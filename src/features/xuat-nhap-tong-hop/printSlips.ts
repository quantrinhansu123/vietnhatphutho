import type { WarehouseSlipPrintData } from '../../components/WarehouseSlipPrintModal';
import { parseLocalizedNumber } from '../../utils';
import { roundKem, sumKemStored } from './chiPhiKemTheo';
import { formatTongHopDate, isNvlWarehouseName, parseNvlPrice, type TongHopHeader } from './model';

function uniqueJoined(values: Array<string | null | undefined>) {
  return [...new Set(values.map(item => String(item || '').trim()).filter(Boolean))].join(', ');
}

function lineAmountOf(line: Record<string, unknown>) {
  const stored = parseNvlPrice(line.thanh_tien ?? '');
  if (Number.isFinite(stored) && stored !== 0) return stored;
  const qty = parseLocalizedNumber(line.so_luong ?? '') || 0;
  const price = parseNvlPrice(line.don_gia ?? '') || 0;
  return Math.round(qty * price * 1000) / 1000;
}

function mapPrintLines(detail: Array<Record<string, unknown>>): WarehouseSlipPrintData['lines'] {
  return detail.map(line => ({
    code: String(line.ma_hang || ''),
    name: String(line.loai_danh_muc === 'san_pham' ? line.ten_hang || '' : line.ten_nvl_sx || ''),
    unit: String(line.don_vi || ''),
    quantity: parseLocalizedNumber(line.so_luong ?? '') || 0,
    unitPrice: parseNvlPrice(line.don_gia ?? '') || 0,
    lineAmount: lineAmountOf(line),
    weightKg: parseLocalizedNumber(line.quy_doi_kg ?? '') || null,
    chiPhiKemTheo: (Array.isArray(line.chi_phi_kem_theo) ? line.chi_phi_kem_theo : []).map(item => {
      const rowItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        ten: String(rowItem.ten || ''),
        donGia: parseNvlPrice(rowItem.don_gia ?? '') || 0,
        thanhTien: parseNvlPrice(rowItem.thanh_tien ?? '') || 0
      };
    })
  }));
}

/**
 * In phiếu tổng hợp: luôn đúng 1 phiếu theo loại (nhập hoặc xuất),
 * không tách xuất+nhập và không chia theo kho/máy.
 */
export function slipsFromTongHopRecord(row: TongHopHeader): WarehouseSlipPrintData[] {
  const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
  if (!detail.length) return [];

  const lines = mapPrintLines(detail);
  const totalAmount = lines.reduce((sum, line) => sum + (line.lineAmount || 0), 0);
  const totalKem = roundKem(detail.reduce((sum, line) => sum + sumKemStored(line.chi_phi_kem_theo), 0));
  const totalKg = roundKem(detail.reduce((sum, line) => sum + (parseLocalizedNumber(line.quy_doi_kg ?? '') || 0), 0));

  const isNhap = row.loai === 'nhap';
  const warehouseNames = isNhap
    ? uniqueJoined(detail.map(line => String(line.kho_dong_ten || line.kho_dong_id || row.kho_dich || '')))
    : uniqueJoined(
      detail.map(line =>
        String(
          line.src_ten ||
            line.nguon_dong_ten ||
            line.src_id ||
            line.nguon_dong_id ||
            row.nguon_id ||
            ''
        )
      )
    );

  const machines = uniqueJoined(
    detail.map(line => {
      if (String(line.dich_dong_loai || '') === 'may') return String(line.dich_dong_id || '');
      if (String(line.src_loai || '') === 'may') return String(line.src_id || '');
      return '';
    }).concat(row.dich_loai === 'may' ? [row.dich_id || ''] : [])
  );

  const warehouseKind: WarehouseSlipPrintData['warehouseKind'] =
    isNvlWarehouseName(warehouseNames) ||
    row.dich_loai === 'may' ||
    detail.some(line => String(line.src_loai || line.dich_dong_loai || '') === 'may')
      ? 'nvl'
      : 'san_pham';

  return [
    {
      slipCode: row.ma_phieu_chung || '',
      slipType: row.loai,
      slipCategory: isNhap ? row.loai_nhap || '' : row.loai_xuat || '',
      warehouseKind,
      slipDate: formatTongHopDate(String(row.ngay || '').slice(0, 10)),
      reason: row.ly_do || (isNhap ? row.loai_nhap || '' : row.loai_xuat || ''),
      note: row.ghi_chu || '',
      createdBy: row.nguoi_lap || '',
      deliverer: row.nguoi_giao || '',
      warehouseLocation: row.dia_diem || '',
      totalAmount,
      totalKem,
      totalCong: roundKem(totalAmount + totalKem),
      totalKg,
      shift: row.ca || '',
      machine: machines,
      warehouseName: warehouseNames || row.kho_dich || '',
      useWarehouseNameInTitle: true,
      isTemporary: false,
      lines
    }
  ];
}
