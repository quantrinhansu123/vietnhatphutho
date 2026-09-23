/**
 * Định mức vật tư trên phiếu giao ca = Tổng trọng lượng (kg) của từng NVL
 * trên phiếu trộn định mức của các lệnh SX (cột Tổng trọng lượng của NVL chính
 * và tổng kg của NVL phụ). Nhiều bản "tỷ lệ" của cùng một phiếu chỉ lấy bản mới nhất.
 */

export type AuxiliaryNormLine = {
  materialId: string;
  code: string;
  name: string;
  unit: string;
  weightKg: number;
  /** `chinh` = NVL cối trộn; `phu` = NVL phụ. Chỉ NVL phụ được thêm dòng mới nếu sổ chưa có. */
  source: 'chinh' | 'phu';
};

export type AuxiliaryNormWeightIndex = {
  byId: Map<string, number>;
  byCode: Map<string, number>;
  lines: AuxiliaryNormLine[];
};

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
}

function positive(value: unknown): number {
  const parsed = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Tổng trọng lượng kg của 1 dòng NVL chính: cột Tổng trọng lượng trên phiếu trộn định mức. */
export function mainLineTotalWeightKg(line: Record<string, unknown>, productTotalKg = 0): number {
  const tong = positive(line.tong_khoi_luong ?? line.tongKhoiLuong);
  if (tong > 0) return tong;
  const ratio = Number(String(line.ty_le_tong ?? line.tyLeTong ?? '').trim().replace(',', '.'));
  if (Number.isFinite(ratio) && ratio > 0 && productTotalKg > 0) {
    return Math.round((ratio / 100) * productTotalKg * 100) / 100;
  }
  return 0;
}

/** Tổng trọng lượng kg của 1 dòng NVL phụ. Không lấy số lượng ĐVT gốc (cuộn/tấm). */
export function auxiliaryLineWeightKg(line: Record<string, unknown>): number {
  const tong = positive(line.tong_khoi_luong ?? line.tongKhoiLuong);
  if (tong > 0) return tong;
  const khoi = positive(line.khoi_luong ?? line.khoiLuong);
  if (khoi > 0) return khoi;
  const unit = String(line.don_vi ?? line.dvt ?? line.donVi ?? '')
    .trim()
    .toLowerCase();
  if (unit === 'kg' || unit === 'kgs') return positive(line.gia_tri ?? line.giaTri);
  return 0;
}

export function formatNormWeight(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function revisionScore(row: Record<string, unknown>): number {
  const match = String(row.ten_phieu ?? row.tenPhieu ?? '')
    .trim()
    .match(/\s-\s*tỷ lệ\s+(\d+)\s*$/iu);
  const rev = match ? Math.max(0, Math.trunc(Number(match[1]) || 0)) : 0;
  const stamp = Date.parse(String(row.updated_at ?? row.created_at ?? '')) || 0;
  return rev * 1e15 + stamp;
}

/** Mỗi chuỗi lịch sử phiếu (gốc + các bản tỷ lệ) chỉ giữ bản mới nhất. */
export function selectCurrentMixingNormRecords(records: unknown[]): Record<string, unknown>[] {
  const groups = new Map<string, Record<string, unknown>>();
  records.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const row = raw as Record<string, unknown>;
    const original = String(row.id_phieu_tron_dm_ban_dau ?? '').trim();
    const id = String(row.id ?? '').trim();
    const key = original || id || `row-${index}`;
    const prev = groups.get(key);
    if (!prev || revisionScore(row) >= revisionScore(prev)) groups.set(key, row);
  });
  return [...groups.values()];
}

function isProductBlock(item: Record<string, unknown>): boolean {
  if (Array.isArray(item.nvl) || Array.isArray(item.nvl_phu) || Array.isArray(item.nvlPhu)) return true;
  if (String(item.loai ?? '').trim() === 'nvl_phu') return true;
  return Boolean(String(item.ma_sp ?? '').trim()) && !String(item.ma_nvl ?? '').trim();
}

function addWeight(
  index: AuxiliaryNormWeightIndex,
  line: Record<string, unknown>,
  source: 'chinh' | 'phu',
  productTotalKg = 0
) {
  const weight = source === 'chinh' ? mainLineTotalWeightKg(line, productTotalKg) : auxiliaryLineWeightKg(line);
  if (weight <= 0) return;
  const materialId = String(line.material_id ?? line.materialId ?? '').trim();
  const code = String(line.ma_nvl ?? line.maNvl ?? line.code ?? '').trim();
  const idKey = materialId.toLowerCase();
  const codeKey = code.toLowerCase();
  if (idKey) index.byId.set(idKey, (index.byId.get(idKey) || 0) + weight);
  if (codeKey) index.byCode.set(codeKey, (index.byCode.get(codeKey) || 0) + weight);

  const lineKey = idKey || codeKey;
  if (!lineKey) return;
  const name = String(line.ten_nvl ?? line.tenNvl ?? '').trim();
  const unit = String(line.don_vi ?? line.dvt ?? line.donVi ?? '').trim();
  const current = index.lines.find(item => {
    if (idKey && item.materialId.toLowerCase() === idKey) return true;
    return Boolean(codeKey) && item.code.toLowerCase() === codeKey;
  });
  if (!current) {
    index.lines.push({ materialId, code, name, unit: unit || 'kg', weightKg: weight, source });
    return;
  }
  current.weightKg += weight;
  if (source === 'chinh') current.source = 'chinh';
  if (!current.materialId && materialId) current.materialId = materialId;
  if (!current.code && code) current.code = code;
  if (!current.name && name) current.name = name;
  if ((!current.unit || current.unit === 'kg') && unit) current.unit = unit;
}

function consumeNorm(index: AuxiliaryNormWeightIndex, product: Record<string, unknown>) {
  const productTotal = positive(product.tong_trong_luong ?? product.tongTrongLuong);
  asRecords(product.nvl_phu ?? product.nvlPhu).forEach(line => addWeight(index, line, 'phu'));
  const loai = String(product.loai ?? product.phan_loai_nvl ?? '').trim();
  if (loai !== 'nvl_phu') {
    asRecords(product.nvl).forEach(line => addWeight(index, line, 'chinh', productTotal));
    const nested = asRecords(product.chi_tiet);
    if (nested.length > 0 && isProductBlock(nested[0])) {
      nested.forEach(block => consumeNorm(index, block));
    }
    return;
  }
  const lines = asRecords(product.nvl);
  if (lines.length > 0) {
    lines.forEach(line => addWeight(index, line, 'phu'));
    return;
  }
  const chi = asRecords(product.chi_tiet);
  if (chi.length > 0 && isProductBlock(chi[0])) {
    chi.forEach(block => consumeNorm(index, block));
    return;
  }
  chi.forEach(line => addWeight(index, line, 'phu'));
}

export function auxiliaryNormWeightIndex(records: unknown[]): AuxiliaryNormWeightIndex {
  const index: AuxiliaryNormWeightIndex = { byId: new Map(), byCode: new Map(), lines: [] };
  for (const record of selectCurrentMixingNormRecords(records)) {
    const products = asRecords(record.products);
    const chi = asRecords(record.chi_tiet);
    const blocks = products.length > 0 ? products : chi;
    if (blocks.length > 0) {
      blocks.forEach(block => {
        if (isProductBlock(block) || String(block.loai ?? '').trim() === 'nvl_phu') {
          consumeNorm(index, block);
        }
      });
      continue;
    }
    if (String(record.loai ?? '').trim() === 'nvl_phu') consumeNorm(index, record);
  }
  return index;
}

export function lookupAuxiliaryNormWeight(
  index: AuxiliaryNormWeightIndex,
  materialId: unknown,
  materialCode: unknown
): number {
  const id = String(materialId ?? '')
    .trim()
    .toLowerCase();
  if (id && index.byId.has(id)) return index.byId.get(id) || 0;
  const code = String(materialCode ?? '')
    .trim()
    .toLowerCase();
  if (code && index.byCode.has(code)) return index.byCode.get(code) || 0;
  return 0;
}
