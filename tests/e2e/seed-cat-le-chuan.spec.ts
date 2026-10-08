import { expect, test } from '@playwright/test';

/**
 * Seed 3 case cắt lẻ CHUẨN (1 Đặc + 1 Sóng + 1 Rỗng) bao đủ quy cách đúng:
 * - Đặc: cắt ngắn + tem 2 đầu (mã mới có hậu tố TEM/MVCC/2DAU)
 * - Sóng: xẻ khổ giữ dài
 * - Rỗng: hạ độ li giữ khổ/dài
 * Luồng: master SP → đơn quy cách → nhập tồn nguồn (Kho Đặc/Kho Sóng)
 * → lệnh cắt lẻ → duyệt (xuất nguồn, nhập cắt+thừa về kho nguồn)
 * → kiểm tra Báo cáo + Theo dõi + mã cũ quy về gốc.
 * Chạy lại an toàn. Yêu cầu backend 3001 đang chạy.
 */
const APP = 'http://127.0.0.1:3001';
const MARK = 'PW-CASE';
const ORDER_CODE = 'PW-CASE-DH01';
const LENH_DAC = 'PW-CASE-LENH-DAC';
const LENH_SR = 'PW-CASE-LENH-SR';

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const NGAY = todayISO();
const FROM = `${NGAY.slice(0, 7)}-01`;
const QTY_NHAP = 20;
const QTY_CAT = 5;

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

type CaseProduct = {
  code: string;
  tenSp: string;
  tenSx: string;
  nhom: string;
  kho: string;
  tenGoc: string;
  liToken: string;
  khoRong: number;
  daiMe: number;
  m2: number;
  kg1: number;
  cutLen: number;
  cutKho: number;
  doLiCat?: string;
  tem?: string;
  mauTem?: string;
  danTem2Dau?: boolean;
};

const PRODUCTS: CaseProduct[] = [
  {
    code: 'PW-CASE-DAC01',
    tenSp: 'Tấm nhựa đặc chuẩn 5li khổ 1.56m dài 30m (PW)',
    tenSx: 'Tấm nhựa đặc chuẩn 5li*1.56m',
    nhom: 'TP; PX Đặc',
    kho: 'Kho Đặc',
    tenGoc: 'Tấm nhựa đặc chuẩn',
    liToken: '5li',
    khoRong: 1.56,
    daiMe: 30,
    m2: r3(1.56 * 30),
    kg1: r3(1.56 * 30 * 5 * 1.13),
    cutLen: 11.7,
    cutKho: 1.56,
    tem: '2.5li',
    mauTem: 'Hồng',
    danTem2Dau: true
  },
  {
    code: 'PW-CASE-SONG01',
    tenSp: 'Tấm nhựa sóng chuẩn 3li khổ 2.1m dài 30m (PW)',
    tenSx: 'Tấm nhựa sóng chuẩn 3li*2.1m',
    nhom: 'TP; PX Sóng',
    tenGoc: 'Tấm nhựa sóng chuẩn',
    liToken: '3li',
    khoRong: 2.1,
    daiMe: 30,
    m2: r3(2.1 * 30),
    kg1: r3(2.1 * 30 * 3 * 1.13),
    cutLen: 30,
    cutKho: 1.05,
    kho: 'Kho Sóng'
  },
  {
    code: 'PW-CASE-RONG01',
    tenSp: 'Tấm nhựa rỗng chuẩn 4li khổ 1.22m dài 30m (PW)',
    tenSx: 'Tấm nhựa rỗng chuẩn 4li*1.22m',
    nhom: 'TP; PX Rỗng',
    tenGoc: 'Tấm nhựa rỗng chuẩn',
    liToken: '4li',
    khoRong: 1.22,
    daiMe: 30,
    m2: r3(1.22 * 30),
    kg1: r3(1.22 * 30 * 4 * 1.13),
    cutLen: 30,
    cutKho: 1.22,
    doLiCat: '3li',
    kho: 'Kho Sóng'
  }
];

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

test('seed 3 case cắt lẻ chuẩn Đặc/Sóng/Rỗng', async ({ page, playwright }) => {
  test.setTimeout(300000);
  const api = await playwright.request.newContext();
  const log: string[] = [];

  await page.goto(`${APP}/`);
  const userInput = page.locator('input[autocomplete="username"]');
  if ((await userInput.count()) > 0) {
    await userInput.fill('itvietnhat2026@gmail.com');
    await page.locator('input[autocomplete="current-password"]').fill('123456');
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await expect(page.getByRole('button', { name: /đăng nhập/i })).toHaveCount(0, { timeout: 20000 });
  }

  // 1. Master SP.
  const spData = await readJson(await api.get(`${APP}/api/san-pham?format=table`));
  const spRows = (Array.isArray(spData.products) ? spData.products : []) as Array<Record<string, unknown>>;
  const existedSp = new Set(spRows.map(r => text(r.ma_sp)));
  let createdSp = 0;
  for (const p of PRODUCTS) {
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
          doDaiM: `${p.daiMe}m`,
          mang: '',
          hangPhe: ''
        }
      })
    );
    createdSp += 1;
  }
  log.push(`san-pham: tạo mới ${createdSp}/3`);

  // 2. Đơn quy cách.
  const orderData = await readJson(await api.get(`${APP}/api/don-hang`));
  const orders = (Array.isArray(orderData.orders) ? orderData.orders : []) as Array<Record<string, unknown>>;
  if (!orders.some(o => text(o.ma_don_hang) === ORDER_CODE)) {
    await readJson(
      await api.post(`${APP}/api/don-hang`, {
        data: {
          orderCode: ORDER_CODE,
          orderType: 'Đơn theo quy cách của khách đặt',
          customer: 'PW Khách cắt lẻ chuẩn',
          note: MARK,
          products: PRODUCTS.map(p => ({
            ma_sp: p.code,
            ten_sp: p.tenSp,
            ten_san_xuat: p.tenSx,
            don_vi: 'Cuộn',
            so_luong_bac: QTY_CAT,
            do_li: p.doLiCat || p.liToken,
            kho: p.cutKho,
            dai_m: p.cutLen,
            ...(p.tem ? { tem: p.tem, mau_tem: p.mauTem, dan_tem_2_dau: p.danTem2Dau ? 1 : 0 } : {}),
            ghi_chu: MARK
          }))
        }
      })
    );
    log.push(`don-hang: tạo ${ORDER_CODE} (3 dòng)`);
  } else {
    log.push(`don-hang: ${ORDER_CODE} đã có, bỏ qua`);
  }

  // 3. Tồn nguồn + lệnh (bỏ qua nếu lệnh đã có).
  const lenhData = await readJson(await api.get(`${APP}/api/lenh-cat-le`));
  const lenhs = (Array.isArray(lenhData.records) ? lenhData.records : []) as Array<Record<string, unknown>>;
  const findLenh = (ma: string) =>
    lenhs.find(l => text(l.ma_lenh) === ma) as unknown as { id: string; ma_lenh: string; trang_thai: string } | undefined;
  let lenhDac = findLenh(LENH_DAC);
  let lenhSr = findLenh(LENH_SR);

  if (!lenhDac && !lenhSr) {
    for (const kho of ['Kho Đặc', 'Kho Sóng']) {
      const lines = PRODUCTS.filter(p => p.kho === kho);
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

  const lenhLine = (p: CaseProduct) => ({
    maSpNguon: p.code,
    tenSpNguon: p.tenSp,
    donVi: 'Cuộn',
    kgNguon: p.kg1,
    m2Nguon: p.m2,
    mDaiNguon: p.daiMe,
    tenGoc: p.tenGoc,
    doLi: p.liToken,
    doLiDm: `(đm ${p.liToken})`,
    doDayM: `${p.khoRong}m`,
    doDaiM: `${p.daiMe}m`,
    mang: '',
    hangPhe: '',
    maAmis: p.code,
    nhomVthh: p.nhom,
    soLuong: QTY_CAT,
    khoRongM: p.cutKho,
    mDaiCat: p.cutLen,
    ...(p.doLiCat ? { doLiCat: p.doLiCat } : {}),
    ...(p.tem ? { tem: p.tem, mauTem: p.mauTem, danTem2Dau: p.danTem2Dau } : {}),
    ghiChu: MARK
  });
  async function ensureLenh(maLenh: string, khoNguon: string, lines: CaseProduct[]) {
    const existed = findLenh(maLenh);
    if (existed) return existed;
    const created = await readJson(
      await api.post(`${APP}/api/lenh-cat-le`, {
        data: {
          maLenh,
          ngayCat: NGAY,
          khoNguon,
          khoDich: khoNguon,
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
  lenhDac = await ensureLenh(LENH_DAC, 'Kho Đặc', PRODUCTS.filter(p => p.kho === 'Kho Đặc'));
  lenhSr = await ensureLenh(LENH_SR, 'Kho Sóng', PRODUCTS.filter(p => p.kho === 'Kho Sóng'));

  for (const lenh of [lenhDac, lenhSr]) {
    if (lenh.trang_thai === 'moi') {
      const done = await readJson(await api.post(`${APP}/api/lenh-cat-le/${lenh.id}/hoan-thanh`, { data: { nguoiLap: 'PW' } }));
      log.push(`duyệt ${lenh.ma_lenh}: xuất ${text(done.ma_phieu_xuat)} / nhập ${text(done.ma_phieu_nhap_tp)} + ${text(done.ma_phieu_nhap_thua) || '—'}`);
    } else {
      log.push(`duyệt ${lenh.ma_lenh}: đã ${lenh.trang_thai}, bỏ qua`);
    }
  }

  // 4. Verify mã cũ quy về gốc + mã tem + kho nhập.
  const fresh = await readJson(await api.get(`${APP}/api/lenh-cat-le`));
  const freshLenhs = (Array.isArray(fresh.records) ? fresh.records : []) as Array<Record<string, unknown>>;
  for (const p of PRODUCTS) {
    const host = freshLenhs.find(l => text(l.ma_lenh) === (p.kho === 'Kho Đặc' ? LENH_DAC : LENH_SR)) as unknown as {
      san_pham: Array<Record<string, unknown>>;
    };
    const item = (host.san_pham || []).find(it => {
      const nguon = (it.san_pham_nguon || {}) as Record<string, unknown>;
      return text(nguon.ma_sp) === p.code;
    });
    expect(item, `Không thấy dòng ${p.code} trong lệnh`).toBeTruthy();
    const cat = ((item as Record<string, unknown>).san_pham_cat_1 || {}) as Record<string, unknown>;
    expect(text(cat.ma_amis_cu), `ma_amis_cu của ${p.code} phải về gốc`).toBe(p.code);
    expect(text(cat.ma_amis).length > p.code.length, `${p.code} phải sinh mã mới`).toBeTruthy();
    if (p.code === 'PW-CASE-DAC01') {
      expect(text(cat.ma_amis).includes('2DAU'), 'Mã Đặc phải có hậu tố tem 2DAU').toBeTruthy();
      const slip = await readJson(await api.get(`${APP}/api/phieu-nhap-kho?ma_sp=${encodeURIComponent(text(cat.ma_amis))}&from=${FROM}`));
      const moves = (Array.isArray(slip.movements) ? slip.movements : []) as Array<Record<string, unknown>>;
      expect(moves.length > 0, 'Phải có phiếu nhập mã cắt').toBeTruthy();
      expect(text(moves[0].ten_kho), 'Nhập cắt phải về Kho Đặc').toBe('Kho Đặc');
      log.push(`case Đặc: ${text(cat.ma_amis)} @ ${text(moves[0].ten_kho)}`);
    }
  }

  // 5. Verify 2 màn hình.
  const track = await readJson(await api.get(`${APP}/api/theo-doi-cat-le?from=${FROM}&to=${NGAY}`));
  const trackRows = (Array.isArray(track.records) ? track.records : []) as Array<Record<string, unknown>>;
  const pwTrack = trackRows.filter(r => text(r.maHang).startsWith('PW-CASE'));
  expect(pwTrack.length, 'Theo dõi phải có 3 nhóm PW-CASE').toBe(3);
  for (const r of pwTrack) {
    expect(Number(r.tonCuoi ?? r.ton) > 0, `Tồn ${text(r.maHang)} phải > 0`).toBeTruthy();
  }
  const nhomSet = new Set(pwTrack.map(r => text(r.nhomVthh)));
  expect(nhomSet.has('dac') && nhomSet.has('song') && nhomSet.has('rong'), 'Đủ 3 nhóm VTHH').toBeTruthy();
  log.push(`theo-doi: 3 nhóm, tồn ${pwTrack.map(r => `${text(r.maHang)}=${r.tonCuoi ?? r.ton}`).join(', ')}`);

  const tong = await readJson(await api.get(`${APP}/api/bao-cao-cat-le-tong-hop?from=${FROM}&to=${NGAY}`));
  const tongRows = (Array.isArray(tong.records) ? tong.records : []) as Array<Record<string, unknown>>;
  const pwTong = tongRows.filter(r => text(r.maHang).startsWith('PW-CASE'));
  expect(pwTong.length, 'Báo cáo phải có 3 nhóm PW-CASE').toBe(3);
  for (const r of pwTong) {
    expect(text(r.tenHang).length > 0, `Tên hàng ${text(r.maHang)} không rỗng`).toBeTruthy();
    expect(Number(r.cuoiSl) > 0, `Cuối kỳ ${text(r.maHang)} phải > 0`).toBeTruthy();
  }
  log.push('bao-cao: 3 nhóm, tên hàng + cuối kỳ OK');

  // 6. UI.
  await page.goto(`${APP}/cat-le`);
  await expect(page.getByText('Lệnh cắt lẻ', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.goto(`${APP}/lenh-cat-le`);
  await expect(page.getByText(LENH_DAC, { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await page.goto(`${APP}/theo-doi-cat-le`);
  await page.getByRole('button', { name: /^xem$/i }).click();
  await expect(page.getByText('PW-CASE-DAC01', { exact: false }).first()).toBeVisible({ timeout: 30000 });
  await page.goto(`${APP}/bao-cao-don-cat-le`);
  await page.getByRole('button', { name: /^xem$/i }).click();
  await expect(page.getByText('PW-CASE-DAC01', { exact: false }).first()).toBeVisible({ timeout: 30000 });

  console.log(log.join('\n'));
  await api.dispose();
});
