import type { AcceptanceReport } from '../components/AcceptanceReportForm';
import type { WeighingRecord } from './weighingRecords';
import { getWeighingDataRows, parseWeighingWeight, sumWeighingRowTotalWeight, sumDamagedGoodsRowWeight, formatWeighingWeightField, computeWeighingNetWeight } from './weighingRecords';
import { roundNormWeight } from '../lib/mixingReportModel';
import { getProductionShiftOptions, type ShiftSetting } from './shiftSettings';
import {
  computeKhoiLuongNhuaTp,
  formatShiftSummaryNumber,
  KHOI_LUONG_NHUA_TP_FACTOR,
  matchesShiftSummaryBucket,
  type ControlBoardShiftSummaryRow,
  type ShiftSummaryWarehouseMovement
} from './controlBoardShiftSummary';
import { formatNumber } from '../utils';
import { sumMachineNvlDauCaLineTotal, sumMachineNvlCuoiCaLineTotal, type MachineNvlSavedReport } from './machineNvlReports';
import { normalizeProductCodeKey } from '../features/san-pham/types';

export type ShiftSummaryMetric =
  | 'slHang'
  | 'khoiLuongHang'
  | 'slHangThucTe'
  | 'khoiLuongHangThucTe'
  | 'khoiLuongNhuaTp'
  | 'hangHong'
  | 'khoiLuongNpl'
  | 'khoiLuongMangXuat'
  | 'khoiLuongLoi'
  | 'tonDauCa'
  | 'tonCuoiCa'
  | 'tongVatLieu'
  | 'chenhLech';

export const SHIFT_SUMMARY_METRIC_META: Record<
  ShiftSummaryMetric,
  { label: string; source: string }
> = {
  slHang: { label: 'SL đặt SX', source: 'Lệnh sản xuất' },
  khoiLuongHang: { label: 'Khối lượng hàng', source: 'Lệnh sản xuất' },
  slHangThucTe: { label: 'SL hàng TT', source: 'Báo cáo sản lượng' },
  khoiLuongHangThucTe: { label: 'Khối lượng hàng TT', source: 'Báo cáo sản lượng (SL × kg định mức)' },
  khoiLuongNhuaTp: {
    label: 'KL nhựa TP',
    source: '(KL hàng TT − KL lõi − KL bì) × 0,75'
  },
  hangHong: { label: 'Hàng hỏng', source: 'Báo cáo hàng hỏng' },
  khoiLuongNpl: { label: 'Khối lượng nhựa xuất', source: 'Lịch sử xuất kho NVL (kg)' },
  khoiLuongMangXuat: { label: 'KL màng xuất (kg)', source: 'Xuất kho NVL đơn vị m² → quy đổi kg' },
  khoiLuongLoi: { label: 'KL lõi', source: 'Báo cáo sản lượng (SL cuộn TT × 1kg)' },
  tonDauCa: { label: 'Tồn đầu ca nhựa', source: 'Bảng tồn NVL đầu ca (chỉ kg)' },
  tonCuoiCa: { label: 'Tồn cuối ca nhựa', source: 'Bảng tồn NVL cuối ca (chỉ kg)' },
  tongVatLieu: { label: 'Tổng nhựa sử dụng', source: 'KL nhựa xuất + Tồn đầu ca nhựa − Tồn cuối ca nhựa' },
  chenhLech: {
    label: 'Chênh lệch nhựa',
    source: 'KL nhựa xuất + Tồn đầu ca nhựa − Tồn cuối ca nhựa − KL nhựa TP − HH nhựa'
  }
};

export type ShiftSummaryDetailColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  mono?: boolean;
  accent?: boolean;
};

export type ShiftSummaryDetailRow = Record<string, string | number | null>;

export type ShiftSummaryDetailView = {
  columns: ShiftSummaryDetailColumn[];
  rows: ShiftSummaryDetailRow[];
  totalLabel: string;
  totalValue: string;
  showActions?: boolean;
};

type ProductRef = { code: string; totalWeight: string };

type ProductionOrderRef = {
  code: string;
  startDate: string;
  shift: string;
  productCode: string;
  productName: string;
  quantity: string;
  unit: string;
  products: Array<{ productCode: string; productName: string; quantity: string; unit: string }>;
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

// Dùng cho "Tổng kg" dạng định mức nhỏ (vd 0.238 kg/m2) và cũng hỗ trợ kiểu VN (1.250,5)
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

function warehouseSlipTypeLabel(type: 'nhap' | 'xuat') {
  return type === 'nhap' ? 'Nhập kho' : 'Xuất kho';
}

function formatDetailNumber(value: number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return formatNumber(value, fractionDigits);
}

export function getShiftSummaryDetail(input: {
  metric: ShiftSummaryMetric;
  ngay: string;
  ca: string;
  shiftSettings: ShiftSetting[];
  productionOrders: ProductionOrderRef[];
  products: ProductRef[];
  materials?: Array<{ code: string; totalWeight: string }>;
  acceptanceReports: AcceptanceReport[];
  warehouseMovements?: ShiftSummaryWarehouseMovement[];
  weighingRecords: WeighingRecord[];
  damagedRecords?: WeighingRecord[];
  machineNvlReports?: MachineNvlSavedReport[];
  summaryRow?: Pick<
    ControlBoardShiftSummaryRow,
    | 'khoiLuongNpl'
    | 'tonDauCa'
    | 'tonCuoiCa'
    | 'khoiLuongHangThucTe'
    | 'khoiLuongLoi'
    | 'khoiLuongMang'
    | 'khoiLuongNhuaTp'
    | 'hangHongNhua'
    | 'tongVatLieu'
    | 'chenhLech'
  > | null;
}): ShiftSummaryDetailView {
  const shiftOptions = getProductionShiftOptions(input.shiftSettings);
  const { ngay, ca, metric } = input;

  const inventoryTotalKgByCode = (() => {
    const map = new Map<string, number>();
    for (const material of input.materials ?? []) {
      const key = normalizeProductCodeKey(material.code);
      if (!key) continue;
      const totalKg = parseKgFactor(material.totalWeight);
      if (totalKg !== null && totalKg > 0) map.set(key, totalKg);
    }
    return map;
  })();

  const resolveLineKgFactor = (unit: string, code: string, lineFactor: number | null | undefined) => {
    if (isKgUnit(unit)) return 1;
    if (lineFactor !== null && lineFactor !== undefined && Number.isFinite(lineFactor) && lineFactor > 0) return lineFactor;
    return inventoryTotalKgByCode.get(normalizeProductCodeKey(code)) ?? null;
  };

  if (metric === 'slHang' || metric === 'khoiLuongHang') {
    const rows: ShiftSummaryDetailRow[] = [];
    let totalQty = 0;
    let totalKl = 0;

    for (const order of input.productionOrders) {
      if (!matchesShiftSummaryBucket(ngay, ca, order.startDate, order.shift, shiftOptions)) continue;

      for (const line of getOrderProductLines(order)) {
        const qty = parseOrderQuantity(line.quantity);
        if (qty <= 0) continue;
        const unitWeight = findProductWeight(input.products, line.productCode);
        const lineKl = unitWeight !== null && unitWeight > 0 ? unitWeight * qty : null;

        totalQty += qty;
        if (lineKl !== null) totalKl += lineKl;

        if (metric === 'slHang') {
          rows.push({
            maLenh: order.code || '-',
            sanPham: line.productName || line.productCode || '-',
            donVi: line.unit || '-',
            soLuong: qty
          });
        } else {
          rows.push({
            maLenh: order.code || '-',
            sanPham: line.productName || line.productCode || '-',
            soLuong: qty,
            tlDonVi: unitWeight !== null ? formatDetailNumber(unitWeight, 3) : '-',
            khoiLuong: lineKl !== null ? formatDetailNumber(lineKl, 3) : '-'
          });
        }
      }
    }

    if (metric === 'slHang') {
      return {
        columns: [
          { key: 'maLenh', label: 'Mã lệnh' },
          { key: 'sanPham', label: 'Sản phẩm' },
          { key: 'donVi', label: 'ĐVT' },
          { key: 'soLuong', label: 'SL', align: 'right', mono: true, accent: true }
        ],
        rows,
        totalLabel: 'Tổng SL',
        totalValue: formatShiftSummaryNumber(totalQty, 0)
      };
    }

    return {
      columns: [
        { key: 'maLenh', label: 'Mã lệnh' },
        { key: 'sanPham', label: 'Sản phẩm' },
        { key: 'soLuong', label: 'SL', align: 'right', mono: true },
        { key: 'tlDonVi', label: 'TL đơn vị', align: 'right', mono: true },
        { key: 'khoiLuong', label: 'KL dòng', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng KL',
      totalValue: formatShiftSummaryNumber(roundNormWeight(totalKl), 3)
    };
  }

  if (metric === 'slHangThucTe') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const report of input.acceptanceReports) {
      if (!matchesShiftSummaryBucket(ngay, ca, report.ngay, report.ca, shiftOptions)) continue;
      if (report.so_luong === null || !Number.isFinite(report.so_luong)) continue;

      total += report.so_luong;
      rows.push({
        gio: report.gio || '-',
        may: report.ten_may || report.ma_may || '-',
        lan: report.lan || '-',
        matHang: report.mat_hang || '-',
        donVi: report.don_vi || '-',
        soLuong: report.so_luong
      });
    }

    return {
      columns: [
        { key: 'gio', label: 'Giờ', mono: true },
        { key: 'may', label: 'Máy' },
        { key: 'lan', label: 'Lần' },
        { key: 'matHang', label: 'Mặt hàng' },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'soLuong', label: 'SL', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng SL',
      totalValue: formatShiftSummaryNumber(total, 2)
    };
  }

  if (metric === 'khoiLuongHangThucTe') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const report of input.acceptanceReports) {
      if (!matchesShiftSummaryBucket(ngay, ca, report.ngay, report.ca, shiftOptions)) continue;
      if (report.so_luong === null || !Number.isFinite(report.so_luong) || report.so_luong <= 0) continue;

      const unitWeight = findProductWeight(input.products, report.mat_hang);
      const lineWeight = unitWeight !== null && unitWeight > 0 ? unitWeight * report.so_luong : 0;
      if (lineWeight <= 0) continue;
      total += lineWeight;

      rows.push({
        gio: report.gio || '-',
        may: report.ten_may || report.ma_may || '-',
        lan: report.lan || '-',
        maSp: report.mat_hang || '-',
        tenSp: report.ten_sp || '-',
        soLuong: report.so_luong,
        dinhMucKg: unitWeight !== null ? formatDetailNumber(unitWeight, 3) : '-',
        khoiLuong: formatDetailNumber(lineWeight, 3)
      });
    }

    return {
      columns: [
        { key: 'gio', label: 'Giờ', mono: true },
        { key: 'may', label: 'Máy' },
        { key: 'lan', label: 'Lần' },
        { key: 'maSp', label: 'Mã SP' },
        { key: 'tenSp', label: 'Tên SP' },
        { key: 'soLuong', label: 'SL', align: 'right', mono: true },
        { key: 'dinhMucKg', label: 'ĐM (kg)', align: 'right', mono: true },
        { key: 'khoiLuong', label: 'Khối lượng', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng KL',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3)
    };
  }

  if (metric === 'hangHong') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const record of getWeighingDataRows(input.damagedRecords ?? [])) {
      if (
        !matchesShiftSummaryBucket(
          ngay,
          ca,
          record.productionDate || record.reportDate,
          record.shiftName,
          shiftOptions
        )
      ) {
        continue;
      }

      const lineWeight = sumDamagedGoodsRowWeight(record);
      if (lineWeight <= 0 && !record.note?.trim()) continue;

      total += lineWeight;
      rows.push({
        rowKey: String(record.id ?? `${record.documentNo}|${record.weighNo}|${record.weighTime}`),
        recordId: record.id != null ? String(record.id) : '',
        soPhieu: record.documentNo || '-',
        gio: record.weighTime || '-',
        may: record.machineName || '-',
        klNhua: formatWeighingWeightField(record.weight),
        klMang: formatWeighingWeightField(record.shellWeight),
        lanCan: record.weighNo || '-',
        khoiLuong: formatDetailNumber(lineWeight, 3),
        ghiChu: record.note || '-'
      });
    }

    return {
      columns: [
        { key: 'soPhieu', label: 'Mã phiếu' },
        { key: 'gio', label: 'Giờ', mono: true },
        { key: 'may', label: 'Máy' },
        { key: 'klNhua', label: 'KL nhựa', align: 'right', mono: true },
        { key: 'klMang', label: 'KL màng', align: 'right', mono: true },
        { key: 'lanCan', label: 'Lần' },
        { key: 'khoiLuong', label: 'Tổng KL', align: 'right', mono: true, accent: true },
        { key: 'ghiChu', label: 'Ghi chú' }
      ],
      rows,
      totalLabel: 'Tổng hàng hỏng',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3)
    };
  }

  if (metric === 'tonDauCa') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const report of input.machineNvlReports ?? []) {
      if (report.reportKind !== 'dau_ca') continue;
      if (!matchesShiftSummaryBucket(ngay, ca, report.ngay, report.ca, shiftOptions)) continue;

      const machineLabel = report.tenMay || report.maMay || '-';

      for (const line of report.lines) {
        if (!isKgUnit(line.donVi || '')) continue;
        const qtyBase =
          (line.soLuongTon > 0
            ? line.soLuongTon
            : (line.soLuongTrongMay ?? 0) + (line.soLuongTrongBonTron ?? 0) + (line.soLuongNlChuaTron ?? 0)) || 0;
        const lineTotal = qtyBase > 0 ? qtyBase : 0;
        if (lineTotal <= 0 && !line.maNvl && !line.tenNvl) continue;

        total += lineTotal;

        rows.push({
          rowKey: `${report.id}|${line.stt}|${line.maNvl}`,
          recordId: report.id || '',
          may: machineLabel,
          maNvl: line.maNvl || '-',
          tenNvl: line.tenNvl || '-',
          donVi: line.donVi || '-',
          tonTrongMay: formatDetailNumber(line.soLuongTrongMay, 3),
          tonTrongBonTron: formatDetailNumber(line.soLuongTrongBonTron, 3),
          nlChuaTron: formatDetailNumber(line.soLuongNlChuaTron, 3),
          tongTon: formatDetailNumber(lineTotal, 3)
        });
      }
    }

    return {
      columns: [
        { key: 'may', label: 'Máy' },
        { key: 'maNvl', label: 'Mã NVL' },
        { key: 'tenNvl', label: 'Tên NVL' },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'tonTrongMay', label: 'Tồn máy', align: 'right', mono: true },
        { key: 'tonTrongBonTron', label: 'Tồn bồn', align: 'right', mono: true },
        { key: 'nlChuaTron', label: 'NL chưa trộn', align: 'right', mono: true },
        { key: 'tongTon', label: 'Tổng tồn (kg)', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng tồn đầu ca nhựa (kg)',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3),
      showActions: true
    };
  }

  if (metric === 'tonCuoiCa') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const report of input.machineNvlReports ?? []) {
      if (report.reportKind !== 'cuoi_ca') continue;
      if (!matchesShiftSummaryBucket(ngay, ca, report.ngay, report.ca, shiftOptions)) continue;

      const machineLabel = report.tenMay || report.maMay || '-';

      for (const line of report.lines) {
        if (!isKgUnit(line.donVi || '')) continue;
        const qtyBase =
          (line.soLuongTon > 0
            ? line.soLuongTon
            : (line.soLuongTrongMay ?? 0) + (line.soLuongTrongBonTron ?? 0) + (line.soLuongNlChuaTron ?? 0)) || 0;
        const lineTotal = qtyBase > 0 ? qtyBase : 0;
        if (lineTotal <= 0 && !line.maNvl && !line.tenNvl) continue;

        total += lineTotal;

        rows.push({
          rowKey: `${report.id}|${line.stt}|${line.maNvl}`,
          recordId: report.id || '',
          may: machineLabel,
          maNvl: line.maNvl || '-',
          tenNvl: line.tenNvl || '-',
          donVi: line.donVi || '-',
          tonTrongMay: formatDetailNumber(line.soLuongTrongMay, 3),
          tonTrongBonTron: formatDetailNumber(line.soLuongTrongBonTron, 3),
          nlChuaTron: formatDetailNumber(line.soLuongNlChuaTron, 3),
          tongTon: formatDetailNumber(lineTotal, 3)
        });
      }
    }

    return {
      columns: [
        { key: 'may', label: 'Máy' },
        { key: 'maNvl', label: 'Mã NVL' },
        { key: 'tenNvl', label: 'Tên NVL' },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'tonTrongMay', label: 'Tồn máy', align: 'right', mono: true },
        { key: 'tonTrongBonTron', label: 'Tồn bồn', align: 'right', mono: true },
        { key: 'nlChuaTron', label: 'NL chưa trộn', align: 'right', mono: true },
        { key: 'tongTon', label: 'Tổng tồn (kg)', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng tồn cuối ca nhựa (kg)',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3),
      showActions: true
    };
  }

  if (metric === 'khoiLuongNpl') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const movement of input.warehouseMovements ?? []) {
      if (!matchesShiftSummaryBucket(ngay, ca, movement.slipDate, movement.shift, shiftOptions)) continue;
      if (movement.warehouseKind !== 'nvl') continue;
      if (movement.slipType !== 'xuat') continue;
      if (!Number.isFinite(movement.quantity) || movement.quantity <= 0) continue;

      const unit = movement.unit || '';
      if (!isKgUnit(unit)) continue;

      const kg = movement.quantity;
      if (!Number.isFinite(kg) || kg <= 0) continue;

      total += kg;
      rows.push({
        rowKey: movement.id || `${movement.slipCode}|${movement.itemCode}`,
        recordId: movement.slipCode || '',
        soPhieu: movement.slipCode || '-',
        loaiPhieu: warehouseSlipTypeLabel(movement.slipType),
        maNvl: movement.itemCode || '-',
        tenNvl: movement.itemName || '-',
        soLuong: formatDetailNumber(movement.quantity, 3),
        donVi: movement.unit || '-',
        khoiLuong: formatDetailNumber(kg, 3)
      });
    }

    return {
      columns: [
        { key: 'soPhieu', label: 'Mã phiếu' },
        { key: 'loaiPhieu', label: 'Loại' },
        { key: 'maNvl', label: 'Mã NVL' },
        { key: 'tenNvl', label: 'Tên NVL' },
        { key: 'soLuong', label: 'SL', align: 'right', mono: true },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'khoiLuong', label: 'KL (kg)', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng khối lượng nhựa xuất (kg)',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3),
      showActions: true
    };
  }

  if (metric === 'khoiLuongMangXuat') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const movement of input.warehouseMovements ?? []) {
      if (!matchesShiftSummaryBucket(ngay, ca, movement.slipDate, movement.shift, shiftOptions)) continue;
      if (movement.warehouseKind !== 'nvl') continue;
      if (movement.slipType !== 'xuat') continue;
      if (!Number.isFinite(movement.quantity) || movement.quantity <= 0) continue;

      const unit = movement.unit || '';
      if (!isM2Unit(unit)) continue;

      const factor = resolveLineKgFactor(unit, movement.itemCode || '', null);
      const kg = factor !== null && factor > 0 ? movement.quantity * factor : 0;
      if (kg <= 0) continue;

      total += kg;
      rows.push({
        rowKey: movement.id || `${movement.slipCode}|${movement.itemCode}`,
        recordId: movement.slipCode || '',
        soPhieu: movement.slipCode || '-',
        loaiPhieu: warehouseSlipTypeLabel(movement.slipType),
        maNvl: movement.itemCode || '-',
        tenNvl: movement.itemName || '-',
        soLuongM2: formatDetailNumber(movement.quantity, 3),
        heSoKg: factor !== null ? formatDetailNumber(factor, 3) : '-',
        khoiLuong: formatDetailNumber(kg, 3)
      });
    }

    return {
      columns: [
        { key: 'soPhieu', label: 'Mã phiếu' },
        { key: 'loaiPhieu', label: 'Loại' },
        { key: 'maNvl', label: 'Mã NVL' },
        { key: 'tenNvl', label: 'Tên NVL' },
        { key: 'soLuongM2', label: 'SL (m²)', align: 'right', mono: true },
        { key: 'heSoKg', label: 'Hệ số (kg/m²)', align: 'right', mono: true },
        { key: 'khoiLuong', label: 'KL (kg)', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng KL màng xuất',
      totalValue: `${formatShiftSummaryNumber(roundNormWeight(total), 3)} kg`,
      showActions: true
    };
  }

  if (metric === 'khoiLuongLoi') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const report of input.acceptanceReports) {
      if (!matchesShiftSummaryBucket(ngay, ca, report.ngay, report.ca, shiftOptions)) continue;
      if (report.so_luong === null || !Number.isFinite(report.so_luong) || report.so_luong <= 0) continue;

      // KL lõi = Số lượng cuộn thực tế × 1kg
      total += report.so_luong;
      rows.push({
        gio: report.gio || '-',
        may: report.ten_may || report.ma_may || '-',
        lan: report.lan || '-',
        matHang: report.mat_hang || '-',
        donVi: report.don_vi || '-',
        khoiLuong: formatDetailNumber(report.so_luong, 3)
      });
    }

    return {
      columns: [
        { key: 'gio', label: 'Giờ', mono: true },
        { key: 'may', label: 'Máy' },
        { key: 'lan', label: 'Lần' },
        { key: 'matHang', label: 'Mặt hàng' },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'khoiLuong', label: 'KL lõi (kg)', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng KL lõi (SL cuộn × 1kg)',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3)
    };
  }

  if (metric === 'khoiLuongNhuaTp') {
    const row = input.summaryRow;
    const khoiLuongHangThucTe = row?.khoiLuongHangThucTe ?? 0;
    const khoiLuongLoi = row?.khoiLuongLoi ?? 0;
    const khoiLuongMang = row?.khoiLuongMang ?? 0;
    const khoiLuongNhuaTp =
      row?.khoiLuongNhuaTp ?? computeKhoiLuongNhuaTp(khoiLuongHangThucTe, khoiLuongLoi, khoiLuongMang);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Khối lượng hàng TT',
          dau: '',
          giaTri: formatDetailNumber(khoiLuongHangThucTe, 3)
        },
        {
          thanhPhan: 'KL lõi',
          dau: '−',
          giaTri: formatDetailNumber(khoiLuongLoi, 3)
        },
        {
          thanhPhan: 'KL bì',
          dau: '−',
          giaTri: formatDetailNumber(khoiLuongMang, 3)
        },
        {
          thanhPhan: `× ${KHOI_LUONG_NHUA_TP_FACTOR}`,
          dau: '',
          giaTri: formatDetailNumber(
            roundNormWeight((khoiLuongHangThucTe - khoiLuongLoi - khoiLuongMang) * KHOI_LUONG_NHUA_TP_FACTOR),
            3
          )
        },
        {
          thanhPhan: 'KL nhựa TP',
          dau: '=',
          giaTri: formatDetailNumber(khoiLuongNhuaTp, 3)
        }
      ],
      totalLabel: 'KL nhựa TP = (KL hàng TT − KL lõi − KL bì) × 0,75',
      totalValue: formatShiftSummaryNumber(khoiLuongNhuaTp, 3)
    };
  }

  if (metric === 'tongVatLieu') {
    const row = input.summaryRow;
    const khoiLuongNpl = row?.khoiLuongNpl ?? 0;
    const tonDauCa = row?.tonDauCa ?? 0;
    const tonCuoiCa = row?.tonCuoiCa ?? 0;
    const tongVatLieu = row?.tongVatLieu ?? roundNormWeight(khoiLuongNpl + tonDauCa - tonCuoiCa);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'congThuc', label: 'Công thức' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Khối lượng nhựa xuất',
          congThuc: '+',
          giaTri: formatDetailNumber(khoiLuongNpl, 3)
        },
        {
          thanhPhan: 'Tồn đầu ca nhựa',
          congThuc: '+',
          giaTri: formatDetailNumber(tonDauCa, 3)
        },
        {
          thanhPhan: 'Tồn cuối ca nhựa',
          congThuc: '−',
          giaTri: formatDetailNumber(tonCuoiCa, 3)
        },
        {
          thanhPhan: 'Tổng nhựa sử dụng',
          congThuc: '=',
          giaTri: formatDetailNumber(tongVatLieu, 3)
        }
      ],
      totalLabel: 'Tổng nhựa sử dụng = KL nhựa xuất + Tồn đầu ca nhựa − Tồn cuối ca nhựa',
      totalValue: formatShiftSummaryNumber(tongVatLieu, 3)
    };
  }

  if (metric === 'chenhLech') {
    const row = input.summaryRow;
    const khoiLuongNpl = row?.khoiLuongNpl ?? 0;
    const tonDauCa = row?.tonDauCa ?? 0;
    const tonCuoiCa = row?.tonCuoiCa ?? 0;
    const khoiLuongNhuaTp = row?.khoiLuongNhuaTp ?? 0;
    const hangHongNhua = row?.hangHongNhua ?? 0;
    const chenhLech =
      row?.chenhLech ??
      roundNormWeight(khoiLuongNpl + tonDauCa - tonCuoiCa - khoiLuongNhuaTp - hangHongNhua);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Khối lượng nhựa xuất',
          dau: '',
          giaTri: formatDetailNumber(khoiLuongNpl, 3)
        },
        {
          thanhPhan: 'Tồn đầu ca nhựa',
          dau: '+',
          giaTri: formatDetailNumber(tonDauCa, 3)
        },
        {
          thanhPhan: 'Tồn cuối ca nhựa',
          dau: '−',
          giaTri: formatDetailNumber(tonCuoiCa, 3)
        },
        {
          thanhPhan: 'KL nhựa TP',
          dau: '−',
          giaTri: formatDetailNumber(khoiLuongNhuaTp, 3)
        },
        {
          thanhPhan: 'HH nhựa',
          dau: '−',
          giaTri: formatDetailNumber(hangHongNhua, 3)
        },
        {
          thanhPhan: 'Chênh lệch nhựa',
          dau: '=',
          giaTri: formatDetailNumber(chenhLech, 3)
        }
      ],
      totalLabel: 'Chênh lệch nhựa = KL nhựa xuất + Tồn đầu ca nhựa − Tồn cuối ca nhựa − KL nhựa TP − HH nhựa',
      totalValue: formatShiftSummaryNumber(chenhLech, 3)
    };
  }

  return {
    columns: [],
    rows: [],
    totalLabel: 'Tổng',
    totalValue: '-'
  };
}

export function isShiftSummaryMetricClickable(
  row: ControlBoardShiftSummaryRow,
  metric: ShiftSummaryMetric
) {
  const value = row[metric];
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (metric === 'tongVatLieu' || metric === 'chenhLech' || metric === 'khoiLuongNhuaTp') return value !== 0;
  return value > 0;
}
