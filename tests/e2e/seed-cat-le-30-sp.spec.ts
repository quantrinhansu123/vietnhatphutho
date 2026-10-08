import { expect, test } from '@playwright/test';

/**
 * Seed dữ liệu cắt lẻ: 30 SP (10 Đặc / 10 Sóng / 10 Rỗng) + đơn quy cách
 * + lệnh cắt lẻ + duyệt (sinh phiếu xuất nguồn / nhập TP / nhập thừa)
 * + báo cáo đơn cắt lẻ → đủ dữ liệu cho 2 màn hình Báo cáo & Theo dõi cắt lẻ.
 *
 * Quy ước kho nguồn: Đặc → Kho Đặc; Sóng/Rỗng → Kho Sóng (2 lệnh riêng).
 * Chạy lại an toàn (upsert SP theo ma_sp, bỏ qua bước đã có theo MARK).
 *
 * Yêu cầu: backend Express chạy ở 3001 (`npm run dev`).
 */
const APP = 'http://127.0.0.1:3001';
const MARK = 'PW-CATLE';
const ORDER_CODE = 'PW-CATLE-DH01';
const LENH_DAC = 'PW-CATLE-LENH-DAC';
const LENH_SR = 'PW-CATLE-LENH-SONGRONG';

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const NGAY = todayISO();
const FROM = `${NGAY.slice(0, 7)}-01`;

const LI_LIST = [1.2, 1.6, 2, 3, 4, 5, 6, 8, 10, 12];
const KHO_LIST = [1.22, 1.56, 2.1];
const CUT_LIST = [12, 10, 8, 15, 6, 20, 9, 14, 7, 11];
const DAI_ME = 30;
const QTY_NHAP = 20;
const QTY_CAT = 5;

type SeedProduct = {
  code: string;
  tenSp: string;
  tenSx: string;
  nhom: string;
  kho: string;
  tenGoc: string;
  li: number;
  liToken: string;
  khoRong: number;
  m2: number;
  kg1: number;
  cutLen: number;
  catLiToken: string;
};

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function buildProducts(): SeedProduct[] {
  const groups = [
    { prefix: 'DAC', label: 'đặc', nhom: 'TP; PX Đặc', tenGoc: 'Tấm nhựa đặc', kho: 'Kho Đặc' },
    { prefix: 'SONG', label: 'sóng', nhom: 'TP; PX Sóng', tenGoc: 'Tấm nhựa sóng', kho: 'Kho Sóng' },
    { prefix: 'RONG', label: 'rỗng', nhom: 'TP; PX Rỗng', tenGoc: 'Tấm nhựa rỗng', kho: 'Kho Sóng' }
  ];
  const out: SeedProduct[] = [];
  for (const g of groups) {
    for (let i = 0; i < 10; i += 1) {
      const li = LI_LIST[i];
      const liToken = `${li}li`;
      const khoRong = KHO_LIST[i % KHO_LIST.length];
      const cutLen = CUT_LIST[i];
      // 1/3 số dòng hạ độ li (vd 4li → 2li), còn lại giữ li chỉ cắt ngắn.
      const haLi = i % 3 === 0;
      const catLi = haLi ? LI_LIST[Math.max(0, i - 2)] : li;
      const code = `PW-${g.prefix}-${String(i + 1).padStart(2, '0')}`;
      const m2 = r3(khoRong * DAI_ME);
      const kg1 = r3(m2 * li * 1.13);
      out.push({
        code,
        tenSp: `${g.tenGoc} ${g.label} ${liToken} khổ ${khoRong}m dài ${DAI_ME}m (PW)`,
        tenSx: `${g.tenGoc} ${g.label} ${liToken}*${khoRong}m`,
        nhom: g.nhom,
        kho: g.kho,
        tenGoc: `${g.tenGoc} ${g.label}`,
        li,
        liToken,
        khoRong,
        m2,
        kg1,
        cutLen,
        catLiToken: `${catLi}li`
      });
    }
  }
  return out;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

async function readJson(res: { ok(): boolean; status(): number; json(): Promise<unknown>; text(): Promise<string> }) {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok()) {
    const message = 'error' in data ? text(data.error) : await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status()} ${message}`.trim());
  }
  return data;
}

function numText(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  return String(Math.round(value * 1000) / 1000);
}

/** Dựng dòng báo cáo từ 1 dòng lệnh (giống lineFromLenh ở frontend). */
function toReportLines(lenh: { id: string; ma_lenh: string }, items: Array<Record<string, unknown>>) {
  return items.map((item, index) => {
    const nguon = (item.san_pham_nguon || {}) as Record<string, unknown>;
    const cat = (item.san_pham_cat_1 || {}) as Record<string, unknown>;
    const rest = (item.san_pham_cat_2 || null) as Record<string, unknown> | null;
    const sourceCode = text(nguon.ma_amis || nguon.ma_sp);
    const productName = text(nguon.ten_goc);
    const qtyCat = Number(item.so_luong_cat_1) || 0;
    const piece = (p: Record<string, unknown>, sl: string) => ({
      maAmis: text(p.ma_amis),
      maAmisCu: text(p.ma_amis_cu) || sourceCode,
      tenSanPham: productName,
      tenSanXuat: text(p.ten_sp),
      sl,
      trongLuong: numText(Number(p.kg) || 0),
      m2: numText(Number(p.m2) || 0)
    });
    return {
      key: `pw-${lenh.ma_lenh}-${index}`,
      lenhId: lenh.id,
      maLenh: lenh.ma_lenh,
      amisCode: sourceCode,
      maAmisCu: text(nguon.ma_amis_cu),
      tenSanPham: productName,
      productionName: text(nguon.ten_sp),
      unit: text(nguon.don_vi) || 'Cuộn',
      dai: numText(Number(cat.m_dai) || 0) || text(cat.do_dai_m).replace(/\s*m\s*$/iu, ''),
      doLiDm: text(cat.do_li_dm || nguon.do_li_dm),
      slTong: numText(qtyCat) || numText(Number(nguon.so_luong) || 0),
      tongKg: numText((Number(cat.kg) || 0) * qtyCat),
      ghiChu: text(item.ghi_chu),
      cut: piece(cat, numText(qtyCat)),
      rest: rest
        ? piece(rest, numText(Number(nguon.so_luong) || 0))
        : { maAmis: '', maAmisCu: sourceCode, tenSanPham: productName, tenSanXuat: '', sl: '', trongLuong: '', m2: '' }
    };
  });
}

test('seed 30 SP cắt lẻ Đặc/Sóng/Rỗng + đơn + lệnh + báo cáo', async ({ page, playwright }) => {
  test.setTimeout(300000);
  const api = await playwright.request.newContext();
  const log: string[] = [];
  const products = buildProducts();

  // 0. Đăng nhập UI (giữ session cho bước kiểm tra màn hình cuối).
  await page.goto(`${APP}/`);
  const userInput = page.locator('input[autocomplete="username"]');
  if ((await userInput.count()) > 0) {
    await userInput.fill('itvietnhat2026@gmail.com');
    await page.locator('input[autocomplete="current-password"]').fill('123456');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toHaveCount(0, { timeout: 20000 });
  }

  // 1. Master 30 sản phẩm (bỏ qua mã đã có).
  const spData = await readJson(await api.get(`${APP}/api/san-pham?format=table`));
  const spRows = (Array.isArray(spData.products) ? spData.products : []) as Array<Record<string, unknown>>;
  const existedSp = new Set(spRows.map(r => text(r.ma_sp)));
  let createdSp = 0;
  for (const p of products) {
    if (existedSp.has(p.code)) continue;
    await readJson(
      await api.post(`${APP}/api/san-pham`, {
        data: {
          code: p.code,
          name: p.tenSp,
          productionName: p.tenSx,
          group: p.nhom,
          unit: 'Cuộn',
          amisCode: p.code,
          tenGoc: p.tenGoc,
          doLi: p.liToken,
          doLiDm: `(đm ${p.liToken})`,
          doDayM: `${p.khoRong}m`,
          doDaiM: `${DAI_ME}m`,
          mang: '',
          hangPhe: ''
        }
      })
    );
    createdSp += 1;
  }
  log.push(`san-pham: tạo mới ${createdSp}/30 (đã có ${30 - createdSp})`);

  // 2. Đơn theo quy cách của khách đặt (30 dòng).
  const orderData = await readJson(await api.get(`${APP}/api/don-hang`));
  const orders = (Array.isArray(orderData.orders) ? orderData.orders : []) as Array<Record<string, unknown>>;
  if (!orders.some(o => text(o.ma_don_hang) === ORDER_CODE)) {
    await readJson(
      await api.post(`${APP}/api/don-hang`, {
        data: {
          orderCode: ORDER_CODE,
          orderType: 'Đơn theo quy cách của khách đặt',
          customer: 'PW Khách cắt lẻ',
          note: MARK,
          products: products.map(p => ({
            ma_sp: p.code,
            ten_sp: p.tenSp,
            ten_san_xuat: p.tenSx,
            don_vi: 'Cuộn',
            so_luong_bac: QTY_CAT,
            do_li: p.catLiToken,
            kho: p.khoRong,
            dai_m: p.cutLen,
            ghi_chu: MARK
          }))
        }
      })
    );
    log.push(`don-hang: tạo ${ORDER_CODE} (30 dòng)`);
  } else {
    log.push(`don-hang: ${ORDER_CODE} đã có, bỏ qua`);
  }

  // 3. Tồn nguồn: nhập Kho Đặc (10) + Kho Sóng (20) — bỏ qua nếu lệnh đã tạo.
  const lenhData = await readJson(await api.get(`${APP}/api/lenh-cat-le`));
  const lenhs = (Array.isArray(lenhData.records) ? lenhData.records : []) as Array<Record<string, unknown>>;
  const findLenh = (ma: string) => lenhs.find(l => text(l.ma_lenh) === ma) as unknown as { id: string; ma_lenh: string; trang_thai: string } | undefined;
  let lenhDac = findLenh(LENH_DAC);
  let lenhSr = findLenh(LENH_SR);

  if (!lenhDac && !lenhSr) {
    for (const kho of ['Kho Đặc', 'Kho Sóng']) {
      const lines = products.filter(p => p.kho === kho);
      await readJson(
        await api.post(`${APP}/api/phieu-nhap-kho`, {
          data: {
            loaiPhieu: 'nhap',
            loaiKho: 'san_pham',
            ngayPhieu: NGAY,
            tenKho: kho,
            lyDo: `Nhập nguồn cắt lẻ ${MARK}`,
            ghiChu: MARK,
            items: lines.map(p => ({
              code: p.code,
              name: p.tenSp,
              unit: 'Cuộn',
              quantity: QTY_NHAP,
              unitPrice: 70000,
              weightKg: r3(p.kg1 * QTY_NHAP),
              areaM2: r3(p.m2 * QTY_NHAP),
              productionName: p.tenSx,
              nhom_vthh: p.nhom
            }))
          }
        })
      );
      log.push(`phieu-nhap: ${kho} +${lines.length} mã x ${QTY_NHAP}`);
    }
  } else {
    log.push('phieu-nhap: lệnh đã tồn tại, bỏ qua nhập nguồn');
  }

  // 4. Lệnh cắt lẻ (2 lệnh theo kho nguồn).
  const lenhLine = (p: SeedProduct) => ({
    maSpNguon: p.code,
    tenSpNguon: p.tenSp,
    donVi: 'Cuộn',
    kgNguon: p.kg1,
    m2Nguon: p.m2,
    mDaiNguon: DAI_ME,
    tenGoc: p.tenGoc,
    doLi: p.liToken,
    doLiDm: `(đm ${p.liToken})`,
    doDayM: `${p.khoRong}m`,
    doDaiM: `${DAI_ME}m`,
    mang: '',
    hangPhe: '',
    maAmis: p.code,
    nhomVthh: p.nhom,
    soLuong: QTY_CAT,
    khoRongM: p.khoRong,
    mDaiCat: p.cutLen,
    ...(p.catLiToken !== p.liToken ? { doLiCat: p.catLiToken } : {}),
    ghiChu: MARK
  });
  async function ensureLenh(maLenh: string, khoNguon: string, lines: SeedProduct[]) {
    const existed = findLenh(maLenh);
    if (existed) return existed;
    const created = await readJson(
      await api.post(`${APP}/api/lenh-cat-le`, {
        data: {
          maLenh,
          ngayCat: NGAY,
          khoNguon,
          khoDich: 'Kho thành phẩm',
          nguoiLap: 'PW',
          ghiChu: MARK,
          sanPham: lines.map(lenhLine)
        }
      })
    );
    const record = (created.record || {}) as Record<string, unknown>;
    log.push(`lenh-cat-le: tạo ${maLenh} (${lines.length} dòng)`);
    return { id: text(record.id), ma_lenh: maLenh, trang_thai: 'moi' };
  }
  lenhDac = await ensureLenh(LENH_DAC, 'Kho Đặc', products.filter(p => p.kho === 'Kho Đặc'));
  lenhSr = await ensureLenh(LENH_SR, 'Kho Sóng', products.filter(p => p.kho === 'Kho Sóng'));

  // 5. Duyệt 2 lệnh → sinh phiếu xuất nguồn / nhập TP / nhập thừa.
  for (const lenh of [lenhDac, lenhSr]) {
    if (lenh.trang_thai === 'moi') {
      const done = await readJson(await api.post(`${APP}/api/lenh-cat-le/${lenh.id}/hoan-thanh`, { data: { nguoiLap: 'PW' } }));
      log.push(`duyệt ${lenh.ma_lenh}: xuất ${text(done.ma_phieu_xuat)} / nhập TP ${text(done.ma_phieu_nhap_tp)} / nhập thừa ${text(done.ma_phieu_nhap_thua) || '—'}`);
    } else {
      log.push(`duyệt ${lenh.ma_lenh}: đã ${lenh.trang_thai}, bỏ qua`);
    }
  }

  // 6. Báo cáo đơn cắt lẻ (từ 2 lệnh đã duyệt).
  const baoData = await readJson(await api.get(`${APP}/api/bao-cao-don-cat-le?from=${FROM}&to=${NGAY}`));
  const baoRows = (Array.isArray(baoData.records) ? baoData.records : []) as Array<Record<string, unknown>>;
  const baoExists = baoRows.some(r => text(r.ghi_chu) === MARK);
  if (!baoExists) {
    const fresh = await readJson(await api.get(`${APP}/api/lenh-cat-le`));
    const freshLenhs = (Array.isArray(fresh.records) ? fresh.records : []) as Array<Record<string, unknown>>;
    const reportLines: Array<Record<string, unknown>> = [];
    for (const ma of [LENH_DAC, LENH_SR]) {
      const lenh = freshLenhs.find(l => text(l.ma_lenh) === ma) as unknown as { id: string; ma_lenh: string; san_pham: Array<Record<string, unknown>> } | undefined;
      expect(lenh, `Không thấy lệnh ${ma} để lập báo cáo`).toBeTruthy();
      reportLines.push(...toReportLines({ id: lenh!.id, ma_lenh: lenh!.ma_lenh }, lenh!.san_pham || []));
    }
    expect(reportLines.length).toBe(30);
    await readJson(
      await api.post(`${APP}/api/bao-cao-don-cat-le`, {
        data: {
          ngay: NGAY,
          maLenh: `${LENH_DAC}, ${LENH_SR}`,
          nguoiLap: 'PW',
          ghiChu: MARK,
          sanPham: reportLines
        }
      })
    );
    log.push(`bao-cao: tạo 1 báo cáo (${reportLines.length} SP)`);
  } else {
    log.push('bao-cao: đã có báo cáo PW, bỏ qua');
  }

  // 7. Kiểm tra API 2 màn hình.
  const track = await readJson(await api.get(`${APP}/api/theo-doi-cat-le?from=${FROM}&to=${NGAY}`));
  const trackRows = (Array.isArray(track.records) ? track.records : []) as Array<Record<string, unknown>>;
  const pwRows = trackRows.filter(r => text(r.maHang).startsWith('PW-'));
  expect(pwRows.length, `Theo dõi phải có 30 nhóm mã PW (thấy ${pwRows.length})`).toBe(30);
  const sumTon = pwRows.reduce((s, r) => s + (Number(r.tonCuoiSl ?? r.ton) || 0), 0);
  expect(sumTon > 0, 'Tồn cuối tổng phải > 0').toBeTruthy();
  log.push(`theo-doi: ${pwRows.length} nhóm PW, tồn cuối tổng ${sumTon}`);

  // 8. Kiểm tra UI 2 màn hình hiển thị được.
  await page.goto(`${APP}/theo-doi-cat-le`);
  await page.getByRole('button', { name: /^xem$/i }).click();
  await expect(page.getByText('PW-DAC-01', { exact: false }).first()).toBeVisible({ timeout: 30000 });

  await page.goto(`${APP}/bao-cao-don-cat-le`);
  await page.getByRole('button', { name: /^xem$/i }).click();
  await expect(page.getByText('PW-DAC-01', { exact: false }).first()).toBeVisible({ timeout: 30000 });

  console.log(log.join('\n'));
  await api.dispose();
});
