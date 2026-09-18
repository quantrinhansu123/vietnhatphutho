import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackButton } from '../../components/layout/NavButtons';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { normalizeMachines, type MachineRow } from '../danh-sach-may';
import { parseMonthStr, toMonthStr } from '../so-che-do-may';
import { formatMoney, formatNumber } from '../../utils';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  X
} from 'lucide-react';
import type {
  BaoCaoThangAggregateResponse,
  BaoCaoThangDotSummary,
  BaoCaoThangPrintData,
  BaoCaoThangRow
} from './types';
import BaoCaoThangPrintPreviewModal from './PrintPreviewModal';

function toNum(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function safeFixed(n: number, digits = 2): string {
  if (!Number.isFinite(n) || n === 0) return '-';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPrintDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '-');
}

/** Picker Tháng + Năm lịch popup tiếng Việt chuẩn AGENTS.md (năm 1-2999). */
export function MonthYearPicker({
  value,
  onChange,
  placeholder = 'Chọn tháng + năm',
  label = 'Tháng + Năm'
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseMonthStr(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.nam ?? now.getFullYear());
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const p = parseMonthStr(value);
    setViewYear(p?.nam ?? new Date().getFullYear());
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, value]);

  const clampYear = (y: number) => Math.min(2999, Math.max(1, Number.isFinite(y) ? Math.floor(y) : 1));

  return (
    <div ref={boxRef} className="relative inline-block text-left">
      {label && <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-9 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-slate-400" />
          {parsed ? `Tháng ${parsed.thang} - Năm ${parsed.nam}` : <span className="text-slate-400 font-normal">{placeholder}</span>}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              aria-label="Năm trước"
              onClick={() => setViewYear(y => clampYear(y - 1))}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="flex flex-1 items-center justify-center gap-1 text-sm font-bold text-slate-800">
              Năm
              <input
                type="number"
                min={1}
                max={2999}
                value={viewYear}
                onChange={e => setViewYear(clampYear(Number(e.target.value) || 1))}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm outline-none focus:border-blue-400"
              />
            </label>
            <button
              type="button"
              aria-label="Năm sau"
              onClick={() => setViewYear(y => clampYear(y + 1))}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => {
              const active = parsed?.nam === viewYear && parsed?.thang === i + 1;
              return (
                <button
                  key={i + 1}
                  type="button"
                  onClick={() => {
                    onChange(toMonthStr(i + 1, viewYear));
                    setOpen(false);
                  }}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tháng {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Form Lập / Sửa Báo Cáo Tháng */
export function BaoCaoThangPanel({
  onBack,
  onOpenList,
  editReport,
  onEditConsumed
}: {
  onBack: () => void;
  onOpenList: () => void;
  editReport: BaoCaoThangRow | null;
  onEditConsumed?: () => void;
}) {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const now = new Date();
  const defaultMonthStr = toMonthStr(now.getMonth() + 1, now.getFullYear());

  const [monthStr, setMonthStr] = useState(
    editReport ? toMonthStr(editReport.thang, editReport.nam) : defaultMonthStr
  );
  const [maMay, setMaMay] = useState(editReport?.ma_may ?? '');
  const [tenBaoCao, setTenBaoCao] = useState(editReport?.ten_bao_cao ?? '');
  const [editingId, setEditingId] = useState<string | null>(editReport?.id ?? null);

  const [aggregateLoading, setAggregateLoading] = useState(false);
  const [aggregateError, setAggregateError] = useState('');
  const [aggregateData, setAggregateData] = useState<BaoCaoThangAggregateResponse | null>(null);

  // Số liệu tổng hợp
  const [tongTlChinh, setTongTlChinh] = useState(editReport ? String(editReport.tong_tl_nvl_chinh) : '0');
  const [tongTienChinh, setTongTienChinh] = useState(editReport ? String(editReport.tong_tien_nvl_chinh) : '0');
  const [tongTlPhu, setTongTlPhu] = useState(editReport ? String(editReport.tong_tl_nvl_phu) : '0');
  const [tongTienPhu, setTongTienPhu] = useState(editReport ? String(editReport.tong_tien_nvl_phu) : '0');
  const [thuHoiTl, setThuHoiTl] = useState(editReport ? String(editReport.thu_hoi_phe_tl) : '0');
  const [thuHoiTien, setThuHoiTien] = useState(editReport ? String(editReport.thu_hoi_phe_tien) : '0');
  const [haoHutKg, setHaoHutKg] = useState(editReport ? String(editReport.hao_hut_kg) : '0');
  const [tlThucTeOverride, setTlThucTeOverride] = useState(
    editReport?.tl_chinh_thuc_te ? String(editReport.tl_chinh_thuc_te) : ''
  );
  const [donGiaTongOverride, setDonGiaTongOverride] = useState(
    editReport?.gia_vt_tt_hao_hut ? String(editReport.gia_vt_tt_hao_hut) : ''
  );
  const [chenhLechOverride, setChenhLechOverride] = useState(
    editReport?.chenh_lech_hao_hut ? String(editReport.chenh_lech_hao_hut) : ''
  );
  const [tiLeOverride, setTiLeOverride] = useState(
    editReport?.ti_le_hao_hut ? String(editReport.ti_le_hao_hut) : ''
  );
  const [soCongTruc, setSoCongTruc] = useState(editReport ? String(editReport.so_cong_truc) : '0');
  const [soCongDauMay, setSoCongDauMay] = useState(editReport ? String(editReport.so_cong_dau_may) : '0');
  const [soCongCuoiMay, setSoCongCuoiMay] = useState(editReport ? String(editReport.so_cong_cuoi_may) : '0');
  const [tongChiPhiNhanCong, setTongChiPhiNhanCong] = useState(
    editReport ? String(editReport.tong_chi_phi_nhan_cong) : '0'
  );
  const [ghiChu, setGhiChu] = useState(editReport?.ghi_chu ?? '');
  const [nguoiLap, setNguoiLap] = useState(editReport?.nguoi_lap ?? '');

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    fetch('/api/danh-sach-may')
      .then(async res => {
        if (!res.ok) throw new Error('bad');
        const data = await res.json();
        setMachines(normalizeMachines(data));
      })
      .catch(() => setMachines([]));
  }, []);

  const machineOptions = useMemo(
    () =>
      machines.map(m => ({
        value: m.code || m.name,
        label: m.code && m.name && m.code !== m.name ? `${m.code} — ${m.name}` : m.code || m.name
      })),
    [machines]
  );

  const tenMay = useMemo(() => {
    const found = machines.find(m => (m.code || m.name) === maMay);
    return found ? found.name || maMay : maMay;
  }, [machines, maMay]);

  // Nếu đang chỉnh sửa báo cáo được truyền vào
  useEffect(() => {
    if (!editReport) return;
    setEditingId(editReport.id);
    setMonthStr(toMonthStr(editReport.thang, editReport.nam));
    setMaMay(editReport.ma_may);
    setTenBaoCao(editReport.ten_bao_cao);
    setTongTlChinh(String(editReport.tong_tl_nvl_chinh ?? 0));
    setTongTienChinh(String(editReport.tong_tien_nvl_chinh ?? 0));
    setTongTlPhu(String(editReport.tong_tl_nvl_phu ?? 0));
    setTongTienPhu(String(editReport.tong_tien_nvl_phu ?? 0));
    setThuHoiTl(String(editReport.thu_hoi_phe_tl ?? 0));
    setThuHoiTien(String(editReport.thu_hoi_phe_tien ?? 0));
    setHaoHutKg(String(editReport.hao_hut_kg ?? 0));
    setTlThucTeOverride(editReport.tl_chinh_thuc_te ? String(editReport.tl_chinh_thuc_te) : '');
    setDonGiaTongOverride(editReport.gia_vt_tt_hao_hut ? String(editReport.gia_vt_tt_hao_hut) : '');
    setChenhLechOverride(editReport.chenh_lech_hao_hut ? String(editReport.chenh_lech_hao_hut) : '');
    setTiLeOverride(editReport.ti_le_hao_hut ? String(editReport.ti_le_hao_hut) : '');
    setSoCongTruc(String(editReport.so_cong_truc ?? 0));
    setSoCongDauMay(String(editReport.so_cong_dau_may ?? 0));
    setSoCongCuoiMay(String(editReport.so_cong_cuoi_may ?? 0));
    setTongChiPhiNhanCong(String(editReport.tong_chi_phi_nhan_cong ?? 0));
    setGhiChu(editReport.ghi_chu ?? '');
    setNguoiLap(editReport.nguoi_lap ?? '');
  }, [editReport]);

  /** Tự động tổng hợp từ báo cáo từng đợt theo tháng và máy */
  async function handleAggregate(targetMonthStr = monthStr, targetMaMay = maMay) {
    const parsed = parseMonthStr(targetMonthStr);
    if (!parsed) {
      setAggregateError('Vui lòng chọn Tháng và Năm hợp lệ.');
      return;
    }
    if (!targetMaMay) {
      setAggregateError('Vui lòng chọn Máy.');
      return;
    }

    setAggregateLoading(true);
    setAggregateError('');
    setSaveMsg('');

    try {
      const res = await fetch(
        `/api/bao-cao-thang/aggregate?thang=${parsed.thang}&nam=${parsed.nam}&ma_may=${encodeURIComponent(
          targetMaMay
        )}&ten_may=${encodeURIComponent(tenMay)}`
      );
      const data = (await res.json().catch(() => ({}))) as BaoCaoThangAggregateResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Không thể tổng hợp báo cáo tháng.');

      setAggregateData(data);

      // Tự động điền dữ liệu đã tổng hợp
      if (!editingId) {
        setTenBaoCao(`Báo cáo tháng ${parsed.thang}/${parsed.nam} - Máy ${tenMay || targetMaMay}`);
      }
      setTongTlChinh(String(data.tong.tong_tl_nvl_chinh));
      setTongTienChinh(String(data.tong.tong_tien_nvl_chinh));
      setTongTlPhu(String(data.tong.tong_tl_nvl_phu));
      setTongTienPhu(String(data.tong.tong_tien_nvl_phu));
      setThuHoiTl(String(data.tong.thu_hoi_phe_tl));
      setThuHoiTien(String(data.tong.thu_hoi_phe_tien));
      setHaoHutKg(String(data.tong.hao_hut_kg));
      setTlThucTeOverride(String(data.tong.tl_chinh_thuc_te));
      setSoCongTruc(String(data.tong.so_cong_truc));
      setSoCongDauMay(String(data.tong.so_cong_dau_may));
      setSoCongCuoiMay(String(data.tong.so_cong_cuoi_may));
      setTongChiPhiNhanCong(String(data.tong.tong_chi_phi_nhan_cong));

      if (data.so_dot === 0) {
        setAggregateError(`Chưa có báo cáo đợt nào của máy ${tenMay || targetMaMay} trong Tháng ${parsed.thang}/${parsed.nam}.`);
      }
    } catch (err: unknown) {
      setAggregateData(null);
      setAggregateError(err instanceof Error ? err.message : 'Lỗi khi tổng hợp báo cáo tháng.');
    } finally {
      setAggregateLoading(false);
    }
  }

  // Tự động kích hoạt tổng hợp khi chọn đủ tháng và máy (ở chế độ tạo mới)
  useEffect(() => {
    if (!editingId && monthStr && maMay) {
      void handleAggregate(monthStr, maMay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr, maMay]);

  // Tính toán phái sinh
  const derived = useMemo(() => {
    const tlChinh = toNum(tongTlChinh);
    const tienChinh = toNum(tongTienChinh);
    const tlPhu = toNum(tongTlPhu);
    const tienPhu = toNum(tongTienPhu);
    const thuTl = toNum(thuHoiTl);
    const thuTien = toNum(thuHoiTien);
    const haoHut = toNum(haoHutKg);
    const override = tlThucTeOverride.trim() === '' ? null : toNum(tlThucTeOverride);
    const tlThucTe = override !== null && override > 0 ? override : Math.max(0, tlChinh - thuTl - haoHut);
    const tienThucTe = Math.max(0, tienChinh - thuTien);
    const donGiaChinh = tlChinh > 0 ? tienChinh / tlChinh : 0;
    const donGiaPhu = tlThucTe > 0 ? tienPhu / tlThucTe : 0;
    const donGiaChinhThucTe = tlThucTe > 0 ? tienThucTe / tlThucTe : 0;
    const donGiaChuaHaoHut = donGiaChinh + donGiaPhu;

    const donGiaTongManual = donGiaTongOverride.trim() === '' ? null : toNum(donGiaTongOverride);
    const donGiaTong = donGiaTongManual ?? (donGiaChinhThucTe + donGiaPhu);
    const chenhLechManual = chenhLechOverride.trim() === '' ? null : toNum(chenhLechOverride);
    const chenhLech = chenhLechManual ?? (donGiaTong - donGiaChuaHaoHut);
    const tiLeManual = tiLeOverride.trim() === '' ? null : toNum(tiLeOverride);
    const tiLe = tiLeManual ?? (donGiaChuaHaoHut !== 0 ? (chenhLech / donGiaChuaHaoHut) * 100 : 0);
    const donGiaThuHoi = thuTl > 0 ? thuTien / thuTl : 0;
    const tongCong = toNum(soCongTruc) + toNum(soCongDauMay) + toNum(soCongCuoiMay);
    const tongPhiNhanCong = toNum(tongChiPhiNhanCong);
    const donGiaNhanCong = tlThucTe > 0 ? tongPhiNhanCong / tlThucTe : 0;
    const bqVatTuNhanCong = donGiaTong + donGiaNhanCong;

    const prev = aggregateData?.thang_truoc;
    const prevDonGiaChinh = toNum(prev?.don_gia_chinh);
    const prevDonGiaPhu = toNum(prev?.don_gia_phu);
    const prevDonGiaChinhThucTe = toNum(prev?.don_gia_chinh_thuc_te);
    const prevDonGiaTong = toNum(prev?.don_gia_tong);
    const prevDonGiaNhanCong = toNum(prev?.don_gia_nhan_cong);
    const prevChuaHaoHut = prevDonGiaChinh + prevDonGiaPhu;

    return {
      tlChinh, tienChinh, tlPhu, tienPhu, thuTl, thuTien, haoHut,
      tlThucTe, tienThucTe, donGiaChinh, donGiaPhu, donGiaChinhThucTe,
      donGiaChuaHaoHut, donGiaTong, chenhLech, tiLe, donGiaThuHoi,
      tongCong, tongPhiNhanCong, donGiaNhanCong, bqVatTuNhanCong,
      prevDonGiaChinh, prevDonGiaPhu, prevDonGiaChinhThucTe, prevDonGiaTong,
      prevDonGiaNhanCong, prevChuaHaoHut,
      prevTen: String(prev?.ten ?? '')
    };
  }, [
    tongTlChinh, tongTienChinh, tongTlPhu, tongTienPhu, thuHoiTl, thuHoiTien,
    haoHutKg, tlThucTeOverride, donGiaTongOverride, chenhLechOverride,
    tiLeOverride, soCongTruc, soCongDauMay, soCongCuoiMay, tongChiPhiNhanCong, aggregateData
  ]);

  async function handleSave() {
    const parsed = parseMonthStr(monthStr);
    if (!parsed) {
      setSaveMsg('Vui lòng chọn Tháng và Năm hợp lệ.');
      return;
    }
    if (!maMay) {
      setSaveMsg('Vui lòng chọn máy.');
      return;
    }

    setSaving(true);
    setSaveMsg('');

    const payload = {
      ten_bao_cao: tenBaoCao.trim() || `Báo cáo tháng ${parsed.thang}/${parsed.nam} - Máy ${tenMay || maMay}`,
      thang: parsed.thang,
      nam: parsed.nam,
      ma_may: maMay,
      ten_may: tenMay,
      dot_ids: aggregateData?.dot_ids ?? editReport?.dot_ids ?? [],
      dot_snapshot: aggregateData?.dot_snapshot ?? editReport?.dot_snapshot ?? [],
      so_dot: aggregateData?.so_dot ?? editReport?.so_dot ?? 0,
      tong_tl_nvl_chinh: derived.tlChinh,
      tong_tien_nvl_chinh: derived.tienChinh,
      tong_tl_nvl_phu: derived.tlPhu,
      tong_tien_nvl_phu: derived.tienPhu,
      thu_hoi_phe_tl: derived.thuTl,
      thu_hoi_phe_tien: derived.thuTien,
      hao_hut_kg: derived.haoHut,
      tl_chinh_thuc_te: derived.tlThucTe,
      gia_vt_tt_hao_hut: donGiaTongOverride.trim() !== '' ? toNum(donGiaTongOverride) : null,
      chenh_lech_hao_hut: chenhLechOverride.trim() !== '' ? toNum(chenhLechOverride) : null,
      ti_le_hao_hut: tiLeOverride.trim() !== '' ? toNum(tiLeOverride) : null,
      so_cong_truc: toNum(soCongTruc),
      so_cong_dau_may: toNum(soCongDauMay),
      so_cong_cuoi_may: toNum(soCongCuoiMay),
      tong_chi_phi_nhan_cong: derived.tongPhiNhanCong,
      ghi_chu: ghiChu.trim(),
      nguoi_lap: nguoiLap.trim()
    };

    try {
      const res = await fetch(editingId ? `/api/bao-cao-thang/${editingId}` : '/api/bao-cao-thang', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Lỗi khi lưu báo cáo tháng.');

      setSaveMsg(editingId ? 'Đã cập nhật báo cáo tháng thành công!' : 'Đã lưu báo cáo tháng thành công!');
      if (!editingId && (data as { report?: { id: string } }).report?.id) {
        setEditingId((data as { report: { id: string } }).report.id);
      }
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Lỗi khi lưu báo cáo tháng.');
    } finally {
      setSaving(false);
    }
  }

  const printData: BaoCaoThangPrintData = useMemo(() => {
    const parsed = parseMonthStr(monthStr) ?? { thang: now.getMonth() + 1, nam: now.getFullYear() };
    return {
      ten_bao_cao: tenBaoCao || `Báo cáo tháng ${parsed.thang}/${parsed.nam} - Máy ${tenMay || maMay}`,
      thang: parsed.thang,
      nam: parsed.nam,
      ma_may: maMay,
      ten_may: tenMay,
      dot_snapshot: aggregateData?.dot_snapshot ?? editReport?.dot_snapshot ?? [],
      so_dot: aggregateData?.so_dot ?? editReport?.so_dot ?? 0,
      tong_tl_nvl_chinh: derived.tlChinh,
      tong_tien_nvl_chinh: derived.tienChinh,
      tong_tl_nvl_phu: derived.tlPhu,
      tong_tien_nvl_phu: derived.tienPhu,
      thu_hoi_phe_tl: derived.thuTl,
      thu_hoi_phe_tien: derived.thuTien,
      hao_hut_kg: derived.haoHut,
      tl_chinh_thuc_te: derived.tlThucTe,
      gia_vt_tt_hao_hut: donGiaTongOverride.trim() !== '' ? toNum(donGiaTongOverride) : null,
      chenh_lech_hao_hut: chenhLechOverride.trim() !== '' ? toNum(chenhLechOverride) : null,
      ti_le_hao_hut: tiLeOverride.trim() !== '' ? toNum(tiLeOverride) : null,
      so_cong_truc: toNum(soCongTruc),
      so_cong_dau_may: toNum(soCongDauMay),
      so_cong_cuoi_may: toNum(soCongCuoiMay),
      tong_chi_phi_nhan_cong: derived.tongPhiNhanCong,
      ghi_chu: ghiChu,
      nguoi_lap: nguoiLap,
      prev_ten: derived.prevTen,
      prev_don_gia_chinh: derived.prevDonGiaChinh,
      prev_don_gia_phu: derived.prevDonGiaPhu,
      prev_don_gia_chinh_thuc_te: derived.prevDonGiaChinhThucTe,
      prev_don_gia_tong: derived.prevDonGiaTong,
      prev_don_gia_nhan_cong: derived.prevDonGiaNhanCong
    };
  }, [
    monthStr, tenBaoCao, maMay, tenMay, aggregateData, editReport, derived,
    donGiaTongOverride, chenhLechOverride, tiLeOverride, soCongTruc,
    soCongDauMay, soCongCuoiMay, ghiChu, nguoiLap, now
  ]);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {editingId ? 'Chỉnh sửa Báo Cáo Tháng' : 'Lập Báo Cáo Tháng (Định giá Vật tư - Nhân công)'}
            </h1>
            <p className="text-xs text-slate-500">
              Tự động tổng hợp số liệu từ các báo cáo từng đợt theo tháng và máy.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenList}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <History className="h-4 w-4 text-slate-500" />
            Danh sách báo cáo
          </button>
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            Xem trước bản in
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingId ? 'Cập nhật báo cáo' : 'Lưu báo cáo tháng'}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div
          className={`rounded-lg p-3 text-xs font-medium ${
            saveMsg.includes('thành công')
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {saveMsg}
        </div>
      )}

      {/* KHỐI CHỌN THÁNG VÀ MÁY ĐỂ TỔNG HỢP */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <MonthYearPicker
            value={monthStr}
            onChange={v => {
              setMonthStr(v);
              if (maMay) void handleAggregate(v, maMay);
            }}
            label="Chọn Tháng & Năm"
          />

          <div className="w-56">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Chọn Máy</span>
            <SearchableSelect
              options={machineOptions}
              value={maMay}
              onChange={val => {
                setMaMay(val);
                if (monthStr) void handleAggregate(monthStr, val);
              }}
              placeholder="-- Chọn máy --"
              getLabel={(item: unknown) => String((item as { label?: unknown }).label ?? '')}
              getValue={(item: unknown) => String((item as { value?: unknown }).value ?? '')}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleAggregate()}
            disabled={aggregateLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {aggregateLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Tổng hợp lại từ các đợt
          </button>

          <div className="flex-1 min-w-[200px]">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Tên báo cáo</span>
            <input
              type="text"
              value={tenBaoCao}
              onChange={e => setTenBaoCao(e.target.value)}
              placeholder="VD: Báo cáo tháng 8/2026 - Máy K01"
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {aggregateError && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            {aggregateError}
          </div>
        )}
      </div>

      {/* DANH SÁCH CÁC ĐỢT THAM GIA TỔNG HỢP */}
      {(aggregateData?.dot_snapshot ?? editReport?.dot_snapshot ?? []).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              Các đợt sản xuất trong tháng ({aggregateData?.so_dot ?? editReport?.so_dot ?? 0} đợt)
            </h2>
            <span className="text-xs text-slate-500">
              Tổng hợp tự động từ mục Đợt sản xuất
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-xs text-slate-700">
              <thead className="bg-slate-50 font-semibold text-slate-800">
                <tr>
                  <th className="px-3 py-2 text-center">STT</th>
                  <th className="px-3 py-2 text-left">Tên đợt</th>
                  <th className="px-3 py-2 text-center">Thời gian</th>
                  <th className="px-3 py-2 text-right">TL chính (kg)</th>
                  <th className="px-3 py-2 text-right">TL phụ (kg)</th>
                  <th className="px-3 py-2 text-right">Thu hồi (kg)</th>
                  <th className="px-3 py-2 text-right">Hao hụt (kg)</th>
                  <th className="px-3 py-2 text-right">TL thực tế (kg)</th>
                  <th className="px-3 py-2 text-right">Số công</th>
                  <th className="px-3 py-2 text-right">Chi phí NC (đ)</th>
                  <th className="px-3 py-2 text-right">ĐG tổng (đ/kg)</th>
                  <th className="px-3 py-2 text-right">BQ VT+NC (đ/kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(aggregateData?.dot_snapshot ?? editReport?.dot_snapshot ?? []).map((dot, idx) => (
                  <tr key={dot.id || idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{dot.ten_dot}</td>
                    <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">
                      {formatPrintDate(dot.tu_ngay)} - {formatPrintDate(dot.den_ngay)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatNumber(dot.tl_chinh)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(dot.tl_phu)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(dot.thu_hoi_tl)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(dot.hao_hut_kg)}</td>
                    <td className="px-3 py-2 text-right font-medium text-blue-700">{formatNumber(dot.tl_thuc_te)}</td>
                    <td className="px-3 py-2 text-right">{safeFixed(dot.so_cong)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(dot.tong_chi_phi_nhan_cong)}</td>
                    <td className="px-3 py-2 text-right">{safeFixed(dot.don_gia_tong)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{safeFixed(dot.bq_vt_nhan_cong)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BẢNG I: KẾT QUẢ ĐỊNH GIÁ VẬT TƯ THỰC TẾ THÁNG */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-800">
          I. Kết quả định giá vật tư thực tế tháng {parseMonthStr(monthStr)?.thang}/{parseMonthStr(monthStr)?.nam}
        </h2>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-amber-50 font-semibold text-slate-800">
              <tr>
                <th className="px-3 py-2 text-center w-12">TT</th>
                <th className="px-3 py-2 text-left">Diễn giải</th>
                <th className="px-3 py-2 text-right w-36">Trọng lượng (kg)</th>
                <th className="px-3 py-2 text-right w-44">Giá trị vật tư (VND)</th>
                <th className="px-3 py-2 text-right w-36">VND/kg tháng này</th>
                <th className="px-3 py-2 text-right w-36">VND/kg tháng trước</th>
                <th className="px-3 py-2 text-right w-28">Chênh lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* 1 */}
              <tr>
                <td className="px-3 py-2 text-center font-medium">1</td>
                <td className="px-3 py-2">Tổng vật tư chính xuất vào sản xuất</td>
                <td className="px-3 py-2 text-right font-medium">{formatNumber(derived.tlChinh)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatMoney(derived.tienChinh)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-900">{safeFixed(derived.donGiaChinh)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{derived.prevDonGiaChinh ? safeFixed(derived.prevDonGiaChinh) : '-'}</td>
                <td className="px-3 py-2 text-right">{derived.prevDonGiaChinh ? safeFixed(derived.donGiaChinh - derived.prevDonGiaChinh) : '-'}</td>
              </tr>
              {/* 2 */}
              <tr>
                <td className="px-3 py-2 text-center font-medium">2</td>
                <td className="px-3 py-2">Tổng vật tư phụ xuất vào sản xuất</td>
                <td className="px-3 py-2 text-right font-medium">{formatNumber(derived.tlPhu)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatMoney(derived.tienPhu)}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-900">{safeFixed(derived.donGiaPhu)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{derived.prevDonGiaPhu ? safeFixed(derived.prevDonGiaPhu) : '-'}</td>
                <td className="px-3 py-2 text-right">{derived.prevDonGiaPhu ? safeFixed(derived.donGiaPhu - derived.prevDonGiaPhu) : '-'}</td>
              </tr>
              {/* 3 */}
              <tr className="bg-amber-50/50 font-medium">
                <td className="px-3 py-2 text-center">3</td>
                <td className="px-3 py-2">Giá vật tư kg chưa có hao hụt vật tư sản xuất</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{safeFixed(derived.donGiaChuaHaoHut)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{derived.prevChuaHaoHut ? safeFixed(derived.prevChuaHaoHut) : '-'}</td>
                <td className="px-3 py-2 text-right">{derived.prevChuaHaoHut ? safeFixed(derived.donGiaChuaHaoHut - derived.prevChuaHaoHut) : '-'}</td>
              </tr>
              {/* 4 */}
              <tr>
                <td className="px-3 py-2 text-center font-medium">4</td>
                <td className="px-3 py-2">Trừ giá trị vật tư thu hồi cho phế bắt buộc &amp; phế sản xuất</td>
                <td className="px-3 py-2 text-right font-medium">{formatNumber(derived.thuTl)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatMoney(derived.thuTien)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{derived.thuTl > 0 ? safeFixed(derived.donGiaThuHoi) : '-'}</td>
                <td className="px-3 py-2 text-right text-slate-500">-</td>
                <td className="px-3 py-2 text-right text-slate-500">-</td>
              </tr>
              {/* 5 */}
              <tr>
                <td className="px-3 py-2 text-center font-medium">5</td>
                <td className="px-3 py-2">Hao hụt</td>
                <td className="px-3 py-2 text-right font-medium">{formatNumber(derived.haoHut)}</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
              </tr>
              {/* 6 */}
              <tr>
                <td className="px-3 py-2 text-center font-medium">6</td>
                <td className="px-3 py-2">Giá vật tư chính thực tế sau sản xuất</td>
                <td className="px-3 py-2 text-right font-medium text-blue-700">{formatNumber(derived.tlThucTe)}</td>
                <td className="px-3 py-2 text-right font-medium text-blue-700">{formatMoney(derived.tienThucTe)}</td>
                <td className="px-3 py-2 text-right font-semibold text-blue-700">{safeFixed(derived.donGiaChinhThucTe)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{derived.prevDonGiaChinhThucTe ? safeFixed(derived.prevDonGiaChinhThucTe) : '-'}</td>
                <td className="px-3 py-2 text-right">{derived.prevDonGiaChinhThucTe ? safeFixed(derived.donGiaChinhThucTe - derived.prevDonGiaChinhThucTe) : '-'}</td>
              </tr>
              {/* 7 */}
              <tr className="bg-blue-50/50 font-medium">
                <td className="px-3 py-2 text-center">7</td>
                <td className="px-3 py-2">Giá vật tư thực tế sau sản xuất có hao hụt (Đơn giá tổng)</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right font-bold text-blue-800">{safeFixed(derived.donGiaTong)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{derived.prevDonGiaTong ? safeFixed(derived.prevDonGiaTong) : '-'}</td>
                <td className="px-3 py-2 text-right">{derived.prevDonGiaTong ? safeFixed(derived.donGiaTong - derived.prevDonGiaTong) : '-'}</td>
              </tr>
              {/* 8 */}
              <tr>
                <td className="px-3 py-2 text-center font-medium">8</td>
                <td className="px-3 py-2">Chênh lệch trước và sau hao hụt</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{safeFixed(derived.chenhLech)}</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
              </tr>
              {/* 9 */}
              <tr>
                <td className="px-3 py-2 text-center font-medium">9</td>
                <td className="px-3 py-2">Tỉ lệ chênh lệch trước và sau hao hụt (%)</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">{safeFixed(derived.tiLe)}%</td>
                <td className="px-3 py-2 text-right">-</td>
                <td className="px-3 py-2 text-right">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-xs font-semibold text-slate-700">
          BQ giá vật tư &amp; nhân công tháng {parseMonthStr(monthStr)?.thang}/{parseMonthStr(monthStr)?.nam} là{' '}
          <span className="text-emerald-700 font-bold">{safeFixed(derived.bqVatTuNhanCong)}</span> đồng/kg.
        </div>
      </div>

      {/* BẢNG II: KẾT QUẢ ĐỊNH GIÁ NHÂN CÔNG THỰC TẾ THÁNG */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-800">
          II. Kết quả định giá nhân công thực tế tháng {parseMonthStr(monthStr)?.thang}/{parseMonthStr(monthStr)?.nam}
        </h2>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-800">
              <tr>
                <th className="px-3 py-2 text-left w-36">Kỳ</th>
                <th className="px-3 py-2 text-left w-36">Bộ phận</th>
                <th className="px-3 py-2 text-right w-36">Số công</th>
                <th className="px-3 py-2 text-right w-44">Tổng chi phí nhân công</th>
                <th className="px-3 py-2 text-right w-36">VND/kg tháng này</th>
                <th className="px-3 py-2 text-right w-36">VND/kg tháng trước</th>
                <th className="px-3 py-2 text-right w-28">Chênh lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td rowSpan={4} className="px-3 py-2 font-medium bg-slate-50/50 align-top">
                  Tháng {parseMonthStr(monthStr)?.thang}/{parseMonthStr(monthStr)?.nam}
                </td>
                <td className="px-3 py-2">Trực</td>
                <td className="px-3 py-2 text-right font-medium">{formatNumber(derived.tongCong > 0 ? toNum(soCongTruc) : 0)}</td>
                <td rowSpan={4} className="px-3 py-2 text-right font-bold text-slate-900 align-middle">
                  {formatMoney(derived.tongPhiNhanCong)}
                </td>
                <td rowSpan={4} className="px-3 py-2 text-right font-bold text-emerald-700 align-middle">
                  {safeFixed(derived.donGiaNhanCong)}
                </td>
                <td rowSpan={4} className="px-3 py-2 text-right text-slate-500 align-middle">
                  {derived.prevDonGiaNhanCong ? safeFixed(derived.prevDonGiaNhanCong) : '-'}
                </td>
                <td rowSpan={4} className="px-3 py-2 text-right align-middle">
                  {derived.prevDonGiaNhanCong ? safeFixed(derived.donGiaNhanCong - derived.prevDonGiaNhanCong) : '-'}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Đầu máy</td>
                <td className="px-3 py-2 text-right font-medium">{formatNumber(derived.tongCong > 0 ? toNum(soCongDauMay) : 0)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Cuối máy</td>
                <td className="px-3 py-2 text-right font-medium">{formatNumber(derived.tongCong > 0 ? toNum(soCongCuoiMay) : 0)}</td>
              </tr>
              <tr className="bg-slate-50/50 font-semibold">
                <td className="px-3 py-2">Tổng công</td>
                <td className="px-3 py-2 text-right text-slate-900">{safeFixed(derived.tongCong)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* GHI CHÚ & NGƯỜI LẬP */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Ghi chú</label>
            <textarea
              rows={3}
              value={ghiChu}
              onChange={e => setGhiChu(e.target.value)}
              placeholder="Nhập ghi chú hoặc phân tích bổ sung cho báo cáo tháng..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Người lập báo cáo</label>
            <input
              type="text"
              value={nguoiLap}
              onChange={e => setNguoiLap(e.target.value)}
              placeholder="Họ tên người lập báo cáo"
              className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <BaoCaoThangPrintPreviewModal
        open={printOpen}
        data={printData}
        onClose={() => setPrintOpen(false)}
      />
    </div>
  );
}

/** Danh Sách Báo Cáo Tháng */
export function BaoCaoThangListView({
  onBack,
  onCreate,
  onEdit
}: {
  onBack: () => void;
  onCreate: () => void;
  onEdit: (report: BaoCaoThangRow) => void;
}) {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  // Ban đầu: tháng trống để danh sách trống, chỉ khi chọn xong tháng - năm mới có dữ liệu!
  const [monthStr, setMonthStr] = useState<string>('');
  const [maMay, setMaMay] = useState<string>('');

  const [reports, setReports] = useState<BaoCaoThangRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [viewPrintData, setViewPrintData] = useState<BaoCaoThangPrintData | null>(null);

  useEffect(() => {
    fetch('/api/danh-sach-may')
      .then(async res => {
        if (!res.ok) throw new Error('bad');
        const data = await res.json();
        setMachines(normalizeMachines(data));
      })
      .catch(() => setMachines([]));
  }, []);

  const machineOptions = useMemo(
    () => [
      { value: '', label: '-- Tất cả máy --' },
      ...machines.map(m => ({
        value: m.code || m.name,
        label: m.code && m.name && m.code !== m.name ? `${m.code} — ${m.name}` : m.code || m.name
      }))
    ],
    [machines]
  );

  async function loadReports(selectedMonth = monthStr, selectedMachine = maMay) {
    const parsed = parseMonthStr(selectedMonth);
    // YÊU CẦU: Khi vào màn hình sẽ chưa có, chỉ khi chọn xong tháng - năm mới có!
    if (!parsed) {
      setReports([]);
      setErrorMsg('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const params = new URLSearchParams({
        thang: String(parsed.thang),
        nam: String(parsed.nam),
        limit: '200'
      });
      if (selectedMachine) params.set('ma_may', selectedMachine);

      const res = await fetch(`/api/bao-cao-thang?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Lỗi khi tải danh sách báo cáo tháng.');

      const list = Array.isArray((data as { reports?: unknown }).reports)
        ? ((data as { reports: BaoCaoThangRow[] }).reports)
        : [];
      setReports(list);
    } catch (err: unknown) {
      setReports([]);
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi tải danh sách.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports(monthStr, maMay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr, maMay]);

  async function handleDelete(report: BaoCaoThangRow) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${report.ten_bao_cao}?`)) return;
    try {
      const res = await fetch(`/api/bao-cao-thang/${report.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Lỗi khi xóa báo cáo.');
      setReports(prev => prev.filter(r => r.id !== report.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khi xóa báo cáo.');
    }
  }

  function handleOpenPrint(report: BaoCaoThangRow) {
    const printItem: BaoCaoThangPrintData = {
      ten_bao_cao: report.ten_bao_cao,
      thang: report.thang,
      nam: report.nam,
      ma_may: report.ma_may,
      ten_may: report.ten_may,
      dot_snapshot: report.dot_snapshot || [],
      so_dot: report.so_dot || 0,
      tong_tl_nvl_chinh: report.tong_tl_nvl_chinh,
      tong_tien_nvl_chinh: report.tong_tien_nvl_chinh,
      tong_tl_nvl_phu: report.tong_tl_nvl_phu,
      tong_tien_nvl_phu: report.tong_tien_nvl_phu,
      thu_hoi_phe_tl: report.thu_hoi_phe_tl,
      thu_hoi_phe_tien: report.thu_hoi_phe_tien,
      hao_hut_kg: report.hao_hut_kg,
      tl_chinh_thuc_te: report.tl_chinh_thuc_te,
      gia_vt_tt_hao_hut: report.gia_vt_tt_hao_hut,
      chenh_lech_hao_hut: report.chenh_lech_hao_hut,
      ti_le_hao_hut: report.ti_le_hao_hut,
      so_cong_truc: report.so_cong_truc,
      so_cong_dau_may: report.so_cong_dau_may,
      so_cong_cuoi_may: report.so_cong_cuoi_may,
      tong_chi_phi_nhan_cong: report.tong_chi_phi_nhan_cong,
      ghi_chu: report.ghi_chu,
      nguoi_lap: report.nguoi_lap
    };
    setViewPrintData(printItem);
  }

  const parsedMonth = parseMonthStr(monthStr);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-lg font-bold text-slate-900">Danh Sách Báo Cáo Tháng</h1>
            <p className="text-xs text-slate-500">
              Tra cứu báo cáo định giá vật tư - nhân công thực tế sản xuất theo tháng và máy.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Thêm mới báo cáo tháng
        </button>
      </div>

      {/* BỘ LỌC TÌM KIẾM THEO THÁNG & NĂM */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <MonthYearPicker
              value={monthStr}
              onChange={setMonthStr}
              label="Chọn Tháng & Năm để tra cứu *"
              placeholder="-- Chọn tháng - năm --"
            />
          </div>

          <div className="w-56">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Lọc theo Máy (tùy chọn)</span>
            <SearchableSelect
              options={machineOptions}
              value={maMay}
              onChange={setMaMay}
              placeholder="-- Tất cả máy --"
              getLabel={(item: unknown) => String((item as { label?: unknown }).label ?? '')}
              getValue={(item: unknown) => String((item as { value?: unknown }).value ?? '')}
            />
          </div>

          {monthStr && (
            <button
              type="button"
              onClick={() => {
                setMonthStr('');
                setMaMay('');
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
              Xóa bộ lọc
            </button>
          )}

          {parsedMonth && (
            <span className="text-xs text-slate-500 ml-auto self-center">
              Đang xem: <strong>Tháng {parsedMonth.thang}/{parsedMonth.nam}</strong>
              {maMay ? ` · Máy ${maMay}` : ''} ({reports.length} báo cáo)
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}
      </div>

      {/* DANH SÁCH BÁO CÁO */}
      {!parsedMonth ? (
        // Trạng thái ban đầu khi vừa vào: CHƯA CÓ DỮ LIỆU
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <Calendar className="h-12 w-12 text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Chưa chọn Tháng &amp; Năm</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md">
            Vui lòng chọn <strong>Tháng - Năm</strong> ở bộ lọc phía trên để tra cứu danh sách báo cáo tháng.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-slate-500 text-xs">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-600" />
          Đang tải dữ liệu báo cáo tháng...
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">
            Không tìm thấy báo cáo tháng nào trong Tháng {parsedMonth.thang}/{parsedMonth.nam}
            {maMay ? ` của máy ${maMay}` : ''}.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Lập báo cáo tháng này ngay
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-800">
                <tr>
                  <th className="px-3 py-2.5 text-center w-12">STT</th>
                  <th className="px-3 py-2.5 text-left">Tên báo cáo</th>
                  <th className="px-3 py-2.5 text-left">Máy</th>
                  <th className="px-3 py-2.5 text-center">Số đợt</th>
                  <th className="px-3 py-2.5 text-right">TL thực tế (kg)</th>
                  <th className="px-3 py-2.5 text-right">Chi phí NC (VND)</th>
                  <th className="px-3 py-2.5 text-right">ĐG tổng (VND/kg)</th>
                  <th className="px-3 py-2.5 text-left">Người lập</th>
                  <th className="px-3 py-2.5 text-center">Ngày tạo</th>
                  <th className="px-3 py-2.5 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reports.map((r, idx) => {
                  const tlThucTe = r.tl_chinh_thuc_te > 0 ? r.tl_chinh_thuc_te : Math.max(0, r.tong_tl_nvl_chinh - r.thu_hoi_phe_tl - r.hao_hut_kg);
                  const tienThucTe = Math.max(0, r.tong_tien_nvl_chinh - r.thu_hoi_phe_tien);
                  const dgChinhThuc = tlThucTe > 0 ? tienThucTe / tlThucTe : 0;
                  const dgPhu = tlThucTe > 0 ? r.tong_tien_nvl_phu / tlThucTe : 0;
                  const dgTong = r.gia_vt_tt_hao_hut ?? (dgChinhThuc + dgPhu);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition">
                      <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {r.ten_bao_cao}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">
                        {r.ten_may || r.ma_may}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {r.so_dot || (r.dot_ids ? r.dot_ids.length : 0)} đợt
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-blue-700">
                        {formatNumber(tlThucTe)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {formatMoney(r.tong_chi_phi_nhan_cong)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                        {safeFixed(dgTong)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {r.nguoi_lap || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-500 whitespace-nowrap">
                        {r.created_at ? formatPrintDate(r.created_at) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Xem và in báo cáo"
                            onClick={() => handleOpenPrint(r)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Chỉnh sửa báo cáo"
                            onClick={() => onEdit(r)}
                            className="rounded p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Xóa báo cáo"
                            onClick={() => void handleDelete(r)}
                            className="rounded p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-800"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BaoCaoThangPrintPreviewModal
        open={Boolean(viewPrintData)}
        data={viewPrintData}
        onClose={() => setViewPrintData(null)}
      />
    </div>
  );
}
