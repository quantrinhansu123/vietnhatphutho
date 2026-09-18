import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, X } from 'lucide-react';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from '../../components/layout/constants';
import { waitForPrintImagesReady } from '../../utils/printReady';
import type { BaoCaoThangPrintData } from './types';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatInt(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return Math.round(value).toLocaleString('vi-VN');
}

function formatKg(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.round(value * 1000) / 1000;
  return rounded.toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}

function formatUnitPrice(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '-';
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function formatPrintDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '-');
}

export function computeBaoCaoThangPrintDerived(data: BaoCaoThangPrintData) {
  const tlChinh = num(data.tong_tl_nvl_chinh);
  const tienChinh = num(data.tong_tien_nvl_chinh);
  const tienPhu = num(data.tong_tien_nvl_phu);
  const thuTl = num(data.thu_hoi_phe_tl);
  const thuTien = num(data.thu_hoi_phe_tien);
  const haoHut = num(data.hao_hut_kg);
  const tlThucTe = num(data.tl_chinh_thuc_te) > 0 ? num(data.tl_chinh_thuc_te) : Math.max(0, tlChinh - thuTl - haoHut);
  const tienThucTe = Math.max(0, tienChinh - thuTien);
  const donGiaChinh = tlChinh > 0 ? tienChinh / tlChinh : 0;
  const donGiaPhu = tlThucTe > 0 ? tienPhu / tlThucTe : 0;
  const donGiaChinhThucTe = tlThucTe > 0 ? tienThucTe / tlThucTe : 0;
  const donGiaChuaHaoHut = donGiaChinh + donGiaPhu;

  const numOrNull = (v: unknown) => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const donGiaTongManual = numOrNull(data.gia_vt_tt_hao_hut);
  const donGiaTong = donGiaTongManual ?? (donGiaChinhThucTe + donGiaPhu);
  const chenhLechManual = numOrNull(data.chenh_lech_hao_hut);
  const chenhLech = chenhLechManual ?? (donGiaTong - donGiaChuaHaoHut);
  const tiLeManual = numOrNull(data.ti_le_hao_hut);
  const tiLe = tiLeManual ?? (donGiaChuaHaoHut !== 0 ? (chenhLech / donGiaChuaHaoHut) * 100 : 0);
  const donGiaThuHoi = thuTl > 0 ? thuTien / thuTl : 0;

  const tongCong = num(data.so_cong_truc) + num(data.so_cong_dau_may) + num(data.so_cong_cuoi_may);
  const tongPhiNhanCong = num(data.tong_chi_phi_nhan_cong);
  const donGiaNhanCong = tlThucTe > 0 ? tongPhiNhanCong / tlThucTe : 0;
  const bqVatTuNhanCong = donGiaTong + donGiaNhanCong;

  return {
    tlChinh, tienChinh, tienPhu, thuTl, thuTien, haoHut,
    tlThucTe, tienThucTe, donGiaChinh, donGiaPhu, donGiaChinhThucTe,
    donGiaChuaHaoHut, donGiaTong, chenhLech, tiLe, donGiaThuHoi,
    tongCong, tongPhiNhanCong, donGiaNhanCong, bqVatTuNhanCong
  };
}

export function BaoCaoThangPrintSheet({ data }: { data: BaoCaoThangPrintData }) {
  const d = computeBaoCaoThangPrintDerived(data);
  const printDate = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const prevDonGia = num(data.prev_don_gia_chinh);
  const prevDonGiaPhu = num(data.prev_don_gia_phu);
  const prevDonGiaChinhThucTe = num(data.prev_don_gia_chinh_thuc_te);
  const prevDonGiaTong = num(data.prev_don_gia_tong);
  const prevDonGiaNhanCong = num(data.prev_don_gia_nhan_cong);
  const prevChuaHaoHut = prevDonGia + prevDonGiaPhu;

  return (
    <div className="dot-san-xuat-print-sheet">
      <div className="dot-san-xuat-print-doc">
        <div className="dot-san-xuat-print-header">
          <div className="dot-san-xuat-print-brand">
            <img src={vietNhatLogoUrl} alt="Việt Nhật" className="dot-san-xuat-print-logo" />
            <div>
              <p className="dot-san-xuat-print-company-name">{PRINT_COMPANY_NAME}</p>
              <p className="dot-san-xuat-print-project-name">
                Máy {data.ten_may || data.ma_may} · Tháng {data.thang}/{data.nam}
              </p>
            </div>
          </div>
          <h1 className="dot-san-xuat-print-title">
            Kết quả định giá vật tư – nhân công thực tế sản xuất {data.ten_bao_cao}
          </h1>
          <div className="dot-san-xuat-print-meta">
            <p><strong>Báo cáo:</strong> {data.ten_bao_cao}</p>
            <p><strong>Máy:</strong> {data.ten_may || data.ma_may}{data.ma_may && data.ten_may && data.ma_may !== data.ten_may ? ` (${data.ma_may})` : ''}</p>
            <p><strong>Tháng / Năm:</strong> Tháng {data.thang}/{data.nam}</p>
            <p><strong>Số đợt tổng hợp:</strong> {data.so_dot} đợt</p>
            {data.prev_ten ? <p><strong>Kỳ so sánh:</strong> {data.prev_ten}</p> : null}
            <p><strong>Ngày in:</strong> {printDate}</p>
          </div>
        </div>

        {/* BẢNG I: VẬT TƯ THỰC TẾ THÁNG */}
        <h2 className="dot-san-xuat-print-subtitle">
          I. Kết quả định giá vật tư thực tế tháng {data.thang}/{data.nam}
        </h2>
        <table className="dot-san-xuat-print-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>TT</th>
              <th style={{ width: '37%' }}>Diễn giải</th>
              <th style={{ width: '13%' }}>Trọng lượng (kg)</th>
              <th style={{ width: '15%' }}>Giá trị vật tư (VND)</th>
              <th style={{ width: '11%' }}>VND/kg tháng này</th>
              <th style={{ width: '11%' }}>VND/kg tháng trước</th>
              <th style={{ width: '8%' }}>Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dot-san-xuat-print-center">1</td>
              <td>Tổng vật tư chính xuất vào sản xuất</td>
              <td className="dot-san-xuat-print-right">{formatKg(d.tlChinh)}</td>
              <td className="dot-san-xuat-print-right">{formatInt(d.tienChinh)}</td>
              <td className="dot-san-xuat-print-right">{formatUnitPrice(d.donGiaChinh)}</td>
              <td className="dot-san-xuat-print-right">{prevDonGia ? formatUnitPrice(prevDonGia) : '-'}</td>
              <td className="dot-san-xuat-print-right">{prevDonGia ? formatUnitPrice(d.donGiaChinh - prevDonGia) : '-'}</td>
            </tr>
            <tr>
              <td className="dot-san-xuat-print-center">2</td>
              <td>Tổng vật tư phụ xuất vào sản xuất</td>
              <td className="dot-san-xuat-print-right">{formatKg(num(data.tong_tl_nvl_phu))}</td>
              <td className="dot-san-xuat-print-right">{formatInt(d.tienPhu)}</td>
              <td className="dot-san-xuat-print-right">{formatUnitPrice(d.donGiaPhu)}</td>
              <td className="dot-san-xuat-print-right">{prevDonGiaPhu ? formatUnitPrice(prevDonGiaPhu) : '-'}</td>
              <td className="dot-san-xuat-print-right">{prevDonGiaPhu ? formatUnitPrice(d.donGiaPhu - prevDonGiaPhu) : '-'}</td>
            </tr>
            <tr className="dot-san-xuat-print-highlight">
              <td className="dot-san-xuat-print-center">3</td>
              <td>Giá vật tư kg chưa có hao hụt vật tư sản xuất</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">{formatUnitPrice(d.donGiaChuaHaoHut)}</td>
              <td className="dot-san-xuat-print-right">{prevChuaHaoHut ? formatUnitPrice(prevChuaHaoHut) : '-'}</td>
              <td className="dot-san-xuat-print-right">{prevChuaHaoHut ? formatUnitPrice(d.donGiaChuaHaoHut - prevChuaHaoHut) : '-'}</td>
            </tr>
            <tr>
              <td className="dot-san-xuat-print-center">4</td>
              <td>Trừ giá trị vật tư thu hồi cho phế bắt buộc &amp; phế sản xuất</td>
              <td className="dot-san-xuat-print-right">{formatKg(d.thuTl)}</td>
              <td className="dot-san-xuat-print-right">{formatInt(d.thuTien)}</td>
              <td className="dot-san-xuat-print-right">{d.thuTl > 0 ? formatUnitPrice(d.donGiaThuHoi) : '-'}</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
            </tr>
            <tr>
              <td className="dot-san-xuat-print-center">5</td>
              <td>Hao hụt</td>
              <td className="dot-san-xuat-print-right">{formatKg(d.haoHut)}</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
            </tr>
            <tr>
              <td className="dot-san-xuat-print-center">6</td>
              <td>Giá vật tư chính thực tế sau sản xuất</td>
              <td className="dot-san-xuat-print-right">{formatKg(d.tlThucTe)}</td>
              <td className="dot-san-xuat-print-right">{formatInt(d.tienThucTe)}</td>
              <td className="dot-san-xuat-print-right">{formatUnitPrice(d.donGiaChinhThucTe)}</td>
              <td className="dot-san-xuat-print-right">{prevDonGiaChinhThucTe ? formatUnitPrice(prevDonGiaChinhThucTe) : '-'}</td>
              <td className="dot-san-xuat-print-right">{prevDonGiaChinhThucTe ? formatUnitPrice(d.donGiaChinhThucTe - prevDonGiaChinhThucTe) : '-'}</td>
            </tr>
            <tr>
              <td className="dot-san-xuat-print-center">7</td>
              <td>Giá vật tư thực tế sau sản xuất có hao hụt (Đơn giá tổng)</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">{formatUnitPrice(d.donGiaTong)}</td>
              <td className="dot-san-xuat-print-right">{prevDonGiaTong ? formatUnitPrice(prevDonGiaTong) : '-'}</td>
              <td className="dot-san-xuat-print-right">{prevDonGiaTong ? formatUnitPrice(d.donGiaTong - prevDonGiaTong) : '-'}</td>
            </tr>
            <tr className="dot-san-xuat-print-total">
              <td className="dot-san-xuat-print-center">8</td>
              <td>Chênh lệch trước và sau hao hụt</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">{formatUnitPrice(d.chenhLech)}</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
            </tr>
            <tr className="dot-san-xuat-print-total">
              <td className="dot-san-xuat-print-center">9</td>
              <td>Tỉ lệ chênh lệch trước và sau hao hụt</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">{formatUnitPrice(d.tiLe)}%</td>
              <td className="dot-san-xuat-print-right">-</td>
              <td className="dot-san-xuat-print-right">-</td>
            </tr>
          </tbody>
        </table>

        <p className="dot-san-xuat-print-note">
          BQ giá vật tư &amp; nhân công tháng {data.thang}/{data.nam} là {formatUnitPrice(d.bqVatTuNhanCong)} đồng/kg.
          {data.ghi_chu ? ` ${data.ghi_chu}` : ''}
        </p>

        {/* BẢNG II: NHÂN CÔNG THỰC TẾ THÁNG */}
        <h2 className="dot-san-xuat-print-subtitle">
          II. Kết quả định giá nhân công thực tế tháng {data.thang}/{data.nam}
        </h2>
        <table className="dot-san-xuat-print-table">
          <thead>
            <tr>
              <th style={{ width: '14%' }}>Kỳ</th>
              <th style={{ width: '16%' }}>Bộ phận</th>
              <th style={{ width: '12%' }}>Số công</th>
              <th style={{ width: '15%' }}>Tổng chi phí nhân công</th>
              <th style={{ width: '15%' }}>Đơn giá nhân công/kg tháng này</th>
              <th style={{ width: '14%' }}>Đơn giá nhân công/kg tháng trước</th>
              <th style={{ width: '14%' }}>Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowSpan={4}>Tháng {data.thang}/{data.nam}</td>
              <td>Trực</td>
              <td className="dot-san-xuat-print-right">{formatKg(num(data.so_cong_truc))}</td>
              <td className="dot-san-xuat-print-right" rowSpan={4}>{formatInt(d.tongPhiNhanCong)}</td>
              <td className="dot-san-xuat-print-right" rowSpan={4}>{formatUnitPrice(d.donGiaNhanCong)}</td>
              <td className="dot-san-xuat-print-right" rowSpan={4}>{prevDonGiaNhanCong ? formatUnitPrice(prevDonGiaNhanCong) : '-'}</td>
              <td className="dot-san-xuat-print-right" rowSpan={4}>{prevDonGiaNhanCong ? formatUnitPrice(d.donGiaNhanCong - prevDonGiaNhanCong) : '-'}</td>
            </tr>
            <tr>
              <td>Đầu máy</td>
              <td className="dot-san-xuat-print-right">{formatKg(num(data.so_cong_dau_may))}</td>
            </tr>
            <tr>
              <td>Cuối máy</td>
              <td className="dot-san-xuat-print-right">{formatKg(num(data.so_cong_cuoi_may))}</td>
            </tr>
            <tr className="dot-san-xuat-print-total">
              <td>Tổng công</td>
              <td className="dot-san-xuat-print-right">{formatKg(d.tongCong)}</td>
            </tr>
          </tbody>
        </table>

        {/* BẢNG III: CHI TIẾT TỪNG ĐỢT ĐÃ TỔNG HỢP */}
        {data.dot_snapshot && data.dot_snapshot.length > 0 && (
          <>
            <h2 className="dot-san-xuat-print-subtitle">
              III. Danh sách các đợt sản xuất trong tháng ({data.dot_snapshot.length} đợt)
            </h2>
            <table className="dot-san-xuat-print-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>TT</th>
                  <th style={{ width: '22%' }}>Tên đợt</th>
                  <th style={{ width: '16%' }}>Thời gian</th>
                  <th style={{ width: '11%' }}>TL chính (kg)</th>
                  <th style={{ width: '11%' }}>TL thực tế (kg)</th>
                  <th style={{ width: '11%' }}>Hao hụt (kg)</th>
                  <th style={{ width: '12%' }}>Chi phí NC (VND)</th>
                  <th style={{ width: '12%' }}>BQ VT+NC (đ/kg)</th>
                </tr>
              </thead>
              <tbody>
                {data.dot_snapshot.map((dot, idx) => (
                  <tr key={dot.id || idx}>
                    <td className="dot-san-xuat-print-center">{idx + 1}</td>
                    <td className="font-medium">{dot.ten_dot}</td>
                    <td className="dot-san-xuat-print-center text-xs">
                      {formatPrintDate(dot.tu_ngay)} - {formatPrintDate(dot.den_ngay)}
                    </td>
                    <td className="dot-san-xuat-print-right">{formatKg(dot.tl_chinh)}</td>
                    <td className="dot-san-xuat-print-right">{formatKg(dot.tl_thuc_te)}</td>
                    <td className="dot-san-xuat-print-right">{formatKg(dot.hao_hut_kg)}</td>
                    <td className="dot-san-xuat-print-right">{formatInt(dot.tong_chi_phi_nhan_cong)}</td>
                    <td className="dot-san-xuat-print-right font-medium">{formatUnitPrice(dot.bq_vt_nhan_cong)}</td>
                  </tr>
                ))}
                <tr className="dot-san-xuat-print-total">
                  <td colSpan={3} className="dot-san-xuat-print-center">Tổng cộng</td>
                  <td className="dot-san-xuat-print-right">{formatKg(d.tlChinh)}</td>
                  <td className="dot-san-xuat-print-right">{formatKg(d.tlThucTe)}</td>
                  <td className="dot-san-xuat-print-right">{formatKg(d.haoHut)}</td>
                  <td className="dot-san-xuat-print-right">{formatInt(d.tongPhiNhanCong)}</td>
                  <td className="dot-san-xuat-print-right">{formatUnitPrice(d.bqVatTuNhanCong)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div className="dot-san-xuat-print-signatures">
          <div>
            <p>Người lập</p>
            <span>(Ký, ghi rõ họ tên)</span>
            <div className="mt-8 font-semibold text-slate-800">{data.nguoi_lap || ''}</div>
          </div>
          <div>
            <p>Quản đốc</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Kế toán</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Giám đốc</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BaoCaoThangPrintPreviewModal({
  open,
  data,
  onClose
}: {
  open: boolean;
  data: BaoCaoThangPrintData | null;
  onClose: () => void;
}) {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !data) return null;

  async function handlePrint() {
    setPrinting(true);
    try {
      await waitForPrintImagesReady();
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-sm">
      <div className="no-print flex items-center justify-between border-b border-slate-700 bg-slate-800 px-6 py-3 text-white">
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-blue-400" />
          <h2 className="text-base font-semibold">Xem trước bản in — {data.ten_bao_cao}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handlePrint()}
            disabled={printing}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            In báo cáo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-100">
        <BaoCaoThangPrintSheet data={data} />
      </div>
    </div>,
    document.body
  );
}
