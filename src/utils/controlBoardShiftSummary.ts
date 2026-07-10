import type { AcceptanceReport } from '../components/AcceptanceReportForm';
import type { WeighingRecord } from './weighingRecords';
import {
  getWeighingDataRows,
  parseWeighingWeight,
  sumDamagedGoodsRowFilmWeight,
  sumDamagedGoodsRowPlasticWeight,
  sumDamagedGoodsRowWeight,
  sumWeighingRowTotalWeight
} from './weighingRecords';
import { roundNormWeight } from '../lib/mixingReportModel';
import type { MachineNvlSavedReport } from './machineNvlReports';
import {
  getProductionShiftOptions,
  resolveShiftName,
  shiftNamesMatch,
  type ShiftOption,
  type ShiftSetting
} from './shiftSettings';
import { normalizeProductCodeKey } from '../features/san-pham/types';

export type ShiftSummaryWarehouseMovement = {
  id: string;
  slipCode: string;
  slipDate: string;
  shift: string;
  slipType: 'nhap' | 'xuat';
  warehouseKind: 'nvl' | 'san_pham';
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  createdBy: string;
};

export type ShiftSummaryFilterSources = {
  shiftSettings: ShiftSetting[];
  productionOrders: Array<{ startDate: string; shift: string; staff: string; machine?: string; position?: string }>;
  mixingReports: Array<{ ngay: string; ca: string; nhan_su: string; ma_may?: string; ten_may?: string }>;
  warehouseMovements: Array<{ slipDate: string; shift: string; createdBy: string }>;
  machineNvlReports: Array<{ ngay: string; ca: string; nhanSu: string; maMay?: string; tenMay?: string }>;
  weighingRecords: Array<{
    productionDate: string;
    reportDate: string;
    shiftName: string;
    worker1: string;
    worker2: string;
    machineName?: string;
  }>;
  acceptanceReports?: Array<{ ngay: string; ca: string; ma_may?: string; ten_may?: string }>;
};

export type ControlBoardShiftSummaryRow = {
  key: string;
  ngay: string;
  ca: string;
  slHang: number;
  khoiLuongHang: number;
  slHangThucTe: number;
  khoiLuongHangThucTe: number;
  khoiLuongNhuaTp: number;
  hangHong: number;
  hangHongNhua: number;
  hangHongMang: number;
  khoiLuongNpl: number;
  khoiLuongMangXuat: number;
  khoiLuongLoi: number;
  khoiLuongMang: number;
  tonDauCa: number;
  tonCuoiCa: number;
  tongVatLieu: number;
  chenhLech: number;
};

type ProductRef = {
  code: string;
  totalWeight: string;
};

type MaterialRef = {
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
  hangHong: number;
  hangHongNhua: number;
  hangHongMang: number;
  khoiLuongNpl: number;
  khoiLuongMangXuat: number;
  khoiLuongLoi: number;
  tonDauCa: number;
  tonCuoiCa: number;
};

/** KL bì (kg) = số thành phẩm thực tế × 0,16 kg */
export const KHOI_LUONG_MANG_KG_PER_UNIT = 0.16;

/** KL nhựa TP (kg) = (KL hàng TT − KL lõi − KL bì) × 0,75 */
export const KHOI_LUONG_NHUA_TP_FACTOR = 0.75;

export function computeKhoiLuongNhuaTp(
  khoiLuongHangThucTe: number,
  khoiLuongLoi: number,
  khoiLuongMang: number
) {
  return roundNormWeight(
    (khoiLuongHangThucTe - khoiLuongLoi - khoiLuongMang) * KHOI_LUONG_NHUA_TP_FACTOR
  );
}

function parseFlexibleNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '-') return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

// Dùng cho "Tổng kg" định mức nhỏ (vd 0.238 kg/m2) và cũng hỗ trợ kiểu VN (1.250,5)
function parseKgFactor(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '-') return null;
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(',', '.');
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
    hangHong: 0,
    hangHongNhua: 0,
    hangHongMang: 0,
    khoiLuongNpl: 0,
    khoiLuongMangXuat: 0,
    khoiLuongLoi: 0,
    tonDauCa: 0,
    tonCuoiCa: 0
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

function isM2Unit(unit: string) {
  const normalized = unit
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized === 'm2' || normalized === 'm^2' || normalized === 'm²' || normalized === 'm 2';
}

function splitShiftLabels(label: string) {
  return String(label || '')
    .split(/[,;+]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function sumWarehouseMovementNplKg(movement: ShiftSummaryWarehouseMovement) {
  if (movement.warehouseKind !== 'nvl') return 0;
  if (movement.slipType !== 'xuat') return 0;
  const unit = movement.unit || '';
  if (!isKgUnit(unit)) return 0;
  const qty = movement.quantity;
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return qty;
}

function sumWarehouseMovementMangKg(
  movement: ShiftSummaryWarehouseMovement,
  resolveKgFactor: (unit: string, code: string, lineFactor: number | null | undefined) => number | null
) {
  if (movement.warehouseKind !== 'nvl') return 0;
  if (movement.slipType !== 'xuat') return 0;
  const unit = movement.unit || '';
  if (!isM2Unit(unit)) return 0;
  const qty = movement.quantity;
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const factor = resolveKgFactor(unit, movement.itemCode || '', null);
  return factor !== null && factor > 0 ? qty * factor : 0;
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
  const bucketShift = normalizeShiftKey(bucketCa, shiftOptions);
  const rowShiftParts = splitShiftLabels(rowCa);
  const candidates = rowShiftParts.length > 0 ? rowShiftParts : [rowCa];
  return candidates.some(
    part =>
      normalizeShiftKey(part, shiftOptions) === bucketShift || shiftNamesMatch(part, bucketCa)
  );
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
  materials?: MaterialRef[];
  acceptanceReports: AcceptanceReport[];
  warehouseMovements?: ShiftSummaryWarehouseMovement[];
  weighingRecords: WeighingRecord[];
  damagedRecords?: WeighingRecord[];
  machineNvlReports?: MachineNvlSavedReport[];
  dateFrom?: string;
  dateTo?: string;
}): ControlBoardShiftSummaryRow[] {
  const shiftOptions = getProductionShiftOptions(input.shiftSettings);
  const map = new Map<string, SummaryBucket>();

  const inventoryTotalKgByCode = (() => {
    const m = new Map<string, number>();
    for (const material of input.materials ?? []) {
      const key = normalizeProductCodeKey(material.code);
      if (!key) continue;
      const totalKg = parseKgFactor(material.totalWeight);
      if (totalKg !== null && totalKg > 0) m.set(key, totalKg);
    }
    return m;
  })();

  const resolveKgFactor = (unit: string, code: string, lineFactor: number | null | undefined) => {
    if (isKgUnit(unit)) return 1;
    if (lineFactor !== null && lineFactor !== undefined && Number.isFinite(lineFactor) && lineFactor > 0) return lineFactor;
    return inventoryTotalKgByCode.get(normalizeProductCodeKey(code)) ?? null;
  };

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
      // KL lõi = Số lượng cuộn thực tế × 1kg
      bucket.khoiLuongLoi += report.so_luong;
    }

    // Khối lượng hàng TT — lấy từ báo cáo sản lượng: Số lượng * định mức kg của sản phẩm
    const unitWeight = findProductWeight(input.products, report.mat_hang);
    if (
      unitWeight !== null &&
      unitWeight > 0 &&
      report.so_luong !== null &&
      Number.isFinite(report.so_luong) &&
      report.so_luong > 0
    ) {
      bucket.khoiLuongHangThucTe += unitWeight * report.so_luong;
    }
  }

  // Không lấy Khối lượng hàng TT từ phiếu cân ca nữa (phieu_can_dinh_ki).
  // KL lõi không lấy từ phiếu cân ca; lấy từ SL cuộn thực tế (báo cáo sản lượng) × 1kg.

  for (const record of getWeighingDataRows(input.damagedRecords ?? [])) {
    const ngay = parseIsoDate(record.productionDate || record.reportDate);
    if (!ngay || !inRange(ngay)) continue;
    const bucket = getOrCreateBucket(map, ngay, record.shiftName, shiftOptions);
    if (!bucket) continue;
    // Hàng hỏng — tổng trọng lượng từ báo cáo hàng hỏng (bao_cao_hang_hong)
    bucket.hangHong += sumDamagedGoodsRowWeight(record);
    bucket.hangHongNhua += sumDamagedGoodsRowPlasticWeight(record);
    bucket.hangHongMang += sumDamagedGoodsRowFilmWeight(record);
  }

  for (const movement of input.warehouseMovements ?? []) {
    if (!inRange(movement.slipDate)) continue;
    const bucket = getOrCreateBucket(map, movement.slipDate, movement.shift, shiftOptions);
    if (!bucket) continue;
    bucket.khoiLuongNpl += sumWarehouseMovementNplKg(movement);
    bucket.khoiLuongMangXuat += sumWarehouseMovementMangKg(movement, resolveKgFactor);
  }

  for (const report of input.machineNvlReports ?? []) {
    if (!inRange(report.ngay)) continue;
    const bucket = getOrCreateBucket(map, report.ngay, report.ca, shiftOptions);
    if (!bucket) continue;
    if (report.reportKind === 'dau_ca') {
      for (const line of report.lines) {
        if (!isKgUnit(line.donVi || '')) continue;
        const qtyBase =
          (line.soLuongTon > 0
            ? line.soLuongTon
            : (line.soLuongTrongMay ?? 0) + (line.soLuongTrongBonTron ?? 0) + (line.soLuongNlChuaTron ?? 0)) || 0;
        if (qtyBase > 0) bucket.tonDauCa += qtyBase;
      }
    } else if (report.reportKind === 'cuoi_ca') {
      for (const line of report.lines) {
        if (!isKgUnit(line.donVi || '')) continue;
        const qty = Number.isFinite(line.soLuongTon) ? line.soLuongTon : 0;
        if (qty > 0) bucket.tonCuoiCa += qty;
      }
    }
  }

  return [...map.values()]
    .map(bucket => {
      const khoiLuongNpl = roundNormWeight(bucket.khoiLuongNpl);
      const khoiLuongMangXuat = roundNormWeight(bucket.khoiLuongMangXuat);
      const tonDauCa = roundNormWeight(bucket.tonDauCa);
      const tonCuoiCa = roundNormWeight(bucket.tonCuoiCa);
      const khoiLuongHangThucTe = roundNormWeight(bucket.khoiLuongHangThucTe);
      const hangHong = roundNormWeight(bucket.hangHong);
      const hangHongNhua = roundNormWeight(bucket.hangHongNhua);
      const hangHongMang = roundNormWeight(bucket.hangHongMang);
      const khoiLuongLoi = roundNormWeight(bucket.khoiLuongLoi);
      const khoiLuongMang = roundNormWeight(bucket.slHangThucTe * KHOI_LUONG_MANG_KG_PER_UNIT);
      const khoiLuongNhuaTp = computeKhoiLuongNhuaTp(khoiLuongHangThucTe, khoiLuongLoi, khoiLuongMang);
      const tongVatLieu = roundNormWeight(khoiLuongNpl + tonDauCa - tonCuoiCa);
      return {
        key: `${bucket.ngay}|${bucket.ca}`,
        ngay: bucket.ngay,
        ca: bucket.ca,
        slHang: bucket.slHang,
        khoiLuongHang: roundNormWeight(bucket.khoiLuongHang),
        slHangThucTe: bucket.slHangThucTe,
        khoiLuongHangThucTe,
        khoiLuongNhuaTp,
        hangHong,
        hangHongNhua,
        hangHongMang,
        khoiLuongNpl,
        khoiLuongMangXuat,
        khoiLuongLoi,
        khoiLuongMang,
        tonDauCa,
        tonCuoiCa,
        tongVatLieu,
        chenhLech: roundNormWeight(khoiLuongNpl + tonDauCa - tonCuoiCa - khoiLuongNhuaTp - hangHongNhua)
      };
    })
    .sort((a, b) => compareSummaryRows(a, b, shiftOptions));
}

export function formatShiftSummaryNumber(value: number, fractionDigits = 2) {
  if (!Number.isFinite(value) || value === 0) return '-';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits
  }).format(value);
}

export function formatShiftSummaryKg(value: number, fractionDigits = 3) {
  return formatShiftSummaryNumber(value, fractionDigits);
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

export function splitStaffNames(value: string) {
  return String(value || '')
    .split(/[,;+]/)
    .map(name => name.trim())
    .filter(name => name && name !== '-');
}

function staffNameMatches(value: string, staffFilter: string) {
  const target = staffFilter.trim().toLowerCase();
  if (!target) return true;
  return splitStaffNames(value).some(name => name.toLowerCase() === target);
}

export function normalizeMachineToken(value: string) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

export function machineValueMatchesFilter(
  machineFilter: string,
  selected: { code?: string; name?: string } | null,
  ...candidates: Array<string | undefined | null>
) {
  if (!machineFilter || machineFilter === 'all') return true;

  const tokens = new Set<string>();
  const addToken = (value?: string | null) => {
    const token = normalizeMachineToken(value || '');
    if (token) tokens.add(token);
  };

  addToken(machineFilter);
  addToken(selected?.code);
  addToken(selected?.name);

  return candidates.some(candidate => {
    const token = normalizeMachineToken(candidate || '');
    if (!token) return false;
    for (const selectedToken of tokens) {
      if (token === selectedToken || token.includes(selectedToken) || selectedToken.includes(token)) {
        return true;
      }
    }
    return false;
  });
}

export function parseControlBoardFilterDate(value?: string) {
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return '';
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function matchesControlBoardDateRange(value: string | undefined, dateFrom: string, dateTo: string) {
  const date = parseControlBoardFilterDate(value);
  if (!date) return !dateFrom && !dateTo;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

export function shiftSummaryRowHasStaff(
  row: Pick<ControlBoardShiftSummaryRow, 'ngay' | 'ca'>,
  staffFilter: string,
  sources: ShiftSummaryFilterSources
) {
  const target = staffFilter.trim();
  if (!target || target === 'all') return true;

  const shiftOptions = getProductionShiftOptions(sources.shiftSettings);

  for (const order of sources.productionOrders) {
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, order.startDate, order.shift, shiftOptions)) continue;
    if (staffNameMatches(order.staff, target)) return true;
  }

  for (const report of sources.mixingReports) {
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, report.ngay, report.ca, shiftOptions)) continue;
    if (staffNameMatches(report.nhan_su, target)) return true;
  }

  for (const movement of sources.warehouseMovements) {
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, movement.slipDate, movement.shift, shiftOptions)) continue;
    if (staffNameMatches(movement.createdBy, target)) return true;
  }

  for (const report of sources.machineNvlReports) {
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, report.ngay, report.ca, shiftOptions)) continue;
    if (staffNameMatches(report.nhanSu, target)) return true;
  }

  for (const record of sources.weighingRecords) {
    const recordNgay = record.productionDate || record.reportDate;
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, recordNgay, record.shiftName, shiftOptions)) continue;
    if (staffNameMatches(record.worker1, target) || staffNameMatches(record.worker2, target)) return true;
  }

  return false;
}

export function shiftSummaryRowHasMachine(
  row: Pick<ControlBoardShiftSummaryRow, 'ngay' | 'ca'>,
  machineFilter: string,
  sources: ShiftSummaryFilterSources,
  selectedMachine?: { code?: string; name?: string } | null
) {
  const target = machineFilter.trim();
  if (!target || target === 'all') return true;

  const shiftOptions = getProductionShiftOptions(sources.shiftSettings);
  const matches = (...candidates: Array<string | undefined | null>) =>
    machineValueMatchesFilter(target, selectedMachine ?? null, ...candidates);

  for (const order of sources.productionOrders) {
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, order.startDate, order.shift, shiftOptions)) continue;
    if (matches(order.machine, order.position)) return true;
  }

  for (const report of sources.acceptanceReports ?? []) {
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, report.ngay, report.ca, shiftOptions)) continue;
    if (matches(report.ma_may, report.ten_may)) return true;
  }

  for (const report of sources.mixingReports) {
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, report.ngay, report.ca, shiftOptions)) continue;
    if (matches(report.ma_may, report.ten_may)) return true;
  }

  for (const report of sources.machineNvlReports) {
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, report.ngay, report.ca, shiftOptions)) continue;
    if (matches(report.maMay, report.tenMay)) return true;
  }

  for (const record of sources.weighingRecords) {
    const recordNgay = record.productionDate || record.reportDate;
    if (!matchesShiftSummaryBucket(row.ngay, row.ca, recordNgay, record.shiftName, shiftOptions)) continue;
    if (matches(record.machineName)) return true;
  }

  return false;
}

export function filterControlBoardShiftSummaryRows(
  rows: ControlBoardShiftSummaryRow[],
  filters: {
    shiftFilter: string;
    staffFilter: string;
    machineFilter?: string;
  },
  sources: ShiftSummaryFilterSources,
  selectedMachine?: { code?: string; name?: string } | null
) {
  const shiftOptions = getProductionShiftOptions(sources.shiftSettings);

  return rows.filter(row => {
    if (filters.shiftFilter !== 'all') {
      const rowShift = normalizeShiftKey(row.ca, shiftOptions);
      const filterShift = normalizeShiftKey(filters.shiftFilter, shiftOptions);
      if (rowShift !== filterShift && !shiftNamesMatch(row.ca, filters.shiftFilter)) {
        return false;
      }
    }

    if (!shiftSummaryRowHasStaff(row, filters.staffFilter, sources)) {
      return false;
    }

    return shiftSummaryRowHasMachine(row, filters.machineFilter || 'all', sources, selectedMachine);
  });
}

export function collectShiftSummaryStaffOptions(sources: ShiftSummaryFilterSources) {
  const names = new Set<string>();

  sources.productionOrders.forEach(order => {
    splitStaffNames(order.staff).forEach(name => names.add(name));
  });
  sources.mixingReports.forEach(report => {
    splitStaffNames(report.nhan_su).forEach(name => names.add(name));
  });
  sources.warehouseMovements.forEach(movement => {
    splitStaffNames(movement.createdBy).forEach(name => names.add(name));
  });
  sources.machineNvlReports.forEach(report => {
    splitStaffNames(report.nhanSu).forEach(name => names.add(name));
  });
  sources.weighingRecords.forEach(record => {
    if (record.worker1?.trim()) names.add(record.worker1.trim());
    if (record.worker2?.trim()) names.add(record.worker2.trim());
  });

  return [...names].sort((a, b) => a.localeCompare(b, 'vi'));
}
