import type { AcceptanceReport } from '../components/AcceptanceReportForm';
import type { MixingReport } from '../components/MixingReportForm';
import type { WeighingRecord } from '../components/WeighingShiftSummary';
import { getWeighingDataRows, sumWeighingRowTotalWeight } from '../components/WeighingShiftSummary';
import { getRoundItems, MIXING_ROUND_KEYS, roundNormWeight } from '../lib/mixingReportModel';
import {
  getProductionShiftOptions,
  resolveShiftName,
  shiftNamesMatch,
  type ShiftOption,
  type ShiftSetting
} from './shiftSettings';
import { formatNumber } from '../utils';

export type ControlBoardShiftSummaryRow = {
  key: string;
  ngay: string;
  ca: string;
  slHang: number;
  khoiLuongHang: number;
  slHangThucTe: number;
  khoiLuongHangThucTe: number;
  khoiLuongNpl: number;
};

type ProductRef = {
  code: string;
  totalWeight: string;
};

type ProductionOrderRef = {
  startDate: string;
  shift: string;
  productCode: string;
  productName: string;
  quantity: string;
  unit: string;
  products: Array<{ productCode: string; productName: string; quantity: string; unit: string }>;
};

type SummaryBucket = {
  ngay: string;
  ca: string;
  slHang: number;
  khoiLuongHang: number;
  slHangThucTe: number;
  khoiLuongHangThucTe: number;
  khoiLuongNpl: number;
};

function parseFlexibleNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '-') return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseOrderQuantity(value: string) {
  const normalized = value.replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIsoDate(value: string) {
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return '';
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function normalizeShiftKey(raw: string, shiftOptions: ShiftOption[]) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-') return 'Chưa phân ca';
  if (shiftOptions.length === 0) return trimmed;
  return resolveShiftName(trimmed, shiftOptions);
}

function bucketKey(ngay: string, ca: string, shiftOptions: ShiftOption[]) {
  const date = parseIsoDate(ngay);
  if (!date) return '';
  return `${date}|${normalizeShiftKey(ca, shiftOptions)}`;
}

function getOrCreateBucket(
  map: Map<string, SummaryBucket>,
  ngay: string,
  ca: string,
  shiftOptions: ShiftOption[]
) {
  const key = bucketKey(ngay, ca, shiftOptions);
  if (!key) return null;
  const existing = map.get(key);
  if (existing) return existing;

  const bucket: SummaryBucket = {
    ngay: parseIsoDate(ngay),
    ca: normalizeShiftKey(ca, shiftOptions),
    slHang: 0,
    khoiLuongHang: 0,
    slHangThucTe: 0,
    khoiLuongHangThucTe: 0,
    khoiLuongNpl: 0
  };
  map.set(key, bucket);
  return bucket;
}

function getOrderProductLines(order: ProductionOrderRef) {
  if (order.products.length > 0) return order.products;
  if (!order.productCode && !order.productName) return [];
  return [
    {
      productCode: order.productCode,
      productName: order.productName,
      quantity: order.quantity,
      unit: order.unit
    }
  ];
}

function findProductWeight(products: ProductRef[], productCode: string) {
  const codeKey = productCode.trim().toLowerCase();
  if (!codeKey) return null;
  const match = products.find(product => product.code.trim().toLowerCase() === codeKey);
  if (!match) return null;
  return parseFlexibleNumber(match.totalWeight);
}

function isKgUnit(unit: string) {
  const normalized = unit
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized === 'kg' || normalized === 'kilogram' || normalized === 'kilogam';
}

function sumMixingReportNplKg(report: MixingReport) {
  let total = 0;

  for (const line of report.chi_tiet) {
    for (const key of MIXING_ROUND_KEYS) {
      for (const item of getRoundItems(line.lan_su_dung, key)) {
        if (!isKgUnit(item.don_vi)) continue;
        const kl = item.kl_thuc_te ?? item.so_luong;
        if (kl !== null && kl !== undefined && Number.isFinite(kl)) {
          total += kl;
        }
      }
    }
  }

  return roundNormWeight(total);
}

export function matchesShiftSummaryBucket(
  bucketNgay: string,
  bucketCa: string,
  rowNgay: string,
  rowCa: string,
  shiftOptions: ShiftOption[]
) {
  const date = parseIsoDate(rowNgay);
  if (!date || date !== parseIsoDate(bucketNgay)) return false;
  return normalizeShiftKey(rowCa, shiftOptions) === normalizeShiftKey(bucketCa, shiftOptions);
}

function compareSummaryRows(a: ControlBoardShiftSummaryRow, b: ControlBoardShiftSummaryRow, shiftOptions: ShiftOption[]) {
  const byDate = b.ngay.localeCompare(a.ngay);
  if (byDate !== 0) return byDate;

  const indexOf = (ca: string) => {
    const idx = shiftOptions.findIndex(option => shiftNamesMatch(ca, option.value));
    return idx === -1 ? 999 : idx;
  };

  const byShift = indexOf(a.ca) - indexOf(b.ca);
  if (byShift !== 0) return byShift;
  return a.ca.localeCompare(b.ca, 'vi');
}

export function buildControlBoardShiftSummary(input: {
  shiftSettings: ShiftSetting[];
  productionOrders: ProductionOrderRef[];
  products: ProductRef[];
  acceptanceReports: AcceptanceReport[];
  mixingReports: MixingReport[];
  weighingRecords: WeighingRecord[];
  dateFrom?: string;
  dateTo?: string;
}): ControlBoardShiftSummaryRow[] {
  const shiftOptions = getProductionShiftOptions(input.shiftSettings);
  const map = new Map<string, SummaryBucket>();

  const inRange = (ngay: string) => {
    const date = parseIsoDate(ngay);
    if (!date) return false;
    if (input.dateFrom && date < input.dateFrom) return false;
    if (input.dateTo && date > input.dateTo) return false;
    return true;
  };

  for (const order of input.productionOrders) {
    const ngay = parseIsoDate(order.startDate);
    if (!ngay || !inRange(ngay)) continue;

    const bucket = getOrCreateBucket(map, ngay, order.shift, shiftOptions);
    if (!bucket) continue;

    for (const line of getOrderProductLines(order)) {
      const qty = parseOrderQuantity(line.quantity);
      if (qty <= 0) continue;
      bucket.slHang += qty;

      const unitWeight = findProductWeight(input.products, line.productCode);
      if (unitWeight !== null && unitWeight > 0) {
        bucket.khoiLuongHang += unitWeight * qty;
      }
    }
  }

  for (const report of input.acceptanceReports) {
    if (!inRange(report.ngay)) continue;
    const bucket = getOrCreateBucket(map, report.ngay, report.ca, shiftOptions);
    if (!bucket) continue;
    // Số lượng hàng TT — chỉ từ báo cáo sản lượng (bao_cao_nghiem_thu)
    if (report.so_luong !== null && Number.isFinite(report.so_luong)) {
      bucket.slHangThucTe += report.so_luong;
    }
  }

  for (const record of getWeighingDataRows(input.weighingRecords)) {
    const ngay = parseIsoDate(record.productionDate || record.reportDate);
    if (!ngay || !inRange(ngay)) continue;
    const bucket = getOrCreateBucket(map, ngay, record.shiftName, shiftOptions);
    if (!bucket) continue;
    // Khối lượng hàng TT — chỉ từ báo cáo cân ca (phieu_can_dinh_ki): TL lõi + TL bì + TL
    bucket.khoiLuongHangThucTe += sumWeighingRowTotalWeight(record);
  }

  for (const report of input.mixingReports) {
    if (!inRange(report.ngay)) continue;
    const bucket = getOrCreateBucket(map, report.ngay, report.ca, shiftOptions);
    if (!bucket) continue;
    bucket.khoiLuongNpl += sumMixingReportNplKg(report);
  }

  return [...map.values()]
    .map(bucket => ({
      key: `${bucket.ngay}|${bucket.ca}`,
      ngay: bucket.ngay,
      ca: bucket.ca,
      slHang: bucket.slHang,
      khoiLuongHang: roundNormWeight(bucket.khoiLuongHang),
      slHangThucTe: bucket.slHangThucTe,
      khoiLuongHangThucTe: roundNormWeight(bucket.khoiLuongHangThucTe),
      khoiLuongNpl: roundNormWeight(bucket.khoiLuongNpl)
    }))
    .sort((a, b) => compareSummaryRows(a, b, shiftOptions));
}

export function formatShiftSummaryNumber(value: number, fractionDigits = 2) {
  if (!Number.isFinite(value) || value === 0) return '-';
  return formatNumber(value, fractionDigits);
}

export function sumShiftSummaryColumn(rows: ControlBoardShiftSummaryRow[], key: keyof ControlBoardShiftSummaryRow) {
  if (key === 'key' || key === 'ngay' || key === 'ca') return 0;
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

export function defaultShiftSummaryDateRange(days = 14) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - Math.max(0, days - 1));
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10)
  };
}
