import type { ProductionOrderRow } from '../features/ke-hoach-san-xuat';
import { getProductionOrderProductLines, parseProductionOrderQuantity } from '../features/ke-hoach-san-xuat';
import { normalizeProductCodeKey } from '../features/san-pham/types';
import { parseProductionOrderFilterDate } from '../features/cai-dat-thoi-gian';
import { shiftNamesMatch } from './shiftSettings';
import { machineValueMatchesFilter } from './controlBoardShiftSummary';

/** Tối thiểu từ báo cáo sản lượng — tránh import vòng từ AcceptanceReportForm. */
export type AcceptanceReportLike = {
  ngay: string;
  ca: string;
  ma_may: string;
  ten_may: string;
  mat_hang: string;
  so_luong: number | null;
};
export type ProductionProgressStatus = 'chua_sx' | 'dang_sx' | 'da_sx';

export type ProductionProgressLine = {
  productCode: string;
  productName: string;
  productionName?: string;
  /** Tên ghép đã lưu trong JSON san_pham lệnh SX — hiển thị nguyên văn. */
  tenGhep?: string;
  quyCachMDai?: number | string;
  unit: string;
  plannedQty: number;
  actualQty: number;
  remainingQty: number;
  status: ProductionProgressStatus;
  /** Key mã hàng chuẩn hóa (không gồm ĐVT/m dài) — dùng để tính rồi phân bổ Đã SX. */
  codeKey?: string;
};

export type ProductionProgressBucket = {
  ngay?: string;
  ca?: string;
  maMay?: string;
  tenMay?: string;
  machine?: string;
};

function resolveProgressStatus(plannedQty: number, actualQty: number): ProductionProgressStatus {
  if (actualQty <= 0) return 'chua_sx';
  if (plannedQty > 0 && actualQty + 1e-9 >= plannedQty) return 'da_sx';
  return 'dang_sx';
}

/** So khớp mã hàng linh hoạt (chuẩn hóa + chứa nhau). */
export function productCodesMatch(left: string, right: string): boolean {
  const a = normalizeProductCodeKey(left);
  const b = normalizeProductCodeKey(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export function productionProgressStatusLabel(status: ProductionProgressStatus): string {
  if (status === 'da_sx') return 'Đã SX';
  if (status === 'dang_sx') return 'Đang SX';
  return 'Chưa SX';
}

export function productionProgressStatusClass(status: ProductionProgressStatus): string {
  if (status === 'da_sx') return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
  if (status === 'dang_sx') return 'bg-amber-100 text-amber-900 ring-amber-200';
  return 'bg-zinc-100 text-zinc-700 ring-zinc-200';
}

function reportMatchesBucket(report: AcceptanceReportLike, bucket: ProductionProgressBucket): boolean {
  if (bucket.ngay) {
    const reportDate = parseProductionOrderFilterDate(report.ngay) || String(report.ngay || '').slice(0, 10);
    if (reportDate !== bucket.ngay) return false;
  }
  if (bucket.ca && !shiftNamesMatch(report.ca, bucket.ca)) return false;

  const machineFilter = String(bucket.machine || bucket.tenMay || bucket.maMay || '').trim();
  if (machineFilter && machineFilter !== '-') {
    if (
      !machineValueMatchesFilter(machineFilter, null, report.ma_may, report.ten_may) &&
      !(
        bucket.maMay &&
        machineValueMatchesFilter(bucket.maMay, null, report.ma_may, report.ten_may)
      ) &&
      !(
        bucket.tenMay &&
        machineValueMatchesFilter(bucket.tenMay, null, report.ma_may, report.ten_may)
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Tổng SL báo cáo sản lượng khớp mã hàng (+ ngày/ca/máy nếu có). */
export function acceptanceQuantityForProduct(input: {
  productCode: string;
  productName?: string;
  reports: AcceptanceReportLike[];
  bucket?: ProductionProgressBucket;
}): number {
  const codeKey = normalizeProductCodeKey(input.productCode);
  const nameKey = normalizeProductCodeKey(input.productName || '');
  if (!codeKey && !nameKey) return 0;

  return input.reports.reduce((sum, report) => {
    if (input.bucket && !reportMatchesBucket(report, input.bucket)) return sum;
    const itemKey = normalizeProductCodeKey(report.mat_hang);
    const matched =
      (codeKey && productCodesMatch(itemKey, codeKey)) ||
      (nameKey && productCodesMatch(itemKey, nameKey));
    if (!matched) return sum;
    const qty = Number(report.so_luong);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
}

/** Chuẩn hóa ĐVT để gộp dòng (giống key bản in lệnh SX): bỏ dấu, viết thường, xóa khoảng trắng. */
function normalizeProgressUnit(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '');
}

/** Mét dài quy cách của dòng (quyCachMDai → chuỗi quy_cach → daiM), giống bản in. */
function resolveProgressLengthMeters(line: {
  quyCachMDai?: number | string | null;
  quyCach?: string;
  daiM?: string;
}): number | null {
  const direct = Number(String(line.quyCachMDai ?? '').replace(',', '.'));
  if (Number.isFinite(direct) && direct > 0) return direct;
  const fromQuyCach = String(line.quyCach ?? '').match(/(\d+(?:[.,]\d+)?)/);
  if (fromQuyCach) {
    const n = Number(fromQuyCach[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const daiM = Number(String(line.daiM ?? '').replace(',', '.'));
  if (Number.isFinite(daiM) && daiM > 0) return daiM;
  return null;
}

export function buildProductionProgressForOrder(
  order: Pick<
    ProductionOrderRow,
    'products' | 'productCode' | 'productName' | 'quantity' | 'unit' | 'startDate' | 'shift' | 'machine'
  >,
  reports: AcceptanceReportLike[]
): ProductionProgressLine[] {
  const ngay = parseProductionOrderFilterDate(order.startDate) || String(order.startDate || '').slice(0, 10);
  const bucket: ProductionProgressBucket = {
    ngay: ngay || undefined,
    ca: order.shift && order.shift !== '-' ? order.shift : undefined,
    machine: order.machine && order.machine !== '-' ? order.machine : undefined
  };

  const merged = new Map<string, ProductionProgressLine>();

  getProductionOrderProductLines(order).forEach(line => {
    const productCode = String(line.productCode || '').trim();
    const productName = String(line.productName || '').trim();
    const productionName = String(line.productionName || '').trim();
    const codeKey = normalizeProductCodeKey(productCode || productName || productionName);
    if (!codeKey) return;
    // Gộp giống bản in: cùng mã + cùng ĐVT + cùng m dài quy cách mới là một dòng
    // (cắt lẻ 8m vs 9m, Tấm vs Cuộn không gộp chung).
    const lengthM = resolveProgressLengthMeters(line);
    const key = `${codeKey}__u:${normalizeProgressUnit(line.unit)}__m:${lengthM !== null ? lengthM.toFixed(3) : 'none'}`;

    const plannedQty = parseProductionOrderQuantity(line.quantity) || 0;
    const lineTenGhep = String(line.tenGhep || '').trim() || undefined;
    const existing = merged.get(key);
    if (existing) {
      existing.plannedQty += plannedQty;
      if (!existing.productName && productName) existing.productName = productName;
      if (!existing.productionName && productionName) existing.productionName = productionName;
      if (!existing.tenGhep && lineTenGhep) existing.tenGhep = lineTenGhep;
      if (existing.quyCachMDai == null && line.quyCachMDai != null) existing.quyCachMDai = line.quyCachMDai;
      if (!existing.unit && line.unit) existing.unit = line.unit;
      return;
    }

    merged.set(key, {
      productCode: productCode || productName || productionName,
      productName,
      productionName: productionName || undefined,
      tenGhep: lineTenGhep,
      quyCachMDai: line.quyCachMDai,
      unit: line.unit && line.unit !== '-' ? line.unit : '',
      plannedQty,
      actualQty: 0,
      remainingQty: plannedQty,
      status: 'chua_sx',
      codeKey
    });
  });

  // Báo cáo sản lượng không phân biệt m dài/ĐVT nên tính Đã SX 1 lần theo mã hàng,
  // rồi phân bổ theo thứ tự dòng (dòng trước fill tới KH, thừa dồn dòng cuối cùng mã).
  const lines = [...merged.values()];
  const remainingByCodeKey = new Map<string, number>();
  lines.forEach((line, idx) => {
    const key = String(line.codeKey || '');
    if (!remainingByCodeKey.has(key)) {
      remainingByCodeKey.set(key, acceptanceQuantityForProduct({
        productCode: line.productCode,
        productName: line.productName,
        reports,
        bucket
      }));
    }
    const remaining = Math.max(0, remainingByCodeKey.get(key) ?? 0);
    const isLastOfCode = idx === lines.length - 1 || lines[idx + 1].codeKey !== line.codeKey;
    line.actualQty = isLastOfCode ? remaining : Math.min(remaining, line.plannedQty);
    remainingByCodeKey.set(key, Math.max(0, remaining - line.actualQty));
    line.remainingQty = Math.max(0, line.plannedQty - line.actualQty);
    line.status = resolveProgressStatus(line.plannedQty, line.actualQty);
  });

  return lines;
}

/** MH trên lệnh khớp ngày/ca/máy mà chưa có báo cáo sản lượng. */
export function listUnproducedProducts(input: {
  planned: Array<{ productCode: string; productName?: string; unit?: string }>;
  reports: AcceptanceReportLike[];
  bucket: ProductionProgressBucket;
}): Array<{ productCode: string; productName: string; unit: string }> {
  const seen = new Set<string>();
  const result: Array<{ productCode: string; productName: string; unit: string }> = [];

  for (const item of input.planned) {
    const code = String(item.productCode || '').trim();
    const name = String(item.productName || '').trim();
    const key = normalizeProductCodeKey(code || name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const actual = acceptanceQuantityForProduct({
      productCode: code || name,
      productName: name,
      reports: input.reports,
      bucket: input.bucket
    });
    if (actual > 0) continue;
    result.push({
      productCode: code || name,
      productName: name,
      unit: String(item.unit || '').trim()
    });
  }

  return result;
}
