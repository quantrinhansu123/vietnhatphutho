import { findProductByCode } from '../features/san-pham';
import { normalizeProductCodeKey, type ProductRow, type ProductNplItem } from '../features/san-pham/types';
import type { MachineRow } from '../features/danh-sach-may';
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
  roundNormWeight,
  sumReportNormTotal
} from '../lib/mixingReportModel';
import type { ShiftSetting } from './shiftSettings';
import { getProductionShiftOptions, shiftNamesMatch } from './shiftSettings';
import {
  convertWarehouseQuantityToKg,
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
  | 'tong'
  | 'ti_le_tron'
  | 'danh_gia_hao_hut';

export const BB_MACHINE_REPORT_TABS: Array<{ id: BbMachineReportTabId; label: string }> = [
  { id: 'lenh_sx', label: 'Dữ liệu trong lệnh sản xuất' },
  { id: 'phieu_xuat_kho', label: 'Dữ liệu trong phiếu xuất kho vật tư' },
  { id: 'ton_dau_ca', label: 'Báo cáo dữ liệu tồn đầu ca' },
  { id: 'bao_cao_loi_hong', label: 'Dữ liệu trong báo cáo lỗi hỏng' },
  { id: 'kiem_ton_cuoi_ca', label: 'Dữ liệu trong báo cáo kiểm tồn cuối ca' },
  { id: 'phieu_nhap_kho', label: 'Dữ liệu trong báo cáo phiếu nhập kho' },
  { id: 'tong_vat_tu_thuc_dung', label: 'Tổng vật tư thực xuất dùng' },
  { id: 'tong', label: 'Tổng' },
  { id: 'ti_le_tron', label: 'Tỉ lệ trộn NL thực tế (TB mẻ)' },
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
  ngay: string;
  shift: string;
  shiftLabel: string;
  orderCode: string;
  machine: string;
  slipCode: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  /** KL định mức = SL SP × Giá trị Thành phần (phan_tram/so_luong). */
  normWeightKg: number | null;
  materialNorm: BbMaterialNormFormula | null;
  weightKg: number | null;
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
  totalNormKg: number;
  allocationRatio: number;
  allocatedNormKg: number;
};

function roundQty(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
  const hay = `${movement.slipCode} ${movement.createdBy} ${movement.itemName} ${movement.itemCode}`.toLowerCase();
  // productionOrderRef chưa map vào movement — scan note-ish fields if present via createdBy only is weak;
  // callers may pass enriched fields later. Also check item fields unlikely.
  return hay.includes(code);
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

    const explicitMatches = relatedOrders.filter(order => movementMentionsOrderCode(movement, order.orderCode));
    const matchedOrders = explicitMatches.length > 0 ? explicitMatches : relatedOrders;
    const matchedByOrder = explicitMatches.length > 0;
    const orderCode = [...new Set(matchedOrders.map(order => order.orderCode).filter(Boolean))].join(', ');
    const machine = [...new Set(matchedOrders.map(order => order.machine).filter(Boolean))].join(', ');

    rows.push({
      key: `${movement.id || movement.slipCode}|${movement.itemCode}|${movement.slipDate}`,
      ngay: parseProductionOrderFilterDate(movement.slipDate) || movement.slipDate,
      shift: movement.shift,
      shiftLabel: formatProductionOrderShiftLabel(movement.shift, lookupSettings),
      orderCode,
      machine,
      slipCode: movement.slipCode,
      itemCode: movement.itemCode,
      itemName: movement.itemName,
      unit: movement.unit,
      quantity: Number.isFinite(movement.quantity) ? movement.quantity : 0,
      normWeightKg: null,
      materialNorm: null,
      weightKg: resolveExportWeightKg(movement, input.materials),
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

/** SL SP × Giá trị Thành phần → kg (ĐVT ≠ kg thì lấy Tổng TL từ kho NVL). */
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

  const qty = Math.max(0, item.quantity ?? 0) * orderQuantity;
  if (qty <= 0) return null;

  const unit = String(item.unit || '').trim();
  if (!unit || unit === '-' || isWarehouseKgUnit(unit)) return qty;

  const converted = convertWarehouseQuantityToKg({
    quantity: qty,
    unit,
    itemCode: item.code,
    warehouseKind: 'nvl',
    materials: materialsCatalog
  });
  return converted !== null && Number.isFinite(converted) && converted > 0 ? converted : null;
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
 * Phiếu kho không lưu mã SP, vì vậy NVL chung được phân bổ theo định mức thành phần;
 * mọi dòng không đủ dữ liệu đối chiếu được giữ riêng để tổng không bị sai lệch.
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

  const productMap = new Map<string, WarehouseProductAllocation>();
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

      const resolvedNormKg = resolveProductUnitNormKg(catalogProduct);
      if (resolvedNormKg !== null && resolvedNormKg > 0) {
        productGroup.normKgPerUnit = resolvedNormKg;
        productGroup.normWeightKg += resolvedNormKg * orderQuantity;
      }
      for (const item of catalogProduct?.nplItems || []) {
        const materialKey = normalizeProductCodeKey(item.code);
        if (!materialKey) continue;
        productGroup.materialKeys.add(materialKey);
        const expectedKg = resolveBomExpectedKg(item, orderQuantity, resolvedNormKg, materialsCatalog);
        if (expectedKg === null) continue;
        productGroup.materialWeights.set(
          materialKey,
          (productGroup.materialWeights.get(materialKey) ?? 0) + expectedKg
        );
        const existingFormula = productGroup.materialFormulas.get(materialKey);
        const rate =
          item.amountType === 'quantity'
            ? Math.max(0, item.quantity ?? 0)
            : Math.max(0, item.percent ?? 0);
        const rawExpectedQuantity =
          item.amountType === 'quantity' ? rate * orderQuantity : expectedKg;
        productGroup.materialFormulas.set(materialKey, {
          productCode,
          productName: productName || catalogProduct?.name || productCode,
          productQuantity: (existingFormula?.productQuantity ?? 0) + orderQuantity,
          productUnit: String(line.unit || catalogProduct?.unit || '').trim() || 'SP',
          productNormKgPerUnit: resolvedNormKg,
          materialCode: item.code,
          materialName: item.name || item.code,
          amountType: item.amountType,
          rate,
          rateUnit: item.amountType === 'quantity' ? item.unit || 'đơn vị' : '%',
          rawExpectedQuantity: (existingFormula?.rawExpectedQuantity ?? 0) + rawExpectedQuantity,
          rawExpectedUnit: item.amountType === 'quantity' ? item.unit || 'đơn vị' : 'kg',
          totalNormKg: (existingFormula?.totalNormKg ?? 0) + expectedKg,
          allocationRatio: 1,
          allocatedNormKg: (existingFormula?.allocatedNormKg ?? 0) + expectedKg
        });
      }
    });
  });

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
    ratio: number,
    suffix: string
  ) => {
    const quantity = row.quantity * ratio;
    const weightKg = row.weightKg === null ? null : row.weightKg * ratio;
    target.lines.push({
      ...row,
      key: `${row.key}|${suffix}`,
      quantity,
      weightKg,
      normWeightKg: null,
      materialNorm: null
    });
    target.quantity += quantity > 0 ? quantity : 0;
    target.totalWeightKg += weightKg && weightKg > 0 ? weightKg : 0;
    target.lineCount += 1;
  };

  for (const row of group.lines) {
    if (productGroups.length === 1) {
      addAllocatedLine(productGroups[0], row, 1, productGroups[0].productKey);
      continue;
    }

    const materialKey = normalizeProductCodeKey(row.itemCode);
    const matchedProducts = productGroups.filter(product => product.materialKeys.has(materialKey));
    if (matchedProducts.length === 0) {
      addAllocatedLine(unassigned, row, 1, 'unassigned');
      continue;
    }
    if (matchedProducts.length === 1) {
      addAllocatedLine(matchedProducts[0], row, 1, matchedProducts[0].productKey);
      continue;
    }

    const totalExpected = matchedProducts.reduce(
      (sum, product) => sum + Math.max(0, product.materialWeights.get(materialKey) ?? 0),
      0
    );
    matchedProducts.forEach((product, index) => {
      const ratio =
        index === matchedProducts.length - 1
          ? 1 - matchedProducts.slice(0, index).reduce((sum, previous) => {
              const expected = Math.max(0, previous.materialWeights.get(materialKey) ?? 0);
              return sum + (totalExpected > 0 ? expected / totalExpected : 1 / matchedProducts.length);
            }, 0)
          : totalExpected > 0
            ? Math.max(0, product.materialWeights.get(materialKey) ?? 0) / totalExpected
            : 1 / matchedProducts.length;
      product.usedQuotaAllocation = true;
      addAllocatedLine(product, row, ratio, product.productKey);
    });
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
      const assignNorm = (line: BbWarehouseExportLineRow, value: number | null, ratio: number) => {
        line.normWeightKg = value;
        line.materialNorm =
          baseFormula && value !== null
            ? { ...baseFormula, allocationRatio: ratio, allocatedNormKg: value }
            : null;
      };
      if (expected <= 0) {
        lines.forEach(line => {
          assignNorm(line, null, 0);
        });
        continue;
      }
      const totalQty = lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
      if (totalQty <= 0) {
        assignNorm(lines[0], roundQty(expected), 1);
        lines.slice(1).forEach(line => {
          assignNorm(line, null, 0);
        });
        continue;
      }
      let assigned = 0;
      lines.forEach((line, index) => {
        const ratio = Math.max(0, line.quantity) / totalQty;
        if (index === lines.length - 1) {
          assignNorm(line, roundQty(expected - assigned), ratio);
          return;
        }
        const share = roundQty(expected * ratio);
        assignNorm(line, share, ratio);
        assigned += share;
      });
    }
  };

  applyLineNormWeights(unassigned);
  productGroups.forEach(applyLineNormWeights);

  if (unassigned.lines.length > 0) productGroups.push(unassigned);
  return productGroups.map(
    ({
      materialWeights: _materialWeights,
      materialFormulas: _materialFormulas,
      materialKeys: _materialKeys,
      usedQuotaAllocation,
      ...product
    }) => ({
      ...product,
      allocationMode:
        product.allocationMode === 'unassigned' ? 'unassigned' : usedQuotaAllocation ? 'quota' : 'direct'
    })
  );
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
  xuatKg: number;
  tonDauKg: number;
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

const THUC_DUNG_NVL_LABELS = [
  { code: 'NHUA-TD', name: 'Nhựa thực dùng', field: 'nhua' as const },
  { code: 'MANG-TD', name: 'Màng thực dùng', field: 'mang' as const },
  { code: 'LOI-TD', name: 'Lõi thực dùng', field: 'loi' as const },
  { code: 'TUI-TD', name: 'Túi thực dùng', field: 'tui' as const }
];

/** Thực dùng = tồn đầu + xuất kho − tồn cuối, theo lệnh SX máy BB. */
export function buildBbThucDungLineRows(input: {
  productionOrders: ProductionOrderRow[];
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
    const xuat = emptyMaterialBucket();
    const tonDau = emptyMaterialBucket();
    const tonCuoi = emptyMaterialBucket();

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

    const shiftLabel = formatProductionOrderShiftLabel(header.shift, lookupSettings);
    for (const item of THUC_DUNG_NVL_LABELS) {
      const field = item.field;
      const xuatKg = xuat[field];
      const tonDauKg = tonDau[field];
      const tonCuoiKg = tonCuoi[field];
      const weightKg = computeMaterialUsageKg(xuatKg, tonDauKg, tonCuoiKg);
      if (
        (!Number.isFinite(weightKg) || weightKg === 0) &&
        xuatKg <= 0 &&
        tonDauKg <= 0 &&
        tonCuoiKg <= 0
      ) {
        continue;
      }
      rows.push({
        key: `${header.orderCode}|${header.ngay}|${header.shift}|${item.code}`,
        ngay: header.ngay,
        shift: header.shift,
        shiftLabel,
        orderCode: header.orderCode,
        machine: header.machine,
        materialCode: item.code,
        materialName: item.name,
        unit: 'kg',
        xuatKg: roundQty(xuatKg, 3),
        tonDauKg: roundQty(tonDauKg, 3),
        tonCuoiKg: roundQty(tonCuoiKg, 3),
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
        lines: [row]
      });
      continue;
    }
    existing.lineCount += 1;
    existing.totalWeightKg += Number.isFinite(row.weightKg) ? row.weightKg : 0;
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
