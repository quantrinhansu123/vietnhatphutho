import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanNvlDocument, nvlDocumentFetch, nvlIdentityKey, resolveNvlCatalog } from '../../src/utils/nvlDocument';
const catalog = [
  { id: 'a', ma_npl: 'MN01', ten_nvl_sx: 'Phế trắng', ten_kho: 'Kho PC' },
  { id: 'b', ma_npl: 'MN01', ten_nvl_sx: 'Phế trà', ten_kho: 'Kho PC' },
  { id: 'c', ma_npl: 'MN01', ten_nvl_sx: 'Phế trắng', ten_kho: 'Kho chính' }
];

test('removes commercial names from nested mixing snapshots while preserving product/cost names and quantities', () => {
  const before = { ten_sp: 'Tấm trắng', chi_tiet: [{ nvl: [{ ma_nvl: 'MN01', material_id: 'a', ten_nvl: 'old', ten_nvl_san_xuat: 'Phế trắng', khoi_luong: 1.2345 }], nvl_phu: [{ material_id: 'b', ma_nvl: 'MN01', ten_nvl: 'old2', gia_tri: 3 }] }], chi_phi: [{ ten: 'Cước', thanh_tien: 456 }] };
  const next = cleanNvlDocument(before, 'mixing', catalog);
  assert.equal('ten_nvl' in next.chi_tiet[0].nvl[0], false);
  assert.equal(next.chi_tiet[0].nvl[0].khoi_luong, 1.2345);
  assert.equal(next.chi_tiet[0].nvl[0].ten_nvl_san_xuat, 'Phế trắng');
  assert.equal(before.chi_tiet[0].nvl[0].ten_nvl, 'old');
  assert.deepEqual(next.chi_phi, before.chi_phi);
  assert.equal(next.ten_sp, before.ten_sp);
  assert.deepEqual(cleanNvlDocument(next, 'mixing', catalog), next);
});

test('warehouse strips only NVL lines; finished product names survive', () => {
  const next = cleanNvlDocument({ chi_tiet: [
    { ma_hang: 'MN01', ten_hang: 'old', material_id: 'a', ten_nvl_sx: 'Phế trắng' },
    { ma_hang: 'SP01', ten_hang: 'Tấm đặc', loai_danh_muc: 'san_pham', material_id: '' }
  ] }, 'warehouse', catalog);
  assert.equal('ten_hang' in next.chi_tiet[0], false);
  assert.equal(next.chi_tiet[1].ten_hang, 'Tấm đặc');
});

test('ID first; same code with different production names/warehouses cannot collapse', () => {
  assert.notEqual(nvlIdentityKey('a', 'MN01', 'Phế trắng'), nvlIdentityKey('b', 'MN01', 'Phế trà'));
  assert.notEqual(nvlIdentityKey('', 'MN01', 'Phế trắng'), nvlIdentityKey('', 'MN01', 'Phế trà'));
  assert.equal(resolveNvlCatalog({ material_id: 'b', ma_nvl: 'MN01' }, catalog)?.id, 'b');
  assert.throws(() => resolveNvlCatalog({ ma_nvl: 'MN01' }, catalog), /3 dòng/);
  assert.throws(() => resolveNvlCatalog({ ma_nvl: 'MN01', ten_nvl_sx: 'Phế trắng' }, catalog), /2 dòng/);
  assert.equal(resolveNvlCatalog({ ma_nvl: 'MN01', ten_nvl_sx: 'Phế trắng', ten_kho: 'Kho PC' }, catalog)?.id, 'a');
});

test('historical deleted IDs stay historical; new writes reject a missing catalog ID', () => {
  const old = { material_id: 'deleted', ma_nvl: 'MN01', ten_nvl_sx: 'Tên cũ', ten_nvl: 'old' };
  assert.throws(() => cleanNvlDocument(old, 'mixing', catalog), /không còn/);
  assert.equal(cleanNvlDocument(old, 'mixing', catalog, true).material_id, 'deleted');
  assert.equal(cleanNvlDocument(old, 'mixing', catalog, true).ten_nvl_sx, 'Tên cũ');
});

test('movement/history clears relational names only for NVL and keeps lots/money', () => {
  const row = { ma_npl: 'MN01', id_danh_muc: 'a', loai_danh_muc: 'kho_nvl', ten_npl: 'old', ten_nvl_sx: 'Phế trắng', so_luong: 2.3456, don_gia: 1234.56, id_dong_nhap_nguon: 'lot1' };
  const next = cleanNvlDocument(row, 'movement', catalog);
  assert.equal(next.ten_npl, '');
  assert.equal(next.id_danh_muc, 'a');
  assert.equal(next.so_luong, row.so_luong);
  assert.equal(next.don_gia, row.don_gia);
  assert.equal(next.id_dong_nhap_nguon, 'lot1');
  assert.equal('material_id' in next, false);
  const history = cleanNvlDocument({ snapshot_cu: [row], snapshot_moi: [row] }, 'history', catalog);
  assert.equal(history.snapshot_cu[0].ten_npl, '');
  const product = { ma_sp: 'SP', ten_npl: 'Tên thành phẩm', loai_danh_muc: 'san_pham' };
  assert.deepEqual(cleanNvlDocument(product, 'movement', catalog), product);
});

test('transport protects old clients and does not touch catalog writes or reads', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => { requests.push({ url: String(input), init }); return new Response('{}'); };
  const wrapped = nvlDocumentFetch(fetcher, { so_tron: 'mixing' }, async () => catalog);
  const payload = { bang_nvl: [{ material_id: 'a', ma_nvl: 'MN01', ten_nvl: 'legacy', ten_nvl_sx: 'Phế trắng' }] };
  await wrapped('https://example.test/rest/v1/so_tron', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal('ten_nvl' in JSON.parse(String(requests[0].init?.body)).bang_nvl[0], false);
  await wrapped('https://example.test/rest/v1/kho_nvl', { method: 'POST', body: '{"ten_npl":"Danh mục"}' });
  assert.equal(requests[1].init?.body, '{"ten_npl":"Danh mục"}');
  await wrapped('https://example.test/rest/v1/so_tron');
  assert.equal(requests[2].init, undefined);
});
