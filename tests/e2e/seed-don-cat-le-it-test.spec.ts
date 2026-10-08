import { expect, test } from '@playwright/test';

/**
 * Tạo đơn cắt lẻ (~10 SP khác nhau) từ sản phẩm CHÍNH trong danh mục
 * (bỏ qua biến thể cắt: ma_amis_cu phải rỗng), ghi chú đơn = "IT test".
 * Chạy lại an toàn. Yêu cầu backend 3001 đang chạy.
 */
const APP = 'http://127.0.0.1:3001';
const ORDER_CODE = 'DH-ITTEST-CL01';
const NOTE = 'IT test';
const LINE_QTY = 5;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function numOf(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/\s*m\s*$/iu, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function readJson(res: { ok(): boolean; status(): number; json(): Promise<unknown>; text(): Promise<string> }) {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok()) {
    const message = 'error' in data ? text(data.error) : await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status()} ${message}`.trim());
  }
  return data;
}

test('tạo đơn cắt lẻ 10 SP chính, ghi chú IT test', async ({ playwright }) => {
  test.setTimeout(180000);
  const api = await playwright.request.newContext();
  const log: string[] = [];

  // 1. Lấy 10 SP chính đủ quy cách (Đặc/Sóng/Rỗng, có khổ + dài).
  const spData = await readJson(await api.get(`${APP}/api/san-pham?format=table`));
  const all = (Array.isArray(spData.products) ? spData.products : []) as Array<Record<string, unknown>>;
  const mains = all.filter(p => {
    if (text((p as Record<string, unknown>).ma_amis_cu)) return false;
    const nhom = text((p as Record<string, unknown>).nhom_vthh);
    if (!/PX (Đặc|Sóng|Rỗng)/iu.test(nhom)) return false;
    if (!text((p as Record<string, unknown>).ma_sp) || !text((p as Record<string, unknown>).ten_sp)) return false;
    if (numOf((p as Record<string, unknown>).do_day_m) === null) return false;
    if (numOf((p as Record<string, unknown>).do_dai_m) === null) return false;
    return true;
  });
  // 1 mã SP chỉ lấy 1 dòng (danh mục có nhiều dòng trùng mã khác dài).
  const seenCode = new Set<string>();
  const uniques = mains.filter(p => {
    const key = text(p.ma_sp).toLocaleLowerCase('vi');
    if (seenCode.has(key)) return false;
    seenCode.add(key);
    return true;
  });
  // Trộn đều 3 nhóm.
  const byGroup = new Map<string, Array<Record<string, unknown>>>();
  for (const p of uniques) {
    const g = /Đặc/iu.test(text(p.nhom_vthh)) ? 'dac' : /Sóng/iu.test(text(p.nhom_vthh)) ? 'song' : 'rong';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(p);
  }
  const picked: Array<Record<string, unknown>> = [];
  while (picked.length < 10) {
    let added = false;
    for (const g of ['dac', 'song', 'rong']) {
      if (picked.length >= 10) break;
      const next = (byGroup.get(g) || []).find(p => !picked.includes(p));
      if (next) {
        picked.push(next);
        added = true;
      }
    }
    if (!added) break;
  }
  expect(picked.length, `Danh mục phải có ít nhất 10 SP chính đủ quy cách (thấy ${picked.length})`).toBe(10);
  log.push(`chọn: ${picked.map(p => text(p.ma_sp)).join(', ')}`);

  // 2. Tạo đơn (bỏ qua nếu đã có).
  const orderData = await readJson(await api.get(`${APP}/api/don-hang`));
  const orders = (Array.isArray(orderData.orders) ? orderData.orders : []) as Array<Record<string, unknown>>;
  if (!orders.some(o => text(o.ma_don_hang) === ORDER_CODE)) {
    const saved = await readJson(
      await api.post(`${APP}/api/don-hang`, {
        data: {
          orderCode: ORDER_CODE,
          orderType: 'Đơn theo quy cách của khách đặt',
          customer: 'Khách lẻ IT test',
          note: NOTE,
          products: picked.map(p => {
            const li = text(p.do_li).replace(/\s*li\s*$/iu, '');
            return {
              ma_sp: text(p.ma_sp),
              ten_sp: text(p.ten_sp),
              ten_san_xuat: text(p.ten_san_xuat),
              don_vi: text(p.don_vi) || 'Cuộn',
              so_luong_bac: LINE_QTY,
              ...(li ? { do_li: li } : {}),
              kho: numOf(p.do_day_m),
              dai_m: numOf(p.do_dai_m),
              ghi_chu: NOTE
            };
          })
        }
      })
    );
    const order = (saved.order || {}) as Record<string, unknown>;
    log.push(`don-hang: tạo ${text(order.ma_don_hang) || ORDER_CODE} (${picked.length} dòng, ghi chú "${NOTE}")`);
  } else {
    log.push(`don-hang: ${ORDER_CODE} đã có, bỏ qua`);
  }

  // 3. Verify.
  const verify = await readJson(await api.get(`${APP}/api/don-hang`));
  const found = ((Array.isArray(verify.orders) ? verify.orders : []) as Array<Record<string, unknown>>).find(
    o => text(o.ma_don_hang) === ORDER_CODE
  );
  expect(found, `Phải thấy đơn ${ORDER_CODE}`).toBeTruthy();
  const lines = (found!.san_pham || []) as Array<Record<string, unknown>>;
  expect(lines.length, 'Đơn phải có 10 dòng').toBe(10);
  expect(text(found!.ghi_chu), 'Ghi chú đơn phải là IT test').toBe(NOTE);
  const codes = new Set(lines.map(l => text(l.ma_sp)));
  expect(codes.size, '10 dòng phải khác mã nhau').toBe(10);
  log.push(`verify: ${lines.length} dòng khác nhau, ghi chú OK`);

  console.log(log.join('\n'));
  await api.dispose();
});
