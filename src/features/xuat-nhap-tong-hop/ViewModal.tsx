import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileText, Warehouse, Truck, MapPin, User, Calendar, Clock, Tag, DollarSign, Scale, Hash, AlertTriangle } from 'lucide-react';
import { takePendingTongHopView, type TongHopHeader } from './model';
import { formatTongHopDate, isNvlWarehouseName } from './model';
import { roundKem, sumKemStored } from './chiPhiKemTheo';
import { formatMoney as formatMoneyUs, formatNumber as formatNumberUs, parseLocalizedNumber } from '../../utils';

function statusLabel(status: string) {
  if (status === 'huy') return 'Đã hủy';
  if (status === 'hoan_thanh') return 'Đã ghi sổ';
  return status || '—';
}
import WarehouseSlipPrintModal, { type WarehouseSlipPrintData } from '../../components/WarehouseSlipPrintModal';

/** Hiển thị số theo chuẩn chung: nghìn `,`, thập phân `.` (VD: 1,250,000 / 100.5). */
function formatMoney(value: number | string) {
  const n = typeof value === 'string' ? parseLocalizedNumber(value) : value;
  if (!Number.isFinite(n)) return '—';
  return formatMoneyUs(n, 0);
}

function formatNumber(value: number | string, decimals = 3) {
  const n = typeof value === 'string' ? parseLocalizedNumber(value) : value;
  if (!Number.isFinite(n)) return '—';
  return formatNumberUs(n, decimals);
}

function slipsFromRecord(row: TongHopHeader): WarehouseSlipPrintData[] {
  const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const line of detail) {
    const key = String(line.kho_dong_ten || line.nguon_dong_ten || line.nguon_dong_id || row.kho_dich || 'Phiếu');
    groups.set(key, [...(groups.get(key) || []), line]);
  }
  return [...groups.entries()].map(([name, groupLines], index) => {
    const totalAmount = groupLines.reduce((sum, line) => sum + (parseLocalizedNumber(line.thanh_tien ?? '') || 0), 0);
    const totalKem = roundKem(groupLines.reduce((sum, line) => sum + sumKemStored(line.chi_phi_kem_theo), 0));
    const totalKg = roundKem(groupLines.reduce((sum, line) => sum + (parseLocalizedNumber(line.quy_doi_kg ?? '') || 0), 0));
    return {
      slipCode: `${row.ma_phieu_chung}-${index + 1}`,
      slipType: row.loai,
      warehouseKind: isNvlWarehouseName(name) || row.dich_loai === 'may' ? 'nvl' : 'san_pham',
      slipDate: formatTongHopDate(String(row.ngay || '').slice(0, 10)),
      reason: row.ly_do || (row.loai === 'nhap' ? row.loai_nhap || '' : row.loai_xuat || ''),
      note: row.ghi_chu || '',
      createdBy: row.nguoi_lap || '',
      deliverer: row.nguoi_giao || '',
      warehouseLocation: row.dia_diem || '',
      totalAmount,
      totalKem,
      totalCong: roundKem(totalAmount + totalKem),
      totalKg,
      shift: row.ca || '',
      machine: row.dich_loai === 'may' ? row.dich_id || '' : '',
      warehouseName: name,
      useWarehouseNameInTitle: true,
      isTemporary: false,
      lines: groupLines.map(line => ({
        code: String(line.ma_hang || ''),
        name: String(line.ten_hang || ''),
        unit: String(line.don_vi || ''),
        quantity: parseLocalizedNumber(line.so_luong ?? '') || 0,
        unitPrice: parseLocalizedNumber(line.don_gia ?? '') || 0,
        lineAmount: parseLocalizedNumber(line.thanh_tien ?? '') || 0,
        weightKg: parseLocalizedNumber(line.quy_doi_kg ?? '') || null,
        chiPhiKemTheo: (Array.isArray(line.chi_phi_kem_theo) ? line.chi_phi_kem_theo : []).map(item => {
          const rowItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
          return {
            ten: String(rowItem.ten || ''),
            donGia: parseLocalizedNumber(rowItem.don_gia ?? '') || 0,
            thanhTien: parseLocalizedNumber(rowItem.thanh_tien ?? '') || 0
          };
        })
      }))
    };
  });
}

export function TongHopViewModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [viewRecord, setViewRecord] = useState<TongHopHeader | null>(null);
  const [printSlips, setPrintSlips] = useState<WarehouseSlipPrintData[] | null>(null);

  useEffect(() => {
    if (open) {
      const row = takePendingTongHopView();
      if (row) setViewRecord(row);
    } else {
      setViewRecord(null);
      setPrintSlips(null);
    }
  }, [open]);

  if (!open || !viewRecord) return null;

  const detail = Array.isArray(viewRecord.chi_tiet) ? viewRecord.chi_tiet : [];
  const isNhap = viewRecord.loai === 'nhap';

  const totalAmount = detail.reduce((sum, line) => sum + (parseLocalizedNumber(line.thanh_tien ?? '') || 0), 0);
  const totalKem = roundKem(detail.reduce((sum, line) => sum + sumKemStored(line.chi_phi_kem_theo), 0));
  const totalKg = roundKem(detail.reduce((sum, line) => sum + (parseLocalizedNumber(line.quy_doi_kg ?? '') || 0), 0));
  /** Chi phí kèm phân bổ trên 1 kg = tổng chi phí kèm / tổng trọng lượng. */
  const kemPerKg = totalKg > 0 ? totalKem / totalKg : 0;
  /** Giá nhập kho của dòng = giá mua + chi phí kèm/1kg. */
  const importPriceOf = (line: Record<string, unknown>) => {
    const price = parseLocalizedNumber(line.don_gia ?? '');
    return Number.isFinite(price) ? price + kemPerKg : null;
  };
  const importAmountOf = (line: Record<string, unknown>) => {
    const qty = parseLocalizedNumber(line.so_luong ?? '');
    const unit = importPriceOf(line);
    if (!Number.isFinite(qty) || unit === null) return null;
    return Math.round(qty * unit * 1000) / 1000;
  };
  const totalNhapKho = roundKem(detail.reduce((sum, line) => sum + (importAmountOf(line) || 0), 0));

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative w-full max-w-7xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 bg-zinc-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isNhap ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
              {isNhap ? <FileText className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-950">
                {isNhap ? 'Xem phiếu nhập' : 'Xem phiếu xuất'} — {viewRecord.ma_phieu_chung}
              </h2>
              <p className="text-xs text-zinc-500">Trạng thái: {statusLabel(viewRecord.trang_thai || '')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintSlips(slipsFromRecord(viewRecord))}
              className="h-8 px-3 rounded-lg border border-zinc-200 bg-white flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <Printer className="h-3.5 w-3.5" />
              In phiếu
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Ngày phiếu</p>
              <p className="text-sm font-semibold text-zinc-950 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                {formatTongHopDate(String(viewRecord.ngay || '').slice(0, 10))}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Loại</p>
              <p className="text-sm font-semibold text-zinc-950 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-zinc-400" />
                {isNhap ? (viewRecord.loai_nhap || '—') : (viewRecord.loai_xuat || '—')}
              </p>
            </div>
            {viewRecord.ca && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Ca</p>
                <p className="text-sm font-semibold text-zinc-950 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  {viewRecord.ca}
                </p>
              </div>
            )}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Số dòng</p>
              <p className="text-sm font-semibold text-zinc-950 flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-zinc-400" />
                {detail.filter(l => l.ma_hang).length}
              </p>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Người lập</p>
              <p className="text-sm text-zinc-950 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-zinc-400" />
                {viewRecord.nguoi_lap || '—'}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Người giao</p>
              <p className="text-sm text-zinc-950 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-zinc-400" />
                {viewRecord.nguoi_giao || '—'}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Địa điểm</p>
              <p className="text-sm text-zinc-950 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                {viewRecord.dia_diem || '—'}
              </p>
            </div>
            {viewRecord.nguon_id && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Nguồn</p>
                <p className="text-sm text-zinc-950 flex items-center gap-1">
                  <Warehouse className="h-3.5 w-3.5 text-zinc-400" />
                  {viewRecord.nguon_id}
                </p>
              </div>
            )}
            {viewRecord.kho_dich && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Đích</p>
                <p className="text-sm text-zinc-950 flex items-center gap-1">
                  <Warehouse className="h-3.5 w-3.5 text-zinc-400" />
                  {viewRecord.kho_dich}
                </p>
              </div>
            )}
            {viewRecord.dich_id && viewRecord.dich_id !== viewRecord.kho_dich && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Máy/Kho đích</p>
                <p className="text-sm text-zinc-950 flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-zinc-400" />
                  {viewRecord.dich_id}
                </p>
              </div>
            )}
          </section>

          {(viewRecord.ly_do || viewRecord.ghi_chu) && (
            <section className="space-y-2">
              {viewRecord.ly_do && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Lý do</p>
                  <p className="text-sm text-zinc-950">{viewRecord.ly_do}</p>
                </div>
              )}
              {viewRecord.ghi_chu && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Ghi chú</p>
                  <p className="text-sm text-zinc-950">{viewRecord.ghi_chu}</p>
                </div>
              )}
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">Chi tiết phiếu</h3>
              <div className="flex items-center gap-3 text-xs font-semibold text-zinc-600">
                <span className="flex items-center gap-1"><Scale className="h-3.5 w-3.5" /> TL: {formatNumber(totalKg)} kg</span>
                <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Hàng: {formatMoney(totalAmount)}</span>
                <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Kèm: {formatMoney(totalKem)}</span>
                <span className="flex items-center gap-1 text-zinc-900"><DollarSign className="h-3.5 w-3.5" /> Cộng: {formatMoney(roundKem(totalAmount + totalKem))}</span>
                <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Chi phí đi kèm/1 kg: {formatMoney(kemPerKg)}</span>
                <span className="flex items-center gap-1 text-sky-800"><DollarSign className="h-3.5 w-3.5" /> Nhập kho: {formatMoney(totalNhapKho)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-3 py-2 text-left">STT</th>
                    <th className="px-3 py-2 text-left">Mã NVL</th>
                    <th className="px-3 py-2 text-left">Tên nguyên vật liệu</th>
                    <th className="px-3 py-2 text-left">Tên SX</th>
                    <th className="px-3 py-2 text-center">ĐVT</th>
                    <th className="px-3 py-2 text-center">Nhóm VTHH</th>
                    <th className="px-3 py-2 text-center">Ngày tồn</th>
                    <th className="px-3 py-2 text-center">Ca</th>
                    <th className="px-3 py-2 text-right">Tồn đầu</th>
                    <th className="px-3 py-2 text-right">SL CT</th>
                    <th className="px-3 py-2 text-right">SL Thực</th>
                    <th className="px-3 py-2 text-right">Quy đổi KG</th>
                    <th className="px-3 py-2 text-right">Giá mua</th>
                    <th className="px-3 py-2 text-right">Thành tiền</th>
                    <th className="px-3 py-2 text-right">Giá nhập kho</th>
                    <th className="px-3 py-2 text-right">Tổng giá nhập kho</th>
                    <th className="px-3 py-2 text-center">Ảnh cân</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.filter(l => l.ma_hang).map((line, idx) => {
                    const importPrice = importPriceOf(line);
                    const importAmount = importAmountOf(line);
                    return (
                    <tr key={idx} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono font-semibold text-zinc-950">{String(line.ma_hang || '')}</td>
                      <td className="px-3 py-2 text-zinc-950">{String(line.ten_hang || '')}</td>
                      <td className="px-3 py-2 text-zinc-700">{String(line.ten_nvl_sx || '')}</td>
                      <td className="px-3 py-2 text-center text-zinc-600">{String(line.don_vi || '')}</td>
                      <td className="px-3 py-2 text-center text-zinc-600">{String(line.nhom_vthh || '')}</td>
                      <td className="px-3 py-2 text-center text-zinc-600">{line.ngay_dong ? formatTongHopDate(String(line.ngay_dong).slice(0, 10)) : '—'}</td>
                      <td className="px-3 py-2 text-center text-zinc-600">{String(line.ca_dong || '')}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono">
                        {line.ton_dau_ca !== null && line.ton_dau_ca !== undefined
                          ? formatNumber(typeof line.ton_dau_ca === 'number' ? line.ton_dau_ca : parseLocalizedNumber(String(line.ton_dau_ca)))
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono">{formatNumber(String(line.so_luong_ct || ''))}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono text-emerald-700">{formatNumber(String(line.so_luong || ''))}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono">{formatNumber(String(line.quy_doi_kg || ''))}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono">{formatMoney(String(line.don_gia || ''))}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono text-zinc-900">{formatMoney(String(line.thanh_tien || ''))}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono text-sky-800" title={`Giá mua + Chi phí đi kèm/1kg (${formatMoney(kemPerKg)})`}>{importPrice === null ? '—' : formatMoney(importPrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-mono text-sky-800">{importAmount === null ? '—' : formatMoney(importAmount)}</td>
                      <td className="px-3 py-2 text-center">
                        {line.link_anh_can_thuc_te ? (
                          <button
                            type="button"
                            onClick={() => window.open(line.link_anh_can_thuc_te as string, '_blank')}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                            title="Xem ảnh số cân"
                          >
                            <FileText className="h-4 w-4 mx-auto" />
                          </button>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {detail.some(l => l.chi_phi_kem_theo && Array.isArray(l.chi_phi_kem_theo) && l.chi_phi_kem_theo.length > 0) && (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">Chi phí đi kèm</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {detail.flatMap(line =>
                    (line.chi_phi_kem_theo as Array<Record<string, unknown>> || []).map((item, i) => {
                      const donGia = typeof item.don_gia === 'number' ? item.don_gia : parseLocalizedNumber(String(item.don_gia || ''));
                      const thanhTien = typeof item.thanh_tien === 'number' ? item.thanh_tien : parseLocalizedNumber(String(item.thanh_tien || ''));
                      return (
                        <div key={`${line.ma_hang}-${i}`} className="rounded border border-zinc-200 bg-white p-2">
                          <p className="text-[11px] font-semibold text-zinc-950">{String(item.ten || '')}</p>
                          <p className="text-xs text-zinc-600">Đơn giá: {formatMoney(donGia)}</p>
                          <p className="text-xs text-zinc-600">Thành tiền: {formatMoney(thanhTien)}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        <WarehouseSlipPrintModal open={Boolean(printSlips)} slips={printSlips} onClose={() => setPrintSlips(null)} />
      </div>
    </div>,
    document.body
  );
}