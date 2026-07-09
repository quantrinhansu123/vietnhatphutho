import type { AcceptanceReport } from '../components/AcceptanceReportForm';
import type { WeighingRecord } from './weighingRecords';
import { getWeighingDataRows, parseWeighingWeight, sumWeighingRowTotalWeight, sumDamagedGoodsRowWeight, formatWeighingWeightField, computeWeighingNetWeight } from './weighingRecords';
import { roundNormWeight } from '../lib/mixingReportModel';
import { getProductionShiftOptions, type ShiftSetting } from './shiftSettings';
import {
  formatShiftSummaryNumber,
  matchesShiftSummaryBucket,
  type ControlBoardShiftSummaryRow,
  type ShiftSummaryWarehouseMovement
} from './controlBoardShiftSummary';
import { formatNumber } from '../utils';
import { sumMachineNvlDauCaLineTotal, sumMachineNvlCuoiCaLineTotal, type MachineNvlSavedReport } from './machineNvlReports';

export type ShiftSummaryMetric =
  | 'slHang'
  | 'khoiLuongHang'
  | 'slHangThucTe'
  | 'khoiLuongHangThucTe'
  | 'hangHong'
  | 'khoiLuongNpl'
  | 'khoiLuongLoi'
  | 'tonDauCa'
  | 'tonCuoiCa'
  | 'tongVatLieu'
  | 'chenhLech';

export const SHIFT_SUMMARY_METRIC_META: Record<
  ShiftSummaryMetric,
  { label: string; source: string }
> = {
  slHang: { label: 'SL hàng LT', source: 'Lệnh sản xuất' },
  khoiLuongHang: { label: 'Khối lượng hàng', source: 'Lệnh sản xuất' },
  slHangThucTe: { label: 'SL hàng TT', source: 'Báo cáo sản lượng' },
  khoiLuongHangThucTe: { label: 'Khối lượng hàng TT', source: 'Báo cáo sản lượng (SL × kg định mức)' },
  hangHong: { label: 'Hàng hỏng', source: 'Báo cáo hàng hỏng' },
  khoiLuongNpl: { label: 'Khối lượng nhựa', source: 'Lịch sử xuất nhập kho (kg)' },
  khoiLuongLoi: { label: 'KL lõi', source: 'Phiếu cân ca' },
  tonDauCa: { label: 'Tồn đầu ca', source: 'Bảng tồn NVL (đầu ca)' },
  tonCuoiCa: { label: 'Tồn cuối ca', source: 'Bảng tồn NVL (cuối ca)' },
  tongVatLieu: { label: 'Tổng nhựa', source: 'KL nhựa + Tồn đầu ca' },
  chenhLech: {
    label: 'Chênh lệch',
    source: 'Tổng nhựa − KL hàng TT − Tồn cuối ca − Hàng hỏng + KL lõi'
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
    | 'hangHong'
    | 'khoiLuongLoi'
    | 'tongVatLieu'
    | 'chenhLech'
  > | null;
}): ShiftSummaryDetailView {
  const shiftOptions = getProductionShiftOptions(input.shiftSettings);
  const { ngay, ca, metric } = input;

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
        const lineTotal = sumMachineNvlDauCaLineTotal(line);
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
        { key: 'tongTon', label: 'Tổng tồn', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng tồn đầu ca',
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
        const lineTotal = sumMachineNvlCuoiCaLineTotal(line);
        if (lineTotal <= 0 && !line.maNvl && !line.tenNvl) continue;

        total += lineTotal;

        rows.push({
          rowKey: `${report.id}|${line.stt}|${line.maNvl}`,
          recordId: report.id || '',
          may: machineLabel,
          maNvl: line.maNvl || '-',
          tenNvl: line.tenNvl || '-',
          donVi: line.donVi || '-',
          slTonDinhMuc: formatDetailNumber(line.soLuongTonDinhMuc, 3),
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
        { key: 'slTonDinhMuc', label: 'SL tồn ĐM', align: 'right', mono: true },
        { key: 'tongTon', label: 'Tổng tồn', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng tồn cuối ca',
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
      if (!isKgUnit(movement.unit)) continue;
      if (!Number.isFinite(movement.quantity) || movement.quantity <= 0) continue;

      total += movement.quantity;
      rows.push({
        rowKey: movement.id || `${movement.slipCode}|${movement.itemCode}`,
        recordId: movement.slipCode || '',
        soPhieu: movement.slipCode || '-',
        loaiPhieu: warehouseSlipTypeLabel(movement.slipType),
        maNvl: movement.itemCode || '-',
        tenNvl: movement.itemName || '-',
        donVi: movement.unit || '-',
        khoiLuong: formatDetailNumber(movement.quantity, 3)
      });
    }

    return {
      columns: [
        { key: 'soPhieu', label: 'Mã phiếu' },
        { key: 'loaiPhieu', label: 'Loại' },
        { key: 'maNvl', label: 'Mã NVL' },
        { key: 'tenNvl', label: 'Tên NVL' },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'khoiLuong', label: 'KL (kg)', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng khối lượng nhựa',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3),
      showActions: true
    };
  }

  if (metric === 'khoiLuongLoi') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const record of getWeighingDataRows(input.weighingRecords ?? [])) {
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

      const coreWeight = parseWeighingWeight(record.coreWeight);
      if (coreWeight === null || coreWeight <= 0) continue;

      total += coreWeight;
      rows.push({
        rowKey: String(record.id ?? `${record.documentNo}|${record.weighNo}|${record.productCode}`),
        recordId: record.id != null ? String(record.id) : '',
        soPhieu: record.documentNo || '-',
        gio: record.weighTime || '-',
        may: record.machineName || '-',
        maSp: record.productCode || '-',
        tenSp: record.productName || '-',
        lanCan: record.weighNo || '-',
        klLoi: formatDetailNumber(coreWeight, 3)
      });
    }

    return {
      columns: [
        { key: 'soPhieu', label: 'Mã phiếu' },
        { key: 'gio', label: 'Giờ', mono: true },
        { key: 'may', label: 'Máy' },
        { key: 'maSp', label: 'Mã SP' },
        { key: 'tenSp', label: 'Tên SP' },
        { key: 'lanCan', label: 'Lần cân' },
        { key: 'klLoi', label: 'KL lõi', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng KL lõi',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3)
    };
  }

  if (metric === 'tongVatLieu') {
    const row = input.summaryRow;
    const khoiLuongNpl = row?.khoiLuongNpl ?? 0;
    const tonDauCa = row?.tonDauCa ?? 0;
    const tongVatLieu = row?.tongVatLieu ?? roundNormWeight(khoiLuongNpl + tonDauCa);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'congThuc', label: 'Công thức' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Khối lượng nhựa',
          congThuc: 'Xuất kho NVL (kg)',
          giaTri: formatDetailNumber(khoiLuongNpl, 3)
        },
        {
          thanhPhan: 'Tồn đầu ca',
          congThuc: 'Bảng tồn NVL đầu ca (kg)',
          giaTri: formatDetailNumber(tonDauCa, 3)
        },
        {
          thanhPhan: 'Tổng nhựa',
          congThuc: 'KL nhựa + Tồn đầu ca',
          giaTri: formatDetailNumber(tongVatLieu, 3)
        }
      ],
      totalLabel: 'Tổng nhựa = KL nhựa + Tồn đầu ca',
      totalValue: formatShiftSummaryNumber(tongVatLieu, 3)
    };
  }

  if (metric === 'chenhLech') {
    const row = input.summaryRow;
    const tongVatLieu = row?.tongVatLieu ?? 0;
    const khoiLuongHangThucTe = row?.khoiLuongHangThucTe ?? 0;
    const tonCuoiCa = row?.tonCuoiCa ?? 0;
    const hangHong = row?.hangHong ?? 0;
    const khoiLuongLoi = row?.khoiLuongLoi ?? 0;
    const chenhLech =
      row?.chenhLech ??
      roundNormWeight(tongVatLieu - khoiLuongHangThucTe - tonCuoiCa - hangHong + khoiLuongLoi);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Tổng nhựa',
          dau: '',
          giaTri: formatDetailNumber(tongVatLieu, 3)
        },
        {
          thanhPhan: 'Khối lượng hàng TT',
          dau: '−',
          giaTri: formatDetailNumber(khoiLuongHangThucTe, 3)
        },
        {
          thanhPhan: 'Tồn cuối ca',
          dau: '−',
          giaTri: formatDetailNumber(tonCuoiCa, 3)
        },
        {
          thanhPhan: 'Hàng hỏng',
          dau: '−',
          giaTri: formatDetailNumber(hangHong, 3)
        },
        {
          thanhPhan: 'KL lõi',
          dau: '+',
          giaTri: formatDetailNumber(khoiLuongLoi, 3)
        },
        {
          thanhPhan: 'Chênh lệch',
          dau: '=',
          giaTri: formatDetailNumber(chenhLech, 3)
        }
      ],
      totalLabel: 'Chênh lệch = Tổng nhựa − KL hàng TT − Tồn cuối ca − Hàng hỏng + KL lõi',
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
  if (metric === 'tongVatLieu' || metric === 'chenhLech') return value !== 0;
  return value > 0;
}
