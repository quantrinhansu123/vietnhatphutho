import { normalizeProductCodeKey } from '../san-pham';
import { roundNplNumber } from '../san-pham/types';

/** Khớp shape in NVL kế hoạch — tránh import vòng từ index.tsx. */
export type PlanScaledMaterialLine = {
  code: string;
  name: string;
  normLabel: string;
  percent: number | null;
  weightKg: number | null;
  proposedQuantity: number;
  unit: string;
};

export type PlanPtdmQtyByProduct = {
  san_pham_id?: string;
  ma_sp: string;
  so_luong_ap_dung: number;
};

export type PlanPtdmRef = {
  dinh_muc_id: string;
  ten_phieu: string;
  thoi_gian_gan: string;
  so_luong_ap_dung_theo_sp: PlanPtdmQtyByProduct[];
};

export type SoTronProductQtyHint = {
  ma_lenh_sx: string;
  san_pham_id?: string;
  ma_sp: string;
  so_luong: number;
  ma_may?: string;
  ca?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickText(record: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  }
  return fallback;
}

function parseQty(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '')
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function parsePlanPtdmList(raw: unknown): PlanPtdmRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): PlanPtdmRef | null => {
      const row = asRecord(item);
      if (!row) return null;
      const dinh_muc_id = pickText(row, ['dinh_muc_id', 'id', 'dinhMucId']);
      if (!dinh_muc_id) return null;
      const qtyRaw = row.so_luong_ap_dung_theo_sp ?? row.soLuongApDungTheoSp;
      const so_luong_ap_dung_theo_sp = Array.isArray(qtyRaw)
        ? qtyRaw
            .map((q): PlanPtdmQtyByProduct | null => {
              const qRow = asRecord(q);
              if (!qRow) return null;
              const ma_sp = pickText(qRow, ['ma_sp', 'maSp', 'productCode']);
              const so_luong_ap_dung = parseQty(qRow.so_luong_ap_dung ?? qRow.soLuongApDung ?? qRow.quantity);
              if (!ma_sp && so_luong_ap_dung <= 0) return null;
              return {
                san_pham_id: pickText(qRow, ['san_pham_id', 'sanPhamId', 'productId']) || undefined,
                ma_sp,
                so_luong_ap_dung
              };
            })
            .filter((q): q is PlanPtdmQtyByProduct => Boolean(q))
        : [];
      return {
        dinh_muc_id,
        ten_phieu: pickText(row, ['ten_phieu', 'tenPhieu', 'name'], dinh_muc_id),
        thoi_gian_gan: pickText(row, ['thoi_gian_gan', 'thoiGianGan', 'attachedAt']),
        so_luong_ap_dung_theo_sp
      };
    })
    .filter((item): item is PlanPtdmRef => Boolean(item));
}

/** Giữ thoi_gian_gan cũ theo dinh_muc_id; phần tử mới để trống (server stamp). */
export function mergePlanPtdmTimestamps(
  incoming: PlanPtdmRef[],
  previous: PlanPtdmRef[]
): PlanPtdmRef[] {
  const prevMap = new Map(previous.map(item => [item.dinh_muc_id, item.thoi_gian_gan]));
  return incoming.map(item => ({
    ...item,
    thoi_gian_gan: item.thoi_gian_gan || prevMap.get(item.dinh_muc_id) || ''
  }));
}

export function formatPlanPtdmAttachedAtVn(iso: string): string {
  const raw = String(iso || '').trim();
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export function remainingPlanQty(planQty: number, doneQty: number): number {
  return Math.max(0, roundNplNumber(planQty - doneQty));
}

/** Cộng SL thành phẩm từ các phiếu sổ trộn theo lệnh + SP. */
export function aggregateSoTronDoneQty(hints: SoTronProductQtyHint[], filter: {
  ma_lenh_sx: string;
  san_pham_id?: string;
  ma_sp?: string;
  ma_may?: string;
  ca?: string;
}): number {
  const orderCode = String(filter.ma_lenh_sx || '').trim().toUpperCase();
  const productId = String(filter.san_pham_id || '').trim();
  const productCode = normalizeProductCodeKey(filter.ma_sp || '');
  const machine = String(filter.ma_may || '').trim();
  const shift = String(filter.ca || '').trim();

  let total = 0;
  hints.forEach(hint => {
    if (String(hint.ma_lenh_sx || '').trim().toUpperCase() !== orderCode) return;
    if (machine && hint.ma_may && String(hint.ma_may).trim() !== machine) return;
    if (shift && hint.ca && String(hint.ca).trim() !== shift) return;
    const hintId = String(hint.san_pham_id || '').trim();
    const hintCode = normalizeProductCodeKey(hint.ma_sp || '');
    const idMatch = productId && hintId && productId === hintId;
    const codeMatch = productCode && hintCode && productCode === hintCode;
    if (!idMatch && !codeMatch) return;
    total += hint.so_luong;
  });
  return roundNplNumber(total);
}

export function parseSoTronQtyHints(payload: unknown): SoTronProductQtyHint[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { reports?: unknown })?.reports)
      ? ((payload as { reports: unknown[] }).reports)
      : Array.isArray((payload as { items?: unknown })?.items)
        ? ((payload as { items: unknown[] }).items)
        : Array.isArray((payload as { data?: unknown })?.data)
          ? ((payload as { data: unknown[] }).data)
          : [];

  const hints: SoTronProductQtyHint[] = [];
  rows.forEach(rowRaw => {
    const row = asRecord(rowRaw);
    if (!row) return;
    const ma_may = pickText(row, ['ma_may', 'may']);
    const ca = pickText(row, ['ca']);
    const bang = row.bang_san_pham ?? row.bangSanPham;
    if (!Array.isArray(bang)) return;
    bang.forEach(spRaw => {
      const sp = asRecord(spRaw);
      if (!sp) return;
      const ma_lenh_sx = pickText(sp, ['ma_lenh_sx', 'maLenhSx', 'lenh_sx']);
      const ma_sp = pickText(sp, ['ma_sp', 'maSp', 'ma_hang']);
      const so_luong = parseQty(sp.so_luong ?? sp.soLuong);
      if (!ma_lenh_sx || so_luong <= 0) return;
      hints.push({
        ma_lenh_sx,
        san_pham_id: pickText(sp, ['san_pham_id', 'sanPhamId']) || undefined,
        ma_sp,
        so_luong,
        ma_may: ma_may || undefined,
        ca: ca || undefined
      });
    });
  });
  return hints;
}

type NormNvlLine = {
  ma_nvl?: string;
  ten_nvl?: string;
  ten_nvl_san_xuat?: string;
  don_vi?: string;
  tong_khoi_luong?: number | null;
  khoi_luong?: number | null;
  gia_tri?: number | null;
};

type NormSpBlock = {
  san_pham_id?: string;
  san_pham_ids?: string[];
  ma_sp?: string;
  ten_sp?: string;
  so_luong_goc?: number;
  tong_trong_luong?: number;
  dinh_luong_coi?: number;
  loai?: string;
  nvl?: NormNvlLine[];
  nvl_phu?: NormNvlLine[];
};

function normBlockMatchesProduct(
  block: NormSpBlock,
  productId?: string,
  productCode?: string
): boolean {
  if (String(block.loai || '') === 'nvl_phu') return false;
  const ids = [
    String(block.san_pham_id || '').trim(),
    ...(Array.isArray(block.san_pham_ids) ? block.san_pham_ids.map(id => String(id || '').trim()) : [])
  ].filter(Boolean);
  if (productId && ids.includes(productId)) return true;
  const codes = String(block.ma_sp || '')
    .split(',')
    .map(c => normalizeProductCodeKey(c))
    .filter(Boolean);
  const codeKey = normalizeProductCodeKey(productCode || '');
  return Boolean(codeKey && codes.includes(codeKey));
}

/** Scale NVL cho tổng kg thành phẩm cần làm theo tỷ lệ của PTĐM. */
export function scaleMaterialsFromPtdmChiTiet(
  chiTiet: unknown,
  applyWeightKg: number,
  productId?: string,
  productCode?: string
): PlanScaledMaterialLine[] {
  if (!Array.isArray(chiTiet) || applyWeightKg <= 0) return [];
  const blocks = chiTiet as NormSpBlock[];
  const matched = blocks.filter(block => normBlockMatchesProduct(block, productId, productCode));
  if (matched.length === 0) return [];

  const merged = new Map<string, PlanScaledMaterialLine>();
  matched.forEach(block => {
    const totalWeightKg = Number(block.tong_trong_luong) > 0 ? Number(block.tong_trong_luong) : 0;
    const batchWeightKg = Number(block.dinh_luong_coi) > 0 ? Number(block.dinh_luong_coi) : 0;
    const nvlLines = [
      ...(Array.isArray(block.nvl) ? block.nvl : []),
      ...(Array.isArray(block.nvl_phu) ? block.nvl_phu : [])
    ];
    nvlLines.forEach(nvl => {
      const code = String(nvl.ma_nvl || '').trim();
      if (!code) return;
      const totalNvlKg = Number(nvl.tong_khoi_luong) > 0 ? Number(nvl.tong_khoi_luong) : 0;
      const oneBatchNvlKg = Number(nvl.khoi_luong) > 0 ? Number(nvl.khoi_luong) : 0;
      const hasWholeProductionAmount = totalWeightKg > 0 && totalNvlKg > 0;
      const ratio = hasWholeProductionAmount
        ? applyWeightKg / totalWeightKg
        : batchWeightKg > 0
          ? applyWeightKg / batchWeightKg
          : 0;
      const baseNvlKg = hasWholeProductionAmount ? totalNvlKg : oneBatchNvlKg;
      const proposedQuantity = roundNplNumber(baseNvlKg * ratio);
      const unit = String(nvl.don_vi || 'kg').trim() || 'kg';
      const key = `${normalizeProductCodeKey(code)}__${unit}`;
      const existing = merged.get(key);
      if (existing) {
        existing.proposedQuantity = roundNplNumber(existing.proposedQuantity + proposedQuantity);
        if (existing.weightKg != null) {
          existing.weightKg = roundNplNumber((existing.weightKg || 0) + proposedQuantity);
        }
      } else {
        merged.set(key, {
          code,
          name: String(nvl.ten_nvl_san_xuat || nvl.ten_nvl || code).trim(),
          normLabel: `${proposedQuantity} ${unit}`,
          percent: null,
          weightKg: unit.toLowerCase() === 'kg' ? proposedQuantity : null,
          proposedQuantity,
          unit
        });
      }
    });
  });
  return [...merged.values()];
}

export function defaultPtdmApplyQtys(products: Array<{
  productId?: string;
  productCode: string;
  quantity: string;
  soLuongDaSx?: string;
}>): PlanPtdmQtyByProduct[] {
  return products
    .map(product => {
      const planQty = parseQty(product.quantity);
      const doneQty = parseQty(product.soLuongDaSx);
      const so_luong_ap_dung = remainingPlanQty(planQty, doneQty);
      if (so_luong_ap_dung <= 0 && planQty <= 0) return null;
      return {
        san_pham_id: product.productId,
        ma_sp: product.productCode,
        so_luong_ap_dung: so_luong_ap_dung > 0 ? so_luong_ap_dung : planQty
      };
    })
    .filter((item): item is PlanPtdmQtyByProduct => Boolean(item));
}

export type PlanPrintMaterialRow = {
  code: string;
  name: string;
  unit: string;
  totalQuantity: number;
  shift: string;
  orderCodes: string[];
};

export type PlanMaterialSourceProduct = {
  productId?: string;
  productCode: string;
  quantity: string;
  soLuongDaSx?: string;
  unit?: string;
  tlCuon?: string;
  tlTam?: string;
  kg1Sp?: string;
  totalKg?: string;
  orderQuantity?: string;
  conversionResults?: Array<{ unit: string; value: number }>;
};

type PlanMaterialSourceLine = {
  orderCode: string;
  shift: string;
  products: PlanMaterialSourceProduct[];
  danhSachPtdm: PlanPtdmRef[];
};

export function plannedProductWeightKg(product: PlanMaterialSourceProduct, quantity: number): number {
  const unit = String(product.unit || '').toLocaleLowerCase('vi');
  const parse = (value: unknown) => parseQty(value);
  let kgPerUnit = 0;
  if (/cuộn/.test(unit)) kgPerUnit = parse(product.tlCuon);
  else if (/tấm/.test(unit)) kgPerUnit = parse(product.tlTam);
  else if (/kg/.test(unit)) kgPerUnit = 1;
  if (kgPerUnit <= 0) kgPerUnit = parse(product.kg1Sp);
  if (kgPerUnit <= 0 && parse(product.totalKg) > 0 && parse(product.orderQuantity) > 0) {
    kgPerUnit = parse(product.totalKg) / parse(product.orderQuantity);
  }
  if (kgPerUnit <= 0 && parse(product.orderQuantity) > 0) {
    const kgConversion = product.conversionResults?.find(item => /^(kg|kilogram)$/i.test(String(item.unit || '').trim()));
    if (kgConversion && Number.isFinite(kgConversion.value) && kgConversion.value > 0) {
      kgPerUnit = kgConversion.value / parse(product.orderQuantity);
    }
  }
  return kgPerUnit > 0 ? roundNplNumber(quantity * kgPerUnit) : 0;
}

/** Gom NVL từ PTĐM gắn trên dòng kế hoạch (theo ngày), scale theo SL áp dụng. */
export async function loadAggregatedPlanMaterialsFromPtdm(
  lines: PlanMaterialSourceLine[]
): Promise<PlanPrintMaterialRow[]> {
  const ptdmIds = [
    ...new Set(lines.flatMap(line => (line.danhSachPtdm || []).map(item => item.dinh_muc_id).filter(Boolean)))
  ];
  if (!ptdmIds.length) return [];

  const res = await fetch(`/api/bang-tron-vat-tu-dinh-muc?ids=${encodeURIComponent(ptdmIds.join(','))}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((data as { error?: string }).error || 'Không thể tải phiếu PTĐM.'));
  }
  const items = Array.isArray((data as { records?: unknown }).records)
    ? (data as { records: Array<Record<string, unknown>> }).records
    : Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: Array<Record<string, unknown>> }).items
      : Array.isArray(data)
        ? (data as Array<Record<string, unknown>>)
        : [];
  const ptdmById = new Map<string, unknown>();
  items.forEach(item => {
    const id = String(item.id || '').trim();
    if (id && ptdmIds.includes(id)) ptdmById.set(id, item.chi_tiet);
  });
  const missingPtdmIds = ptdmIds.filter(id => !ptdmById.has(id));
  if (missingPtdmIds.length > 0) {
    throw new Error(`Không tìm thấy ${missingPtdmIds.length} phiếu PTĐM đã gắn trong danh sách định mức.`);
  }

  const merged = new Map<string, PlanPrintMaterialRow>();
  lines.forEach(line => {
    const shift = String(line.shift || '').trim() || '—';
    const products = line.products.length
      ? line.products
      : [];
    products.forEach(product => {
      (line.danhSachPtdm || []).forEach(ptdm => {
        const applyQty =
          ptdm.so_luong_ap_dung_theo_sp.find(
            q =>
              (product.productId && q.san_pham_id && q.san_pham_id === product.productId) ||
              normalizeProductCodeKey(q.ma_sp) === normalizeProductCodeKey(product.productCode)
          )?.so_luong_ap_dung ??
          remainingPlanQty(parseQty(product.quantity), parseQty(product.soLuongDaSx));
        const applyWeightKg = plannedProductWeightKg(product, applyQty);
        const materials = scaleMaterialsFromPtdmChiTiet(
          ptdmById.get(ptdm.dinh_muc_id),
          applyWeightKg,
          product.productId,
          product.productCode
        );
        materials.forEach(material => {
          const key = `${shift}__${normalizeProductCodeKey(material.code)}__${material.unit || '-'}`;
          const existing = merged.get(key);
          if (existing) {
            existing.totalQuantity = roundNplNumber(existing.totalQuantity + material.proposedQuantity);
            if (line.orderCode && !existing.orderCodes.includes(line.orderCode)) {
              existing.orderCodes.push(line.orderCode);
            }
          } else {
            merged.set(key, {
              code: material.code,
              name: material.name,
              unit: material.unit,
              totalQuantity: material.proposedQuantity,
              shift,
              orderCodes: line.orderCode ? [line.orderCode] : []
            });
          }
        });
      });
    });
  });

  return [...merged.values()].sort((a, b) => {
    const shiftCmp = a.shift.localeCompare(b.shift, 'vi', { numeric: true });
    if (shiftCmp !== 0) return shiftCmp;
    return a.code.localeCompare(b.code, 'vi');
  });
}
