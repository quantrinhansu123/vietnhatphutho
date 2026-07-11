import type { AcceptanceReport } from '../components/AcceptanceReportForm';
import type { WeighingRecord } from './weighingRecords';
import { getWeighingDataRows, parseWeighingWeight, sumWeighingRowTotalWeight, sumDamagedGoodsRowWeight, formatWeighingWeightField, computeWeighingNetWeight } from './weighingRecords';
import { roundNormWeight } from '../lib/mixingReportModel';
import { getProductionShiftOptions, type ShiftSetting } from './shiftSettings';
import {
  computeKhoiLuongNhuaTp,
  computeMachineNvlLineKg,
  computeMaterialUsageKg,
  computeTlLoiTpNhapKhoFromShiftSummary,
  computeTlMangTpNhapKhoFromShiftSummary,
  computeTlNhuaTpNhapKhoFromShiftSummary,
  computeTlTuiBaoBiNhapKhoFromShiftSummary,
  formatShiftSummaryNumber,
  KHOI_LUONG_NHUA_TP_FACTOR,
  TL_LOI_TP_KG_PER_UNIT,
  TL_TUI_BAO_BI_KG_PER_UNIT,
  matchesShiftSummaryBucket,
  resolveMachineNvlLineMaterialType,
  type ControlBoardShiftSummaryRow,
  type ShiftSummaryWarehouseMovement
} from './controlBoardShiftSummary';
import { formatNumber } from '../utils';
import { sumMachineNvlDauCaLineTotal, type MachineNvlSavedReport } from './machineNvlReports';
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
  | 'tongNhuaThucDung'
  | 'tongMangThucDung'
  | 'loiThucDung'
  | 'tuiThucDung'
  | 'tongThucDung'
  | 'tongVatLieu'
  | 'chenhLech'
  | 'khoiLuongLoiXuatKho'
  | 'khoiLuongTuiXuatKho'
  | 'tongTrongLuongXuatKho'
  | 'tonDauCaNhua'
  | 'tonDauCaMang'
  | 'tonDauCaLoi'
  | 'tonDauCaTui'
  | 'tongTrongLuongTonDauCa'
  | 'tonCuoiCaNhua'
  | 'tonCuoiCaMang'
  | 'tonCuoiCaLoi'
  | 'tonCuoiCaTui'
  | 'tongTrongLuongTonCuoiCa'
  | 'slDatThucTeNhapKho'
  | 'tlNhuaTpNhapKho'
  | 'tlMangTpNhapKho'
  | 'tlTuiBaoBiNhapKho'
  | 'tlLoiTpNhapKho'
  | 'tongTpNhapKho'
  | 'tlNhuaKhongMangLoiHong'
  | 'tlNhuaCucDauNongLoiHong'
  | 'tlNhuaDinhMangLoiHong'
  | 'tlMangLoiHong'
  | 'soCuonLoiDinhHangHong'
  | 'tongTrongLuongLoiHong';

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
  khoiLuongNpl: { label: 'Số lượng nhựa thực tế xuất dùng (kg)', source: 'Phiếu xuất kho NVL (kg)' },
  khoiLuongMangXuat: { label: 'KL màng xuất (kg)', source: 'Xuất kho NVL đơn vị m² → quy đổi kg' },
  khoiLuongLoi: { label: 'KL lõi', source: 'Báo cáo sản lượng (SL cuộn TT × 1kg)' },
  tonDauCa: { label: 'Tồn đầu ca nhựa', source: 'Bảng tồn NVL đầu ca (chỉ kg)' },
  tonCuoiCa: { label: 'Tồn cuối ca nhựa', source: 'Bảng tồn NVL cuối ca (chỉ kg)' },
  tongNhuaThucDung: {
    label: 'Tổng Nhựa thực dùng',
    source:
      'Số lượng nhựa tồn đầu ca (kg) + Số lượng nhựa thực tế xuất dùng (kg) − Số lượng nhựa tồn cuối ca (kg)'
  },
  tongMangThucDung: {
    label: 'Tổng màng thực dùng',
    source: 'KL màng xuất + Tồn đầu ca màng − Tồn cuối ca màng'
  },
  loiThucDung: {
    label: 'Lõi thực dùng',
    source: 'Số lượng đạt thực tế × 1'
  },
  tuiThucDung: {
    label: 'Túi thực dùng',
    source: 'TL túi bao bì nhập kho (kg) = 0,2 × Số lượng đạt thực tế'
  },
  tongThucDung: {
    label: 'Tổng thực dùng',
    source: 'Tổng nhựa + màng + lõi + túi thực dùng'
  },
  tongVatLieu: { label: 'Tổng nhựa sử dụng', source: 'KL nhựa xuất + Tồn đầu ca nhựa − Tồn cuối ca nhựa' },
  chenhLech: {
    label: 'Chênh lệch nhựa',
    source: 'KL nhựa xuất + Tồn đầu ca nhựa − Tồn cuối ca nhựa − KL nhựa TP − HH nhựa'
  },
  khoiLuongLoiXuatKho: { label: 'Trọng lượng lõi xuất kho (kg)', source: 'Phiếu xuất kho NVL (lõi)' },
  khoiLuongTuiXuatKho: { label: 'Trọng lượng túi xuất kho (kg)', source: 'Phiếu xuất kho NVL (túi/bao bì)' },
  tongTrongLuongXuatKho: { label: 'Tổng trọng lượng xuất kho', source: 'Nhựa + màng + lõi + túi xuất kho' },
  tonDauCaNhua: { label: 'Số lượng nhựa tồn đầu ca (kg)', source: 'Bảng kiểm kê NVL tồn đầu ca' },
  tonDauCaMang: { label: 'Số lượng màng tồn đầu ca (kg)', source: 'Bảng kiểm kê NVL tồn đầu ca (m² → kg)' },
  tonDauCaLoi: { label: 'Trọng lượng lõi tồn đầu ca (kg)', source: 'Bảng kiểm kê NVL tồn đầu ca (lõi)' },
  tonDauCaTui: { label: 'Trọng lượng túi tồn đầu ca (kg)', source: 'Bảng kiểm kê NVL tồn đầu ca (túi/bao bì)' },
  tongTrongLuongTonDauCa: { label: 'Tổng trọng lượng tồn đầu ca', source: 'Tổng nhựa + màng + lõi + túi tồn đầu ca' },
  tonCuoiCaNhua: { label: 'Số lượng nhựa tồn cuối ca (kg)', source: 'Bảng kiểm kê NVL tồn cuối ca' },
  tonCuoiCaMang: { label: 'Số lượng màng tồn cuối ca (kg)', source: 'Bảng kiểm kê NVL tồn cuối ca (m² → kg)' },
  tonCuoiCaLoi: {
    label: 'Trọng lượng lõi tồn cuối ca (kg)',
    source: 'Báo cáo kiểm tồn NVL cuối ca — các mã/tên có “lõi”'
  },
  tonCuoiCaTui: {
    label: 'Trọng lượng túi tồn cuối ca (kg)',
    source: 'Báo cáo tồn cuối ca — Loại vật tư = Bao bì'
  },
  tongTrongLuongTonCuoiCa: { label: 'Tổng trọng lượng tồn cuối ca', source: 'Tổng nhựa + màng + lõi + túi tồn cuối ca' },
  slDatThucTeNhapKho: {
    label: 'Số lượng đạt thực tế',
    source: 'Phiếu báo cáo sản lượng (SL cuộn)'
  },
  tlNhuaTpNhapKho: {
    label: 'TL nhựa thành phẩm (kg)',
    source:
      'Nhựa xuất dùng + tồn đầu ca nhựa − tồn cuối ca nhựa − dính màng − cục đầu nòng − không màng lỗi hỏng'
  },
  tlMangTpNhapKho: {
    label: 'TL màng thành phẩm (kg)',
    source: 'Màng xuất dùng + tồn đầu ca màng − tồn cuối ca màng − màng lỗi hỏng'
  },
  tlTuiBaoBiNhapKho: {
    label: 'TL túi bao bì nhập kho (kg)',
    source: '0,2 × Số lượng đạt thực tế'
  },
  tlLoiTpNhapKho: {
    label: 'TL lõi thành phẩm (kg)',
    source: '1 × Số lượng đạt thực tế'
  },
  tongTpNhapKho: { label: 'Tổng TP nhập kho', source: 'Nhựa + màng + túi + lõi TP nhập kho' },
  tlNhuaKhongMangLoiHong: { label: 'TL Nhựa không mảng lỗi hỏng (Kg)', source: 'Báo cáo lỗi hỏng' },
  tlNhuaCucDauNongLoiHong: { label: 'TL Nhựa cục đầu nòng lỗi hỏng (Kg)', source: 'Báo cáo lỗi hỏng' },
  tlNhuaDinhMangLoiHong: { label: 'TL Nhựa lỗi dính màng lỗi hỏng (Kg)', source: 'Báo cáo lỗi hỏng' },
  tlMangLoiHong: { label: 'TL Màng lỗi hỏng (kg)', source: 'Báo cáo lỗi hỏng' },
  soCuonLoiDinhHangHong: { label: 'Số cuộn lõi dính trong hàng hỏng (Kg)', source: 'Báo cáo lỗi hỏng' },
  tongTrongLuongLoiHong: { label: 'Tổng trọng lượng lỗi hỏng', source: 'Báo cáo lỗi hỏng' }
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
  summaryRow?: ControlBoardShiftSummaryRow | null;
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
            : (line.soLuongTrongMay ?? 0) +
              (line.soLuongTrongBonTron ?? 0) +
              (line.soLuongNlChuaTron ?? 0) +
              (line.soLuongTonNgoai ?? 0)) || 0;
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
          tonNgoai: formatDetailNumber(line.soLuongTonNgoai, 3),
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
        { key: 'tonNgoai', label: 'Tồn ngoài', align: 'right', mono: true },
        { key: 'tongTon', label: 'Tổng tồn (kg)', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: 'Tổng tồn đầu ca nhựa (kg)',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 3),
      showActions: true
    };
  }

  if (
    metric === 'tonCuoiCaNhua' ||
    metric === 'tonCuoiCaMang' ||
    metric === 'tonCuoiCaLoi' ||
    metric === 'tonCuoiCaTui'
  ) {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;
    const wanted =
      metric === 'tonCuoiCaNhua'
        ? 'nhua'
        : metric === 'tonCuoiCaMang'
          ? 'mang'
          : metric === 'tonCuoiCaLoi'
            ? 'loi'
            : 'bao_bi';

    for (const report of input.machineNvlReports ?? []) {
      if (report.reportKind !== 'cuoi_ca') continue;
      if (!matchesShiftSummaryBucket(ngay, ca, report.ngay, report.ca, shiftOptions)) continue;

      const machineLabel = report.tenMay || report.maMay || '-';

      for (const line of report.lines) {
        if (resolveMachineNvlLineMaterialType(line) !== wanted) continue;
        const lineTotal = computeMachineNvlLineKg(line, 'cuoi_ca', resolveLineKgFactor);
        if (lineTotal <= 0 && !line.maNvl && !line.tenNvl) continue;

        total += lineTotal;
        rows.push({
          rowKey: `${report.id}|${line.stt}|${line.maNvl}`,
          recordId: report.id || '',
          may: machineLabel,
          maNvl: line.maNvl || '-',
          tenNvl: line.tenNvl || '-',
          loaiVatTu: line.loaiVatTu || wanted,
          donVi: line.donVi || '-',
          soLuongTon: formatDetailNumber(
            line.soLuongTon > 0
              ? line.soLuongTon
              : (line.soLuongTrongMay ?? 0) +
                (line.soLuongTrongBonTron ?? 0) +
                (line.soLuongNlChuaTron ?? 0) +
                (line.soLuongTonNgoai ?? 0),
            3
          ),
          tongTon: formatDetailNumber(lineTotal, 3)
        });
      }
    }

    const totalLabels: Partial<Record<ShiftSummaryMetric, string>> = {
      tonCuoiCaNhua: 'Tổng nhựa tồn cuối ca (kg)',
      tonCuoiCaMang: 'Tổng màng tồn cuối ca (kg)',
      tonCuoiCaLoi: 'Tổng lõi tồn cuối ca (kg)',
      tonCuoiCaTui: 'Tổng túi tồn cuối ca (kg)'
    };

    return {
      columns: [
        { key: 'may', label: 'Máy' },
        { key: 'maNvl', label: 'Mã NVL' },
        { key: 'tenNvl', label: 'Tên NVL' },
        { key: 'loaiVatTu', label: 'Loại' },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'soLuongTon', label: 'SL tồn', align: 'right', mono: true },
        { key: 'tongTon', label: 'Tổng (kg)', align: 'right', mono: true, accent: true }
      ],
      rows,
      totalLabel: totalLabels[metric] ?? 'Tổng tồn cuối ca (kg)',
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
            : (line.soLuongTrongMay ?? 0) +
              (line.soLuongTrongBonTron ?? 0) +
              (line.soLuongNlChuaTron ?? 0) +
              (line.soLuongTonNgoai ?? 0)) || 0;
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
          tonNgoai: formatDetailNumber(line.soLuongTonNgoai, 3),
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
        { key: 'tonNgoai', label: 'Tồn ngoài', align: 'right', mono: true },
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

  if (metric === 'tongNhuaThucDung' || metric === 'tongMangThucDung') {
    const row = input.summaryRow;
    const parts =
      metric === 'tongNhuaThucDung'
        ? {
            label: 'Tổng Nhựa thực dùng',
            xuatLabel: 'Số lượng nhựa thực tế xuất dùng (kg)',
            dauLabel: 'Số lượng nhựa tồn đầu ca (kg)',
            cuoiLabel: 'Số lượng nhựa tồn cuối ca (kg)',
            xuat: row?.khoiLuongNpl ?? 0,
            dau: row?.tonDauCaNhua ?? 0,
            cuoi: row?.tonCuoiCaNhua ?? 0,
            value: row?.tongNhuaThucDung ?? 0
          }
        : {
            label: 'Tổng màng thực dùng',
            xuatLabel: 'Màng xuất dùng',
            dauLabel: 'Màng tồn đầu ca',
            cuoiLabel: 'Màng tồn cuối ca',
            xuat: row?.khoiLuongMangXuat ?? 0,
            dau: row?.tonDauCaMang ?? 0,
            cuoi: row?.tonCuoiCaMang ?? 0,
            value: row?.tongMangThucDung ?? 0
          };

    const computed = computeMaterialUsageKg(parts.xuat, parts.dau, parts.cuoi);
    const isNhua = metric === 'tongNhuaThucDung';

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'congThuc', label: 'Công thức' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: isNhua
        ? [
            { thanhPhan: parts.dauLabel, congThuc: '', giaTri: formatDetailNumber(parts.dau, 3) },
            { thanhPhan: parts.xuatLabel, congThuc: '+', giaTri: formatDetailNumber(parts.xuat, 3) },
            { thanhPhan: parts.cuoiLabel, congThuc: '−', giaTri: formatDetailNumber(parts.cuoi, 3) },
            { thanhPhan: parts.label, congThuc: '=', giaTri: formatDetailNumber(computed, 3) }
          ]
        : [
            { thanhPhan: parts.xuatLabel, congThuc: '+', giaTri: formatDetailNumber(parts.xuat, 3) },
            { thanhPhan: parts.dauLabel, congThuc: '+', giaTri: formatDetailNumber(parts.dau, 3) },
            { thanhPhan: parts.cuoiLabel, congThuc: '−', giaTri: formatDetailNumber(parts.cuoi, 3) },
            { thanhPhan: parts.label, congThuc: '=', giaTri: formatDetailNumber(computed, 3) }
          ],
      totalLabel: isNhua
        ? 'Tổng Nhựa thực dùng = tồn đầu ca + xuất dùng − tồn cuối ca'
        : `${parts.label} = xuất + tồn đầu ca − tồn cuối ca`,
      totalValue: formatShiftSummaryNumber(parts.value || computed, 3)
    };
  }

  if (metric === 'tuiThucDung') {
    const row = input.summaryRow;
    const slDatThucTeNhapKho = row?.slDatThucTeNhapKho ?? 0;
    const tong =
      row?.tuiThucDung ??
      row?.tlTuiBaoBiNhapKho ??
      computeTlTuiBaoBiNhapKhoFromShiftSummary(slDatThucTeNhapKho);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Số lượng đạt thực tế',
          dau: '×',
          giaTri: formatDetailNumber(slDatThucTeNhapKho, 0)
        },
        {
          thanhPhan: `Hệ số túi bao bì (${TL_TUI_BAO_BI_KG_PER_UNIT} kg)`,
          dau: '',
          giaTri: formatDetailNumber(TL_TUI_BAO_BI_KG_PER_UNIT, 1)
        },
        {
          thanhPhan: 'TL túi bao bì nhập kho (kg)',
          dau: '=',
          giaTri: formatDetailNumber(tong, 3)
        },
        {
          thanhPhan: 'Túi thực dùng',
          dau: '=',
          giaTri: formatDetailNumber(tong, 3)
        }
      ],
      totalLabel: 'Túi thực dùng = TL túi bao bì nhập kho (kg)',
      totalValue: formatShiftSummaryNumber(tong, 3)
    };
  }

  if (metric === 'loiThucDung') {
    const row = input.summaryRow;
    const slDatThucTeNhapKho = row?.slDatThucTeNhapKho ?? 0;
    const tong = row?.loiThucDung ?? computeTlLoiTpNhapKhoFromShiftSummary(slDatThucTeNhapKho);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Số lượng đạt thực tế',
          dau: '×',
          giaTri: formatDetailNumber(slDatThucTeNhapKho, 0)
        },
        {
          thanhPhan: `Hệ số lõi (${TL_LOI_TP_KG_PER_UNIT} kg)`,
          dau: '',
          giaTri: formatDetailNumber(TL_LOI_TP_KG_PER_UNIT, 0)
        },
        {
          thanhPhan: 'Lõi thực dùng',
          dau: '=',
          giaTri: formatDetailNumber(tong, 3)
        }
      ],
      totalLabel: 'Lõi thực dùng = Số lượng đạt thực tế × 1',
      totalValue: formatShiftSummaryNumber(tong, 3)
    };
  }

  if (metric === 'tongThucDung') {
    const row = input.summaryRow;
    const tongNhuaThucDung = row?.tongNhuaThucDung ?? 0;
    const tongMangThucDung = row?.tongMangThucDung ?? 0;
    const loiThucDung = row?.loiThucDung ?? 0;
    const tuiThucDung = row?.tuiThucDung ?? 0;
    const tong =
      row?.tongThucDung ?? roundNormWeight(tongNhuaThucDung + tongMangThucDung + loiThucDung + tuiThucDung);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'giaTri', label: 'Giá trị (kg)', align: 'right', mono: true, accent: true }
      ],
      rows: [
        { thanhPhan: 'Tổng nhựa thực dùng', giaTri: formatDetailNumber(tongNhuaThucDung, 3) },
        { thanhPhan: 'Tổng màng thực dùng', giaTri: formatDetailNumber(tongMangThucDung, 3) },
        { thanhPhan: 'Lõi thực dùng', giaTri: formatDetailNumber(loiThucDung, 3) },
        { thanhPhan: 'Túi thực dùng', giaTri: formatDetailNumber(tuiThucDung, 3) }
      ],
      totalLabel: 'Tổng thực dùng',
      totalValue: formatShiftSummaryNumber(tong, 3)
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
    const tongNhuaThucDung = row?.tongNhuaThucDung ?? roundNormWeight(khoiLuongNpl + tonDauCa - tonCuoiCa);
    const chenhLech =
      row?.chenhLech ?? roundNormWeight(tongNhuaThucDung - khoiLuongNhuaTp - hangHongNhua);

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

  if (metric === 'slDatThucTeNhapKho') {
    const rows: ShiftSummaryDetailRow[] = [];
    let total = 0;

    for (const report of input.acceptanceReports ?? []) {
      if (!matchesShiftSummaryBucket(ngay, ca, report.ngay, report.ca, shiftOptions)) continue;
      if (report.so_luong === null || !Number.isFinite(report.so_luong) || report.so_luong <= 0) continue;

      total += report.so_luong;
      rows.push({
        rowKey: report.id || `${report.ngay}|${report.ca}|${report.mat_hang}`,
        recordId: report.id || '',
        may: report.ten_may || report.ma_may || '-',
        matHang: report.mat_hang || '-',
        soLuong: formatDetailNumber(report.so_luong, 0),
        donVi: report.don_vi || 'cuộn',
        gio: report.gio || '-'
      });
    }

    return {
      columns: [
        { key: 'may', label: 'Máy' },
        { key: 'matHang', label: 'Mặt hàng' },
        { key: 'soLuong', label: 'SL (cuộn)', align: 'right', mono: true, accent: true },
        { key: 'donVi', label: 'ĐVT' },
        { key: 'gio', label: 'Giờ' }
      ],
      rows,
      totalLabel: 'Tổng SL đạt thực tế (báo cáo sản lượng)',
      totalValue: formatShiftSummaryNumber(roundNormWeight(total), 0),
      showActions: false
    };
  }

  if (metric === 'tlLoiTpNhapKho') {
    const row = input.summaryRow;
    const slDatThucTeNhapKho = row?.slDatThucTeNhapKho ?? 0;
    const tong = row?.tlLoiTpNhapKho ?? computeTlLoiTpNhapKhoFromShiftSummary(slDatThucTeNhapKho);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Số lượng đạt thực tế',
          dau: '×',
          giaTri: formatDetailNumber(slDatThucTeNhapKho, 0)
        },
        {
          thanhPhan: `Hệ số lõi TP (${TL_LOI_TP_KG_PER_UNIT} kg)`,
          dau: '',
          giaTri: formatDetailNumber(TL_LOI_TP_KG_PER_UNIT, 0)
        },
        {
          thanhPhan: 'TL lõi thành phẩm (kg)',
          dau: '=',
          giaTri: formatDetailNumber(tong, 3)
        }
      ],
      totalLabel: 'TL lõi thành phẩm = 1 × SL đạt thực tế',
      totalValue: formatShiftSummaryNumber(tong, 3)
    };
  }

  if (metric === 'tlTuiBaoBiNhapKho') {
    const row = input.summaryRow;
    const slDatThucTeNhapKho = row?.slDatThucTeNhapKho ?? 0;
    const tong =
      row?.tlTuiBaoBiNhapKho ?? computeTlTuiBaoBiNhapKhoFromShiftSummary(slDatThucTeNhapKho);

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Số lượng đạt thực tế',
          dau: '×',
          giaTri: formatDetailNumber(slDatThucTeNhapKho, 0)
        },
        {
          thanhPhan: `Hệ số túi bao bì (${TL_TUI_BAO_BI_KG_PER_UNIT} kg)`,
          dau: '',
          giaTri: formatDetailNumber(TL_TUI_BAO_BI_KG_PER_UNIT, 1)
        },
        {
          thanhPhan: 'TL túi bao bì nhập kho (kg)',
          dau: '=',
          giaTri: formatDetailNumber(tong, 3)
        }
      ],
      totalLabel: 'TL túi bao bì nhập kho = 0,2 × SL đạt thực tế',
      totalValue: formatShiftSummaryNumber(tong, 3)
    };
  }

  if (metric === 'tlMangTpNhapKho') {
    const row = input.summaryRow;
    const khoiLuongMangXuat = row?.khoiLuongMangXuat ?? 0;
    const tonDauCaMang = row?.tonDauCaMang ?? 0;
    const tonCuoiCaMang = row?.tonCuoiCaMang ?? 0;
    const tlMangLoiHong = row?.tlMangLoiHong ?? 0;
    const tong =
      row?.tlMangTpNhapKho ??
      computeTlMangTpNhapKhoFromShiftSummary({
        khoiLuongMangXuat,
        tonDauCaMang,
        tonCuoiCaMang,
        tlMangLoiHong
      });

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị (kg)', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Số lượng màng thực tế xuất dùng',
          dau: '+',
          giaTri: formatDetailNumber(khoiLuongMangXuat, 3)
        },
        {
          thanhPhan: 'Số lượng màng tồn đầu ca',
          dau: '+',
          giaTri: formatDetailNumber(tonDauCaMang, 3)
        },
        {
          thanhPhan: 'Số lượng màng tồn cuối ca',
          dau: '−',
          giaTri: formatDetailNumber(tonCuoiCaMang, 3)
        },
        {
          thanhPhan: 'TL Màng lỗi hỏng',
          dau: '−',
          giaTri: formatDetailNumber(tlMangLoiHong, 3)
        },
        { thanhPhan: 'TL màng thành phẩm', dau: '=', giaTri: formatDetailNumber(tong, 3) }
      ],
      totalLabel: 'TL màng thành phẩm (kg)',
      totalValue: formatShiftSummaryNumber(tong, 3)
    };
  }

  if (metric === 'tlNhuaTpNhapKho') {
    const row = input.summaryRow;
    const khoiLuongNpl = row?.khoiLuongNpl ?? 0;
    const tonDauCaNhua = row?.tonDauCaNhua ?? 0;
    const tonCuoiCaNhua = row?.tonCuoiCaNhua ?? 0;
    const tlNhuaKhongMangLoiHong = row?.tlNhuaKhongMangLoiHong ?? 0;
    const tlNhuaCucDauNongLoiHong = row?.tlNhuaCucDauNongLoiHong ?? 0;
    const tlNhuaDinhMangLoiHong = row?.tlNhuaDinhMangLoiHong ?? 0;
    const tong =
      row?.tlNhuaTpNhapKho ??
      computeTlNhuaTpNhapKhoFromShiftSummary({
        khoiLuongNpl,
        tonDauCaNhua,
        tonCuoiCaNhua,
        tlNhuaKhongMangLoiHong,
        tlNhuaCucDauNongLoiHong,
        tlNhuaDinhMangLoiHong
      });

    return {
      columns: [
        { key: 'thanhPhan', label: 'Thành phần' },
        { key: 'dau', label: '' },
        { key: 'giaTri', label: 'Giá trị (kg)', align: 'right', mono: true, accent: true }
      ],
      rows: [
        {
          thanhPhan: 'Số lượng nhựa thực tế xuất dùng',
          dau: '+',
          giaTri: formatDetailNumber(khoiLuongNpl, 3)
        },
        {
          thanhPhan: 'Số lượng nhựa tồn đầu ca',
          dau: '+',
          giaTri: formatDetailNumber(tonDauCaNhua, 3)
        },
        {
          thanhPhan: 'Số lượng nhựa tồn cuối ca',
          dau: '−',
          giaTri: formatDetailNumber(tonCuoiCaNhua, 3)
        },
        {
          thanhPhan: 'TL Nhựa lỗi dính màng lỗi hỏng',
          dau: '−',
          giaTri: formatDetailNumber(tlNhuaDinhMangLoiHong, 3)
        },
        {
          thanhPhan: 'TL Nhựa cục đầu nòng lỗi hỏng',
          dau: '−',
          giaTri: formatDetailNumber(tlNhuaCucDauNongLoiHong, 3)
        },
        {
          thanhPhan: 'TL Nhựa không màng lỗi hỏng',
          dau: '−',
          giaTri: formatDetailNumber(tlNhuaKhongMangLoiHong, 3)
        },
        { thanhPhan: 'TL nhựa thành phẩm', dau: '=', giaTri: formatDetailNumber(tong, 3) }
      ],
      totalLabel: 'TL nhựa thành phẩm (kg)',
      totalValue: formatShiftSummaryNumber(tong, 3)
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
  if (
    metric === 'tongVatLieu' ||
    metric === 'tongThucDung' ||
    metric === 'tongNhuaThucDung' ||
    metric === 'tongMangThucDung' ||
    metric === 'loiThucDung' ||
    metric === 'tuiThucDung' ||
    metric === 'chenhLech' ||
    metric === 'khoiLuongNhuaTp' ||
    metric === 'tongTrongLuongXuatKho' ||
    metric === 'tongTrongLuongTonDauCa' ||
    metric === 'tongTrongLuongTonCuoiCa' ||
    metric === 'tlNhuaTpNhapKho' ||
    metric === 'tlMangTpNhapKho' ||
    metric === 'tlTuiBaoBiNhapKho' ||
    metric === 'tlLoiTpNhapKho' ||
    metric === 'tongTpNhapKho' ||
    metric === 'tongTrongLuongLoiHong'
  ) {
    return value !== 0;
  }
  return value > 0;
}
