import { expect, test, type APIRequestContext } from '@playwright/test';

const APP = 'http://127.0.0.1:3001';
const FROM = '2026-10-01';
const TO = '2026-10-31';
const MARK = 'PW-T10-TRA-NCC';
const LOAI_XUAT = 'Xuất cho trả lại Nhà cung cấp (hàng không đúng quy cách, chất lượng)';
const LOAI_NHAP = 'Nhập kho từ Nhà cung cấp';
const DATES = ['2026-10-06', '2026-10-10', '2026-10-14', '2026-10-20', '2026-10-27'];

type Supplier = { id: string; ten: string };
type Material = { code: string; name: string; sx: string; unit: string; kho: string };

async function readJson(res: { ok: () => boolean; status: () => number; json: () => Promise<unknown>; text: () => Promise<string> }) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok()) {
    const message = data && typeof data === 'object' && 'error' in data ? String((data as { error?: unknown }).error) : await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status()} ${message}`);
  }
  return data as Record<string, unknown>;
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

async function tonOf(api: APIRequestContext, code: string, kho: string) {
  const res = await api.get(`${APP}/api/xuat-nhap-tong-hop/ton?ma_hang=${encodeURIComponent(code)}&ten_kho=${encodeURIComponent(kho)}&catalog=nvl`);
  const data = await readJson(res);
  return Number(data.ton) || 0;
}

test('tạo phiếu xuất trả NCC tháng 10 cho 5 nhà cung cấp', async ({ page, playwright }) => {
  test.setTimeout(180000);
  const api = await playwright.request.newContext();

  await page.goto(`${APP}/`);
  const userInput = page.locator('input[autocomplete="username"]');
  if ((await userInput.count()) > 0) {
    await userInput.fill('itvietnhat2026@gmail.com');
    await page.locator('input[autocomplete="current-password"]').fill('123456');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toHaveCount(0, { timeout: 20000 });
  }

  const nccData = await readJson(await api.get(`${APP}/api/nha-cung-cap`));
  const nccRows = (Array.isArray(nccData.suppliers) ? nccData.suppliers : Array.isArray(nccData.records) ? nccData.records : []) as Array<Record<string, unknown>>;
  const suppliers: Supplier[] = nccRows
    .map(row => {
      const id = text(row.ma_nha_cung_cap ?? row.id);
      const ten = text(row.ten_nha_cung_cap);
      return id ? { id, ten: ten || id } : null;
    })
    .filter((item): item is Supplier => Boolean(item))
    .slice(0, 5);
  expect(suppliers.length, 'Cần ít nhất 1 nhà cung cấp trong danh mục').toBeGreaterThan(0);

  const nvlData = await readJson(await api.get(`${APP}/api/kho-nvl`));
  const nvlRows = (Array.isArray(nvlData.materials) ? nvlData.materials : []) as Array<Record<string, unknown>>;
  const materials: Material[] = nvlRows
    .map(row => ({
      code: text(row.ma_npl),
      name: text(row.ten_npl),
      sx: text(row.ten_nvl_sx),
      unit: text(row.don_vi) || 'kg',
      kho: text(row.ten_kho)
    }))
    .filter(item => item.code && item.name && item.kho);
  const khoChinh = materials.find(item => item.kho.toLocaleLowerCase('vi').includes('nvl chính'))?.kho
    || materials.find(item => item.kho.toLocaleLowerCase('vi').includes('nvl'))?.kho
    || '';
  expect(khoChinh, 'Cần kho NVL có hàng').not.toBe('');
  const pool = materials.filter(item => item.kho === khoChinh);
  expect(pool.length, `Kho ${khoChinh} chưa có NVL`).toBeGreaterThan(0);

  const existing = await readJson(await api.get(`${APP}/api/xuat-nhap-tong-hop?from=${FROM}&to=${TO}&limit=2000`));
  const records = (Array.isArray(existing.records) ? existing.records : []) as Array<Record<string, unknown>>;
  const done = new Set(
    records
      .filter(row => text(row.loai) === 'xuat' && text(row.ghi_chu).includes(MARK) && text(row.trang_thai) !== 'huy')
      .map(row => text(row.ghi_chu))
  );

  const created: string[] = [];
  for (let index = 0; index < suppliers.length; index += 1) {
    const supplier = suppliers[index];
    const note = `${MARK} ${supplier.id}`;
    if ([...done].some(item => item.includes(supplier.id))) {
      created.push(`${supplier.id} đã có phiếu, bỏ qua`);
      continue;
    }
    const ngay = DATES[index % DATES.length];
    const first = pool[index % pool.length];
    const second = pool[(index + 1) % pool.length];
    const picks = second.code === first.code ? [first] : [first, second];
    const qty = [4, 2];

    for (let lineIndex = 0; lineIndex < picks.length; lineIndex += 1) {
      const item = picks[lineIndex];
      const need = qty[lineIndex] || 2;
      const ton = await tonOf(api, item.code, khoChinh);
      if (ton + 1e-9 >= need) continue;
      const nhap = await api.post(`${APP}/api/xuat-nhap-tong-hop`, {
        data: {
          loai: 'nhap',
          ngay,
          nguon_loai: 'ncc',
          nguon_id: supplier.id,
          loai_nhap: LOAI_NHAP,
          ghi_chu: `${MARK} nhap bu ${supplier.id} ${item.code}`,
          dia_diem: 'Phú Thọ',
          ly_do: 'Nhập bù tồn để xuất trả nhà cung cấp (Playwright tháng 10)',
          lines: [{
            ma_hang: item.code,
            ten_hang: item.name,
            ten_nvl_sx: item.sx,
            don_vi: item.unit,
            so_luong: 30,
            don_gia: 12000,
            quy_doi_kg: 30,
            kho_dong: khoChinh,
            phan_loai_nvl: 'nvl_chinh',
            chi_phi_kem_theo: [{ ten: 'Vận chuyển', don_gia: 150000, thanh_tien: 150000 }]
          }]
        }
      });
      await readJson(nhap);
    }

    const xuat = await api.post(`${APP}/api/xuat-nhap-tong-hop`, {
      data: {
        loai: 'xuat',
        ngay,
        loai_xuat: LOAI_XUAT,
        ghi_chu: note,
        dia_diem: 'Phú Thọ',
        ly_do: 'Xuất trả nhà cung cấp hàng không đúng quy cách (Playwright tháng 10)',
        lines: picks.map((item, lineIndex) => ({
          ma_hang: item.code,
          ten_hang: item.name,
          ten_nvl_sx: item.sx,
          don_vi: item.unit,
          so_luong: qty[lineIndex] || 2,
          don_gia: 12000,
          quy_doi_kg: qty[lineIndex] || 2,
          src_loai: 'kho',
          src_id: khoChinh,
          src_ten: khoChinh,
          dich_dong_loai: 'ncc',
          dich_dong_id: supplier.id,
          phan_loai_nvl: 'nvl_chinh'
        }))
      }
    });
    const saved = await readJson(xuat);
    const record = (saved.record && typeof saved.record === 'object' ? saved.record : {}) as Record<string, unknown>;
    created.push(`${text(record.ma_phieu_chung) || 'phiếu'} · ${ngay} · ${supplier.id} ${supplier.ten} · xuất từ ${khoChinh}`);
  }

  console.log(created.join('\n'));
  expect(created.length).toBe(suppliers.length);
  await api.dispose();
});
