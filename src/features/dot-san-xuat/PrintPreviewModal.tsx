import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, X } from 'lucide-react';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from '../../components/layout/constants';
import { waitForPrintImagesReady } from '../../utils/printReady';

export interface DotSanXuatPrintLenh {
  ma_lenh_sx: string;
  ngay_bat_dau?: string;
}

export interface DotSanXuatPrintData {
  ten_dot: string;
  tu_ngay: string;
  den_ngay: string;
  ma_may: string;
  ten_may: string;
  lenh_sx: DotSanXuatPrintLenh[];
  phieu_xuat_codes: string[];
  tong_tl_nvl_chinh: number;
  tong_tien_nvl_chinh: number;
  tong_tl_nvl_phu: number;
  tong_tien_nvl_phu: number;
  thu_hoi_phe_tl: number;
  thu_hoi_phe_tien: number;
  hao_hut_kg: number;
  /** Null = tự tính (chính − thu hồi − hao hụt). */
  tl_chinh_thuc_te_override: number | null;
  /** Null = tự tính. Ba dòng tổng hợp cho phép nhập tay. */
  gia_vt_tt_hao_hut?: number | null;
  chenh_lech_hao_hut?: number | null;
  ti_le_hao_hut?: number | null;
  so_cong_truc: number;
  so_cong_dau_may: number;
  so_cong_cuoi_may: number;
  tong_chi_phi_nhan_cong: number;
  ghi_chu: string;
  prev_ten_dot?: string;
  prev_don_gia_chinh?: number;
  prev_don_gia_phu?: number;
  prev_don_gia_chinh_thuc_te?: number;
  prev_don_gia_tong?: number;
  prev_don_gia_nhan_cong?: number;
}

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

export function computeDotPrintDerived(data: DotSanXuatPrintData) {
  const tlChinh = num(data.tong_tl_nvl_chinh);
  const tienChinh = num(data.tong_tien_nvl_chinh);
  const tienPhu = num(data.tong_tien_nvl_phu);
  const thuTl = num(data.thu_hoi_phe_tl);
  const thuTien = num(data.thu_hoi_phe_tien);
  const haoHut = num(data.hao_hut_kg);
  const override = data.tl_chinh_thuc_te_override;
  const tlThucTe =
    override !== null && override !== undefined && override > 0
      ? override
      : Math.max(0, tlChinh - thuTl - haoHut);
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

export function DotSanXuatPrintSheet({ data }: { data: DotSanXuatPrintData }) {
  const d = computeDotPrintDerived(data);
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
                Máy {data.ten_may || data.ma_may} · Từ {formatPrintDate(data.tu_ngay)} đến {formatPrintDate(data.den_ngay)}
              </p>
            </div>
          </div>
          <h1 className="dot-san-xuat-print-title">
            Kết quả định giá vật tư – nhân công thực tế sản xuất {data.ten_dot}
          </h1>
          <div className="dot-san-xuat-print-meta">
            <p><strong>Đợt:</strong> {data.ten_dot}</p>
            <p><strong>Máy:</strong> {data.ten_may || data.ma_may}{data.ma_may && data.ten_may && data.ma_may !== data.ten_may ? ` (${data.ma_may})` : ''}</p>
            <p><strong>Từ ngày:</strong> {formatPrintDate(data.tu_ngay)}</p>
            <p><strong>Đến ngày:</strong> {formatPrintDate(data.den_ngay)}</p>
            <p><strong>Số lệnh SX:</strong> {data.lenh_sx.length}</p>
            <p><strong>Số phiếu xuất NVL:</strong> {data.phieu_xuat_codes.length}</p>
            {data.prev_ten_dot ? <p><strong>Đợt so sánh:</strong> {data.prev_ten_dot}</p> : null}
            <p><strong>Ngày in:</strong> {printDate}</p>
          </div>
        </div>

        <table className="dot-san-xuat-print-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>TT</th>
              <th style={{ width: '37%' }}>Diễn giải</th>
              <th style={{ width: '13%' }}>Trọng lượng (kg)</th>
              <th style={{ width: '15%' }}>Giá trị vật tư (VND)</th>
              <th style={{ width: '11%' }}>VND/kg đợt này</th>
              <th style={{ width: '11%' }}>VND/kg đợt trước</th>
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
              <td>Giá vật tư kg chưa có hao hụt vật tư sản xuất như phế sản xuất, hao hụt không tên, phế bắt buộc</td>
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
              <td>Giá vật tư chính thực tế sau sản xuất có màng</td>
              <td className="dot-san-xuat-print-right">{formatKg(d.tlThucTe)}</td>
              <td className="dot-san-xuat-print-right">{formatInt(d.tienThucTe)}</td>
              <td className="dot-san-xuat-print-right">{formatUnitPrice(d.donGiaChinhThucTe)}</td>
              <td className="dot-san-xuat-print-right">{prevDonGiaChinhThucTe ? formatUnitPrice(prevDonGiaChinhThucTe) : '-'}</td>
              <td className="dot-san-xuat-print-right">{prevDonGiaChinhThucTe ? formatUnitPrice(d.donGiaChinhThucTe - prevDonGiaChinhThucTe) : '-'}</td>
            </tr>
            <tr>
              <td className="dot-san-xuat-print-center">7</td>
              <td>Giá vật tư thực tế sau sản xuất có hao hụt vật tư sản xuất như phế sản xuất, hao hụt không tên, phế bắt buộc</td>
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
          BQ giá vật tư &amp; nhân công {data.ten_dot} là {formatUnitPrice(d.bqVatTuNhanCong)} đồng/kg.
          {data.ghi_chu ? ` ${data.ghi_chu}` : ''}
        </p>

        <h2 className="dot-san-xuat-print-subtitle">
          Kết quả định giá nhân công thực tế sản xuất {data.ten_dot}
        </h2>
        <table className="dot-san-xuat-print-table">
          <thead>
            <tr>
              <th style={{ width: '14%' }}>Đợt</th>
              <th style={{ width: '16%' }}>Số công</th>
              <th style={{ width: '12%' }}>Số nhân công (số công)</th>
              <th style={{ width: '15%' }}>Tổng chi phí nhân công</th>
              <th style={{ width: '15%' }}>Đơn giá nhân công/kg đợt này</th>
              <th style={{ width: '14%' }}>Đơn giá nhân công/kg đợt trước</th>
              <th style={{ width: '14%' }}>Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowSpan={4}>{data.ten_dot}</td>
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
              <td>Tổng chi phí nhân công</td>
              <td className="dot-san-xuat-print-right">{formatKg(d.tongCong)}</td>
            </tr>
          </tbody>
        </table>

        <div className="dot-san-xuat-print-signatures">
          <div>
            <p>Người lập</p>
            <span>(Ký, ghi rõ họ tên)</span>
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

export default function DotSanXuatPrintPreviewModal({
  open,
  data,
  onClose
}: {
  open: boolean;
  data: DotSanXuatPrintData | null;
  onClose: () => void;
}) {
  const [pendingPrint, setPendingPrint] = useState(false);

  useEffect(() => {
    if (!open) setPendingPrint(false);
  }, [open ]);

  useEffect(() => {
    if (!pendingPrint || !data) return;
    document.body.classList.add('dot-san-xuat-print-active');
    let cancelled = false;
    const timer = window.setTimeout(() => {
      waitForPrintImagesReady().then(() => {
        if (cancelled) return;
        window.print();
        setPendingPrint(false);
        document.body.classList.remove('dot-san-xuat-print-active');
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.body.classList.remove('dot-san-xuat-print-active');
    };
  }, [pendingPrint, data]);

  if (!open || !data) {
    return pendingPrint && data
      ? createPortal(
          <div className="dot-san-xuat-print-batch">
            <DotSanXuatPrintSheet data={data} />
          </div>,
          document.body
        )
      : null;
  }

  return (
    <>
      {pendingPrint &&
        createPortal(
          <div className="dot-san-xuat-print-batch">
            <DotSanXuatPrintSheet data={data} />
          </div>,
          document.body
        )}

      <div className="dot-san-xuat-print-modal fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <div className="dot-san-xuat-print-modal-chrome flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
            <div>
              <h3 className="text-lg font-black text-zinc-950">Xem trước bản in đợt sản xuất</h3>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                {data.ten_dot} · Máy {data.ten_may || data.ma_may} · {formatPrintDate(data.tu_ngay)} → {formatPrintDate(data.den_ngay)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
              aria-label="Đóng xem trước"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 px-4 py-4 sm:px-5">
            <div className="dot-san-xuat-print-preview mx-auto max-w-[210mm] rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <DotSanXuatPrintSheet data={data} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => setPendingPrint(true)}
              disabled={pendingPrint}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-sm font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
            >
              {pendingPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              In báo cáo
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
