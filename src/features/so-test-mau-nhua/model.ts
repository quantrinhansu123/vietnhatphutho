export interface PlasticTestRow {
  material_id: string;
  ma_npl: string;
  ten_npl: string;
  may_ep_mau: string;
  may_va_dap: string;
  chi_so_mi: string;
  ket_luan: string;
  nguoi_thuc_hien: string;
}

export interface PlasticTestRecord {
  id: string;
  ngay: string;
  chi_tiet: PlasticTestRow[];
  updated_at: string;
}

export interface PlasticTestMaterial {
  id: string;
  ma_npl: string;
  ten_npl: string;
  phan_loai: string;
}

export const MAX_PLASTIC_TEST_ROWS = 200;

export function emptyPlasticTestRow(): PlasticTestRow {
  return {
    material_id: '', ma_npl: '', ten_npl: '', may_ep_mau: '', may_va_dap: '',
    chi_so_mi: '', ket_luan: '', nguoi_thuc_hien: ''
  };
}

export function normalizePlasticTestDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  if (year < 1 || year > 2999 || month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = month === 2 ? (leap ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31);
  if (day < 1 || day > days) return null;
  return `${y.padStart(4, '0')}-${m}-${d}`;
}

export function formatPlasticTestDate(value: string): string {
  const date = normalizePlasticTestDate(value);
  return date ? date.split('-').reverse().join('/') : '';
}

export function isPlasticTestMaterial(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[\s-]+/g, '_');
  return ['nvl_chinh', 'nvl_phu', 'nguyen_vat_lieu_chinh', 'nguyen_vat_lieu_phu'].includes(text);
}

export function hasPlasticTestContent(row: PlasticTestRow): boolean {
  return Object.values(row).some(value => value.trim() !== '');
}

export function parsePlasticTestBody(body: unknown):
  { record: { ngay: string; chi_tiet: PlasticTestRow[] } } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Dữ liệu sổ không hợp lệ.' };
  const source = body as Record<string, unknown>;
  const ngay = normalizePlasticTestDate(source.ngay);
  if (!ngay) return { error: 'Ngày không hợp lệ (năm từ 1 đến 2999).' };
  if (!Array.isArray(source.chi_tiet) || source.chi_tiet.length > MAX_PLASTIC_TEST_ROWS) {
    return { error: `Sổ chỉ được có tối đa ${MAX_PLASTIC_TEST_ROWS} dòng.` };
  }
  const rows: PlasticTestRow[] = [];
  const keys = Object.keys(emptyPlasticTestRow()) as (keyof PlasticTestRow)[];
  for (const [index, raw] of source.chi_tiet.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: `Dòng ${index + 1} không hợp lệ.` };
    const row = emptyPlasticTestRow();
    for (const key of keys) {
      const value = (raw as Record<string, unknown>)[key];
      if (value !== undefined && typeof value !== 'string') return { error: `Dòng ${index + 1}: dữ liệu phải là văn bản.` };
      row[key] = (value as string | undefined)?.trim() ?? '';
      if (row[key].length > 2000) return { error: `Dòng ${index + 1}: mỗi ô tối đa 2.000 ký tự.` };
    }
    if (!hasPlasticTestContent(row)) continue;
    if (!row.material_id) {
      return { error: `Dòng ${index + 1}: vui lòng chọn loại hàng từ kho nguyên vật liệu.` };
    }
    rows.push(row);
  }
  return { record: { ngay, chi_tiet: rows } };
}
