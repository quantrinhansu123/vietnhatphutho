import 'dotenv/config';
import { expect, test } from '@playwright/test';

/**
 * Xóa toàn bộ dữ liệu seed PW-CATLE:
 * san_pham (PW-*), don_hang, lenh_cat_le, phieu nhap/xuat kho,
 * bao_cao_don_cat_le (+lines cascade), nhap_kho catalog.
 * Chạy lại an toàn.
 */
const URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '').trim();
const T_PRODUCTS = String(process.env.SUPABASE_PRODUCTS_TABLE || 'san_pham');
const T_ORDERS = String(process.env.SUPABASE_ORDERS_TABLE || 'don_hang');

async function sb(api: { fetch: (url: string, opts?: Record<string, unknown>) => Promise<{ status: () => number; text: () => Promise<string> }> }, method: 'GET' | 'DELETE', table: string, query: string) {
  const res = await api.fetch(`${URL}/rest/v1/${table}?${query}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'return=minimal' }
  });
  const body = await res.text().catch(() => '');
  return { status: res.status(), body };
}

test('xóa dữ liệu seed PW-CATLE', async ({ playwright }) => {
  test.setTimeout(180000);
  expect(URL, 'Thiếu SUPABASE_URL').toBeTruthy();
  expect(KEY, 'Thiếu SUPABASE key').toBeTruthy();
  const api = await playwright.request.newContext();
  const log: string[] = [];
  const req = (m: 'GET' | 'DELETE', t: string, q: string) => sb(api, m, t, q);

  async function count(table: string, query: string): Promise<number> {
    const res = await api.fetch(`${URL}/rest/v1/${table}?${query}&select=id`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const data = (await res.json().catch(() => [])) as unknown[];
    return Array.isArray(data) ? data.length : -1;
  }

  // Đếm trước xóa.
  const before: Record<string, number> = {
    san_pham: await count(T_PRODUCTS, 'or=(ma_sp.like.PW-*,ma_amis.like.PW-*)'),
    phieu_nhap: await count('phieu_nhap_kho', 'or=(ghi_chu.ilike.*PW-CATLE*,ly_do.ilike.*PW-CATLE*,ma_sp.like.PW-*)'),
    phieu_xuat: await count('phieu_xuat_kho', 'or=(ghi_chu.ilike.*PW-CATLE*,ly_do.ilike.*PW-CATLE*,ma_sp.like.PW-*)'),
    nhap_kho: await count('nhap_kho', 'ma_sp=like.PW-*')
  };
  log.push(`trước xóa: ${JSON.stringify(before)}`);

  // 1. Phiếu (cả bảng tách + bảng cũ fallback).
  for (const t of ['phieu_nhap_kho', 'phieu_xuat_kho', 'phieu_xuat_nhap_kho']) {
    const r = await req('DELETE', t, 'or=(ghi_chu.ilike.*PW-CATLE*,ly_do.ilike.*PW-CATLE*,ma_sp.like.PW-*)');
    log.push(`del ${t}: HTTP ${r.status}${r.status >= 400 ? ` ${r.body.slice(0, 120)}` : ''}`);
  }
  // 2. Báo cáo (lines cascade theo FK), lệnh, đơn.
  for (const [t, q] of [
    ['bao_cao_don_cat_le', 'ghi_chu=eq.PW-CATLE'],
    ['lenh_cat_le', 'ma_lenh=like.PW-CATLE-*'],
    [T_ORDERS, 'ma_don_hang=eq.PW-CATLE-DH01']
  ] as Array<[string, string]>) {
    const r = await req('DELETE', t, q);
    log.push(`del ${t}: HTTP ${r.status}${r.status >= 400 ? ` ${r.body.slice(0, 120)}` : ''}`);
  }
  // 3. Catalog nhap_kho + master san_pham (cột *_cu có thể chưa migrate → bỏ qua lỗi).
  // nhap_kho: lấy id rồi xóa theo lô (tránh lỗi 400 với filter like).
  const nkIdsRes = await api.fetch(`${URL}/rest/v1/nhap_kho?or=(ma_sp.like.PW-*,ma_sp_cu.like.PW-*)&select=id`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  if (nkIdsRes.ok()) {
    const nkIds = ((await nkIdsRes.json().catch(() => [])) as Array<{ id: string }>).map(r => r.id).filter(Boolean);
    log.push(`nhap_kho PW ids: ${nkIds.length}`);
    for (let i = 0; i < nkIds.length; i += 50) {
      const batch = nkIds.slice(i, i + 50).join(',');
      const r = await req('DELETE', 'nhap_kho', `id=in.(${batch})`);
      if (r.status >= 400) log.push(`del nhap_kho batch: HTTP ${r.status} ${r.body.slice(0, 200)}`);
    }
  } else {
    const t = await nkIdsRes.text().catch(() => '');
    log.push(`select nhap_kho ids: HTTP ${nkIdsRes.status()} ${t.slice(0, 200)}`);
  }
  for (const q of ['or=(ma_sp.like.PW-*,ma_amis.like.PW-*)', 'ma_amis_cu.like.PW-*']) {
    const r = await req('DELETE', T_PRODUCTS, q);
    log.push(`del ${T_PRODUCTS} [${q}]: HTTP ${r.status}`);
  }

  // Đếm sau xóa.
  const after: Record<string, number> = {
    san_pham: await count(T_PRODUCTS, 'or=(ma_sp.like.PW-*,ma_amis.like.PW-*)'),
    phieu_nhap: await count('phieu_nhap_kho', 'or=(ghi_chu.ilike.*PW-CATLE*,ly_do.ilike.*PW-CATLE*,ma_sp.like.PW-*)'),
    phieu_xuat: await count('phieu_xuat_kho', 'or=(ghi_chu.ilike.*PW-CATLE*,ly_do.ilike.*PW-CATLE*,ma_sp.like.PW-*)'),
    nhap_kho: await count('nhap_kho', 'ma_sp=like.PW-*'),
    lenh: await count('lenh_cat_le', 'ma_lenh=like.PW-CATLE-*'),
    bao_cao: await count('bao_cao_don_cat_le', 'ghi_chu=eq.PW-CATLE')
  };
  log.push(`sau xóa: ${JSON.stringify(after)}`);
  console.log(log.join('\n'));

  expect(after.san_pham).toBe(0);
  expect(after.phieu_nhap).toBe(0);
  expect(after.phieu_xuat).toBe(0);
  expect(after.nhap_kho).toBe(0);
  expect(after.lenh).toBe(0);
  expect(after.bao_cao).toBe(0);
  await api.dispose();
});
