import { expect, test } from '@playwright/test';

const APP = 'http://127.0.0.1:3001';
const FROM = '2026-10-01';
const TO = '2026-10-31';
const MARK = 'PW-T10-NHAP-UI';
const LOAI_NHAP = 'Nhập kho từ Nhà cung cấp';
const NCC_NEEDLE = 'ấn hồng';
const DATES = ['2026-10-05', '2026-10-09', '2026-10-15', '2026-10-21', '2026-10-28'];

const LINES = [
  {
    ma_hang: 'MN04',
    ten_hang: 'Hạt nhựa tái chế tạo thành từ phế cái mua ngoài',
    ten_nvl_sx: 'Hạt trắng cuống test',
    don_vi: 'kg',
    don_gia: 15000,
    kho_dong: 'Kho NVL chính',
    phan_loai_nvl: 'nvl_chinh'
  },
  {
    ma_hang: 'HM01',
    ten_hang: 'Hạt màu trắng sứ',
    ten_nvl_sx: 'Hạt màu trắng sứ Hà Nội Hải Phòng B',
    don_vi: 'kg',
    don_gia: 10000,
    kho_dong: 'Kho NVL phụ',
    phan_loai_nvl: 'nvl_chinh'
  },
  {
    ma_hang: 'MN03',
    ten_hang: 'Hạt nhựa mua ngoài tổng hợp',
    ten_nvl_sx: 'Hạt trà phúc - Hưng yên',
    don_vi: 'kg',
    don_gia: 500000,
    kho_dong: 'Kho NVL chính',
    phan_loai_nvl: 'nvl_chinh'
  },
  {
    ma_hang: 'MN03',
    ten_hang: 'Hạt nhựa mua ngoài tổng hợp',
    ten_nvl_sx: 'Hạt trắng G1011 Hưng Yên Hải Phòng',
    don_vi: 'kg',
    don_gia: 30001,
    kho_dong: 'Kho NVL chính',
    phan_loai_nvl: 'nvl_chinh'
  }
];

function text(value: unknown) {
  return String(value ?? '').trim();
}

function fold(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi');
}

async function readJson(res: { ok: () => boolean; status: () => number; json: () => Promise<unknown>; text: () => Promise<string> }) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok()) {
    const message = data && typeof data === 'object' && 'error' in data ? String((data as { error?: unknown }).error) : await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status()} ${message}`);
  }
  return data as Record<string, unknown>;
}

test('nhập 4 tên sản xuất hạt ở 5 ngày tháng 10 cho Ấn Hồng', async ({ page, playwright }) => {
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
  const supplier = nccRows
    .map(row => {
      const id = text(row.ma_nha_cung_cap ?? row.id);
      const ten = text(row.ten_nha_cung_cap);
      return { id, ten };
    })
    .find(item => fold(`${item.id} ${item.ten}`).includes(fold(NCC_NEEDLE)));
  expect(supplier, 'Không thấy nhà cung cấp Ấn Hồng').toBeTruthy();

  const existing = await readJson(await api.get(`${APP}/api/xuat-nhap-tong-hop?from=${FROM}&to=${TO}&limit=2000`));
  const records = (Array.isArray(existing.records) ? existing.records : []) as Array<Record<string, unknown>>;
  const doneDates = new Set(
    records
      .filter(row => text(row.loai) === 'nhap' && text(row.ghi_chu).includes(MARK) && text(row.trang_thai) !== 'huy')
      .map(row => text(row.ngay).slice(0, 10))
  );

  const created: string[] = [];
  for (let dayIndex = 0; dayIndex < DATES.length; dayIndex += 1) {
    const ngay = DATES[dayIndex];
    if (doneDates.has(ngay)) {
      created.push(`${ngay} đã có phiếu, bỏ qua`);
      continue;
    }
    const qtyBase = 5 + dayIndex * 3;
    const saved = await readJson(await api.post(`${APP}/api/xuat-nhap-tong-hop`, {
      data: {
        loai: 'nhap',
        ngay,
        nguon_loai: 'ncc',
        nguon_id: supplier!.id,
        loai_nhap: LOAI_NHAP,
        ghi_chu: `${MARK} ${ngay}`,
        dia_diem: 'Phú Thọ',
        ly_do: 'Nhập kiểm tra giao diện tổng hợp NVL tháng 10',
        lines: LINES.map((line, lineIndex) => {
          const soLuong = qtyBase + lineIndex;
          return {
            ...line,
            so_luong: soLuong,
            quy_doi_kg: soLuong
          };
        })
      }
    }));
    const record = (saved.record && typeof saved.record === 'object' ? saved.record : {}) as Record<string, unknown>;
    created.push(`${text(record.ma_phieu_chung) || 'phiếu'} · ${ngay} · ${supplier!.id}`);
  }

  console.log(created.join('\n'));
  expect(created.length).toBe(DATES.length);
  await api.dispose();
});
