/** Document snapshots keep the production name; the commercial name belongs to kho_nvl only. */
export type NvlDocumentKind = 'mixing' | 'warehouse' | 'movement' | 'history';
type Row = Record<string, unknown>;
const text = (v: unknown) => String(v ?? '').trim();
const norm = (v: unknown) => text(v).replace(/\s+/g, ' ').toLocaleLowerCase('vi');
export type NvlCatalogRef = { id: string; ma_npl: string; ten_nvl_sx?: string; ten_kho?: string };
export class NvlIdentityError extends Error {}

export function nvlIdentityKey(id: unknown, code: unknown, productionName: unknown) {
  return text(id) ? `id:${norm(id)}` : `code:${JSON.stringify([norm(code), norm(productionName)])}`;
}

export function resolveNvlCatalog(line: Row, catalog: NvlCatalogRef[], historical = false): NvlCatalogRef | undefined {
  const id = text(line.material_id ?? line.materialId ?? line.id_danh_muc);
  if (id) {
    const hit = catalog.find(item => item.id === id);
    if (hit) return hit;
    // A historical snapshot keeps its recorded identity even after catalog replacement/deletion.
    // Do not silently remap it to a newly imported row having the same code.
    if (historical) return { id, ma_npl: text(line.ma_nvl ?? line.ma_hang ?? line.ma_npl), ten_nvl_sx: text(line.ten_nvl_san_xuat ?? line.ten_nvl_sx) };
    throw new NvlIdentityError(`ID vật liệu ${id} không còn trong danh mục; cần chọn lại NVL.`);
  }
  const code = norm(line.ma_nvl ?? line.maNvl ?? line.ma_hang ?? line.ma_npl);
  const sx = norm(line.ten_nvl_san_xuat ?? line.ten_nvl_sx ?? line.tenNvlSanXuat ?? line.productionName);
  const kho = norm(line.ten_kho ?? line.kho_dong_ten);
  if (!code) throw new NvlIdentityError('Dòng NVL thiếu mã và ID; cần chọn lại vật liệu trước khi bỏ tên.');
  const hits = catalog.filter(item => norm(item.ma_npl) === code && (!sx || norm(item.ten_nvl_sx) === sx) && (!kho || norm(item.ten_kho) === kho));
  // A code may appear in several warehouses. Only an exact, unique catalog row is an ID.
  if (hits.length !== 1) throw new NvlIdentityError(`NVL ${code}: tìm thấy ${hits.length} dòng danh mục; cần chọn ID/kho/tên sản xuất chính xác.`);
  return hits[0];
}

const removed = new Set(['ten_nvl', 'tenNvl', 'ten_nguyen_vat_lieu', 'tenNguyenVatLieu', 'materialName']);
const isMaterial = (v: Row) => ['ma_nvl', 'maNvl', 'material_id', 'materialId', 'kho_nvl_id'].some(k => k in v);

/** Pure, non-mutating and idempotent; product/staff/cost names are deliberately untouched. */
export function cleanNvlDocument<T>(value: T, kind: NvlDocumentKind = 'mixing', catalog?: NvlCatalogRef[], historical = false): T {
  const visit = (input: unknown, warehouseLine = false, rootRecord = true): unknown => {
    if (Array.isArray(input)) return input.map(item => visit(item, warehouseLine, rootRecord));
    if (!input || typeof input !== 'object') return input;
    const raw = input as Row;
    const nvlMovement = ['movement', 'history'].includes(kind) && (raw.loai_danh_muc === 'kho_nvl' || (Boolean(text(raw.ma_npl)) && !text(raw.ma_sp) && raw.loai_danh_muc !== 'san_pham'));
    const material = raw.loai_danh_muc !== 'san_pham' && (isMaterial(raw) || warehouseLine || nvlMovement);
    const result: Row = {};
    for (const [key, child] of Object.entries(raw)) {
      if (removed.has(key)) continue;
      if (material && ['ten_hang', 'tenHang', 'ten_npl'].includes(key)) continue;
      // In a mixed warehouse history only the NVL leg loses its name.
      result[key] = visit(child, kind === 'warehouse' && ['chi_tiet', 'lines'].includes(key), false);
    }
    const hasIdentity = ['material_id', 'materialId', 'id_danh_muc', 'ma_nvl', 'maNvl', 'ma_hang', 'ma_npl'].some(k => text(raw[k]));
    if (material && catalog && hasIdentity) {
      const hit = resolveNvlCatalog(raw, catalog, historical);
      if (hit) {
        if (nvlMovement) result.id_danh_muc = hit.id;
        else if (!rootRecord || 'material_id' in raw) result.material_id = hit.id;
        const sxKey = 'ten_nvl_san_xuat' in raw ? 'ten_nvl_san_xuat' : 'ten_nvl_sx';
        if (!text(result[sxKey]) && text(hit.ten_nvl_sx)) result[sxKey] = hit.ten_nvl_sx;
      }
    }
    // Legacy SQL columns remain in the schema; clear their value without dropping mixed-use columns.
    if (nvlMovement && 'ten_npl' in raw) result.ten_npl = '';
    if (rootRecord && material && 'ten_hang' in raw) result.ten_hang = '';
    if (!material && 'ten_nvl' in raw) result.ten_nvl = null;
    return result;
  };
  return visit(value) as T;
}

export const serializeNvlDocument = (value: unknown, kind: NvlDocumentKind = 'mixing') => JSON.stringify(cleanNvlDocument(value, kind));

/** Transport boundary also protects older clients and every generated warehouse leg/history snapshot. */
export function nvlDocumentFetch(
  fetcher: typeof fetch,
  tables: Record<string, NvlDocumentKind>,
  catalog: () => Promise<NvlCatalogRef[]>
): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const table = decodeURIComponent(new URL(url).pathname.split('/rest/v1/')[1] || '');
    const kind = tables[table];
    if (!kind || !['POST', 'PATCH', 'PUT'].includes(String(init?.method || 'GET').toUpperCase()) || typeof init?.body !== 'string') return fetcher(input, init);
    const payload = JSON.parse(init.body);
    const cleaned = cleanNvlDocument(payload, kind, await catalog());
    return fetcher(input, { ...init, body: JSON.stringify(cleaned) });
  };
}
