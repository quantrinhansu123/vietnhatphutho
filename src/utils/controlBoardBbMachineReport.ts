import { findProductByCode } from '../features/san-pham';
import { normalizeProductCodeKey, type ProductRow, type ProductNplItem } from '../features/san-pham/types';
import { findMachineByRef, type MachineRow } from '../features/danh-sach-may';
import type { MaterialRow } from '../features/kho-nvl';
import {
  getProductionOrderProductLines,
  parseProductionOrderQuantity,
  resolveProductUnitNormKg,
  resolveProductionOrderMachine,
  formatProductionOrderShiftLabel,
  type ProductionOrderRow,
  type ProductionOrderLookupSetting
} from '../features/ke-hoach-san-xuat';
import { parseProductionOrderFilterDate, splitProductionOrderStaffNames } from '../features/cai-dat-thoi-gian';
import type { ShiftSummaryWarehouseMovement } from './controlBoardShiftSummary';
import {
  computeKhoiLuongNhuaTp,
  computeMaterialUsageKg,
  computePercentRatio,
  computeShiftSummarySanLuongMetrics,
  computeSoTienLoLaiNhua,
  computeTlMangTpNhapKhoFromShiftSummary,
  computeTlNhuaTpNhapKhoFromShiftSummary,
  isWarehouseBagExportItem,
  isWarehouseCoreExportItem,
  isWarehouseFilmItem,
  isWarehousePlasticNvlLine,
  KHOI_LUONG_MANG_KG_PER_UNIT,
  machineValueMatchesFilter,
  matchesControlBoardDateRange,
  matchesShiftSummaryBucket,
  resolveMachineNvlLineMaterialType,
  resolveShiftSummaryGiaNhuaFromWarehouse,
  TI_LE_LOI_HONG_DINH_MUC_PERCENT
} from './controlBoardShiftSummary';
import type { MixingReport } from '../components/MixingReportForm';
import type { AcceptanceReport } from '../components/AcceptanceReportForm';
import {
  MIXING_ROUND_KEYS,
  getRoundBatchWeight,
  getRoundItems,
  resolveLineKlThucTe,
  roundNormWeight,
  sumReportNormTotal
} from '../lib/mixingReportModel';
import type { ShiftSetting } from './shiftSettings';
import { getProductionShiftOptions, shiftNamesMatch } from './shiftSettings';
import {
  convertWarehouseQuantityToKg,
  findMaterialTongKgPerUnit,
  isWarehouseKgUnit,
  mapMaterialToWeightCatalogItem,
  type WarehouseWeightCatalogItem
} from './warehouseWeight';
import {
  getWeighingDataRows,
  splitDamagedGoodsDefectWeights,
  type WeighingRecord
} from './weighingRecords';
import {
  sumMachineNvlCuoiCaLineTotal,
  sumMachineNvlDauCaLineTotal,
  type MachineNvlSavedReport
} from './machineNvlReports';

export type BbMachineReportTabId =
  | 'lenh_sx'
  | 'phieu_xuat_kho'
  | 'ton_dau_ca'
  | 'bao_cao_loi_hong'
  | 'kiem_ton_cuoi_ca'
  | 'phieu_nhap_kho'
  | 'tong_vat_tu_thuc_dung'
  | 'tong_dinh_muc_nvl_nhap_kho'
  | 'tong'
  | 'danh_gia_hao_hut';

export const BB_MACHINE_REPORT_TABS: Array<{ id: BbMachineReportTabId; label: string }> = [
  { id: 'lenh_sx', label: 'Dữ liệu trong lệnh sản xuất' },
  { id: 'phieu_xuat_kho', label: 'Dữ liệu trong phiếu xuất kho vật tư' },
  { id: 'ton_dau_ca', label: 'Báo cáo dữ liệu tồn đầu ca' },
  { id: 'bao_cao_loi_hong', label: 'Dữ liệu trong báo cáo lỗi hỏng' },
  { id: 'kiem_ton_cuoi_ca', label: 'Dữ liệu trong báo cáo kiểm tồn cuối ca' },
  { id: 'phieu_nhap_kho', label: 'Dữ liệu trong báo cáo phiếu nhập kho' },
  { id: 'tong_vat_tu_thuc_dung', label: 'Tổng vật tư thực xuất dùng & tỉ lệ trộn' },
  { id: 'tong_dinh_muc_nvl_nhap_kho', label: 'Tổng định mức vật tư của thành phẩm nhập kho' },
  { id: 'tong', label: 'Tổng' },
  { id: 'danh_gia_hao_hut', label: 'Đánh giá hiệu quả lỗi hỏng & hao hụt NVL' }
];

export type BbProductionOrderLineRow = {
  key: string;
  ngay: string;
  orderCode: string;
  machine: string;
  startDate: string;
  shift: string;
  shiftLabel: string;
  staffMain: string;
  staffAssistant: string;
  staffSupport: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  normKgPerUnit: number | null;
  totalNormKg: number | null;
};

export type BbWarehouseExportLineRow = {
  key: string;
  /** Khóa dòng phiếu gốc — dùng để không cộng trùng SL khi phân bổ nhiều SP. */
  slipLineKey: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  orderCode: string;
  machine: string;
  slipCode: string;
  itemCode: string;
  itemName: string;
  unit: string;
  /** SL thực xuất (kg: phân bổ % theo SL SP; ≠ kg: = SL định mức). */
  quantity: number;
  /** SL định mức theo ĐVT NVL (Thành phần × SL từng SP; ĐVT ≠ kg đã làm tròn nguyên). */
  normQuantity: number | null;
  /** KL định mức = SL định mức quy đổi sang kg. */
  normWeightKg: number | null;
  materialNorm: BbMaterialNormFormula | null;
  weightKg: number | null;
  /** Công thức KL thực xuất (click ô KL để xem). */
  weightFormula: BbExportWeightFormula | null;
  matchedByOrder: boolean;
};

export type BbMaterialNormFormula = {
  productCode: string;
  productName: string;
  productQuantity: number;
  productUnit: string;
  productNormKgPerUnit: number | null;
  materialCode: string;
  materialName: string;
  amountType: 'percent' | 'quantity';
  rate: number;
  rateUnit: string;
  rawExpectedQuantity: number;
  rawExpectedUnit: string;
  /** Hệ số kg/đvt lấy từ cột Tổng kg kho NVL */
  catalogKgPerUnit: number | null;
  totalNormKg: number;
  allocationRatio: number;
  allocatedNormKg: number;
};

export type BbExportWeightConvertMode =
  | 'kg_as_is'
  | 'multiply_tong_kg'
  | 'ton_to_kg'
  | 'gram_to_kg'
  | 'unknown';

/** Công thức SL/KL thực xuất (kg: % SL_SP × phiếu; ≠ kg: = định mức). */
export type BbExportWeightFormula = {
  itemCode: string;
  itemName: string;
  unit: string;
  /** SL thực xuất trên dòng này (đã phân bổ theo SP nếu có). */
  quantity: number;
  /** KL thực xuất trên dòng này (kg). */
  weightKg: number | null;
  convertMode: BbExportWeightConvertMode;
  /** Hệ số từ cột Tổng kg kho NVL (null nếu ĐVT kg / tấn / g). */
  catalogKgPerUnit: number | null;
  /** SL trên phiếu xuất gốc (trước phân bổ SP). */
  sourceQuantity: number;
  /** KL phiếu xuất gốc (trước phân bổ SP). */
  sourceWeightKg: number | null;
  /** Tỉ lệ phân bổ từ phiếu → SP (1 = không chia). */
  allocationRatio: number;
  /** SL sản phẩm (lệnh SX) dùng để tính nhu cầu Thành phần. */
  productQuantity: number | null;
  productUnit: string;
  /** Loại Thành phần: % hoặc số lượng. */
  bomAmountType: 'percent' | 'quantity' | null;
  /** Giá trị Thành phần (% hoặc SL NVL / 1 SP). */
  bomRate: number | null;
  bomRateUnit: string;
  /** Nhu cầu SP = SL SP × Thành phần (hoặc KL ĐM nếu loại %). */
  demandQuantity: number | null;
  /** Tổng nhu cầu các SP cùng NVL (mẫu số tỉ lệ %). */
  totalDemand: number | null;
  /** KL định mức của SP này (SL đặt × ĐM kg) — dùng làm tử số % phân bổ. */
  allocWeightBase: number | null;
  /** Tổng KL định mức các SP cùng NVL — mẫu số % phân bổ theo khối lượng. */
  allocWeightTotal: number | null;
};

function roundQty(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * ĐVT ≠ kg: làm tròn SL về số nguyên.
 * Phần thập phân &lt; 0.5 → xuống; &gt; 0.5 → lên; đúng 0.5 → làm tròn xuống.
 */
function roundNonKgQuantityToInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const whole = Math.floor(abs);
  const frac = abs - whole;
  // Dùng epsilon để nhận đúng 0.5 do lỗi float
  if (frac < 0.5 - 1e-9) return sign * whole;
  if (frac > 0.5 + 1e-9) return sign * (whole + 1);
  return sign * whole; // đúng .5 → xuống
}

function roundQuantityByUnit(value: number, unit: string): number {
  if (isWarehouseKgUnit(unit)) return roundQty(value, 3);
  return roundNonKgQuantityToInt(value);
}

/** Máy BB: mã/tên có "BB" hoặc "bao bì" (không phân biệt hoa thường / dấu). */
export function isBbMachineText(...candidates: Array<string | undefined | null>) {
  return candidates.some(value => {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return false;
    if (/bb/i.test(raw)) return true;
    const compact = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
    return compact.includes('baobi');
  });
}

export function isBbMachineRow(machine: Pick<MachineRow, 'code' | 'name' | 'type'> | null | undefined) {
  if (!machine) return false;
  return isBbMachineText(machine.code, machine.name, machine.type);
}

export function splitBbProductionOrderStaff(staff: string) {
  const names = splitProductionOrderStaffNames(staff);
  return {
    staffMain: names[0] || '',
    staffAssistant: names[1] || '',
    staffSupport: names.slice(2).join(', ')
  };
}

function findMachineForOrder(order: ProductionOrderRow, machines: MachineRow[]) {
  const candidates = [order.machine, order.position].map(value => String(value || '').trim()).filter(Boolean);
  if (candidates.length === 0) return null;
  return (
    machines.find(machine =>
      candidates.some(candidate => {
        const token = candidate.replace(/\s+/g, '').toUpperCase();
        const code = machine.code.replace(/\s+/g, '').toUpperCase();
        const name = machine.name.replace(/\s+/g, '').toUpperCase();
        return token === code || token === name || token.includes(code) || code.includes(token) || name.includes(token);
      })
    ) ?? null
  );
}

/** Tìm máy theo nhãn hiển thị (mã / tên / "mã · tên") — khớp mờ, bỏ khoảng trắng & phân biệt hoa thường. */
function findBbMachineByLabel(machines: MachineRow[], label: string): MachineRow | null {
  const exact = findMachineByRef(machines, label);
  if (exact) return exact;
  const token = String(label || '').replace(/\s+/g, '').toUpperCase();
  if (!token) return null;
  return (
    machines.find(machine => {
      const code = machine.code.replace(/\s+/g, '').toUpperCase();
      const name = machine.name.replace(/\s+/g, '').toUpperCase();
      return (
        (code && (token === code || token.includes(code) || code.includes(token))) ||
        (name && (token === name || token.includes(name) || name.includes(token)))
      );
    }) ?? null
  );
}

export function isBbProductionOrder(order: ProductionOrderRow, machines: MachineRow[]) {
  const resolved = resolveProductionOrderMachine(order, machines);
  const matched = findMachineForOrder(order, machines);
  return isBbMachineText(order.machine, order.position, resolved, matched?.code, matched?.name, matched?.type);
}

export function buildBbProductionOrderLineRows(input: {
  productionOrders: ProductionOrderRow[];
  products: ProductRow[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbProductionOrderLineRow[] {
  const shiftSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const rows: BbProductionOrderLineRow[] = [];

  for (const order of input.productionOrders) {
    if (!isBbProductionOrder(order, input.machines)) continue;

    const ngay = parseProductionOrderFilterDate(order.startDate);
    if (!matchesControlBoardDateRange(ngay || order.startDate, input.dateFrom, input.dateTo)) continue;

    const machineLabel = resolveProductionOrderMachine(order, input.machines);
    if (
      !machineValueMatchesFilter(
        input.machineFilter || 'all',
        input.selectedMachine ?? null,
        order.machine,
        order.position,
        machineLabel
      )
    ) {
      continue;
    }

    if (input.shiftFilter && input.shiftFilter !== 'all') {
      if (!shiftNamesMatch(order.shift, input.shiftFilter)) continue;
    }

    const staff = splitBbProductionOrderStaff(order.staff);
    const shiftLabel = formatProductionOrderShiftLabel(order.shift, shiftSettings);
    const productLines = getProductionOrderProductLines(order);

    productLines.forEach((line, index) => {
      const quantity = parseProductionOrderQuantity(line.quantity);
      const product = findProductByCode(input.products, line.productCode);
      const normKgPerUnit = resolveProductUnitNormKg(product);
      const totalNormKg =
        normKgPerUnit !== null && quantity > 0 ? roundQty(normKgPerUnit * quantity, 3) : null;

      rows.push({
        key: `${order.id || order.code}|${line.productCode || index}|${index}`,
        ngay: ngay || parseProductionOrderFilterDate(order.startDate) || '',
        orderCode: order.code,
        machine: machineLabel,
        startDate: order.startDate,
        shift: order.shift,
        shiftLabel,
        staffMain: staff.staffMain,
        staffAssistant: staff.staffAssistant,
        staffSupport: staff.staffSupport,
        productCode: line.productCode || '',
        productName: line.productName || '',
        unit: line.unit || '',
        quantity,
        normKgPerUnit,
        totalNormKg
      });
    });
  }

  return rows.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    const shiftCmp = a.shiftLabel.localeCompare(b.shiftLabel, 'vi');
    if (shiftCmp !== 0) return shiftCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

function resolveExportWeightConvertMode(
  unit: string,
  catalogKgPerUnit: number | null
): BbExportWeightConvertMode {
  if (isWarehouseKgUnit(unit)) return 'kg_as_is';
  const normalized = String(unit || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (
    normalized === 't' ||
    normalized === 'tan' ||
    normalized === 'ton' ||
    normalized === 'tonne' ||
    normalized === 'mt'
  ) {
    return 'ton_to_kg';
  }
  if (normalized === 'g' || normalized === 'gr' || normalized === 'gram' || normalized === 'gam') {
    return 'gram_to_kg';
  }
  if (catalogKgPerUnit !== null && catalogKgPerUnit > 0) return 'multiply_tong_kg';
  return 'unknown';
}

function buildExportWeightFormula(input: {
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  weightKg: number | null;
  materialsCatalog: WarehouseWeightCatalogItem[];
  sourceQuantity?: number;
  sourceWeightKg?: number | null;
  allocationRatio?: number;
  productQuantity?: number | null;
  productUnit?: string;
  bomAmountType?: 'percent' | 'quantity' | null;
  bomRate?: number | null;
  bomRateUnit?: string;
  demandQuantity?: number | null;
  totalDemand?: number | null;
  allocWeightBase?: number | null;
  allocWeightTotal?: number | null;
}): BbExportWeightFormula | null {
  const hasQty = input.quantity > 0;
  const hasKg = input.weightKg !== null && input.weightKg > 0;
  if (!hasQty && !hasKg) return null;
  const catalogKgPerUnit = findMaterialTongKgPerUnit(input.itemCode, input.materialsCatalog);
  return {
    itemCode: input.itemCode,
    itemName: input.itemName,
    unit: input.unit || '',
    quantity: hasQty ? input.quantity : 0,
    weightKg: hasKg ? input.weightKg : null,
    convertMode: resolveExportWeightConvertMode(input.unit || '', catalogKgPerUnit),
    catalogKgPerUnit,
    sourceQuantity:
      input.sourceQuantity !== undefined && input.sourceQuantity > 0
        ? input.sourceQuantity
        : hasQty
          ? input.quantity
          : 0,
    sourceWeightKg:
      input.sourceWeightKg !== undefined ? input.sourceWeightKg : input.weightKg,
    allocationRatio:
      input.allocationRatio !== undefined && Number.isFinite(input.allocationRatio)
        ? input.allocationRatio
        : 1,
    productQuantity:
      input.productQuantity !== undefined && input.productQuantity !== null && input.productQuantity > 0
        ? input.productQuantity
        : null,
    productUnit: input.productUnit || '',
    bomAmountType: input.bomAmountType ?? null,
    bomRate:
      input.bomRate !== undefined && input.bomRate !== null && Number.isFinite(input.bomRate)
        ? input.bomRate
        : null,
    bomRateUnit: input.bomRateUnit || '',
    demandQuantity:
      input.demandQuantity !== undefined && input.demandQuantity !== null && input.demandQuantity > 0
        ? input.demandQuantity
        : null,
    totalDemand:
      input.totalDemand !== undefined && input.totalDemand !== null && input.totalDemand > 0
        ? input.totalDemand
        : null,
    allocWeightBase:
      input.allocWeightBase !== undefined && input.allocWeightBase !== null && input.allocWeightBase > 0
        ? input.allocWeightBase
        : null,
    allocWeightTotal:
      input.allocWeightTotal !== undefined && input.allocWeightTotal !== null && input.allocWeightTotal > 0
        ? input.allocWeightTotal
        : null
  };
}

type ExportAllocationBomShare = {
  productQuantity: number;
  productUnit: string;
  bomAmountType: 'percent' | 'quantity' | null;
  bomRate: number | null;
  bomRateUnit: string;
  demandQuantity: number;
  totalDemand: number;
  allocWeightBase: number;
  allocWeightTotal: number;
};

function allocateExportWeightFormula(
  base: BbExportWeightFormula | null,
  allocatedQuantity: number,
  allocatedWeightKg: number | null,
  allocationRatio: number,
  bomShare?: ExportAllocationBomShare | null
): BbExportWeightFormula | null {
  const hasQty = allocatedQuantity > 0;
  const hasKg = allocatedWeightKg !== null && allocatedWeightKg > 0;
  if (!base || (!hasQty && !hasKg)) return null;
  return {
    ...base,
    quantity: hasQty ? allocatedQuantity : 0,
    weightKg: hasKg ? allocatedWeightKg : null,
    allocationRatio: Number.isFinite(allocationRatio) ? allocationRatio : 1,
    productQuantity: bomShare?.productQuantity ?? base.productQuantity,
    productUnit: bomShare?.productUnit || base.productUnit,
    bomAmountType: bomShare?.bomAmountType ?? base.bomAmountType,
    bomRate: bomShare?.bomRate ?? base.bomRate,
    bomRateUnit: bomShare?.bomRateUnit || base.bomRateUnit,
    demandQuantity: bomShare?.demandQuantity ?? base.demandQuantity,
    totalDemand: bomShare?.totalDemand ?? base.totalDemand,
    allocWeightBase: bomShare?.allocWeightBase ?? base.allocWeightBase,
    allocWeightTotal: bomShare?.allocWeightTotal ?? base.allocWeightTotal
  };
}

function resolveExportWeightKg(
  movement: ShiftSummaryWarehouseMovement,
  materials: MaterialRow[]
): number | null {
  const qty = Number(movement.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const catalog = materials.map(mapMaterialToWeightCatalogItem);
  const converted = convertWarehouseQuantityToKg({
    quantity: qty,
    unit: movement.unit,
    itemCode: movement.itemCode,
    warehouseKind: 'nvl',
    materials: catalog
  });
  if (converted === null || !Number.isFinite(converted) || converted <= 0) return null;
  return roundQty(converted, 3);
}

function movementMentionsOrderCode(movement: ShiftSummaryWarehouseMovement, orderCode: string) {
  const code = String(orderCode || '').trim().toLowerCase();
  if (!code) return false;
  const hay = `${movement.slipCode} ${movement.createdBy} ${movement.itemName} ${movement.itemCode} ${movement.reason || ''}`.toLowerCase();
  return hay.includes(code);
}

function parseWarehouseSlipOrderCodes(value: string | undefined | null): string[] {
  return String(value || '')
    .split(/[,;|/]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function movementMatchesOrderCode(movement: ShiftSummaryWarehouseMovement, orderCode: string) {
  const code = String(orderCode || '').trim().toUpperCase();
  if (!code) return false;
  const linked = parseWarehouseSlipOrderCodes(movement.reason).map(item => item.toUpperCase());
  if (linked.length > 0) return linked.includes(code);
  return movementMentionsOrderCode(movement, orderCode);
}

function orderIncludesProduct(order: ProductionOrderRow, productCode: string, productName: string) {
  const codeKey = normalizeProductCodeKey(productCode);
  const nameKey = normalizeProductCodeKey(productName);
  return getProductionOrderProductLines(order).some(line => {
    const lineCode = normalizeProductCodeKey(line.productCode);
    const lineName = normalizeProductCodeKey(line.productName);
    return (codeKey && lineCode === codeKey) || (nameKey && lineName === nameKey);
  });
}

export function buildBbWarehouseExportLineRows(input: {
  productionOrders: ProductionOrderRow[];
  warehouseMovements: ShiftSummaryWarehouseMovement[];
  materials: MaterialRow[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbWarehouseExportLineRow[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];

  const headers: Array<{
    ngay: string;
    shift: string;
    orderCode: string;
    machine: string;
  }> = [];
  const seenOrderKeys = new Set<string>();

  for (const order of input.productionOrders) {
    if (!isBbProductionOrder(order, input.machines)) continue;
    const ngay = parseProductionOrderFilterDate(order.startDate);
    if (!matchesControlBoardDateRange(ngay || order.startDate, input.dateFrom, input.dateTo)) continue;
    const machineLabel = resolveProductionOrderMachine(order, input.machines);
    if (
      !machineValueMatchesFilter(
        input.machineFilter || 'all',
        input.selectedMachine ?? null,
        order.machine,
        order.position,
        machineLabel
      )
    ) {
      continue;
    }
    if (input.shiftFilter && input.shiftFilter !== 'all') {
      if (!shiftNamesMatch(order.shift, input.shiftFilter)) continue;
    }
    const key = `${order.code}|${ngay}|${order.shift}`;
    if (seenOrderKeys.has(key)) continue;
    seenOrderKeys.add(key);
    headers.push({
      ngay: ngay || '',
      shift: order.shift,
      orderCode: order.code,
      machine: machineLabel
    });
  }

  if (headers.length === 0) return [];

  const materialsCatalog = input.materials.map(mapMaterialToWeightCatalogItem);
  const rows: BbWarehouseExportLineRow[] = [];

  for (const movement of input.warehouseMovements) {
    if (movement.slipType !== 'xuat' || movement.warehouseKind !== 'nvl') continue;
    if (!matchesControlBoardDateRange(movement.slipDate, input.dateFrom, input.dateTo)) continue;
    if (input.shiftFilter && input.shiftFilter !== 'all') {
      if (!shiftNamesMatch(movement.shift, input.shiftFilter)) continue;
    }

    const relatedOrders = headers.filter(order =>
      matchesShiftSummaryBucket(order.ngay, order.shift, movement.slipDate, movement.shift, shiftOptions)
    );
    if (relatedOrders.length === 0) continue;

    const explicitMatches = relatedOrders.filter(order => movementMatchesOrderCode(movement, order.orderCode));
    const matchedOrders = explicitMatches.length > 0 ? explicitMatches : relatedOrders;
    const matchedByOrder = explicitMatches.length > 0;
    const orderCode = [...new Set(matchedOrders.map(order => order.orderCode).filter(Boolean))].join(', ');
    const machine = [...new Set(matchedOrders.map(order => order.machine).filter(Boolean))].join(', ');

    const slipLineKey = `${movement.id || movement.slipCode}|${movement.itemCode}|${movement.slipDate}`;
    const quantity = Number.isFinite(movement.quantity) ? movement.quantity : 0;
    const weightKg = resolveExportWeightKg(movement, input.materials);
    rows.push({
      key: slipLineKey,
      slipLineKey,
      ngay: parseProductionOrderFilterDate(movement.slipDate) || movement.slipDate,
      shift: movement.shift,
      shiftLabel: formatProductionOrderShiftLabel(movement.shift, lookupSettings),
      orderCode,
      machine,
      slipCode: movement.slipCode,
      itemCode: movement.itemCode,
      itemName: movement.itemName,
      unit: movement.unit,
      quantity,
      normQuantity: null,
      normWeightKg: null,
      materialNorm: null,
      weightKg,
      weightFormula: buildExportWeightFormula({
        itemCode: movement.itemCode,
        itemName: movement.itemName,
        unit: movement.unit,
        quantity,
        weightKg,
        materialsCatalog
      }),
      matchedByOrder
    });
  }

  return rows.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    const shiftCmp = a.shiftLabel.localeCompare(b.shiftLabel, 'vi');
    if (shiftCmp !== 0) return shiftCmp;
    return a.slipCode.localeCompare(b.slipCode, 'vi');
  });
}

export function sumBbProductionOrderTotals(rows: BbProductionOrderLineRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.quantity += row.quantity > 0 ? row.quantity : 0;
      acc.totalNormKg += row.totalNormKg && row.totalNormKg > 0 ? row.totalNormKg : 0;
      return acc;
    },
    { quantity: 0, totalNormKg: 0 }
  );
}

export function sumBbWarehouseExportWeightKg(rows: BbWarehouseExportLineRow[]) {
  return rows.reduce((sum, row) => sum + (row.weightKg && row.weightKg > 0 ? row.weightKg : 0), 0);
}

/** Tổng SL đúng cột phiếu xuất kho — mỗi dòng phiếu chỉ cộng một lần. */
export function sumBbWarehouseExportSlipQuantity(rows: BbWarehouseExportLineRow[]) {
  const seen = new Set<string>();
  let sum = 0;
  for (const row of rows) {
    const id = row.slipLineKey || row.key;
    if (seen.has(id)) continue;
    seen.add(id);
    if (row.quantity > 0) sum += row.quantity;
  }
  return sum;
}

export type BbProductionOrderGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  startDate: string;
  machine: string;
  shift: string;
  shiftLabel: string;
  staffMain: string;
  staffAssistant: string;
  staffSupport: string;
  lineCount: number;
  quantity: number;
  totalNormKg: number;
  lines: BbProductionOrderLineRow[];
};

export type BbWarehouseExportGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  machine: string;
  lineCount: number;
  quantity: number;
  totalNormWeightKg: number;
  totalWeightKg: number;
  unmatchedCount: number;
  lines: BbWarehouseExportLineRow[];
  productGroups: BbWarehouseExportProductGroup[];
};

export type BbWarehouseExportProductGroup = {
  productKey: string;
  productCode: string;
  productName: string;
  unit: string;
  orderQuantity: number;
  normKgPerUnit: number | null;
  normWeightKg: number;
  lineCount: number;
  quantity: number;
  totalWeightKg: number;
  allocationMode: 'direct' | 'quota' | 'unassigned';
  lines: BbWarehouseExportLineRow[];
};

/** Gom dòng hàng theo số lệnh SX (giữ thứ tự ngày desc). */
export function groupBbProductionOrderLines(rows: BbProductionOrderLineRow[]): BbProductionOrderGroup[] {
  const map = new Map<string, BbProductionOrderGroup>();

  for (const row of rows) {
    const groupKey = row.orderCode.trim() || row.key;
    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, {
        groupKey,
        orderCode: row.orderCode,
        ngay: row.ngay,
        startDate: row.startDate,
        machine: row.machine,
        shift: row.shift,
        shiftLabel: row.shiftLabel,
        staffMain: row.staffMain,
        staffAssistant: row.staffAssistant,
        staffSupport: row.staffSupport,
        lineCount: 1,
        quantity: row.quantity > 0 ? row.quantity : 0,
        totalNormKg: row.totalNormKg && row.totalNormKg > 0 ? row.totalNormKg : 0,
        lines: [row]
      });
      continue;
    }
    existing.lineCount += 1;
    existing.quantity += row.quantity > 0 ? row.quantity : 0;
    existing.totalNormKg += row.totalNormKg && row.totalNormKg > 0 ? row.totalNormKg : 0;
    existing.lines.push(row);
  }

  return [...map.values()].sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

/** SL SP × Giá trị Thành phần → kg (ĐVT kg giữ nguyên; ĐVT khác: SL làm tròn nguyên rồi × Tổng kg). */
function resolveBomExpectedKg(
  item: ProductNplItem,
  orderQuantity: number,
  unitWeightKg: number | null,
  materialsCatalog: WarehouseWeightCatalogItem[]
): number | null {
  if (item.amountType === 'percent') {
    if (unitWeightKg === null || unitWeightKg <= 0) return null;
    const kg = unitWeightKg * orderQuantity * (Math.max(0, item.percent ?? 0) / 100);
    return kg > 0 ? kg : null;
  }

  const rawQty = Math.max(0, item.quantity ?? 0) * orderQuantity;
  if (rawQty <= 0) return null;

  const unit = String(item.unit || '').trim();
  // ĐVT kg (hoặc trống): KL = SL, không nhân thêm hệ số Tổng kg
  if (!unit || unit === '-' || isWarehouseKgUnit(unit)) {
    return rawQty > 0 ? rawQty : null;
  }

  // ĐVT ≠ kg: làm tròn SL về số nguyên (.5 làm tròn xuống) rồi mới quy đổi kg
  const qty = roundNonKgQuantityToInt(rawQty);
  if (qty <= 0) return null;

  const converted = convertWarehouseQuantityToKg({
    quantity: qty,
    unit,
    itemCode: item.code,
    warehouseKind: 'nvl',
    materials: materialsCatalog
  });
  return converted !== null && Number.isFinite(converted) && converted > 0 ? converted : null;
}

/**
 * SL sản phẩm theo ngày/ca/máy BB từ báo cáo nghiệm thu (dùng khi cần đối chiếu sản lượng).
 */
export function acceptanceQuantityForBbProduct(input: {
  ngay: string;
  shift: string;
  machine: string;
  productCode: string;
  productName: string;
  reports: AcceptanceReport[];
}): number {
  const codeKey = normalizeProductCodeKey(input.productCode);
  const nameKey = normalizeProductCodeKey(input.productName);
  if (!codeKey && !nameKey) return 0;

  return input.reports.reduce((sum, report) => {
    if (!isBbMachineText(report.ma_may, report.ten_may)) return sum;
    const reportDate = parseProductionOrderFilterDate(report.ngay) || report.ngay;
    if (reportDate !== input.ngay || !shiftNamesMatch(report.ca, input.shift)) return sum;
    if (
      !machineValueMatchesFilter(input.machine, null, report.ma_may, report.ten_may) &&
      !(isBbMachineText(input.machine) && isBbMachineText(report.ma_may, report.ten_may))
    ) {
      return sum;
    }
    const itemKey = normalizeProductCodeKey(report.mat_hang);
    const productMatched =
      (codeKey && (itemKey === codeKey || itemKey.includes(codeKey) || codeKey.includes(itemKey))) ||
      (nameKey && (itemKey === nameKey || itemKey.includes(nameKey) || nameKey.includes(itemKey)));
    if (!productMatched) return sum;
    const qty = Number(report.so_luong);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

/** Gom dòng xuất kho theo số lệnh SX (nhiều lệnh ghép → tách theo chuỗi orderCode). */
export function groupBbWarehouseExportLines(
  rows: BbWarehouseExportLineRow[],
  productionOrders: ProductionOrderRow[] = [],
  products: ProductRow[] = [],
  materials: MaterialRow[] = []
): BbWarehouseExportGroup[] {
  const map = new Map<string, BbWarehouseExportGroup>();

  for (const row of rows) {
    const groupKey = row.orderCode.trim() || `unlinked|${row.ngay}|${row.shift}`;
    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, {
        groupKey,
        orderCode: row.orderCode,
        ngay: row.ngay,
        shift: row.shift,
        shiftLabel: row.shiftLabel,
        machine: row.machine,
        lineCount: 1,
        quantity: row.quantity > 0 ? row.quantity : 0,
        totalNormWeightKg: 0,
        totalWeightKg: row.weightKg && row.weightKg > 0 ? row.weightKg : 0,
        unmatchedCount: row.matchedByOrder ? 0 : 1,
        lines: [row],
        productGroups: []
      });
      continue;
    }
    existing.lineCount += 1;
    existing.quantity += row.quantity > 0 ? row.quantity : 0;
    existing.totalWeightKg += row.weightKg && row.weightKg > 0 ? row.weightKg : 0;
    if (!row.matchedByOrder) existing.unmatchedCount += 1;
    existing.lines.push(row);
  }

  const groups = [...map.values()];
  groups.forEach(group => {
    group.productGroups = buildBbWarehouseExportProductGroups(group, productionOrders, products, materials);
    group.totalNormWeightKg = group.productGroups.reduce(
      (sum, productGroup) => sum + productGroup.normWeightKg,
      0
    );
  });

  return groups.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

/** Định mức NVL theo SL thành phẩm nhập kho (phiếu nhập kho TP), gom theo lệnh SX. */
export function buildBbInboundMaterialNormGroups(input: {
  productionOrders: ProductionOrderRow[];
  warehouseMovements: ShiftSummaryWarehouseMovement[];
  products: ProductRow[];
  materials: MaterialRow[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbWarehouseExportGroup[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const materialsCatalog = input.materials.map(mapMaterialToWeightCatalogItem);
  const inboundMovements = input.warehouseMovements.filter(
    movement => movement.slipType === 'nhap' && movement.warehouseKind === 'san_pham'
  );
  if (inboundMovements.length === 0) return [];

  const groups: BbWarehouseExportGroup[] = [];

  for (const header of headers) {
    const relatedOrders = input.productionOrders.filter(order => {
      if (String(order.code || '').trim().toUpperCase() !== String(header.orderCode || '').trim().toUpperCase()) {
        return false;
      }
      const ngay = parseProductionOrderFilterDate(order.startDate);
      if (header.ngay && ngay && ngay !== header.ngay) return false;
      return shiftNamesMatch(order.shift, header.shift);
    });

    const bucketMovements = inboundMovements.filter(movement => {
      if (!matchesControlBoardDateRange(movement.slipDate, input.dateFrom, input.dateTo)) return false;
      if (input.shiftFilter && input.shiftFilter !== 'all' && !shiftNamesMatch(movement.shift, input.shiftFilter)) {
        return false;
      }
      return matchesShiftSummaryBucket(header.ngay, header.shift, movement.slipDate, movement.shift, shiftOptions);
    });
    if (bucketMovements.length === 0) continue;

    const explicitMatches = bucketMovements.filter(movement => movementMatchesOrderCode(movement, header.orderCode));
    const matchedMovements =
      explicitMatches.length > 0
        ? explicitMatches
        : bucketMovements.filter(movement =>
            relatedOrders.some(order => orderIncludesProduct(order, movement.itemCode, movement.itemName))
          );
    if (matchedMovements.length === 0) continue;

    const productMap = new Map<string, BbWarehouseExportProductGroup>();
    const matchedByOrder = explicitMatches.length > 0;

    for (const movement of matchedMovements) {
      const productCode = String(movement.itemCode || '').trim();
      const productName = String(movement.itemName || '').trim();
      const productKey = normalizeProductCodeKey(productCode) || normalizeProductCodeKey(productName) || movement.id;
      const inboundQty = Math.max(0, Number(movement.quantity) || 0);
      if (inboundQty <= 0) continue;

      const catalogProduct = findProductByCode(input.products, productCode);
      let productGroup = productMap.get(productKey);
      if (!productGroup) {
        productGroup = {
          productKey,
          productCode,
          productName: productName || catalogProduct?.name || productCode,
          unit: String(movement.unit || catalogProduct?.unit || '').trim(),
          orderQuantity: 0,
          normKgPerUnit: resolveProductUnitNormKg(catalogProduct),
          normWeightKg: 0,
          lineCount: 0,
          quantity: 0,
          totalWeightKg: 0,
          allocationMode: 'direct',
          lines: []
        };
        productMap.set(productKey, productGroup);
      }

      productGroup.quantity += inboundQty;
      productGroup.orderQuantity += inboundQty;
      productGroup.lineCount += 1;

      const unitNorm = productGroup.normKgPerUnit;
      const productWeightKg = unitNorm !== null && unitNorm > 0 ? roundQty(unitNorm * inboundQty, 3) : 0;
      productGroup.totalWeightKg += productWeightKg;

      const movementPrefix = `${movement.id || movement.slipCode}|${movement.itemCode}|`;
      for (const item of catalogProduct?.nplItems || []) {
        const materialKey = normalizeProductCodeKey(item.code);
        if (!materialKey) continue;
        const expectedKg = resolveBomExpectedKg(item, inboundQty, unitNorm, materialsCatalog);
        if (expectedKg === null || expectedKg <= 0) continue;

        productGroup.lines.push({
          key: `${movementPrefix}${materialKey}`,
          slipLineKey: `${movementPrefix}${materialKey}`,
          ngay: parseProductionOrderFilterDate(movement.slipDate) || movement.slipDate,
          shift: movement.shift,
          shiftLabel: formatProductionOrderShiftLabel(movement.shift, lookupSettings),
          orderCode: header.orderCode,
          machine: header.machine,
          slipCode: movement.slipCode,
          itemCode: item.code,
          itemName: item.name || item.code,
          unit: item.unit || 'kg',
          quantity:
            item.amountType === 'quantity'
              ? roundQuantityByUnit(Math.max(0, item.quantity ?? 0) * inboundQty, item.unit || '')
              : expectedKg,
          normQuantity:
            item.amountType === 'quantity'
              ? roundQuantityByUnit(Math.max(0, item.quantity ?? 0) * inboundQty, item.unit || '')
              : expectedKg,
          normWeightKg: expectedKg,
          materialNorm: null,
          weightKg: expectedKg,
          weightFormula: null,
          matchedByOrder
        });
      }
    }

    const productGroups = [...productMap.values()]
      .map(productGroup => {
        productGroup.normWeightKg = productGroup.lines.reduce(
          (sum, line) => sum + (line.normWeightKg || 0),
          0
        );
        return productGroup;
      })
      .filter(productGroup => productGroup.quantity > 0 || productGroup.lines.length > 0);
    if (productGroups.length === 0) continue;

    const groupKey = header.orderCode.trim() || `unlinked|${header.ngay}|${header.shift}`;
    groups.push({
      groupKey,
      orderCode: header.orderCode,
      ngay: header.ngay,
      shift: header.shift,
      shiftLabel: formatProductionOrderShiftLabel(header.shift, lookupSettings),
      machine: header.machine,
      lineCount: productGroups.reduce((sum, productGroup) => sum + productGroup.lineCount, 0),
      quantity: productGroups.reduce((sum, productGroup) => sum + productGroup.quantity, 0),
      totalNormWeightKg: productGroups.reduce((sum, productGroup) => sum + productGroup.normWeightKg, 0),
      totalWeightKg: productGroups.reduce((sum, productGroup) => sum + productGroup.totalWeightKg, 0),
      unmatchedCount: matchedByOrder ? 0 : matchedMovements.length,
      lines: productGroups.flatMap(productGroup => productGroup.lines),
      productGroups
    });
  }

  return groups.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

type WarehouseProductAllocation = BbWarehouseExportProductGroup & {
  /** KL định mức (kg) theo mã NVL — đã quy đổi từ kho NVL nếu ĐVT ≠ kg. */
  materialWeights: Map<string, number>;
  /** Chi tiết phép tính định mức để hiển thị khi người dùng bấm vào số. */
  materialFormulas: Map<string, BbMaterialNormFormula>;
  /** Mã NVL có trong Thành phần (kể cả khi chưa quy đổi được kg). */
  materialKeys: Set<string>;
  usedQuotaAllocation: boolean;
};

/**
 * Chia dòng NVL xuất kho về từng sản phẩm trong lệnh.
 * ĐVT kg: %_i = SL_SP_i / Σ SL_SP → SL/KL thực xuất = % × phiếu xuất (phần cuối nhận dư).
 * ĐVT ≠ kg: SL thực xuất = SL định mức (SL đặt × Thành phần), không chia % phiếu.
 * Định mức (KL) vẫn tính theo Thành phần × SL từng SP.
 */
function buildBbWarehouseExportProductGroups(
  group: BbWarehouseExportGroup,
  productionOrders: ProductionOrderRow[],
  products: ProductRow[],
  materials: MaterialRow[] = []
): BbWarehouseExportProductGroup[] {
  const materialsCatalog = materials.map(mapMaterialToWeightCatalogItem);
  const orderCodes = group.orderCode
    .split(',')
    .map(code => code.trim())
    .filter(Boolean);
  const codeSet = new Set(orderCodes.map(code => code.toUpperCase()));
  const relatedOrders = productionOrders.filter(order => {
    if (codeSet.size > 0 && !codeSet.has(String(order.code || '').trim().toUpperCase())) return false;
    const ngay = parseProductionOrderFilterDate(order.startDate) || order.startDate;
    if (group.ngay && ngay && ngay !== group.ngay) return false;
    return shiftNamesMatch(order.shift, group.shift);
  });

  type ProductDraft = WarehouseProductAllocation & {
    catalogProduct: ProductRow | null | undefined;
  };
  const productMap = new Map<string, ProductDraft>();
  relatedOrders.forEach(order => {
    getProductionOrderProductLines(order).forEach((line, lineIndex) => {
      const productCode = String(line.productCode || '').trim();
      const productName = String(line.productName || '').trim();
      const productKey = normalizeProductCodeKey(productCode) || `__product_${lineIndex}`;
      const orderQuantity = Math.max(0, parseProductionOrderQuantity(line.quantity));
      const catalogProduct = findProductByCode(products, productCode);
      let productGroup = productMap.get(productKey);
      if (!productGroup) {
        productGroup = {
          productKey,
          productCode,
          productName: productName || catalogProduct?.name || productCode,
          unit: String(line.unit || catalogProduct?.unit || '').trim(),
          orderQuantity: 0,
          catalogProduct,
          normKgPerUnit: resolveProductUnitNormKg(catalogProduct),
          normWeightKg: 0,
          lineCount: 0,
          quantity: 0,
          totalWeightKg: 0,
          allocationMode: 'direct',
          lines: [],
          materialWeights: new Map<string, number>(),
          materialFormulas: new Map<string, BbMaterialNormFormula>(),
          materialKeys: new Set<string>(),
          usedQuotaAllocation: false
        };
        productMap.set(productKey, productGroup);
      }
      productGroup.orderQuantity += orderQuantity;
      if (!productGroup.unit) {
        productGroup.unit = String(line.unit || catalogProduct?.unit || '').trim();
      }
      if (catalogProduct) productGroup.catalogProduct = catalogProduct;
    });
  });

  for (const productGroup of productMap.values()) {
    const orderQuantity = Math.max(0, productGroup.orderQuantity);
    const catalogProduct = productGroup.catalogProduct;
    const resolvedNormKg = resolveProductUnitNormKg(catalogProduct);
    if (resolvedNormKg !== null && resolvedNormKg > 0) {
      productGroup.normKgPerUnit = resolvedNormKg;
      productGroup.normWeightKg = resolvedNormKg * orderQuantity;
    }
    for (const item of catalogProduct?.nplItems || []) {
      const materialKey = normalizeProductCodeKey(item.code);
      if (!materialKey) continue;
      productGroup.materialKeys.add(materialKey);
      const expectedKg = resolveBomExpectedKg(item, orderQuantity, resolvedNormKg, materialsCatalog);
      if (expectedKg === null) continue;
      const rate =
        item.amountType === 'quantity'
          ? Math.max(0, item.quantity ?? 0)
          : Math.max(0, item.percent ?? 0);
      const rawExpectedQuantity =
        item.amountType === 'quantity'
          ? roundQuantityByUnit(rate * orderQuantity, item.unit || '')
          : expectedKg;
      const catalogKgPerUnit =
        item.amountType === 'quantity' && !isWarehouseKgUnit(item.unit || '')
          ? findMaterialTongKgPerUnit(item.code, materialsCatalog)
          : null;
      // KL định mức: ưu tiên quy đổi từ SL đã làm tròn (ĐVT ≠ kg)
      const totalNormKg =
        item.amountType === 'quantity' &&
        !isWarehouseKgUnit(item.unit || '') &&
        catalogKgPerUnit !== null &&
        catalogKgPerUnit > 0
          ? roundQty(rawExpectedQuantity * catalogKgPerUnit, 3)
          : expectedKg;
      productGroup.materialWeights.set(
        materialKey,
        (productGroup.materialWeights.get(materialKey) ?? 0) + totalNormKg
      );
      productGroup.materialFormulas.set(materialKey, {
        productCode: productGroup.productCode,
        productName: productGroup.productName,
        productQuantity: orderQuantity,
        productUnit: productGroup.unit || 'SP',
        productNormKgPerUnit: resolvedNormKg,
        materialCode: item.code,
        materialName: item.name || item.code,
        amountType: item.amountType,
        rate,
        rateUnit: item.amountType === 'quantity' ? item.unit || 'đơn vị' : '%',
        rawExpectedQuantity,
        rawExpectedUnit: item.amountType === 'quantity' ? item.unit || 'đơn vị' : 'kg',
        catalogKgPerUnit,
        totalNormKg,
        allocationRatio: 1,
        allocatedNormKg: totalNormKg
      });
    }
  }

  const productGroups = [...productMap.values()];
  const unassigned: WarehouseProductAllocation = {
    productKey: '__unassigned__',
    productCode: '',
    productName: 'Chưa xác định sản phẩm',
    unit: '',
    orderQuantity: 0,
    normKgPerUnit: null,
    normWeightKg: 0,
    lineCount: 0,
    quantity: 0,
    totalWeightKg: 0,
    allocationMode: 'unassigned',
    lines: [],
    materialWeights: new Map<string, number>(),
    materialFormulas: new Map<string, BbMaterialNormFormula>(),
    materialKeys: new Set<string>(),
    usedQuotaAllocation: false
  };

  const addAllocatedLine = (
    target: WarehouseProductAllocation,
    row: BbWarehouseExportLineRow,
    allocatedQuantity: number,
    allocatedWeightKg: number | null,
    suffix: string,
    allocationRatio = 1,
    bomShare: ExportAllocationBomShare | null = null
  ) => {
    const qty = allocatedQuantity > 0 ? allocatedQuantity : 0;
    const weightKg =
      allocatedWeightKg === null ? null : allocatedWeightKg > 0 ? allocatedWeightKg : 0;
    target.lines.push({
      ...row,
      key: `${row.slipLineKey}|${suffix}`,
      slipLineKey: row.slipLineKey,
      quantity: qty,
      weightKg,
      normQuantity: null,
      normWeightKg: null,
      materialNorm: null,
      weightFormula: allocateExportWeightFormula(
        row.weightFormula,
        qty,
        weightKg,
        allocationRatio,
        bomShare
      )
    });
    target.quantity += qty;
    target.totalWeightKg += weightKg && weightKg > 0 ? weightKg : 0;
    target.lineCount += 1;
  };

  /** Nhu cầu phân bổ = SL SP × Thành phần (số lượng) hoặc KL ĐM (loại %). */
  const resolveAllocationDemand = (
    product: WarehouseProductAllocation,
    materialKey: string
  ): ExportAllocationBomShare => {
    const formula = materialKey ? product.materialFormulas.get(materialKey) ?? null : null;
    if (formula) {
      const demand =
        formula.amountType === 'quantity'
          ? Math.max(0, formula.rawExpectedQuantity)
          : Math.max(0, formula.totalNormKg);
      return {
        productQuantity: Math.max(0, formula.productQuantity),
        productUnit: formula.productUnit || product.unit || '',
        bomAmountType: formula.amountType,
        bomRate: Number.isFinite(formula.rate) ? formula.rate : null,
        bomRateUnit: formula.rateUnit || '',
        demandQuantity: demand,
        totalDemand: demand,
        allocWeightBase: 0,
        allocWeightTotal: 0
      };
    }
    const fallback = Math.max(0, product.orderQuantity);
    return {
      productQuantity: fallback,
      productUnit: product.unit || '',
      bomAmountType: null,
      bomRate: null,
      bomRateUnit: '',
      demandQuantity: fallback,
      totalDemand: fallback,
      allocWeightBase: 0,
      allocWeightTotal: 0
    };
  };

  /**
   * ĐVT kg: % = SL_SP / Σ SL_SP; SL/KL thực xuất = % × phiếu (phần cuối nhận dư).
   * ĐVT ≠ kg: tạm gắn dòng theo phiếu; sau đó syncNonKgActualQuantityToNorm ghi đè = định mức.
   */
  const allocateExportByProductShare = (
    targets: WarehouseProductAllocation[],
    row: BbWarehouseExportLineRow
  ) => {
    if (targets.length === 0) return;
    const materialKey = normalizeProductCodeKey(row.itemCode);
    const bomShares = targets.map(product => resolveAllocationDemand(product, materialKey));
    const totalOrderQty = targets.reduce((sum, product) => sum + Math.max(0, product.orderQuantity), 0);
    // % phân bổ lấy theo KL định mức (SL đặt × ĐM kg) của từng SP; thiếu ĐM thì lùi về SL đặt.
    const totalNormWeight = targets.reduce((sum, product) => sum + Math.max(0, product.normWeightKg || 0), 0);
    const useNormWeight = totalNormWeight > 0;
    const sharesWithTotal = bomShares.map((share, index) => ({
      ...share,
      productQuantity: Math.max(0, targets[index]?.orderQuantity ?? share.productQuantity),
      totalDemand: totalOrderQty > 0 ? totalOrderQty : share.totalDemand,
      allocWeightBase: Math.max(0, targets[index]?.normWeightKg || 0),
      allocWeightTotal: totalNormWeight
    }));

    if (targets.length === 1) {
      targets[0].usedQuotaAllocation = false;
      addAllocatedLine(
        targets[0],
        row,
        row.quantity,
        row.weightKg,
        targets[0].productKey,
        1,
        sharesWithTotal[0] || null
      );
      return;
    }

    let assignedQty = 0;
    let assignedKg = 0;
    const rowQty = Math.max(0, row.quantity);
    const rowKg = row.weightKg !== null && row.weightKg > 0 ? row.weightKg : 0;
    const qtyIsNonKg = !isWarehouseKgUnit(row.unit || '');

    targets.forEach((product, index) => {
      const isLast = index === targets.length - 1;
      const orderQty = Math.max(0, product.orderQuantity);
      const normWeight = Math.max(0, product.normWeightKg || 0);
      // % phân bổ = KL định mức SP ÷ tổng KL định mức; thiếu ĐM thì dùng SL đặt.
      const ratio = useNormWeight
        ? normWeight / totalNormWeight
        : totalOrderQty > 0
          ? orderQty / totalOrderQty
          : 1 / targets.length;
      // ĐVT ≠ kg: SL phân bổ tạm (sẽ ghi đè = định mức); kg giữ thập phân theo % KL định mức
      const qtyShare = isLast
        ? qtyIsNonKg
          ? roundNonKgQuantityToInt(rowQty - assignedQty)
          : roundQty(rowQty - assignedQty)
        : qtyIsNonKg
          ? roundNonKgQuantityToInt(rowQty * ratio)
          : roundQty(rowQty * ratio);
      const kgShare =
        row.weightKg === null
          ? null
          : isLast
            ? roundQty(rowKg - assignedKg)
            : roundQty(rowKg * ratio);
      if (qtyShare > 0) assignedQty += qtyShare;
      if (kgShare !== null && kgShare > 0) assignedKg += kgShare;
      product.usedQuotaAllocation = true;
      addAllocatedLine(
        product,
        row,
        qtyShare,
        kgShare,
        product.productKey,
        ratio,
        sharesWithTotal[index] || null
      );
    });
  };

  for (const row of group.lines) {
    if (productGroups.length === 1) {
      allocateExportByProductShare(productGroups, row);
      continue;
    }

    const materialKey = normalizeProductCodeKey(row.itemCode);
    const matchedProducts = productGroups.filter(product => product.materialKeys.has(materialKey));
    if (matchedProducts.length === 0) {
      if (productGroups.length > 0) {
        allocateExportByProductShare(productGroups, row);
      } else {
        addAllocatedLine(unassigned, row, row.quantity, row.weightKg, 'unassigned');
      }
      continue;
    }

    // Nhiều SP cùng NVL: ĐVT kg → % theo SL_SP; ĐVT ≠ kg → sau đó = định mức
    allocateExportByProductShare(matchedProducts, row);
  }

  /** Gán KL định mức (kg) từng dòng NVL từ Thành phần (đã quy đổi ĐVT qua kho NVL). */
  const applyLineNormWeights = (target: WarehouseProductAllocation) => {
    const linesByMaterial = new Map<string, BbWarehouseExportLineRow[]>();
    for (const line of target.lines) {
      const materialKey = normalizeProductCodeKey(line.itemCode);
      if (!materialKey || !target.materialKeys.has(materialKey)) {
        line.normWeightKg = null;
        line.materialNorm = null;
        continue;
      }
      const bucket = linesByMaterial.get(materialKey);
      if (bucket) bucket.push(line);
      else linesByMaterial.set(materialKey, [line]);
    }

    for (const [materialKey, lines] of linesByMaterial) {
      const expected = Math.max(0, target.materialWeights.get(materialKey) ?? 0);
      const baseFormula = target.materialFormulas.get(materialKey) ?? null;
      const expectedNormQty =
        baseFormula && baseFormula.amountType === 'quantity'
          ? Math.max(0, baseFormula.rawExpectedQuantity)
          : null;
      const normQtyUnit = baseFormula?.rawExpectedUnit || lines[0]?.unit || '';

      const assignNorm = (
        line: BbWarehouseExportLineRow,
        value: number | null,
        normQty: number | null,
        ratio: number
      ) => {
        line.normWeightKg = value;
        line.normQuantity = normQty;
        line.materialNorm =
          baseFormula && value !== null
            ? { ...baseFormula, allocationRatio: ratio, allocatedNormKg: value }
            : null;
      };

      if (expected <= 0) {
        lines.forEach(line => {
          assignNorm(line, null, null, 0);
        });
        continue;
      }

      // NVL ĐVT = kg (thường khai báo dạng %): SL định mức = KL định mức (kg).
      const normQtyFromKg = (line: BbWarehouseExportLineRow, kgShare: number): number | null =>
        expectedNormQty === null && isWarehouseKgUnit(line.unit || '') ? kgShare : null;

      const totalQty = lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
      if (totalQty <= 0) {
        const kgShare = roundQty(expected);
        assignNorm(lines[0], kgShare, expectedNormQty ?? normQtyFromKg(lines[0], kgShare), 1);
        lines.slice(1).forEach(line => {
          assignNorm(line, null, null, 0);
        });
        continue;
      }

      let assignedKg = 0;
      let assignedNormQty = 0;
      lines.forEach((line, index) => {
        const ratio = Math.max(0, line.quantity) / totalQty;
        const isLast = index === lines.length - 1;
        const kgShare = isLast ? roundQty(expected - assignedKg) : roundQty(expected * ratio);
        let qtyShare: number | null = null;
        if (expectedNormQty !== null) {
          qtyShare = isLast
            ? roundQuantityByUnit(expectedNormQty - assignedNormQty, normQtyUnit)
            : roundQuantityByUnit(expectedNormQty * ratio, normQtyUnit);
          if (qtyShare > 0) assignedNormQty += qtyShare;
        } else {
          qtyShare = normQtyFromKg(line, kgShare);
        }
        if (kgShare > 0) assignedKg += kgShare;
        assignNorm(line, kgShare, qtyShare, ratio);
      });
    }
  };

  /** ĐVT ≠ kg: SL thực xuất = đúng SL định mức; KL theo định mức (hoặc × Tổng kg kho NVL). */
  const syncNonKgActualQuantityToNorm = (target: WarehouseProductAllocation) => {
    for (const line of target.lines) {
      if (isWarehouseKgUnit(line.unit || '')) continue;
      if (line.normQuantity === null || !(line.normQuantity >= 0)) continue;
      const newQty = Math.max(0, line.normQuantity);
      let newKg =
        line.normWeightKg !== null && line.normWeightKg > 0 ? line.normWeightKg : null;
      if (newKg === null && newQty > 0) {
        const catalogKg = findMaterialTongKgPerUnit(line.itemCode, materialsCatalog);
        if (catalogKg !== null && catalogKg > 0) {
          newKg = roundQty(newQty * catalogKg, 3);
        }
      }
      line.quantity = newQty;
      line.weightKg = newKg;
      if (line.weightFormula) {
        const bom = line.materialNorm;
        line.weightFormula = {
          ...line.weightFormula,
          quantity: newQty,
          weightKg: newKg,
          allocationRatio: 1,
          productQuantity: bom?.productQuantity ?? line.weightFormula.productQuantity,
          productUnit: bom?.productUnit || line.weightFormula.productUnit,
          bomAmountType: bom?.amountType ?? line.weightFormula.bomAmountType,
          bomRate: bom?.rate ?? line.weightFormula.bomRate,
          bomRateUnit: bom?.rateUnit || line.weightFormula.bomRateUnit,
          demandQuantity: newQty,
          totalDemand: newQty
        };
      }
    }
    target.quantity = target.lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
    target.totalWeightKg = target.lines.reduce(
      (sum, line) => sum + (line.weightKg && line.weightKg > 0 ? line.weightKg : 0),
      0
    );
  };

  applyLineNormWeights(unassigned);
  productGroups.forEach(applyLineNormWeights);
  syncNonKgActualQuantityToNorm(unassigned);
  productGroups.forEach(syncNonKgActualQuantityToNorm);

  if (unassigned.lines.length > 0) {
    productGroups.push({
      ...unassigned,
      catalogProduct: null
    });
  }
  return productGroups.map(product => {
    const {
      materialWeights: _materialWeights,
      materialFormulas: _materialFormulas,
      materialKeys: _materialKeys,
      usedQuotaAllocation,
      catalogProduct: _catalogProduct,
      ...rest
    } = product;
    return {
      ...rest,
      allocationMode:
        rest.allocationMode === 'unassigned' ? 'unassigned' : usedQuotaAllocation ? 'quota' : 'direct'
    };
  });
}

export type BbDamagedGoodsLineRow = {
  key: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  orderCode: string;
  machine: string;
  documentNo: string;
  productCode: string;
  productName: string;
  materialCode: string;
  materialName: string;
  unit: string;
  weightKg: number;
  matchedByOrder: boolean;
};

export type BbDamagedGoodsGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  machine: string;
  lineCount: number;
  totalWeightKg: number;
  lines: BbDamagedGoodsLineRow[];
};

const DAMAGED_NVL_LABELS = [
  { code: 'NHUA-KM', name: 'Nhựa không mảng lỗi hỏng', field: 'nhuaKhongMang' as const },
  { code: 'NHUA-DN', name: 'Nhựa cục đầu nòng lỗi hỏng', field: 'nhuaCucDauNong' as const },
  { code: 'NHUA-DM', name: 'Nhựa lỗi dính màng', field: 'nhuaDinhMang' as const },
  { code: 'MANG-LH', name: 'Màng lỗi hỏng', field: 'mang' as const },
  { code: 'LOI-LH', name: 'Lõi dính trong hàng hỏng', field: 'loi' as const }
];

function matchBbNvlReportToOrderHeaders(
  report: Pick<MachineNvlSavedReport, 'ngay' | 'ca' | 'maMay' | 'tenMay'>,
  headers: Array<{ ngay: string; shift: string; orderCode: string; machine: string }>,
  shiftOptions: ReturnType<typeof getProductionShiftOptions>
) {
  const ngay = parseProductionOrderFilterDate(report.ngay);
  const relatedOrders = headers.filter(order =>
    matchesShiftSummaryBucket(order.ngay, order.shift, ngay || report.ngay, report.ca, shiftOptions)
  );
  if (relatedOrders.length === 0) return [];

  const machineMatched = relatedOrders.filter(
    order =>
      machineValueMatchesFilter(order.machine, null, report.maMay, report.tenMay) ||
      (isBbMachineText(report.maMay, report.tenMay) && isBbMachineText(order.machine))
  );
  if (machineMatched.length > 0) return machineMatched;

  // Phiếu tồn ca thường ghi "Máy Bao Bì" — vẫn gắn theo ngày + ca lệnh BB.
  if (isBbMachineText(report.maMay, report.tenMay) || relatedOrders.some(order => isBbMachineText(order.machine))) {
    return relatedOrders;
  }
  return relatedOrders;
}

function collectBbOrderHeaders(input: {
  productionOrders: ProductionOrderRow[];
  machines: MachineRow[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}) {
  const headers: Array<{
    ngay: string;
    shift: string;
    orderCode: string;
    machine: string;
  }> = [];
  const seen = new Set<string>();

  for (const order of input.productionOrders) {
    if (!isBbProductionOrder(order, input.machines)) continue;
    const ngay = parseProductionOrderFilterDate(order.startDate);
    if (!matchesControlBoardDateRange(ngay || order.startDate, input.dateFrom, input.dateTo)) continue;
    const machineLabel = resolveProductionOrderMachine(order, input.machines);
    if (
      !machineValueMatchesFilter(
        input.machineFilter || 'all',
        input.selectedMachine ?? null,
        order.machine,
        order.position,
        machineLabel
      )
    ) {
      continue;
    }
    if (input.shiftFilter && input.shiftFilter !== 'all' && !shiftNamesMatch(order.shift, input.shiftFilter)) {
      continue;
    }
    const key = `${order.code}|${ngay}|${order.shift}`;
    if (seen.has(key)) continue;
    seen.add(key);
    headers.push({
      ngay: ngay || '',
      shift: order.shift,
      orderCode: order.code,
      machine: machineLabel
    });
  }

  return headers;
}

export type BbOrderCodeOption = {
  code: string;
  ngay: string;
  shiftLabel: string;
  machine: string;
  label: string;
};

/** DS số lệnh SX máy BB (theo bộ lọc ngày/ca/máy hiện tại) để chọn tickbox nhiều lệnh. */
export function buildBbOrderCodeOptions(input: {
  productionOrders: ProductionOrderRow[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbOrderCodeOption[] {
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const seen = new Set<string>();
  const options: BbOrderCodeOption[] = [];

  for (const order of input.productionOrders) {
    if (!isBbProductionOrder(order, input.machines)) continue;
    const code = String(order.code || '').trim();
    if (!code || seen.has(code)) continue;
    const ngay = parseProductionOrderFilterDate(order.startDate);
    if (!matchesControlBoardDateRange(ngay || order.startDate, input.dateFrom, input.dateTo)) continue;
    const machineLabel = resolveProductionOrderMachine(order, input.machines);
    if (
      !machineValueMatchesFilter(
        input.machineFilter || 'all',
        input.selectedMachine ?? null,
        order.machine,
        order.position,
        machineLabel
      )
    ) {
      continue;
    }
    if (input.shiftFilter && input.shiftFilter !== 'all' && !shiftNamesMatch(order.shift, input.shiftFilter)) {
      continue;
    }
    seen.add(code);
    const shiftLabel = formatProductionOrderShiftLabel(order.shift, lookupSettings);
    options.push({
      code,
      ngay: ngay || '',
      shiftLabel,
      machine: machineLabel,
      label: ngay ? `${code} · ${ngay}` : code
    });
  }

  return options.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.code.localeCompare(b.code, 'vi');
  });
}

/** Dòng NVL từ báo cáo lỗi hỏng gắn lệnh BB (ngày + ca + máy BB). */
export function buildBbDamagedGoodsLineRows(input: {
  productionOrders: ProductionOrderRow[];
  damagedRecords: WeighingRecord[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbDamagedGoodsLineRow[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const rows: BbDamagedGoodsLineRow[] = [];

  for (const record of getWeighingDataRows(input.damagedRecords)) {
    const ngay = parseProductionOrderFilterDate(record.productionDate || record.reportDate);
    if (!matchesControlBoardDateRange(ngay || record.productionDate, input.dateFrom, input.dateTo)) continue;
    if (input.shiftFilter && input.shiftFilter !== 'all' && !shiftNamesMatch(record.shiftName, input.shiftFilter)) {
      continue;
    }
    if (
      !machineValueMatchesFilter(
        input.machineFilter || 'all',
        input.selectedMachine ?? null,
        record.machineName
      )
    ) {
      continue;
    }

    const relatedOrders = headers.filter(order =>
      matchesShiftSummaryBucket(order.ngay, order.shift, ngay || record.productionDate, record.shiftName, shiftOptions)
    );
    if (relatedOrders.length === 0) continue;

    const machineMatched = relatedOrders.filter(
      order =>
        machineValueMatchesFilter(order.machine, null, record.machineName) ||
        (isBbMachineText(record.machineName) && isBbMachineText(order.machine))
    );
    const matchedOrders =
      machineMatched.length > 0
        ? machineMatched
        : isBbMachineText(record.machineName)
          ? relatedOrders
          : [];
    if (matchedOrders.length === 0) continue;

    const orderCode = [...new Set(matchedOrders.map(order => order.orderCode).filter(Boolean))].join(', ');
    const machine =
      String(record.machineName || '').trim() ||
      [...new Set(matchedOrders.map(order => order.machine).filter(Boolean))].join(', ');
    const split = splitDamagedGoodsDefectWeights(record);
    const shiftLabel = formatProductionOrderShiftLabel(record.shiftName, lookupSettings);

    for (const item of DAMAGED_NVL_LABELS) {
      const weightKg = split[item.field];
      if (!Number.isFinite(weightKg) || weightKg <= 0) continue;
      rows.push({
        key: `${record.id || record.documentNo}|${item.code}|${ngay}|${record.shiftName}`,
        ngay: ngay || '',
        shift: record.shiftName,
        shiftLabel,
        orderCode,
        machine,
        documentNo: record.documentNo || '',
        productCode: record.productCode || '',
        productName: record.productName || '',
        materialCode: item.code,
        materialName: item.name,
        unit: 'kg',
        weightKg: roundQty(weightKg, 3),
        matchedByOrder: true
      });
    }
  }

  return rows.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    const orderCmp = a.orderCode.localeCompare(b.orderCode, 'vi');
    if (orderCmp !== 0) return orderCmp;
    return a.materialName.localeCompare(b.materialName, 'vi');
  });
}

export function sumBbDamagedGoodsWeightKg(rows: BbDamagedGoodsLineRow[]) {
  return rows.reduce((sum, row) => sum + (row.weightKg > 0 ? row.weightKg : 0), 0);
}

export function groupBbDamagedGoodsLines(rows: BbDamagedGoodsLineRow[]): BbDamagedGoodsGroup[] {
  const map = new Map<string, BbDamagedGoodsGroup>();

  for (const row of rows) {
    const groupKey = row.orderCode.trim() || `unlinked|${row.ngay}|${row.shift}`;
    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, {
        groupKey,
        orderCode: row.orderCode,
        ngay: row.ngay,
        shift: row.shift,
        shiftLabel: row.shiftLabel,
        machine: row.machine,
        lineCount: 1,
        totalWeightKg: row.weightKg > 0 ? row.weightKg : 0,
        lines: [row]
      });
      continue;
    }
    existing.lineCount += 1;
    existing.totalWeightKg += row.weightKg > 0 ? row.weightKg : 0;
    existing.lines.push(row);
  }

  return [...map.values()].sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

export type BbCuoiCaLineRow = {
  key: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  orderCode: string;
  machine: string;
  reportId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  weightKg: number;
};

export type BbCuoiCaGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  machine: string;
  lineCount: number;
  totalWeightKg: number;
  lines: BbCuoiCaLineRow[];
};

/** Dòng NVL từ báo cáo kiểm tồn cuối ca gắn lệnh BB (ngày + ca + máy BB). */
export function buildBbCuoiCaLineRows(input: {
  productionOrders: ProductionOrderRow[];
  machineNvlReports: MachineNvlSavedReport[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbCuoiCaLineRow[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const rows: BbCuoiCaLineRow[] = [];

  for (const report of input.machineNvlReports) {
    if (report.reportKind !== 'cuoi_ca') continue;
    const ngay = parseProductionOrderFilterDate(report.ngay);
    if (!matchesControlBoardDateRange(ngay || report.ngay, input.dateFrom, input.dateTo)) continue;
    if (input.shiftFilter && input.shiftFilter !== 'all' && !shiftNamesMatch(report.ca, input.shiftFilter)) {
      continue;
    }
    if (
      !machineValueMatchesFilter(
        input.machineFilter || 'all',
        input.selectedMachine ?? null,
        report.maMay,
        report.tenMay
      )
    ) {
      continue;
    }

    const matchedOrders = matchBbNvlReportToOrderHeaders(report, headers, shiftOptions);
    if (matchedOrders.length === 0) continue;

    const orderCode = [...new Set(matchedOrders.map(order => order.orderCode).filter(Boolean))].join(', ');
    const machine =
      String(report.tenMay || report.maMay || '').trim() ||
      [...new Set(matchedOrders.map(order => order.machine).filter(Boolean))].join(', ');
    const shiftLabel = formatProductionOrderShiftLabel(report.ca, lookupSettings);

    report.lines.forEach((line, index) => {
      const weightKg = sumMachineNvlCuoiCaLineTotal(line);
      const quantity =
        Number.isFinite(line.soLuongTon) && line.soLuongTon > 0
          ? line.soLuongTon
          : (line.soLuongTrongMay ?? 0) +
            (line.soLuongTrongBonTron ?? 0) +
            (line.soLuongNlChuaTron ?? 0) +
            (line.soLuongTonNgoai ?? 0);
      if ((!Number.isFinite(weightKg) || weightKg <= 0) && (!Number.isFinite(quantity) || quantity <= 0)) {
        return;
      }
      rows.push({
        key: `${report.id}|${line.maNvl || index}|${index}`,
        ngay: ngay || report.ngay,
        shift: report.ca,
        shiftLabel,
        orderCode,
        machine,
        reportId: report.id,
        itemCode: line.maNvl || '',
        itemName: line.tenNvl || '',
        unit: line.donVi || '',
        quantity: Number.isFinite(quantity) ? quantity : 0,
        weightKg: Number.isFinite(weightKg) && weightKg > 0 ? roundQty(weightKg, 3) : 0
      });
    });
  }

  return rows.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    const orderCmp = a.orderCode.localeCompare(b.orderCode, 'vi');
    if (orderCmp !== 0) return orderCmp;
    return a.itemCode.localeCompare(b.itemCode, 'vi');
  });
}

export function sumBbCuoiCaWeightKg(rows: BbCuoiCaLineRow[]) {
  return rows.reduce((sum, row) => sum + (row.weightKg > 0 ? row.weightKg : 0), 0);
}

export function groupBbCuoiCaLines(rows: BbCuoiCaLineRow[]): BbCuoiCaGroup[] {
  const map = new Map<string, BbCuoiCaGroup>();

  for (const row of rows) {
    const groupKey = row.orderCode.trim() || `unlinked|${row.ngay}|${row.shift}`;
    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, {
        groupKey,
        orderCode: row.orderCode,
        ngay: row.ngay,
        shift: row.shift,
        shiftLabel: row.shiftLabel,
        machine: row.machine,
        lineCount: 1,
        totalWeightKg: row.weightKg > 0 ? row.weightKg : 0,
        lines: [row]
      });
      continue;
    }
    existing.lineCount += 1;
    existing.totalWeightKg += row.weightKg > 0 ? row.weightKg : 0;
    existing.lines.push(row);
  }

  return [...map.values()].sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

export type BbDauCaLineRow = {
  key: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  orderCode: string;
  machine: string;
  reportId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  weightKg: number;
};

export type BbDauCaGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  machine: string;
  lineCount: number;
  totalWeightKg: number;
  lines: BbDauCaLineRow[];
};

/** Dòng NVL từ báo cáo tồn đầu ca gắn lệnh BB (ngày + ca + máy BB). */
export function buildBbDauCaLineRows(input: {
  productionOrders: ProductionOrderRow[];
  machineNvlReports: MachineNvlSavedReport[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbDauCaLineRow[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const rows: BbDauCaLineRow[] = [];

  for (const report of input.machineNvlReports) {
    if (report.reportKind !== 'dau_ca') continue;
    const ngay = parseProductionOrderFilterDate(report.ngay);
    if (!matchesControlBoardDateRange(ngay || report.ngay, input.dateFrom, input.dateTo)) continue;
    if (input.shiftFilter && input.shiftFilter !== 'all' && !shiftNamesMatch(report.ca, input.shiftFilter)) {
      continue;
    }
    if (
      !machineValueMatchesFilter(
        input.machineFilter || 'all',
        input.selectedMachine ?? null,
        report.maMay,
        report.tenMay
      )
    ) {
      continue;
    }

    const matchedOrders = matchBbNvlReportToOrderHeaders(report, headers, shiftOptions);
    if (matchedOrders.length === 0) continue;

    const orderCode = [...new Set(matchedOrders.map(order => order.orderCode).filter(Boolean))].join(', ');
    const machine =
      String(report.tenMay || report.maMay || '').trim() ||
      [...new Set(matchedOrders.map(order => order.machine).filter(Boolean))].join(', ');
    const shiftLabel = formatProductionOrderShiftLabel(report.ca, lookupSettings);

    report.lines.forEach((line, index) => {
      const weightKg = sumMachineNvlDauCaLineTotal(line);
      const quantity =
        Number.isFinite(line.soLuongTon) && line.soLuongTon > 0
          ? line.soLuongTon
          : (line.soLuongTrongMay ?? 0) +
            (line.soLuongTrongBonTron ?? 0) +
            (line.soLuongNlChuaTron ?? 0) +
            (line.soLuongTonNgoai ?? 0);
      if ((!Number.isFinite(weightKg) || weightKg <= 0) && (!Number.isFinite(quantity) || quantity <= 0)) {
        return;
      }
      rows.push({
        key: `${report.id}|${line.maNvl || index}|${index}`,
        ngay: ngay || report.ngay,
        shift: report.ca,
        shiftLabel,
        orderCode,
        machine,
        reportId: report.id,
        itemCode: line.maNvl || '',
        itemName: line.tenNvl || '',
        unit: line.donVi || '',
        quantity: Number.isFinite(quantity) ? quantity : 0,
        weightKg: Number.isFinite(weightKg) && weightKg > 0 ? roundQty(weightKg, 3) : 0
      });
    });
  }

  return rows.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    const orderCmp = a.orderCode.localeCompare(b.orderCode, 'vi');
    if (orderCmp !== 0) return orderCmp;
    return a.itemCode.localeCompare(b.itemCode, 'vi');
  });
}

export function sumBbDauCaWeightKg(rows: BbDauCaLineRow[]) {
  return rows.reduce((sum, row) => sum + (row.weightKg > 0 ? row.weightKg : 0), 0);
}

export function groupBbDauCaLines(rows: BbDauCaLineRow[]): BbDauCaGroup[] {
  const map = new Map<string, BbDauCaGroup>();

  for (const row of rows) {
    const groupKey = row.orderCode.trim() || `unlinked|${row.ngay}|${row.shift}`;
    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, {
        groupKey,
        orderCode: row.orderCode,
        ngay: row.ngay,
        shift: row.shift,
        shiftLabel: row.shiftLabel,
        machine: row.machine,
        lineCount: 1,
        totalWeightKg: row.weightKg > 0 ? row.weightKg : 0,
        lines: [row]
      });
      continue;
    }
    existing.lineCount += 1;
    existing.totalWeightKg += row.weightKg > 0 ? row.weightKg : 0;
    existing.lines.push(row);
  }

  return [...map.values()].sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

export type BbThucDungLineRow = {
  key: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  orderCode: string;
  machine: string;
  materialCode: string;
  materialName: string;
  unit: string;
  tiLeDinhMucPercent: number | null;
  tiLeThucTeTbPercent: number | null;
  batchCount: number;
  /** Tổng xuất kho NVL trong ca (cùng lệnh) — dùng để tính TL đã trộn. */
  xuatTrongCaKg: number;
  trongLuongDaTronKg: number;
  tonDauKg: number;
  /** true khi tồn đầu lấy từ NNS-TRON × tỉ lệ TB thực tế. */
  tonDauFromNnsTron: boolean;
  /** KL NNS-TRON tồn đầu ca dùng để phân bổ (nếu có). */
  nnsTronTonDauKg: number | null;
  tonCuoiKg: number;
  weightKg: number;
};

export type BbThucDungGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  machine: string;
  lineCount: number;
  totalWeightKg: number;
  tonDauCaTotal: number;
  tonCuoiCaTotal: number;
  xuatCaTotal: number;
  lines: BbThucDungLineRow[];
};

type MaterialBucket = { nhua: number; mang: number; loi: number; tui: number };

function emptyMaterialBucket(): MaterialBucket {
  return { nhua: 0, mang: 0, loi: 0, tui: 0 };
}

function addMaterialBucket(target: MaterialBucket, source: MaterialBucket) {
  target.nhua += source.nhua;
  target.mang += source.mang;
  target.loi += source.loi;
  target.tui += source.tui;
}

function resolveMovementExportKg(
  movement: ShiftSummaryWarehouseMovement,
  materials: MaterialRow[]
): number {
  const qty = Number(movement.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const catalog = materials.map(mapMaterialToWeightCatalogItem);
  const converted = convertWarehouseQuantityToKg({
    quantity: qty,
    unit: movement.unit,
    itemCode: movement.itemCode,
    warehouseKind: 'nvl',
    materials: catalog
  });
  if (converted !== null && Number.isFinite(converted) && converted > 0) return converted;
  return 0;
}

function classifyExportMovementKg(
  movement: ShiftSummaryWarehouseMovement,
  materials: MaterialRow[]
): MaterialBucket {
  const zero = emptyMaterialBucket();
  if (movement.slipType !== 'xuat' || movement.warehouseKind !== 'nvl') return zero;
  const kg = resolveMovementExportKg(movement, materials);
  if (kg <= 0) return zero;
  if (isWarehouseCoreExportItem(movement.itemCode || '', movement.itemName || '')) {
    return { ...zero, loi: kg };
  }
  if (isWarehouseBagExportItem(movement.itemCode || '', movement.itemName || '')) {
    return { ...zero, tui: kg };
  }
  if (isWarehouseFilmItem(movement.itemCode || '', movement.itemName || '', movement.unit || '')) {
    return { ...zero, mang: kg };
  }
  if (isWarehousePlasticNvlLine(movement)) {
    return { ...zero, nhua: kg };
  }
  const unit = String(movement.unit || '').toLowerCase();
  if (unit.includes('m2') || unit.includes('m²')) return { ...zero, mang: kg };
  return { ...zero, nhua: kg };
}

function classifyMachineNvlLineKg(
  report: MachineNvlSavedReport,
  line: MachineNvlSavedReport['lines'][number]
): MaterialBucket {
  const zero = emptyMaterialBucket();
  const kg =
    report.reportKind === 'dau_ca'
      ? sumMachineNvlDauCaLineTotal(line)
      : sumMachineNvlCuoiCaLineTotal(line);
  if (!Number.isFinite(kg) || kg <= 0) return zero;
  const materialType = resolveMachineNvlLineMaterialType(line);
  if (materialType === 'loi') return { ...zero, loi: kg };
  if (materialType === 'bao_bi') return { ...zero, tui: kg };
  if (materialType === 'mang') return { ...zero, mang: kg };
  return { ...zero, nhua: kg };
}

function materialIdentityKey(code: string, name: string) {
  return (String(code || '').trim() || String(name || '').trim()).toUpperCase();
}

function normalizeMaterialCodeKey(code: string) {
  return String(code || '').trim().toUpperCase();
}

/**
 * Gom kg tồn đầu/cuối theo mã NVL — cùng cách gắn phiếu tồn với lệnh như tab Tồn đầu ca.
 * Ưu tiên index theo maNvl; dòng không có mã thì fallback theo tên.
 */
function sumMachineNvlKgByCodeForHeader(
  reports: MachineNvlSavedReport[],
  header: { ngay: string; shift: string; orderCode: string; machine: string },
  shiftOptions: ReturnType<typeof getProductionShiftOptions>,
  reportKind: 'dau_ca' | 'cuoi_ca'
) {
  const byCode = new Map<string, number>();
  const byName = new Map<string, number>();

  for (const report of reports) {
    if (report.reportKind !== reportKind) continue;
    const reportDate = parseProductionOrderFilterDate(report.ngay);
    if (
      !matchesShiftSummaryBucket(
        header.ngay,
        header.shift,
        reportDate || report.ngay,
        report.ca,
        shiftOptions
      )
    ) {
      continue;
    }

    for (const line of report.lines) {
      const code = normalizeMaterialCodeKey(line.maNvl || '');
      const name = String(line.tenNvl || '')
        .trim()
        .toUpperCase();
      const kg =
        reportKind === 'dau_ca' ? sumMachineNvlDauCaLineTotal(line) : sumMachineNvlCuoiCaLineTotal(line);
      if (!Number.isFinite(kg) || kg <= 0) continue;
      if (code) {
        byCode.set(code, (byCode.get(code) || 0) + kg);
      } else if (name) {
        byName.set(name, (byName.get(name) || 0) + kg);
      }
    }
  }

  return { byCode, byName };
}

function lookupMachineNvlKgByMaterial(
  maps: { byCode: Map<string, number>; byName: Map<string, number> },
  materialCode: string,
  materialName: string
) {
  const code = normalizeMaterialCodeKey(materialCode);
  if (code && maps.byCode.has(code)) return maps.byCode.get(code) || 0;
  const name = String(materialName || '')
    .trim()
    .toUpperCase();
  if (name && maps.byName.has(name)) return maps.byName.get(name) || 0;
  return 0;
}

/** Mã tồn hỗn hợp dùng để phân bổ tồn đầu theo tỉ lệ TB thực tế cho các NVL khác. */
const NNS_TRON_MATERIAL_CODE = 'NNS-TRON';

function isNnsTronMaterialCode(code: string) {
  const key = normalizeMaterialCodeKey(code).replace(/[\s_]+/g, '-');
  return key === NNS_TRON_MATERIAL_CODE || key === 'NNSTRON';
}

function lookupNnsTronTonDauKg(maps: {
  byCode: Map<string, number>;
  byName: Map<string, number>;
}) {
  for (const [code, kg] of maps.byCode.entries()) {
    if (isNnsTronMaterialCode(code) && Number.isFinite(kg) && kg > 0) return kg;
  }
  for (const [name, kg] of maps.byName.entries()) {
    const key = String(name || '')
      .trim()
      .toUpperCase()
      .replace(/[\s_]+/g, '-');
    if ((key === NNS_TRON_MATERIAL_CODE || key.includes('NNS-TRON')) && Number.isFinite(kg) && kg > 0) {
      return kg;
    }
  }
  return 0;
}

type MixingThucDungAgg = {
  materialCode: string;
  materialName: string;
  unit: string;
  tiLeDinhMucSum: number;
  tiLeDinhMucCount: number;
  tiLeThucTeSum: number;
  tiLeThucTeCount: number;
  totalKlThucTe: number;
};

/** Thực dùng theo từng NVL từ báo cáo trộn: TL đã trộn + tồn đầu − tồn cuối.
 * TL đã trộn = Tổng xuất trong ca × Tỉ lệ TB thực tế (%).
 */
export function buildBbThucDungLineRows(input: {
  productionOrders: ProductionOrderRow[];
  mixingReports: MixingReport[];
  warehouseMovements: ShiftSummaryWarehouseMovement[];
  machineNvlReports: MachineNvlSavedReport[];
  materials: MaterialRow[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbThucDungLineRow[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const rows: BbThucDungLineRow[] = [];

  for (const header of headers) {
    const byMaterial = new Map<string, MixingThucDungAgg>();
    // Tỉ lệ ĐM (%) lấy từ cấu hình "tỉ lệ trộn" của máy (Danh sách máy) theo từng NVL.
    const machineRow = findBbMachineByLabel(input.machines, header.machine);
    const machineRatioByCode = new Map<string, number>();
    const machineRatioByName = new Map<string, number>();
    if (machineRow) {
      for (const ratio of machineRow.mixingRatios) {
        const pct = Number(String(ratio.percent ?? '').trim().replace(',', '.'));
        if (!Number.isFinite(pct)) continue;
        const codeKey = normalizeProductCodeKey(ratio.materialCode);
        if (codeKey) machineRatioByCode.set(codeKey, pct);
        const nameKey = (ratio.materialName || '').trim().toLowerCase();
        if (nameKey) machineRatioByName.set(nameKey, pct);
      }
    }
    /** Tỉ lệ ĐM lấy thẳng từ Tỷ lệ trộn của máy theo NVL; không có thì để trống (—). */
    const resolveMachineDinhMuc = (code: string, name: string): number | null => {
      const codeKey = normalizeProductCodeKey(code);
      if (codeKey && machineRatioByCode.has(codeKey)) return machineRatioByCode.get(codeKey)!;
      const nameKey = (name || '').trim().toLowerCase();
      if (nameKey && machineRatioByName.has(nameKey)) return machineRatioByName.get(nameKey)!;
      return null;
    };
    const tonDauMaps = sumMachineNvlKgByCodeForHeader(
      input.machineNvlReports,
      header,
      shiftOptions,
      'dau_ca'
    );
    const tonCuoiMaps = sumMachineNvlKgByCodeForHeader(
      input.machineNvlReports,
      header,
      shiftOptions,
      'cuoi_ca'
    );
    const nnsTronTonDauKg = lookupNnsTronTonDauKg(tonDauMaps);

    // Báº£ng thá»±c dÃ¹ng pháº£i hiá»ƒn thá»‹ Ä‘á»§ NVL cá»§a bÃ¡o cÃ¡o tá»“n cÃ¹ng ngÃ y + ca,
    // ká»ƒ cáº£ khi NVL Ä‘Ã³ khÃ´ng xuáº¥t hiá»‡n trong bÃ¡o cÃ¡o trá»™n.
    for (const report of input.machineNvlReports) {
      if (report.reportKind !== 'dau_ca' && report.reportKind !== 'cuoi_ca') continue;
      const reportDate = parseProductionOrderFilterDate(report.ngay);
      if (
        !matchesShiftSummaryBucket(
          header.ngay,
          header.shift,
          reportDate || report.ngay,
          report.ca,
          shiftOptions
        )
      ) {
        continue;
      }
      for (const line of report.lines) {
        const code = String(line.maNvl || '').trim();
        const name = String(line.tenNvl || '').trim();
        const key = materialIdentityKey(code, name);
        if (!key || byMaterial.has(key)) continue;
        byMaterial.set(key, {
          materialCode: code,
          materialName: name,
          unit: String(line.donVi || 'kg').trim() || 'kg',
          tiLeDinhMucSum: 0,
          tiLeDinhMucCount: 0,
          tiLeThucTeSum: 0,
          tiLeThucTeCount: 0,
          totalKlThucTe: 0
        });
      }
    }

    let tongXuatTrongCaKg = 0;
    for (const movement of input.warehouseMovements) {
      if (movement.slipType !== 'xuat' || movement.warehouseKind !== 'nvl') continue;
      if (
        !matchesShiftSummaryBucket(
          header.ngay,
          header.shift,
          movement.slipDate,
          movement.shift,
          shiftOptions
        )
      ) {
        continue;
      }
      tongXuatTrongCaKg += resolveMovementExportKg(movement, input.materials);
    }
    tongXuatTrongCaKg = roundQty(tongXuatTrongCaKg, 3);

    for (const report of input.mixingReports) {
      if (
        !matchesShiftSummaryBucket(header.ngay, header.shift, report.ngay, report.ca, shiftOptions)
      ) {
        continue;
      }
      if (!isBbMachineText(report.ma_may, report.ten_may)) continue;
      if (
        !machineValueMatchesFilter(header.machine, null, report.ma_may, report.ten_may) &&
        !(isBbMachineText(header.machine) && isBbMachineText(report.ma_may, report.ten_may))
      ) {
        continue;
      }

      for (const line of report.chi_tiet || []) {
        const lineCode = String(line.ma_nvl || '').trim();
        const lineName = String(line.ten_vat_tu || '').trim();
        let countedItemWeight = false;

        for (const roundKey of MIXING_ROUND_KEYS) {
          const items = getRoundItems(line.lan_su_dung, roundKey);
          if (items.length === 0) continue;
          const batchWeight =
            getRoundBatchWeight(line.lan_su_dung, roundKey) ??
            roundNormWeight(items.reduce((sum, item) => sum + (item.so_luong ?? item.kl_thuc_te ?? 0), 0));
          if (!batchWeight || batchWeight <= 0) continue;

          for (const item of items) {
            const code = String(item.ma_nvl || lineCode || '').trim();
            const name = String(item.ten_vat_tu || lineName || '').trim();
            const key = materialIdentityKey(code, name);
            if (!key) continue;

            let agg = byMaterial.get(key);
            if (!agg) {
              agg = {
                materialCode: code,
                materialName: name,
                unit: String(item.don_vi || line.don_vi || 'kg').trim() || 'kg',
                tiLeDinhMucSum: 0,
                tiLeDinhMucCount: 0,
                tiLeThucTeSum: 0,
                tiLeThucTeCount: 0,
                totalKlThucTe: 0
              };
              byMaterial.set(key, agg);
            } else {
              if (!agg.materialCode && code) agg.materialCode = code;
              if (!agg.materialName && name) agg.materialName = name;
            }

            const dinhMuc = item.ti_le_phan_tram;
            if (dinhMuc !== null && dinhMuc !== undefined && Number.isFinite(dinhMuc)) {
              agg.tiLeDinhMucSum += dinhMuc;
              agg.tiLeDinhMucCount += 1;
            }

            const klThucTe = item.kl_thuc_te;
            if (klThucTe !== null && klThucTe !== undefined && Number.isFinite(klThucTe) && klThucTe > 0) {
              countedItemWeight = true;
              const tiLeThucTe = (klThucTe / batchWeight) * 100;
              agg.tiLeThucTeSum += tiLeThucTe;
              agg.tiLeThucTeCount += 1;
              agg.totalKlThucTe += klThucTe;
            }
          }
        }

        if (countedItemWeight) continue;
        const lineKl = resolveLineKlThucTe(line);
        if (lineKl === null || lineKl <= 0) continue;
        const key = materialIdentityKey(lineCode, lineName);
        if (!key) continue;
        let agg = byMaterial.get(key);
        if (!agg) {
          agg = {
            materialCode: lineCode,
            materialName: lineName,
            unit: String(line.don_vi || 'kg').trim() || 'kg',
            tiLeDinhMucSum: 0,
            tiLeDinhMucCount: 0,
            tiLeThucTeSum: 0,
            tiLeThucTeCount: 0,
            totalKlThucTe: 0
          };
          byMaterial.set(key, agg);
        }
        agg.totalKlThucTe += lineKl;
      }
    }

    if (byMaterial.size === 0) continue;

    const shiftLabel = formatProductionOrderShiftLabel(header.shift, lookupSettings);
    for (const [materialKey, agg] of byMaterial.entries()) {
      const tiLeThucTeTbPercent =
        agg.tiLeThucTeCount > 0 ? roundQty(agg.tiLeThucTeSum / agg.tiLeThucTeCount, 2) : null;
      // Trọng lượng đã trộn = Tổng xuất trong ca × Tỉ lệ TB thực tế (%)
      const trongLuongDaTronKg =
        tiLeThucTeTbPercent !== null && Number.isFinite(tiLeThucTeTbPercent)
          ? roundQty(tongXuatTrongCaKg * (tiLeThucTeTbPercent / 100), 3)
          : 0;
      const directTonDauKg = roundQty(
        lookupMachineNvlKgByMaterial(tonDauMaps, agg.materialCode, agg.materialName),
        3
      );
      // Có NNS-TRON tồn đầu → điền tồn đầu các NVL khác = NNS-TRON × tỉ lệ TB thực tế.
      const useNnsTronTonDau =
        !isNnsTronMaterialCode(agg.materialCode) &&
        nnsTronTonDauKg > 0 &&
        tiLeThucTeTbPercent !== null &&
        Number.isFinite(tiLeThucTeTbPercent) &&
        tiLeThucTeTbPercent > 0;
      const tonDauKg = useNnsTronTonDau
        ? roundQty(nnsTronTonDauKg * (tiLeThucTeTbPercent / 100), 3)
        : directTonDauKg;
      const tonCuoiKg = roundQty(
        lookupMachineNvlKgByMaterial(tonCuoiMaps, agg.materialCode, agg.materialName),
        3
      );
      // Thực dùng (kg) = Trọng lượng đã trộn + Tồn đầu − Tồn cuối
      const weightKg = computeMaterialUsageKg(trongLuongDaTronKg, tonDauKg, tonCuoiKg);
      if (
        (!Number.isFinite(weightKg) || weightKg === 0) &&
        trongLuongDaTronKg <= 0 &&
        tonDauKg <= 0 &&
        tonCuoiKg <= 0 &&
        tongXuatTrongCaKg <= 0
      ) {
        continue;
      }
      rows.push({
        key: `${header.orderCode}|${header.ngay}|${header.shift}|${materialKey}`,
        ngay: header.ngay,
        shift: header.shift,
        shiftLabel,
        orderCode: header.orderCode,
        machine: header.machine,
        materialCode: agg.materialCode,
        materialName: agg.materialName,
        unit: agg.unit,
        tiLeDinhMucPercent: (() => {
          const fromMachine = resolveMachineDinhMuc(agg.materialCode, agg.materialName);
          return fromMachine === null ? null : roundQty(fromMachine, 2);
        })(),
        tiLeThucTeTbPercent,
        batchCount: agg.tiLeThucTeCount,
        xuatTrongCaKg: tongXuatTrongCaKg,
        trongLuongDaTronKg,
        tonDauKg,
        tonDauFromNnsTron: useNnsTronTonDau,
        nnsTronTonDauKg: useNnsTronTonDau ? nnsTronTonDauKg : null,
        tonCuoiKg,
        weightKg: roundQty(weightKg, 3)
      });
    }
  }

  return rows.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    const orderCmp = a.orderCode.localeCompare(b.orderCode, 'vi');
    if (orderCmp !== 0) return orderCmp;
    return a.materialName.localeCompare(b.materialName, 'vi');
  });
}

export function sumBbThucDungWeightKg(rows: BbThucDungLineRow[]) {
  return rows.reduce((sum, row) => sum + (Number.isFinite(row.weightKg) ? row.weightKg : 0), 0);
}

export type BbThucDungDetailMetric =
  | 'ti_le_dinh_muc'
  | 'ti_le_thuc_te'
  | 'trong_luong_da_tron'
  | 'ton_dau'
  | 'ton_cuoi'
  | 'thuc_dung'
  | 'so_me';

export const BB_THUC_DUNG_DETAIL_METRIC_LABEL: Record<BbThucDungDetailMetric, string> = {
  ti_le_dinh_muc: 'Tỉ lệ định mức (%)',
  ti_le_thuc_te: 'Tỉ lệ TB thực tế (%)',
  trong_luong_da_tron: 'Trọng lượng đã trộn (kg)',
  ton_dau: 'Tồn đầu (kg)',
  ton_cuoi: 'Tồn cuối (kg)',
  thuc_dung: 'Thực dùng (kg)',
  so_me: 'Số mẻ có KL thực tế'
};

export type BbThucDungDetailColumn = { key: string; label: string; align?: 'left' | 'right' };
export type BbThucDungDetailRow = {
  metric: BbThucDungDetailMetric;
  title: string;
  subtitle: string;
  valueLabel: string;
  valueText: string;
  formula?: string;
  columns: BbThucDungDetailColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
};

function materialCodeMatches(left: string, right: string) {
  const a = normalizeMaterialCodeKey(left);
  const b = normalizeMaterialCodeKey(right);
  return Boolean(a && b && a === b);
}

function materialNameMatches(left: string, right: string) {
  const a = String(left || '')
    .trim()
    .toUpperCase();
  const b = String(right || '')
    .trim()
    .toUpperCase();
  return Boolean(a && b && a === b);
}

function materialMatchesLine(
  code: string,
  name: string,
  target: Pick<BbThucDungLineRow, 'materialCode' | 'materialName'>
) {
  if (target.materialCode && code) return materialCodeMatches(code, target.materialCode);
  if (target.materialCode && !code) return materialNameMatches(name, target.materialName);
  if (!target.materialCode) return materialNameMatches(name, target.materialName) || materialCodeMatches(code, name);
  return materialCodeMatches(code, target.materialCode) || materialNameMatches(name, target.materialName);
}

/** Chi tiết nguồn số liệu khi bấm vào ô số tab thực xuất dùng & tỉ lệ trộn. */
export function buildBbThucDungMetricDetail(input: {
  line: BbThucDungLineRow;
  metric: BbThucDungDetailMetric;
  mixingReports: MixingReport[];
  machineNvlReports: MachineNvlSavedReport[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
}): BbThucDungDetailBag {
  const shiftOptions = getProductionShiftOptions((input.shiftSettings || []) as ShiftSetting[]);
  const header = {
    ngay: input.line.ngay,
    shift: input.line.shift,
    orderCode: input.line.orderCode,
    machine: input.line.machine
  };
  const valueLabel = BB_THUC_DUNG_DETAIL_METRIC_LABEL[input.metric];
  const subtitle = `${input.line.orderCode || '—'} · ${input.line.ngay || '—'} · ${
    input.line.shiftLabel || input.line.shift || '—'
  } · ${input.line.machine || '—'}`;
  const title = `${input.line.materialCode || '—'} · ${input.line.materialName || '—'}`;

  const formatValue = () => {
    switch (input.metric) {
      case 'ti_le_dinh_muc':
        return input.line.tiLeDinhMucPercent === null || input.line.tiLeDinhMucPercent === undefined
          ? '—'
          : `${roundQty(input.line.tiLeDinhMucPercent, 2)}%`;
      case 'ti_le_thuc_te':
        return input.line.tiLeThucTeTbPercent === null || input.line.tiLeThucTeTbPercent === undefined
          ? '—'
          : `${roundQty(input.line.tiLeThucTeTbPercent, 2)}%`;
      case 'so_me':
        return String(input.line.batchCount || 0);
      case 'trong_luong_da_tron':
        return `${roundQty(input.line.trongLuongDaTronKg, 3)} kg`;
      case 'ton_dau':
        return `${roundQty(input.line.tonDauKg, 3)} kg`;
      case 'ton_cuoi':
        return `${roundQty(input.line.tonCuoiKg, 3)} kg`;
      case 'thuc_dung':
        return `${roundQty(input.line.weightKg, 3)} kg`;
      default:
        return '—';
    }
  };

  const mixingFormula =
    input.line.tiLeThucTeTbPercent !== null && input.line.tiLeThucTeTbPercent !== undefined
      ? `Trọng lượng đã trộn = Tổng xuất trong ca (${roundQty(input.line.xuatTrongCaKg, 3)}) × Tỉ lệ TB thực tế (${roundQty(
          input.line.tiLeThucTeTbPercent,
          2
        )}%) = ${roundQty(input.line.trongLuongDaTronKg, 3)} kg`
      : `Trọng lượng đã trộn = Tổng xuất trong ca (${roundQty(input.line.xuatTrongCaKg, 3)}) × Tỉ lệ TB thực tế (—) = ${roundQty(
          input.line.trongLuongDaTronKg,
          3
        )} kg`;

  const isMixingMetric =
    input.metric === 'ti_le_dinh_muc' ||
    input.metric === 'ti_le_thuc_te' ||
    input.metric === 'trong_luong_da_tron' ||
    input.metric === 'so_me' ||
    input.metric === 'thuc_dung';
  const isTonDauMetric = input.metric === 'ton_dau' || input.metric === 'thuc_dung';
  const isTonCuoiMetric = input.metric === 'ton_cuoi' || input.metric === 'thuc_dung';

  const mixingRows: Array<Record<string, string | number | null | undefined>> = [];
  if (isMixingMetric) {
    for (const report of input.mixingReports) {
      if (
        !matchesShiftSummaryBucket(header.ngay, header.shift, report.ngay, report.ca, shiftOptions)
      ) {
        continue;
      }
      if (!isBbMachineText(report.ma_may, report.ten_may)) continue;
      if (
        !machineValueMatchesFilter(header.machine, null, report.ma_may, report.ten_may) &&
        !(isBbMachineText(header.machine) && isBbMachineText(report.ma_may, report.ten_may))
      ) {
        continue;
      }

      for (const line of report.chi_tiet || []) {
        for (const roundKey of MIXING_ROUND_KEYS) {
          const items = getRoundItems(line.lan_su_dung, roundKey);
          if (items.length === 0) continue;
          const batchWeight =
            getRoundBatchWeight(line.lan_su_dung, roundKey) ??
            roundNormWeight(items.reduce((sum, item) => sum + (item.so_luong ?? item.kl_thuc_te ?? 0), 0));
          const roundLabel = roundKey.replace('lan_', 'Lần ');

          for (const item of items) {
            const code = String(item.ma_nvl || line.ma_nvl || '').trim();
            const name = String(item.ten_vat_tu || line.ten_vat_tu || '').trim();
            if (!materialMatchesLine(code, name, input.line)) continue;
            const kl = item.kl_thuc_te;
            const tiLeTt =
              kl !== null &&
              kl !== undefined &&
              Number.isFinite(kl) &&
              batchWeight &&
              batchWeight > 0
                ? roundQty((kl / batchWeight) * 100, 2)
                : null;
            mixingRows.push({
              ngay: report.ngay,
              ca: report.ca,
              may: report.ten_may || report.ma_may || '',
              lan: roundLabel,
              maNvl: code,
              tenNvl: name,
              tiLeDm: item.ti_le_phan_tram,
              klThucTe: kl,
              tiLeTt,
              batchWeight: batchWeight ?? null
            });
          }
        }
      }
    }
  }

  const tonRows: Array<Record<string, string | number | null | undefined>> = [];
  const pushTonRows = (reportKind: 'dau_ca' | 'cuoi_ca') => {
    for (const report of input.machineNvlReports) {
      if (report.reportKind !== reportKind) continue;
      const reportDate = parseProductionOrderFilterDate(report.ngay);
      if (
        !matchesShiftSummaryBucket(
          header.ngay,
          header.shift,
          reportDate || report.ngay,
          report.ca,
          shiftOptions
        )
      ) {
        continue;
      }
      report.lines.forEach((line, index) => {
        const code = String(line.maNvl || '').trim();
        const name = String(line.tenNvl || '').trim();
        if (!materialMatchesLine(code, name, input.line)) return;
        const kg =
          reportKind === 'dau_ca'
            ? sumMachineNvlDauCaLineTotal(line)
            : sumMachineNvlCuoiCaLineTotal(line);
        tonRows.push({
          loai: reportKind === 'dau_ca' ? 'Tồn đầu ca' : 'Tồn cuối ca',
          ngay: report.ngay,
          ca: report.ca,
          may: report.tenMay || report.maMay || '',
          maNvl: code,
          tenNvl: name,
          donVi: line.donVi || '',
          soLuongTon: line.soLuongTon,
          trongMay: line.soLuongTrongMay,
          bonTron: line.soLuongTrongBonTron,
          chuaTron: line.soLuongNlChuaTron,
          tonNgoai: line.soLuongTonNgoai,
          weightKg: Number.isFinite(kg) ? roundQty(kg, 3) : 0,
          reportId: report.id || `${reportKind}-${index}`
        });
      });
    }
  };
  if (isTonDauMetric) pushTonRows('dau_ca');
  if (isTonCuoiMetric) pushTonRows('cuoi_ca');

  if (input.metric === 'ton_dau' || input.metric === 'ton_cuoi') {
    const tonDauFormula =
      input.metric === 'ton_dau' &&
      input.line.tonDauFromNnsTron &&
      input.line.nnsTronTonDauKg !== null &&
      input.line.tiLeThucTeTbPercent !== null
        ? `Tồn đầu = NNS-TRON (${roundQty(input.line.nnsTronTonDauKg, 3)} kg) × Tỉ lệ TB thực tế (${roundQty(
            input.line.tiLeThucTeTbPercent,
            2
          )}%) = ${roundQty(input.line.tonDauKg, 3)} kg`
        : undefined;
    return {
      metric: input.metric,
      title,
      subtitle,
      valueLabel,
      valueText: formatValue(),
      formula: tonDauFormula,
      columns: [
        { key: 'ngay', label: 'Ngày' },
        { key: 'ca', label: 'Ca' },
        { key: 'may', label: 'Máy' },
        { key: 'maNvl', label: 'Mã NVL' },
        { key: 'tenNvl', label: 'Tên NVL' },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'soLuongTon', label: 'SL tồn', align: 'right' },
        { key: 'weightKg', label: 'TL (kg)', align: 'right' }
      ],
      rows: tonRows
    };
  }

  if (input.metric === 'thuc_dung') {
    const tonDauPart =
      input.line.tonDauFromNnsTron &&
      input.line.nnsTronTonDauKg !== null &&
      input.line.tiLeThucTeTbPercent !== null
        ? `Tồn đầu (${roundQty(input.line.tonDauKg, 3)} = NNS-TRON ${roundQty(
            input.line.nnsTronTonDauKg,
            3
          )} × ${roundQty(input.line.tiLeThucTeTbPercent, 2)}%)`
        : `Tồn đầu (${roundQty(input.line.tonDauKg, 3)})`;
    return {
      metric: input.metric,
      title,
      subtitle,
      valueLabel,
      valueText: formatValue(),
      formula: `${mixingFormula}. Thực dùng (kg) = Trọng lượng đã trộn (${roundQty(
        input.line.trongLuongDaTronKg,
        3
      )}) + ${tonDauPart} − Tồn cuối (${roundQty(input.line.tonCuoiKg, 3)}) = ${roundQty(
        input.line.weightKg,
        3
      )} kg`,
      columns: [
        { key: 'nguon', label: 'Nguồn' },
        { key: 'ngay', label: 'Ngày' },
        { key: 'ca', label: 'Ca' },
        { key: 'may', label: 'Máy' },
        { key: 'maNvl', label: 'Mã NVL' },
        { key: 'tenNvl', label: 'Tên NVL' },
        { key: 'chiTiet', label: 'Chi tiết' },
        { key: 'weightKg', label: 'TL (kg)', align: 'right' }
      ],
      rows: [
        ...mixingRows.map(row => ({
          nguon: 'Báo cáo trộn',
          ngay: row.ngay,
          ca: row.ca,
          may: row.may,
          maNvl: row.maNvl,
          tenNvl: row.tenNvl,
          chiTiet: `${row.lan || ''}${row.tiLeTt != null ? ` · TL TT ${row.tiLeTt}%` : ''}`,
          weightKg: row.klThucTe
        })),
        ...tonRows.map(row => ({
          nguon: row.loai,
          ngay: row.ngay,
          ca: row.ca,
          may: row.may,
          maNvl: row.maNvl,
          tenNvl: row.tenNvl,
          chiTiet: row.donVi || '',
          weightKg: row.weightKg
        }))
      ]
    };
  }

  return {
    metric: input.metric,
    title,
    subtitle,
    valueLabel,
    valueText: formatValue(),
    formula:
      input.metric === 'trong_luong_da_tron' || input.metric === 'ti_le_thuc_te'
        ? mixingFormula
        : undefined,
    columns: [
      { key: 'ngay', label: 'Ngày' },
      { key: 'ca', label: 'Ca' },
      { key: 'may', label: 'Máy' },
      { key: 'lan', label: 'Mẻ/Lần' },
      { key: 'maNvl', label: 'Mã NVL' },
      { key: 'tenNvl', label: 'Tên NVL' },
      { key: 'tiLeDm', label: 'Tỉ lệ ĐM (%)', align: 'right' },
      { key: 'klThucTe', label: 'KL thực tế (kg)', align: 'right' },
      { key: 'tiLeTt', label: 'Tỉ lệ TT (%)', align: 'right' },
      { key: 'batchWeight', label: 'KL mẻ (kg)', align: 'right' }
    ],
    rows: mixingRows
  };
}

export function groupBbThucDungLines(rows: BbThucDungLineRow[]): BbThucDungGroup[] {
  const map = new Map<string, BbThucDungGroup>();

  for (const row of rows) {
    const groupKey = row.orderCode.trim() || `unlinked|${row.ngay}|${row.shift}`;
    const existing = map.get(groupKey);
    if (!existing) {
      map.set(groupKey, {
        groupKey,
        orderCode: row.orderCode,
        ngay: row.ngay,
        shift: row.shift,
        shiftLabel: row.shiftLabel,
        machine: row.machine,
        lineCount: 1,
        totalWeightKg: Number.isFinite(row.weightKg) ? row.weightKg : 0,
        tonDauCaTotal: Number.isFinite(row.tonDauKg) ? row.tonDauKg : 0,
        tonCuoiCaTotal: Number.isFinite(row.tonCuoiKg) ? row.tonCuoiKg : 0,
        xuatCaTotal: Number.isFinite(row.xuatTrongCaKg) ? row.xuatTrongCaKg : 0,
        lines: [row]
      });
      continue;
    }
    existing.lineCount += 1;
    existing.totalWeightKg += Number.isFinite(row.weightKg) ? row.weightKg : 0;
    existing.tonDauCaTotal += Number.isFinite(row.tonDauKg) ? row.tonDauKg : 0;
    existing.tonCuoiCaTotal += Number.isFinite(row.tonCuoiKg) ? row.tonCuoiKg : 0;
    // Tổng xuất trong ca là tổng phiếu xuất của lệnh/ca — không cộng theo từng dòng NVL.
    if (!existing.xuatCaTotal && Number.isFinite(row.xuatTrongCaKg) && row.xuatTrongCaKg > 0) {
      existing.xuatCaTotal = row.xuatTrongCaKg;
    }
    existing.lines.push(row);
  }

  return [...map.values()].sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

export type BbTongDetailLine = {
  key: string;
  label: string;
  valueKg: number;
};

export type BbTongGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  machine: string;
  tongTpNhapKho: number;
  tongTrongLuongLoiHong: number;
  tongThucDung: number;
  tongTrongLuongNhapKho: number;
  chenhLechTrongLuongNhapXuat: number;
  tiLeChenhLechTrongLuong: number;
  lines: BbTongDetailLine[];
};

/**
 * Tab Tổng — cùng công thức sản lượng bảng tổng hợp ca:
 * TL nhập kho = TP nhập (nhựa/màng/lõi/túi) + lỗi hỏng
 * Chênh lệch = TL nhập kho − thực dùng
 * Tỉ lệ = chênh lệch / TL nhập kho × 100
 */
export function buildBbTongGroups(input: {
  productionOrders: ProductionOrderRow[];
  warehouseMovements: ShiftSummaryWarehouseMovement[];
  machineNvlReports: MachineNvlSavedReport[];
  damagedRecords: WeighingRecord[];
  materials: MaterialRow[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbTongGroup[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const groups: BbTongGroup[] = [];

  for (const header of headers) {
    const xuat = emptyMaterialBucket();
    const tonDau = emptyMaterialBucket();
    const tonCuoi = emptyMaterialBucket();
    let tlNhuaKhongMangLoiHong = 0;
    let tlNhuaCucDauNongLoiHong = 0;
    let tlNhuaDinhMangLoiHong = 0;
    let tlMangLoiHong = 0;
    let tongTrongLuongLoiHong = 0;

    for (const movement of input.warehouseMovements) {
      if (
        !matchesShiftSummaryBucket(
          header.ngay,
          header.shift,
          movement.slipDate,
          movement.shift,
          shiftOptions
        )
      ) {
        continue;
      }
      addMaterialBucket(xuat, classifyExportMovementKg(movement, input.materials));
    }

    for (const report of input.machineNvlReports) {
      if (
        !matchesShiftSummaryBucket(header.ngay, header.shift, report.ngay, report.ca, shiftOptions)
      ) {
        continue;
      }
      if (!isBbMachineText(report.maMay, report.tenMay)) continue;
      if (
        !machineValueMatchesFilter(header.machine, null, report.maMay, report.tenMay) &&
        !(isBbMachineText(header.machine) && isBbMachineText(report.maMay, report.tenMay))
      ) {
        continue;
      }
      for (const line of report.lines) {
        const split = classifyMachineNvlLineKg(report, line);
        if (report.reportKind === 'dau_ca') addMaterialBucket(tonDau, split);
        else if (report.reportKind === 'cuoi_ca') addMaterialBucket(tonCuoi, split);
      }
    }

    for (const record of getWeighingDataRows(input.damagedRecords)) {
      const ngay = parseProductionOrderFilterDate(record.productionDate || record.reportDate);
      if (
        !matchesShiftSummaryBucket(
          header.ngay,
          header.shift,
          ngay || record.productionDate,
          record.shiftName,
          shiftOptions
        )
      ) {
        continue;
      }
      const machineOk =
        machineValueMatchesFilter(header.machine, null, record.machineName) ||
        (isBbMachineText(record.machineName) && isBbMachineText(header.machine));
      if (!machineOk && !isBbMachineText(record.machineName)) continue;
      const split = splitDamagedGoodsDefectWeights(record);
      tlNhuaKhongMangLoiHong += split.nhuaKhongMang;
      tlNhuaCucDauNongLoiHong += split.nhuaCucDauNong;
      tlNhuaDinhMangLoiHong += split.nhuaDinhMang;
      tlMangLoiHong += split.mang;
      tongTrongLuongLoiHong += split.tong;
    }

    const nhuaThucDung = computeMaterialUsageKg(xuat.nhua, tonDau.nhua, tonCuoi.nhua);
    const mangThucDung = computeMaterialUsageKg(xuat.mang, tonDau.mang, tonCuoi.mang);
    const loiThucDung = computeMaterialUsageKg(xuat.loi, tonDau.loi, tonCuoi.loi);
    const tuiThucDung = computeMaterialUsageKg(xuat.tui, tonDau.tui, tonCuoi.tui);
    const tongThucDung = roundQty(nhuaThucDung + mangThucDung + loiThucDung + tuiThucDung, 3);

    const tlNhuaTpNhapKho = computeTlNhuaTpNhapKhoFromShiftSummary({
      khoiLuongNpl: xuat.nhua,
      tonDauCaNhua: tonDau.nhua,
      tonCuoiCaNhua: tonCuoi.nhua,
      tlNhuaKhongMangLoiHong,
      tlNhuaCucDauNongLoiHong,
      tlNhuaDinhMangLoiHong
    });
    const tlMangTpNhapKho = computeTlMangTpNhapKhoFromShiftSummary({
      khoiLuongMangXuat: xuat.mang,
      tonDauCaMang: tonDau.mang,
      tonCuoiCaMang: tonCuoi.mang,
      tlMangLoiHong
    });
    const tlLoiTpNhapKho = roundQty(loiThucDung, 3);
    const tlTuiBaoBiNhapKho = roundQty(tuiThucDung, 3);
    const tongTpNhapKho = roundQty(
      tlNhuaTpNhapKho + tlMangTpNhapKho + tlLoiTpNhapKho + tlTuiBaoBiNhapKho,
      3
    );
    const tongLoiHong = roundQty(tongTrongLuongLoiHong, 3);

    const metrics = computeShiftSummarySanLuongMetrics({
      tongTpNhapKho,
      tongTrongLuongLoiHong: tongLoiHong,
      tongThucDung,
      chenhLechNhua: 0,
      tongMangThucDung: mangThucDung,
      tlMangTpNhapKho,
      hangHongMang: tlMangLoiHong
    });

    const hasAny =
      metrics.tongTrongLuongNhapKho !== 0 ||
      metrics.chenhLechTrongLuongNhapXuat !== 0 ||
      tongThucDung !== 0 ||
      tongLoiHong !== 0 ||
      tongTpNhapKho !== 0;
    if (!hasAny) continue;

    const shiftLabel = formatProductionOrderShiftLabel(header.shift, lookupSettings);
    const groupKey = header.orderCode.trim() || `unlinked|${header.ngay}|${header.shift}`;

    groups.push({
      groupKey,
      orderCode: header.orderCode,
      ngay: header.ngay,
      shift: header.shift,
      shiftLabel,
      machine: header.machine,
      tongTpNhapKho,
      tongTrongLuongLoiHong: tongLoiHong,
      tongThucDung,
      tongTrongLuongNhapKho: metrics.tongTrongLuongNhapKho,
      chenhLechTrongLuongNhapXuat: metrics.chenhLechTrongLuongNhapXuat,
      tiLeChenhLechTrongLuong: metrics.tiLeChenhLechTrongLuong,
      lines: [
        { key: `${groupKey}|tl-nhua-tp`, label: 'TL nhựa TP nhập kho', valueKg: tlNhuaTpNhapKho },
        { key: `${groupKey}|tl-mang-tp`, label: 'TL màng TP nhập kho', valueKg: tlMangTpNhapKho },
        { key: `${groupKey}|tl-loi-tp`, label: 'TL lõi TP nhập kho', valueKg: tlLoiTpNhapKho },
        { key: `${groupKey}|tl-tui-tp`, label: 'TL túi bao bì nhập kho', valueKg: tlTuiBaoBiNhapKho },
        { key: `${groupKey}|tong-tp`, label: 'Tổng TP nhập kho', valueKg: tongTpNhapKho },
        { key: `${groupKey}|loi-hong`, label: 'Tổng trọng lượng lỗi hỏng', valueKg: tongLoiHong },
        { key: `${groupKey}|thuc-dung`, label: 'Tổng trọng lượng thực dùng', valueKg: tongThucDung }
      ]
    });
  }

  return groups.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

export function sumBbTongTrongLuongNhapKho(groups: BbTongGroup[]) {
  return groups.reduce((sum, g) => sum + g.tongTrongLuongNhapKho, 0);
}

export function sumBbTongChenhLech(groups: BbTongGroup[]) {
  return groups.reduce((sum, g) => sum + g.chenhLechTrongLuongNhapXuat, 0);
}

function resolveBbAvgExportUnitPrice(
  ngay: string,
  ca: string,
  movements: ShiftSummaryWarehouseMovement[],
  shiftSettings: ShiftSetting[],
  matchItem: (movement: ShiftSummaryWarehouseMovement) => boolean
) {
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  let amount = 0;
  let qty = 0;
  for (const movement of movements) {
    if (movement.slipType !== 'xuat' || movement.warehouseKind !== 'nvl') continue;
    if (!matchItem(movement)) continue;
    if (!matchesShiftSummaryBucket(ngay, ca, movement.slipDate, movement.shift, shiftOptions)) continue;
    const unitPrice = Number(movement.unitPrice);
    const quantity = Number(movement.quantity);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    amount += quantity * unitPrice;
    qty += quantity;
  }
  if (qty <= 0) return 0;
  return Math.round(amount / qty);
}

export type BbMixingRatioLineRow = {
  key: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  orderCode: string;
  machine: string;
  materialCode: string;
  materialName: string;
  tiLeDinhMucPercent: number | null;
  tiLeThucTeTbPercent: number | null;
  batchCount: number;
  totalKlThucTe: number;
};

export type BbMixingRatioGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  machine: string;
  lineCount: number;
  lines: BbMixingRatioLineRow[];
};

type MixingRatioAgg = {
  materialCode: string;
  materialName: string;
  tiLeDinhMucSum: number;
  tiLeDinhMucCount: number;
  tiLeThucTeSum: number;
  tiLeThucTeCount: number;
  totalKlThucTe: number;
};

/** TB tỉ lệ thực tế từng NVL giữa các mẻ trộn gắn lệnh BB. */
export function buildBbMixingRatioGroups(input: {
  productionOrders: ProductionOrderRow[];
  mixingReports: MixingReport[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbMixingRatioGroup[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const groups: BbMixingRatioGroup[] = [];

  for (const header of headers) {
    const byMaterial = new Map<string, MixingRatioAgg>();

    for (const report of input.mixingReports) {
      if (
        !matchesShiftSummaryBucket(header.ngay, header.shift, report.ngay, report.ca, shiftOptions)
      ) {
        continue;
      }
      if (!isBbMachineText(report.ma_may, report.ten_may)) continue;
      if (
        !machineValueMatchesFilter(header.machine, null, report.ma_may, report.ten_may) &&
        !(isBbMachineText(header.machine) && isBbMachineText(report.ma_may, report.ten_may))
      ) {
        continue;
      }

      for (const line of report.chi_tiet || []) {
        const materialCode = String(line.ma_nvl || '').trim();
        const materialName = String(line.ten_vat_tu || '').trim();
        const materialKey = (materialCode || materialName || '').toUpperCase();
        if (!materialKey) continue;

        for (const roundKey of MIXING_ROUND_KEYS) {
          const items = getRoundItems(line.lan_su_dung, roundKey);
          if (items.length === 0) continue;
          const batchWeight =
            getRoundBatchWeight(line.lan_su_dung, roundKey) ??
            roundNormWeight(items.reduce((sum, item) => sum + (item.so_luong ?? item.kl_thuc_te ?? 0), 0));
          if (!batchWeight || batchWeight <= 0) continue;

          for (const item of items) {
            const code = String(item.ma_nvl || materialCode || '').trim();
            const name = String(item.ten_vat_tu || materialName || '').trim();
            const key = (code || name || '').toUpperCase();
            if (!key) continue;

            let agg = byMaterial.get(key);
            if (!agg) {
              agg = {
                materialCode: code,
                materialName: name,
                tiLeDinhMucSum: 0,
                tiLeDinhMucCount: 0,
                tiLeThucTeSum: 0,
                tiLeThucTeCount: 0,
                totalKlThucTe: 0
              };
              byMaterial.set(key, agg);
            }

            const dinhMuc = item.ti_le_phan_tram;
            if (dinhMuc !== null && dinhMuc !== undefined && Number.isFinite(dinhMuc)) {
              agg.tiLeDinhMucSum += dinhMuc;
              agg.tiLeDinhMucCount += 1;
            }

            const klThucTe = item.kl_thuc_te;
            if (klThucTe !== null && klThucTe !== undefined && Number.isFinite(klThucTe) && klThucTe > 0) {
              const tiLeThucTe = (klThucTe / batchWeight) * 100;
              agg.tiLeThucTeSum += tiLeThucTe;
              agg.tiLeThucTeCount += 1;
              agg.totalKlThucTe += klThucTe;
            }
          }
        }
      }
    }

    if (byMaterial.size === 0) continue;

    const shiftLabel = formatProductionOrderShiftLabel(header.shift, lookupSettings);
    const groupKey = header.orderCode.trim() || `unlinked|${header.ngay}|${header.shift}`;
    const lines: BbMixingRatioLineRow[] = [...byMaterial.entries()]
      .map(([materialKey, agg]) => ({
        key: `${groupKey}|${materialKey}`,
        ngay: header.ngay,
        shift: header.shift,
        shiftLabel,
        orderCode: header.orderCode,
        machine: header.machine,
        materialCode: agg.materialCode,
        materialName: agg.materialName,
        tiLeDinhMucPercent:
          agg.tiLeDinhMucCount > 0 ? roundQty(agg.tiLeDinhMucSum / agg.tiLeDinhMucCount, 2) : null,
        tiLeThucTeTbPercent:
          agg.tiLeThucTeCount > 0 ? roundQty(agg.tiLeThucTeSum / agg.tiLeThucTeCount, 2) : null,
        batchCount: agg.tiLeThucTeCount,
        totalKlThucTe: roundQty(agg.totalKlThucTe, 3)
      }))
      .sort((a, b) => a.materialName.localeCompare(b.materialName, 'vi'));

    groups.push({
      groupKey,
      orderCode: header.orderCode,
      ngay: header.ngay,
      shift: header.shift,
      shiftLabel,
      machine: header.machine,
      lineCount: lines.length,
      lines
    });
  }

  return groups.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

export type BbDanhGiaHaoHutGroup = {
  groupKey: string;
  orderCode: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  machine: string;
  tongNhuaThucXuat: number;
  tongNhuaDinhMuc: number;
  tiLeNhuaThucXuatVsDinhMuc: number;
  giaTriHaoHutNhuaKg: number;
  giaTriHaoHutNhua: number;
  tongMangThucXuat: number;
  tongMangDinhMuc: number;
  tiLeMangThucXuatVsDinhMuc: number;
  giaTriHaoHutMangKg: number;
  giaTriHaoHutMang: number;
  tiLeLoiHong: number;
  tiLeLoiHongDinhMuc: number;
  lechLoiHongVsDinhMuc: number;
  soLuongNhuaLoiHong: number;
  giaTriNhuaLoiHong: number;
  soLuongMangLoiHong: number;
  giaTriMangLoiHong: number;
  soLuongLoiLoiHong: number;
  giaTriLoiLoiHong: number;
  tongGiaTriHaoHutLoiHong: number;
};

/** Đánh giá hiệu quả lỗi hỏng & hao hụt NVL theo lệnh BB. */
export function buildBbDanhGiaHaoHutGroups(input: {
  productionOrders: ProductionOrderRow[];
  products: ProductRow[];
  warehouseMovements: ShiftSummaryWarehouseMovement[];
  machineNvlReports: MachineNvlSavedReport[];
  damagedRecords: WeighingRecord[];
  materials: MaterialRow[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbDanhGiaHaoHutGroup[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const groups: BbDanhGiaHaoHutGroup[] = [];

  for (const header of headers) {
    const xuat = emptyMaterialBucket();
    const tonDau = emptyMaterialBucket();
    const tonCuoi = emptyMaterialBucket();
    let hangHongNhua = 0;
    let hangHongMang = 0;
    let soCuonLoiHong = 0;
    let tongTrongLuongLoiHong = 0;
    let tlNhuaKhongMangLoiHong = 0;
    let tlNhuaCucDauNongLoiHong = 0;
    let tlNhuaDinhMangLoiHong = 0;
    let tlMangLoiHong = 0;
    let slHang = 0;
    let khoiLuongHang = 0;

    for (const order of input.productionOrders) {
      if (!isBbProductionOrder(order, input.machines)) continue;
      if (order.code !== header.orderCode) continue;
      const ngay = parseProductionOrderFilterDate(order.startDate);
      if (ngay !== header.ngay) continue;
      if (!shiftNamesMatch(order.shift, header.shift)) continue;
      for (const line of getProductionOrderProductLines(order)) {
        const qty = parseProductionOrderQuantity(line.quantity);
        if (qty <= 0) continue;
        slHang += qty;
        const product = findProductByCode(input.products, line.productCode);
        const unitWeight = resolveProductUnitNormKg(product);
        if (unitWeight !== null && unitWeight > 0) khoiLuongHang += unitWeight * qty;
      }
    }

    for (const movement of input.warehouseMovements) {
      if (
        !matchesShiftSummaryBucket(
          header.ngay,
          header.shift,
          movement.slipDate,
          movement.shift,
          shiftOptions
        )
      ) {
        continue;
      }
      addMaterialBucket(xuat, classifyExportMovementKg(movement, input.materials));
    }

    for (const report of input.machineNvlReports) {
      if (
        !matchesShiftSummaryBucket(header.ngay, header.shift, report.ngay, report.ca, shiftOptions)
      ) {
        continue;
      }
      if (!isBbMachineText(report.maMay, report.tenMay)) continue;
      if (
        !machineValueMatchesFilter(header.machine, null, report.maMay, report.tenMay) &&
        !(isBbMachineText(header.machine) && isBbMachineText(report.maMay, report.tenMay))
      ) {
        continue;
      }
      for (const line of report.lines) {
        const split = classifyMachineNvlLineKg(report, line);
        if (report.reportKind === 'dau_ca') addMaterialBucket(tonDau, split);
        else if (report.reportKind === 'cuoi_ca') addMaterialBucket(tonCuoi, split);
      }
    }

    for (const record of getWeighingDataRows(input.damagedRecords)) {
      const ngay = parseProductionOrderFilterDate(record.productionDate || record.reportDate);
      if (
        !matchesShiftSummaryBucket(
          header.ngay,
          header.shift,
          ngay || record.productionDate,
          record.shiftName,
          shiftOptions
        )
      ) {
        continue;
      }
      const machineOk =
        machineValueMatchesFilter(header.machine, null, record.machineName) ||
        (isBbMachineText(record.machineName) && isBbMachineText(header.machine));
      if (!machineOk && !isBbMachineText(record.machineName)) continue;
      const split = splitDamagedGoodsDefectWeights(record);
      hangHongNhua += split.nhuaKhongMang + split.nhuaCucDauNong + split.nhuaDinhMang;
      hangHongMang += split.mang;
      soCuonLoiHong += split.loi;
      tongTrongLuongLoiHong += split.tong;
      tlNhuaKhongMangLoiHong += split.nhuaKhongMang;
      tlNhuaCucDauNongLoiHong += split.nhuaCucDauNong;
      tlNhuaDinhMangLoiHong += split.nhuaDinhMang;
      tlMangLoiHong += split.mang;
    }

    const tongNhuaThucXuat = computeMaterialUsageKg(xuat.nhua, tonDau.nhua, tonCuoi.nhua);
    const tongMangThucXuat = computeMaterialUsageKg(xuat.mang, tonDau.mang, tonCuoi.mang);
    const loiThucDung = computeMaterialUsageKg(xuat.loi, tonDau.loi, tonCuoi.loi);
    const tuiThucDung = computeMaterialUsageKg(xuat.tui, tonDau.tui, tonCuoi.tui);
    const tongThucDung = roundQty(tongNhuaThucXuat + tongMangThucXuat + loiThucDung + tuiThucDung, 3);

    const khoiLuongLoi = roundQty(slHang, 3);
    const khoiLuongMang = roundQty(slHang * KHOI_LUONG_MANG_KG_PER_UNIT, 3);
    const tongNhuaDinhMuc = computeKhoiLuongNhuaTp(khoiLuongHang, khoiLuongLoi, khoiLuongMang);
    const tongMangDinhMuc = khoiLuongMang;

    const tlNhuaTpNhapKho = computeTlNhuaTpNhapKhoFromShiftSummary({
      khoiLuongNpl: xuat.nhua,
      tonDauCaNhua: tonDau.nhua,
      tonCuoiCaNhua: tonCuoi.nhua,
      tlNhuaKhongMangLoiHong,
      tlNhuaCucDauNongLoiHong,
      tlNhuaDinhMangLoiHong
    });
    const tlMangTpNhapKho = computeTlMangTpNhapKhoFromShiftSummary({
      khoiLuongMangXuat: xuat.mang,
      tonDauCaMang: tonDau.mang,
      tonCuoiCaMang: tonCuoi.mang,
      tlMangLoiHong
    });
    const tongTpNhapKho = roundQty(
      tlNhuaTpNhapKho + tlMangTpNhapKho + loiThucDung + tuiThucDung,
      3
    );

    const sanLuong = computeShiftSummarySanLuongMetrics({
      tongTpNhapKho,
      tongTrongLuongLoiHong,
      tongThucDung,
      chenhLechNhua: roundQty(tongNhuaThucXuat - tongNhuaDinhMuc - hangHongNhua, 3),
      tongMangThucDung: tongMangThucXuat,
      tlMangTpNhapKho,
      hangHongMang
    });

    const giaTriHaoHutNhuaKg = sanLuong.giaTriLoLaiNhua;
    const giaTriHaoHutMangKg = sanLuong.giaTriLoLaiMang;
    const tiLeNhuaThucXuatVsDinhMuc = computePercentRatio(tongNhuaThucXuat, tongNhuaDinhMuc);
    const tiLeMangThucXuatVsDinhMuc = computePercentRatio(tongMangThucXuat, tongMangDinhMuc);

    const giaNhua = resolveShiftSummaryGiaNhuaFromWarehouse(
      header.ngay,
      header.shift,
      input.warehouseMovements,
      shiftSettings
    );
    const giaMang = resolveBbAvgExportUnitPrice(
      header.ngay,
      header.shift,
      input.warehouseMovements,
      shiftSettings,
      m => isWarehouseFilmItem(m.itemCode || '', m.itemName || '', m.unit || '')
    );
    const giaLoi = resolveBbAvgExportUnitPrice(
      header.ngay,
      header.shift,
      input.warehouseMovements,
      shiftSettings,
      m => isWarehouseCoreExportItem(m.itemCode || '', m.itemName || '')
    );

    const giaTriHaoHutNhua = computeSoTienLoLaiNhua(giaTriHaoHutNhuaKg, giaNhua);
    const giaTriHaoHutMang = computeSoTienLoLaiNhua(giaTriHaoHutMangKg, giaMang);
    const soLuongNhuaLoiHong = roundQty(hangHongNhua, 3);
    const soLuongMangLoiHong = roundQty(hangHongMang, 3);
    const soLuongLoiLoiHong = roundQty(soCuonLoiHong, 3);
    const giaTriNhuaLoiHong = computeSoTienLoLaiNhua(soLuongNhuaLoiHong, giaNhua);
    const giaTriMangLoiHong = computeSoTienLoLaiNhua(soLuongMangLoiHong, giaMang);
    const giaTriLoiLoiHong = computeSoTienLoLaiNhua(soLuongLoiLoiHong, giaLoi);
    const tongGiaTriHaoHutLoiHong =
      giaTriHaoHutNhua +
      giaTriHaoHutMang +
      giaTriNhuaLoiHong +
      giaTriMangLoiHong +
      giaTriLoiLoiHong;

    const hasAny =
      tongNhuaThucXuat !== 0 ||
      tongNhuaDinhMuc !== 0 ||
      tongMangThucXuat !== 0 ||
      tongMangDinhMuc !== 0 ||
      tongTrongLuongLoiHong !== 0 ||
      tongGiaTriHaoHutLoiHong !== 0;
    if (!hasAny) continue;

    const shiftLabel = formatProductionOrderShiftLabel(header.shift, lookupSettings);
    groups.push({
      groupKey: header.orderCode.trim() || `unlinked|${header.ngay}|${header.shift}`,
      orderCode: header.orderCode,
      ngay: header.ngay,
      shift: header.shift,
      shiftLabel,
      machine: header.machine,
      tongNhuaThucXuat: roundQty(tongNhuaThucXuat, 3),
      tongNhuaDinhMuc: roundQty(tongNhuaDinhMuc, 3),
      tiLeNhuaThucXuatVsDinhMuc,
      giaTriHaoHutNhuaKg,
      giaTriHaoHutNhua,
      tongMangThucXuat: roundQty(tongMangThucXuat, 3),
      tongMangDinhMuc: roundQty(tongMangDinhMuc, 3),
      tiLeMangThucXuatVsDinhMuc,
      giaTriHaoHutMangKg,
      giaTriHaoHutMang,
      tiLeLoiHong: sanLuong.tiLeLoiHong,
      tiLeLoiHongDinhMuc: sanLuong.tiLeLoiHongDinhMuc ?? TI_LE_LOI_HONG_DINH_MUC_PERCENT,
      lechLoiHongVsDinhMuc: sanLuong.lechLoiHongVsDinhMuc,
      soLuongNhuaLoiHong,
      giaTriNhuaLoiHong,
      soLuongMangLoiHong,
      giaTriMangLoiHong,
      soLuongLoiLoiHong,
      giaTriLoiLoiHong,
      tongGiaTriHaoHutLoiHong
    });
  }

  return groups.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

export function sumBbDanhGiaMoney(groups: BbDanhGiaHaoHutGroup[], key: keyof BbDanhGiaHaoHutGroup) {
  return groups.reduce((sum, g) => sum + Number(g[key] || 0), 0);
}

export type BbInboundReportRow = {
  key: string;
  ngay: string;
  shift: string;
  shiftLabel: string;
  orderCode: string;
  machine: string;
  acceptedRolls: number;
  mixedPlasticKg: number;
  finishedGoodsInboundKg: number;
};

function isCuonUnitText(unit: unknown) {
  return (
    String(unit ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') === 'cuon'
  );
}

/**
 * Tab Dữ liệu trong báo cáo phiếu nhập kho — theo lệnh SX máy BB:
 * SL Đạt thực tế (cuộn) từ báo cáo sản lượng, TL nhựa đã trộn (kg) từ báo cáo phối trộn,
 * Tổng TP nhập kho (kg) dùng lại đúng công thức của tab Tổng.
 */
export function buildBbInboundReportRows(input: {
  productionOrders: ProductionOrderRow[];
  warehouseMovements: ShiftSummaryWarehouseMovement[];
  machineNvlReports: MachineNvlSavedReport[];
  damagedRecords: WeighingRecord[];
  acceptanceReports: AcceptanceReport[];
  mixingReports: MixingReport[];
  materials: MaterialRow[];
  machines: MachineRow[];
  shiftSettings?: ShiftSetting[] | ProductionOrderLookupSetting[];
  dateFrom: string;
  dateTo: string;
  shiftFilter?: string;
  machineFilter?: string;
  selectedMachine?: { code?: string; name?: string } | null;
}): BbInboundReportRow[] {
  const shiftSettings = (input.shiftSettings || []) as ShiftSetting[];
  const shiftOptions = getProductionShiftOptions(shiftSettings);
  const lookupSettings = (input.shiftSettings || []) as ProductionOrderLookupSetting[];
  const headers = collectBbOrderHeaders(input);
  if (headers.length === 0) return [];

  const tongTpByGroupKey = new Map<string, number>();
  for (const group of buildBbTongGroups(input)) {
    tongTpByGroupKey.set(group.groupKey, group.tongTpNhapKho);
  }

  const rows = headers.map(header => {
    let acceptedRolls = 0;
    for (const report of input.acceptanceReports) {
      if (!isBbMachineText(report.ma_may, report.ten_may)) continue;
      if (!isCuonUnitText(report.don_vi)) continue;
      if (!matchesShiftSummaryBucket(header.ngay, header.shift, report.ngay, report.ca, shiftOptions)) continue;
      if (
        !machineValueMatchesFilter(header.machine, null, report.ma_may, report.ten_may) &&
        !(isBbMachineText(header.machine) && isBbMachineText(report.ma_may, report.ten_may))
      ) {
        continue;
      }
      acceptedRolls += report.so_luong ?? 0;
    }

    let mixedPlasticKg = 0;
    for (const report of input.mixingReports) {
      if (!isBbMachineText(report.ma_may, report.ten_may)) continue;
      if (!matchesShiftSummaryBucket(header.ngay, header.shift, report.ngay, report.ca, shiftOptions)) continue;
      if (
        !machineValueMatchesFilter(header.machine, null, report.ma_may, report.ten_may) &&
        !(isBbMachineText(header.machine) && isBbMachineText(report.ma_may, report.ten_may))
      ) {
        continue;
      }
      mixedPlasticKg += sumReportNormTotal(report.chi_tiet || []);
    }

    const groupKey = header.orderCode.trim() || `unlinked|${header.ngay}|${header.shift}`;

    return {
      key: groupKey,
      ngay: header.ngay,
      shift: header.shift,
      shiftLabel: formatProductionOrderShiftLabel(header.shift, lookupSettings),
      orderCode: header.orderCode,
      machine: header.machine,
      acceptedRolls: Math.round(acceptedRolls),
      mixedPlasticKg: roundQty(mixedPlasticKg, 3),
      finishedGoodsInboundKg: roundQty(tongTpByGroupKey.get(groupKey) ?? 0, 3)
    };
  });

  return rows.sort((a, b) => {
    const dateCmp = b.ngay.localeCompare(a.ngay);
    if (dateCmp !== 0) return dateCmp;
    return a.orderCode.localeCompare(b.orderCode, 'vi');
  });
}

export function sumBbInboundReportTotals(rows: BbInboundReportRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.acceptedRolls += row.acceptedRolls > 0 ? row.acceptedRolls : 0;
      acc.mixedPlasticKg += row.mixedPlasticKg > 0 ? row.mixedPlasticKg : 0;
      acc.finishedGoodsInboundKg += row.finishedGoodsInboundKg > 0 ? row.finishedGoodsInboundKg : 0;
      return acc;
    },
    { acceptedRolls: 0, mixedPlasticKg: 0, finishedGoodsInboundKg: 0 }
  );
}
