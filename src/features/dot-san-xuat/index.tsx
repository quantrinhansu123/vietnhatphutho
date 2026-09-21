import React, { useEffect, useMemo, useState } from 'react';
import { BackButton } from '../../components/layout/NavButtons';
import { useTabAccess } from '../../app/useTabAccess';
import { formatMoney, formatNumber } from '../../utils';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { normalizeMachines, type MachineRow } from '../danh-sach-may';
import { formatDateVN, parseDateStr, VnCalendarPicker } from '../so-che-do-may';
import { Loader2, Plus, Pencil, Trash2, RefreshCw, Save, Printer, Eye } from 'lucide-react';
import DotSanXuatPrintPreviewModal, { type DotSanXuatPrintData } from './PrintPreviewModal';

export interface DotSanXuatLenh {
  id: string;
  ma_lenh_sx: string;
  ten_lenh_sx?: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  may?: string;
  ca?: string;
  trang_thai?: string;
  /** True = trạng thái Hoàn thành. */
  hoan_thanh?: boolean;
  /** True = lệnh có sổ trộn (SX thực tế) trong phạm vi đợt. */
  co_so_tron?: boolean;
  /** True = khớp máy đã chọn; false = ứng viên trong khoảng ngày nhưng khác/chưa gán máy. */
  khop_may?: boolean;
}

export interface DotSanXuatPhieu {
  ma_phieu: string;
  ngay_phieu: string;
  /** Các máy ghi trên dòng phiếu (rỗng = phiếu chưa gán máy). */
  may?: string[];
  /** True = có dòng khớp máy đã chọn. */
  khop_may?: boolean;
  tong_tl_chinh: number;
  tong_tien_chinh: number;
  tong_tl_phu: number;
  tong_tien_phu: number;
  tong_tl_chua_phan_loai: number;
  tong_tien_chua_phan_loai: number;
  so_dong: number;
}

export interface DotSanXuatPreview {
  tu_ngay: string;
  den_ngay: string;
  ma_may: string;
  lenh_sx: DotSanXuatLenh[];
  /** Mã lệnh (lowercase) đã có sổ trộn trong phạm vi — để đối chiếu. */
  so_tron_lenh?: string[];
  phieu_xuat: DotSanXuatPhieu[];
  tong: {
    tong_tl_nvl_chinh: number;
    tong_tien_nvl_chinh: number;
    tong_tl_nvl_phu: number;
    tong_tien_nvl_phu: number;
    don_gia_chinh: number;
    don_gia_phu: number;
  };
  dot_truoc: Record<string, unknown> | null;
}

export interface DotSanXuatRow {
  id: string;
  ten_dot: string;
  dot_so: number;
  thang: number;
  nam: number;
  tu_ngay: string;
  den_ngay: string;
  ma_may: string;
  ten_may: string;
  lenh_sx_ids: unknown;
  lenh_sx_snapshot: unknown;
  phieu_xuat_codes: unknown;
  tong_tl_nvl_chinh: number;
  tong_tien_nvl_chinh: number;
  tong_tl_nvl_phu: number;
  tong_tien_nvl_phu: number;
  thu_hoi_phe_tl: number;
  thu_hoi_phe_tien: number;
  hao_hut_kg: number;
  tl_chinh_thuc_te_override?: number | null;
  gia_vt_tt_hao_hut?: number | null;
  chenh_lech_hao_hut?: number | null;
  ti_le_hao_hut?: number | null;
  so_cong_truc: number;
  so_cong_dau_may: number;
  so_cong_cuoi_may: number;
  tong_chi_phi_nhan_cong: number;
  ghi_chu: string;
  nguoi_lap: string;
  created_at?: string;
}

function toNum(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function monthYearOf(dateISO: string): { thang: number; nam: number } {
  const p = parseDateStr(dateISO);
  if (p) return { thang: p.thang, nam: p.nam };
  const now = new Date();
  return { thang: now.getMonth() + 1, nam: now.getFullYear() };
}

function safeFixed(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function DotSanXuatPanel({ onBack }: { onBack: () => void }) {
  const tabAccess = useTabAccess('dot-san-xuat');
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [tuNgay, setTuNgay] = useState(todayISO().slice(0, 8) + '01');
  const [denNgay, setDenNgay] = useState(todayISO());
  const [maMay, setMaMay] = useState('');
  const [preview, setPreview] = useState<DotSanXuatPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Tổng tự động (cho phép sửa tay khi phiếu chưa có tổng chuẩn)
  const [tongTlChinh, setTongTlChinh] = useState('0');
  const [tongTienChinh, setTongTienChinh] = useState('0');
  const [tongTlPhu, setTongTlPhu] = useState('0');
  const [tongTienPhu, setTongTienPhu] = useState('0');

  // Nhập tay: khoản không suy luận được
  const [thuHoiTl, setThuHoiTl] = useState('0');
  const [thuHoiTien, setThuHoiTien] = useState('0');
  const [haoHutKg, setHaoHutKg] = useState('0');
  const [tlThucTeOverride, setTlThucTeOverride] = useState('');
  const [donGiaTongOverride, setDonGiaTongOverride] = useState('');
  const [chenhLechOverride, setChenhLechOverride] = useState('');
  const [tiLeOverride, setTiLeOverride] = useState('');
  const [soCongTruc, setSoCongTruc] = useState('0');
  const [soCongDauMay, setSoCongDauMay] = useState('0');
  const [soCongCuoiMay, setSoCongCuoiMay] = useState('0');
  const [tongChiPhiNhanCong, setTongChiPhiNhanCong] = useState('0');
  const [ghiChu, setGhiChu] = useState('');
  const [tenDot, setTenDot] = useState('');
  const [dotSo, setDotSo] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [dots, setDots] = useState<DotSanXuatRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [view, setView] = useState<'form' | 'list'>('form');
  const [printData, setPrintData] = useState<DotSanXuatPrintData | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    fetch('/api/danh-sach-may')
      .then(async res => {
        if (!res.ok) throw new Error('bad');
        const data = await res.json();
        setMachines(normalizeMachines(data));
      })
      .catch(() => setMachines([]));
    void loadDots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadDots() {
    setListLoading(true);
    try {
      const res = await fetch('/api/dot-san-xuat?limit=200');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDots(Array.isArray((data as { dots?: unknown }).dots) ? ((data as { dots: DotSanXuatRow[] }).dots) : []);
    } catch {
      /* ignore */
    } finally {
      setListLoading(false);
    }
  }

  /** Lấy số đợt tiếp theo trong tháng của máy (chỉ khi bấm nút Gợi ý). */
  async function suggestDotSo() {
    const { thang, nam } = monthYearOf(denNgay);
    try {
      const sug = await fetch(`/api/dot-san-xuat/next-so?thang=${thang}&nam=${nam}&ma_may=${encodeURIComponent(maMay)}`);
      const sugData = (await sug.json().catch(() => ({}))) as { dot_so?: number; ten_dot?: string };
      if (sug.ok && sugData.dot_so) {
        setDotSo(sugData.dot_so);
        setTenDot(sugData.ten_dot || `Đợt ${sugData.dot_so} tháng ${thang}/${nam}`);
      }
    } catch {
      /* ignore */
    }
  }

  async function handlePreview() {
    if (!parseDateStr(tuNgay) || !parseDateStr(denNgay)) {
      setPreviewError('Vui lòng chọn Từ ngày và Đến ngày hợp lệ.');
      return;
    }
    if (tuNgay > denNgay) {
      setPreviewError('Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.');
      return;
    }
    if (!maMay) {
      setPreviewError('Vui lòng chọn máy.');
      return;
    }
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await fetch(
        `/api/dot-san-xuat/preview?tu_ngay=${encodeURIComponent(tuNgay)}&den_ngay=${encodeURIComponent(denNgay)}&ma_may=${encodeURIComponent(maMay)}&ten_may=${encodeURIComponent(tenMay)}`
      );
      const data = (await res.json().catch(() => ({}))) as DotSanXuatPreview & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Không truy xuất được dữ liệu đợt.');
      setPreview(data);
      setTongTlChinh(String(data.tong.tong_tl_nvl_chinh));
      setTongTienChinh(String(data.tong.tong_tien_nvl_chinh));
      setTongTlPhu(String(data.tong.tong_tl_nvl_phu));
      setTongTienPhu(String(data.tong.tong_tien_nvl_phu));
      if (data.lenh_sx.length === 0 && data.phieu_xuat.length === 0) {
        setPreviewError('Không có lệnh SX và phiếu xuất NVL nào trong khoảng ngày này.');
      }
      // Số đợt + tên đợt do người dùng tự điền (không tự gợi ý sau truy xuất).
    } catch (err: unknown) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : 'Không truy xuất được dữ liệu đợt.');
    } finally {
      setPreviewLoading(false);
    }
  }

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
    const donGiaChuaHaoHut = donGiaChinh + (tlThucTe > 0 ? tienPhu / tlThucTe : 0);
    // Lưu ý: đơn giá phụ & chưa hao hụt dùng TL thực tế làm mẫu số (theo mẫu Excel đợt 4 T8/2026).
    // Ba dòng tổng hợp cho phép nhập tay: trống = tự tính; nhập = dùng số tay (số sau kéo theo số trước nếu số trước để trống).
    const donGiaTongManual = donGiaTongOverride.trim() === '' ? null : toNum(donGiaTongOverride);
    const donGiaTong = donGiaTongManual ?? (donGiaChinhThucTe + donGiaPhu);
    const chenhLechManual = chenhLechOverride.trim() === '' ? null : toNum(chenhLechOverride);
    const chenhLech = chenhLechManual ?? (donGiaTong - donGiaChuaHaoHut);
    const tiLeManual = tiLeOverride.trim() === '' ? null : toNum(tiLeOverride);
    const tiLe = tiLeManual ?? (donGiaChuaHaoHut !== 0 ? (chenhLech / donGiaChuaHaoHut) * 100 : 0);
    const donGiaThuHoi = thuTl > 0 ? thuTien / thuTl : 0;
    const tongPhiNhanCong = toNum(tongChiPhiNhanCong);
    const donGiaNhanCong = tlThucTe > 0 ? tongPhiNhanCong / tlThucTe : 0;
    const bqVatTuNhanCong = donGiaTong + donGiaNhanCong;
    const prev = preview?.dot_truoc as Record<string, unknown> | null;
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
      tongPhiNhanCong, donGiaNhanCong, bqVatTuNhanCong,
      prevDonGiaChinh, prevDonGiaPhu, prevDonGiaChinhThucTe, prevDonGiaTong,
      prevDonGiaNhanCong, prevChuaHaoHut,
      prevTen: String(prev?.ten_dot ?? '')
    };
  }, [tongTlChinh, tongTienChinh, tongTlPhu, tongTienPhu, thuHoiTl, thuHoiTien, haoHutKg, tlThucTeOverride, donGiaTongOverride, chenhLechOverride, tiLeOverride, tongChiPhiNhanCong, preview]);

  function fillFromRow(row: DotSanXuatRow) {
    setEditingId(row.id);
    setTenDot(row.ten_dot);
    setDotSo(Number(row.dot_so) || 1);
    setTuNgay(String(row.tu_ngay).slice(0, 10));
    setDenNgay(String(row.den_ngay).slice(0, 10));
    setMaMay(String(row.ma_may || ''));
    setPreview(null);
    setTongTlChinh(String(row.tong_tl_nvl_chinh ?? 0));
    setTongTienChinh(String(row.tong_tien_nvl_chinh ?? 0));
    setTongTlPhu(String(row.tong_tl_nvl_phu ?? 0));
    setTongTienPhu(String(row.tong_tien_nvl_phu ?? 0));
    setThuHoiTl(String(row.thu_hoi_phe_tl ?? 0));
    setThuHoiTien(String(row.thu_hoi_phe_tien ?? 0));
    setHaoHutKg(String(row.hao_hut_kg ?? 0));
    setTlThucTeOverride(
      row.tl_chinh_thuc_te_override !== null && row.tl_chinh_thuc_te_override !== undefined
        ? String(row.tl_chinh_thuc_te_override)
        : ''
    );
    setDonGiaTongOverride(
      row.gia_vt_tt_hao_hut !== null && row.gia_vt_tt_hao_hut !== undefined
        ? String(row.gia_vt_tt_hao_hut)
        : ''
    );
    setChenhLechOverride(
      row.chenh_lech_hao_hut !== null && row.chenh_lech_hao_hut !== undefined
        ? String(row.chenh_lech_hao_hut)
        : ''
    );
    setTiLeOverride(
      row.ti_le_hao_hut !== null && row.ti_le_hao_hut !== undefined ? String(row.ti_le_hao_hut) : ''
    );
    setSoCongTruc(String(row.so_cong_truc ?? 0));
    setSoCongDauMay(String(row.so_cong_dau_may ?? 0));
    setSoCongCuoiMay(String(row.so_cong_cuoi_may ?? 0));
    setTongChiPhiNhanCong(String(row.tong_chi_phi_nhan_cong ?? 0));
    setGhiChu(String(row.ghi_chu || ''));
    setView('form');
    window.scrollTo({ top: 0 });
  }

  function resetForm() {
    setEditingId(null);
    setPreview(null);
    setThuHoiTl('0');
    setThuHoiTien('0');
    setHaoHutKg('0');
    setTlThucTeOverride('');
    setDonGiaTongOverride('');
    setChenhLechOverride('');
    setTiLeOverride('');
    setSoCongTruc('0');
    setSoCongDauMay('0');
    setSoCongCuoiMay('0');
    setTongChiPhiNhanCong('0');
    setGhiChu('');
    setSaveMsg('');
  }

  function parseSnapshotLenh(value: unknown): { ma_lenh_sx: string; ngay_bat_dau?: string }[] {
    const raw = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
    if (!Array.isArray(raw)) return [];
    const list: { ma_lenh_sx: string; ngay_bat_dau?: string }[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const ma = String(record.ma_lenh_sx ?? record.code ?? '').trim();
      if (!ma) continue;
      const ngay = String(record.ngay_bat_dau ?? record.startDate ?? '').slice(0, 10);
      list.push(ngay ? { ma_lenh_sx: ma, ngay_bat_dau: ngay } : { ma_lenh_sx: ma });
    }
    return list;
  }

  function parseSnapshotCodes(value: unknown): string[] {
    const raw = typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : value;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map(item => String(item ?? '').trim()).filter(Boolean))];
  }

  /** Bản xem trước từ form đang lập (dùng số liệu trên màn hình). */
  function buildPrintDataFromForm(): DotSanXuatPrintData | null {
    if (!preview) return null;
    const { thang, nam } = monthYearOf(denNgay);
    const prev = preview.dot_truoc as Record<string, unknown> | null;
    return {
      ten_dot: tenDot.trim() || `Đợt ${dotSo} tháng ${thang}/${nam}`,
      tu_ngay: tuNgay,
      den_ngay: denNgay,
      ma_may: maMay,
      ten_may: tenMay,
      lenh_sx: preview.lenh_sx.map(l => ({ ma_lenh_sx: l.ma_lenh_sx, ngay_bat_dau: String(l.ngay_bat_dau || '').slice(0, 10) || undefined })),
      phieu_xuat_codes: preview.phieu_xuat.map(p => p.ma_phieu),
      tong_tl_nvl_chinh: toNum(tongTlChinh),
      tong_tien_nvl_chinh: Math.round(toNum(tongTienChinh)),
      tong_tl_nvl_phu: toNum(tongTlPhu),
      tong_tien_nvl_phu: Math.round(toNum(tongTienPhu)),
      thu_hoi_phe_tl: toNum(thuHoiTl),
      thu_hoi_phe_tien: Math.round(toNum(thuHoiTien)),
      hao_hut_kg: toNum(haoHutKg),
      tl_chinh_thuc_te_override: tlThucTeOverride.trim() === '' ? null : toNum(tlThucTeOverride),
      gia_vt_tt_hao_hut: donGiaTongOverride.trim() === '' ? null : toNum(donGiaTongOverride),
      chenh_lech_hao_hut: chenhLechOverride.trim() === '' ? null : toNum(chenhLechOverride),
      ti_le_hao_hut: tiLeOverride.trim() === '' ? null : toNum(tiLeOverride),
      so_cong_truc: toNum(soCongTruc),
      so_cong_dau_may: toNum(soCongDauMay),
      so_cong_cuoi_may: toNum(soCongCuoiMay),
      tong_chi_phi_nhan_cong: Math.round(toNum(tongChiPhiNhanCong)),
      ghi_chu: ghiChu.trim(),
      prev_ten_dot: prev ? String(prev.ten_dot ?? '') : undefined,
      prev_don_gia_chinh: derived.prevDonGiaChinh || undefined,
      prev_don_gia_phu: derived.prevDonGiaPhu || undefined,
      prev_don_gia_chinh_thuc_te: derived.prevDonGiaChinhThucTe || undefined,
      prev_don_gia_tong: derived.prevDonGiaTong || undefined,
      prev_don_gia_nhan_cong: derived.prevDonGiaNhanCong || undefined
    };
  }

  /** Bản xem trước từ một đợt đã lưu (không cần truy xuất lại). */
  function buildPrintDataFromRow(row: DotSanXuatRow): DotSanXuatPrintData {
    const overrideRaw = row.tl_chinh_thuc_te_override;
    const numOrNull = (v: unknown) => {
      if (v === null || v === undefined || String(v).trim() === '') return null;
      const n = Number(String(v).replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    return {
      ten_dot: row.ten_dot,
      tu_ngay: String(row.tu_ngay).slice(0, 10),
      den_ngay: String(row.den_ngay).slice(0, 10),
      ma_may: String(row.ma_may || ''),
      ten_may: String(row.ten_may || row.ma_may || ''),
      lenh_sx: parseSnapshotLenh(row.lenh_sx_snapshot),
      phieu_xuat_codes: parseSnapshotCodes(row.phieu_xuat_codes),
      tong_tl_nvl_chinh: toNum(row.tong_tl_nvl_chinh),
      tong_tien_nvl_chinh: Math.round(toNum(row.tong_tien_nvl_chinh)),
      tong_tl_nvl_phu: toNum(row.tong_tl_nvl_phu),
      tong_tien_nvl_phu: Math.round(toNum(row.tong_tien_nvl_phu)),
      thu_hoi_phe_tl: toNum(row.thu_hoi_phe_tl),
      thu_hoi_phe_tien: Math.round(toNum(row.thu_hoi_phe_tien)),
      hao_hut_kg: toNum(row.hao_hut_kg),
      tl_chinh_thuc_te_override:
        overrideRaw === null || overrideRaw === undefined || String(overrideRaw).trim() === ''
          ? null
          : toNum(overrideRaw),
      gia_vt_tt_hao_hut: numOrNull(row.gia_vt_tt_hao_hut),
      chenh_lech_hao_hut: numOrNull(row.chenh_lech_hao_hut),
      ti_le_hao_hut: numOrNull(row.ti_le_hao_hut),
      so_cong_truc: toNum(row.so_cong_truc),
      so_cong_dau_may: toNum(row.so_cong_dau_may),
      so_cong_cuoi_may: toNum(row.so_cong_cuoi_may),
      tong_chi_phi_nhan_cong: Math.round(toNum(row.tong_chi_phi_nhan_cong)),
      ghi_chu: String(row.ghi_chu || '')
    };
  }

  function openPrintPreview(data: DotSanXuatPrintData | null) {
    if (!data) return;
    setPrintData(data);
    setPrintOpen(true);
  }

  async function handleSave() {
    if (!tabAccess.canCreate && !editingId) {
      setSaveMsg('Tài khoản chưa được cấp quyền tạo đợt sản xuất.');
      return;
    }
    if (editingId && !tabAccess.canEdit) {
      setSaveMsg('Tài khoản chưa được cấp quyền sửa đợt sản xuất.');
      return;
    }
    if (!parseDateStr(tuNgay) || !parseDateStr(denNgay) || !maMay) {
      setSaveMsg('Vui lòng chọn Từ ngày, Đến ngày và Máy.');
      return;
    }
    const { thang, nam } = monthYearOf(denNgay);
    const lenhSelected = preview?.lenh_sx || [];
    const payload = {
      ten_dot: tenDot.trim() || `Đợt ${dotSo} tháng ${thang}/${nam}`,
      dot_so: dotSo,
      thang,
      nam,
      tu_ngay: tuNgay,
      den_ngay: denNgay,
      ma_may: maMay,
      ten_may: tenMay,
      lenh_sx_ids: lenhSelected.map(l => l.id),
      lenh_sx_snapshot: lenhSelected,
      phieu_xuat_codes: (preview?.phieu_xuat || []).map(p => p.ma_phieu),
      tong_tl_nvl_chinh: toNum(tongTlChinh),
      tong_tien_nvl_chinh: Math.round(toNum(tongTienChinh)),
      tong_tl_nvl_phu: toNum(tongTlPhu),
      tong_tien_nvl_phu: Math.round(toNum(tongTienPhu)),
      thu_hoi_phe_tl: toNum(thuHoiTl),
      thu_hoi_phe_tien: Math.round(toNum(thuHoiTien)),
      hao_hut_kg: toNum(haoHutKg),
      tl_chinh_thuc_te_override: tlThucTeOverride.trim() === '' ? null : toNum(tlThucTeOverride),
      gia_vt_tt_hao_hut: donGiaTongOverride.trim() === '' ? null : toNum(donGiaTongOverride),
      chenh_lech_hao_hut: chenhLechOverride.trim() === '' ? null : toNum(chenhLechOverride),
      ti_le_hao_hut: tiLeOverride.trim() === '' ? null : toNum(tiLeOverride),
      so_cong_truc: toNum(soCongTruc),
      so_cong_dau_may: toNum(soCongDauMay),
      so_cong_cuoi_may: toNum(soCongCuoiMay),
      tong_chi_phi_nhan_cong: Math.round(toNum(tongChiPhiNhanCong)),
      ghi_chu: ghiChu.trim(),
      nguoi_lap: ''
    };
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(editingId ? `/api/dot-san-xuat/${editingId}` : '/api/dot-san-xuat', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as { error?: string }).error || 'Lưu đợt thất bại.'));
      setSaveMsg(editingId ? 'Đã cập nhật đợt sản xuất.' : 'Đã lưu đợt sản xuất.');
      await loadDots();
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Lưu đợt thất bại.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!tabAccess.canDelete) {
      setSaveMsg('Tài khoản chưa được cấp quyền xóa đợt sản xuất.');
      return;
    }
    if (!window.confirm('Xóa đợt sản xuất này?')) return;
    try {
      const res = await fetch(`/api/dot-san-xuat/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String((data as { error?: string }).error || 'Xóa thất bại.'));
      await loadDots();
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Xóa thất bại.');
    }
  }

  const inputCls =
    'h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100';
  const labelCls = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500';
  const cellEditCls =
    'h-8 w-full min-w-[90px] rounded-md border border-amber-300 bg-amber-50 px-1.5 text-right text-[12.5px] font-bold tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200';

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <BackButton onClick={onBack} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">Đợt sản xuất</h2>
          <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
            Chọn Từ ngày → Đến ngày → Máy để truy xuất lệnh SX và phiếu xuất kho NVL đúng phạm vi đó,
            tính tổng vật tư chính/phụ. Khoản nào không suy luận được thì sửa trực tiếp trong bảng xem trước.
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setView('form')}
            className={`h-9 rounded-lg px-3 text-[12px] font-bold ${view === 'form' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            Lập đợt
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`h-9 rounded-lg px-3 text-[12px] font-bold ${view === 'list' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            Đã lưu ({dots.length})
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">Các đợt đã lưu</span>
            <button
              type="button"
              onClick={() => void loadDots()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tải lại
            </button>
          </div>
          {listLoading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-[13px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
            </div>
          ) : dots.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-slate-500">Chưa có đợt nào. Sang tab Lập đợt để tạo.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-[12.5px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Đợt</th>
                    <th className="px-3 py-2">Máy</th>
                    <th className="px-3 py-2">Từ → Đến</th>
                    <th className="px-3 py-2 text-right">TL chính (kg)</th>
                    <th className="px-3 py-2 text-right">Tiền chính</th>
                    <th className="px-3 py-2 text-right">TL phụ (kg)</th>
                    <th className="px-3 py-2 text-right">Tiền phụ</th>
                    <th className="px-3 py-2 text-right">Đơn giá tổng</th>
                    <th className="px-3 py-2 text-right">Chênh lệch</th>
                    <th className="px-3 py-2 text-right">Tỉ lệ (%)</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {dots.map(row => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-bold text-slate-900">{row.ten_dot}</td>
                      <td className="px-3 py-2">{row.ten_may || row.ma_may}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateVN(String(row.tu_ngay).slice(0, 10))} → {formatDateVN(String(row.den_ngay).slice(0, 10))}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(Number(row.tong_tl_nvl_chinh) || 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(Math.round(Number(row.tong_tien_nvl_chinh) || 0))}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(Number(row.tong_tl_nvl_phu) || 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(Math.round(Number(row.tong_tien_nvl_phu) || 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.gia_vt_tt_hao_hut != null ? safeFixed(Number(row.gia_vt_tt_hao_hut)) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.chenh_lech_hao_hut != null ? safeFixed(Number(row.chenh_lech_hao_hut), 0) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.ti_le_hao_hut != null ? `${safeFixed(Number(row.ti_le_hao_hut))}%` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openPrintPreview(buildPrintDataFromRow(row))}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-emerald-600"
                            title="Xem trước bản in"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => fillFromRow(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-brand-600"
                            title="Sửa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(row.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            title="Xóa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className={labelCls}>Từ ngày</span>
                <VnCalendarPicker value={tuNgay} onChange={setTuNgay} />
              </div>
              <div>
                <span className={labelCls}>Đến ngày</span>
                <VnCalendarPicker value={denNgay} onChange={setDenNgay} />
              </div>
              <div>
                <span className={labelCls}>Máy</span>
                <SearchableSelect
                  value={maMay}
                  onChange={setMaMay}
                  options={machineOptions}
                  placeholder="Chọn máy"
                  getLabel={(item: unknown) => String((item as { label?: unknown }).label ?? '')}
                  getValue={(item: unknown) => String((item as { value?: unknown }).value ?? '')}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => void handlePreview()}
                  disabled={previewLoading}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Truy xuất lệnh + phiếu xuất
                </button>
              </div>
            </div>
            {previewError ? <p className="mt-2 text-[12.5px] font-semibold text-rose-600">{previewError}</p> : null}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <span className={labelCls}>Tên đợt (tự điền, vd Đợt 1 tháng 9/2026)</span>
                <input value={tenDot} onChange={e => setTenDot(e.target.value)} className={inputCls} placeholder="Đợt 4 tháng 8/2026" />
              </div>
              <div>
                <span className={labelCls}>Số đợt (tự điền)</span>
                <span className="flex gap-1.5">
                  <input
                    value={String(dotSo)}
                    onChange={e => {
                      const n = Math.max(1, Math.round(Number(e.target.value) || 1));
                      setDotSo(n);
                    }}
                    inputMode="numeric"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => void suggestDotSo()}
                    title="Lấy số đợt tiếp theo trong tháng của máy này"
                    className="h-10 shrink-0 rounded-lg border border-slate-200 px-2.5 text-[12px] font-bold text-slate-500 hover:bg-slate-50"
                  >
                    Gợi ý
                  </button>
                </span>
              </div>
              <div>
                <span className={labelCls}>Khoảng đã chọn</span>
                <div className="flex h-10 items-center rounded-lg bg-slate-50 px-2.5 text-[12.5px] font-bold text-slate-700 ring-1 ring-slate-200">
                  {formatDateVN(tuNgay)} → {formatDateVN(denNgay)} · {tenMay || maMay || '—'}
                </div>
              </div>
            </div>
          </div>

          {preview ? (
            <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="border-b border-slate-100 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                    Lệnh sản xuất theo ngày và máy ({preview.lenh_sx.length})
                  </div>
                  <div className="max-h-[260px] overflow-auto">
                    {preview.lenh_sx.length === 0 ? (
                      <p className="px-4 py-4 text-[12.5px] text-slate-500">Không có lệnh SX nào theo ngày và máy này.</p>
                    ) : (
                      <table className="w-full text-[12.5px]">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr className="text-left text-[11px] uppercase text-slate-500">
                            <th className="px-3 py-2">Mã lệnh</th>
                            <th className="px-3 py-2">Ngày BĐ</th>
                            <th className="px-3 py-2">Máy</th>
                            <th className="px-3 py-2">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.lenh_sx.map(l => (
                            <tr key={l.id} className="border-t border-slate-100">
                              <td className="px-3 py-1.5 font-bold">{l.ma_lenh_sx || '-'}</td>
                              <td className="px-3 py-1.5">{formatDateVN(String(l.ngay_bat_dau || '').slice(0, 10))}</td>
                              <td className="px-3 py-1.5 text-slate-500">{l.may || '-'}</td>
                              <td className="px-3 py-1.5">
                                <span className="text-slate-600">{l.trang_thai || '-'}</span>
                                {l.co_so_tron ? (
                                  <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">có SX thực tế</span>
                                ) : (
                                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">chưa có sổ trộn</span>
                                )}
                                {l.hoan_thanh ? null : (
                                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">chưa hoàn thành</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="border-b border-slate-100 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                    Phiếu xuất NVL trong khoảng ({preview.phieu_xuat.length})
                  </div>
                  <div className="max-h-[260px] overflow-auto">
                    {preview.phieu_xuat.length === 0 ? (
                      <p className="px-4 py-4 text-[12.5px] text-slate-500">
                        Không có phiếu xuất kho NVL nào theo ngày và máy này.
                      </p>
                    ) : (
                      <table className="w-full min-w-[560px] text-[12px]">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr className="text-[11px] uppercase text-slate-500">
                            <th className="px-2 py-2 text-left">Mã phiếu</th>
                            <th className="px-2 py-2 text-right">TL chính (kg)</th>
                            <th className="px-2 py-2 text-right">Tiền chính</th>
                            <th className="px-2 py-2 text-right">TL phụ (kg)</th>
                            <th className="px-2 py-2 text-right">Tiền phụ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.phieu_xuat.map(p => (
                            <tr key={p.ma_phieu} className="border-t border-slate-100">
                              <td className="px-2 py-1.5">
                                <span className="font-bold">{p.ma_phieu}</span>
                                <span className="block text-[11px] text-slate-400">{formatDateVN(String(p.ngay_phieu).slice(0, 10))} · {p.so_dong} dòng</span>
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(p.tong_tl_chinh)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(Math.round(p.tong_tien_chinh))}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(p.tong_tl_phu)}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(Math.round(p.tong_tien_phu))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {(() => {
                const hasPhieu = preview.phieu_xuat.length > 0;
                const hasLenh = preview.lenh_sx.length > 0;
                const anyHoanThanh = preview.lenh_sx.some(l => l.hoan_thanh);
                const anySoTron = preview.lenh_sx.some(l => l.co_so_tron);
                if (!hasPhieu || (hasLenh && anyHoanThanh && anySoTron)) return null;
                const reasons: string[] = [];
                if (!hasLenh) reasons.push(`có ${preview.phieu_xuat.length} phiếu xuất NVL nhưng không có lệnh SX nào trong phạm vi`);
                else {
                  if (!anyHoanThanh) reasons.push('chưa có lệnh nào chuyển Hoàn thành');
                  if (!anySoTron) reasons.push('chưa có sổ trộn (SX thực tế) nào trong phạm vi');
                }
                return (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] font-semibold leading-relaxed text-amber-800">
                    Lưu ý đối chiếu: {reasons.join(' · ')}. Tổng vật tư vẫn tính đúng từ phiếu xuất kho;
                    hãy kiểm tra trạng thái lệnh và sổ trộn trước khi chốt đợt.
                  </div>
                );
              })()}

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card">
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Tổng vật tư truy xuất (tự động — sửa tay nếu phiếu chưa có tổng chuẩn)
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div>
                    <span className={labelCls}>Tổng TL NVL chính (kg)</span>
                    <input value={tongTlChinh} onChange={e => setTongTlChinh(e.target.value)} inputMode="decimal" className={inputCls} />
                  </div>
                  <div>
                    <span className={labelCls}>Tổng tiền NVL chính (VND)</span>
                    <input value={tongTienChinh} onChange={e => setTongTienChinh(e.target.value)} inputMode="numeric" className={inputCls} />
                  </div>
                  <div>
                    <span className={labelCls}>Tổng TL NVL phụ (kg)</span>
                    <input value={tongTlPhu} onChange={e => setTongTlPhu(e.target.value)} inputMode="decimal" className={inputCls} />
                  </div>
                  <div>
                    <span className={labelCls}>Tổng tiền NVL phụ (VND)</span>
                    <input value={tongTienPhu} onChange={e => setTongTienPhu(e.target.value)} inputMode="numeric" className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card">
                <span className={labelCls}>Ghi chú đợt (vd máy chạy ổn định, không phát sinh sự cố) — sửa trực tiếp, hiện trên bản in</span>
                <textarea value={ghiChu} onChange={e => setGhiChu(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                <div className="bg-[#1d4ed8] px-4 py-2.5 text-[13px] font-black uppercase tracking-wide text-white">
                  ĐẶC - Kết quả định giá vật tư - nhân công thực tế sản xuất {tenDot || `đợt ${dotSo}`}
                  {derived.prevTen ? <span className="ml-2 font-semibold normal-case opacity-80">(so với {derived.prevTen})</span> : null}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-[12.5px]">
                    <thead>
                      <tr className="bg-[#1d4ed8] text-white">
                        <th className="px-2 py-2 text-center">TT</th>
                        <th className="px-3 py-2 text-left">Diễn giải</th>
                        <th className="px-3 py-2 text-right">Trọng lượng (kg)</th>
                        <th className="px-3 py-2 text-right">Giá trị vật tư (VND)</th>
                        <th className="px-3 py-2 text-right">VND/kg đợt này</th>
                        <th className="px-3 py-2 text-right">VND/kg đợt trước</th>
                        <th className="px-3 py-2 text-right">Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-200">
                        <td className="px-2 py-2 text-center">1</td>
                        <td className="px-3 py-2">Tổng vật tư chính xuất vào sản xuất</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(derived.tlChinh)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(Math.round(derived.tienChinh))}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#b91c1c]">{safeFixed(derived.donGiaChinh, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{derived.prevDonGiaChinh ? safeFixed(derived.prevDonGiaChinh, 0) : '-'}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#1d4ed8]">{derived.prevDonGiaChinh ? safeFixed(derived.donGiaChinh - derived.prevDonGiaChinh, 0) : '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-2 py-2 text-center">2</td>
                        <td className="px-3 py-2">Tổng vật tư phụ xuất vào sản xuất</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(derived.tlPhu)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(Math.round(derived.tienPhu))}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#b91c1c]">{safeFixed(derived.donGiaPhu)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{derived.prevDonGiaPhu ? safeFixed(derived.prevDonGiaPhu) : '-'}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#1d4ed8]">{derived.prevDonGiaPhu ? safeFixed(derived.donGiaPhu - derived.prevDonGiaPhu, 0) : '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200 bg-amber-50/70">
                        <td className="px-2 py-2 text-center">3</td>
                        <td className="px-3 py-2 font-semibold">Giá vật tư kg chưa có hao hụt vật tư sản xuất như phế sản xuất, hao hụt không tên, phế bắt buộc</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#b91c1c]">{safeFixed(derived.donGiaChuaHaoHut)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{derived.prevChuaHaoHut ? safeFixed(derived.prevChuaHaoHut) : '-'}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#1d4ed8]">{derived.prevChuaHaoHut ? safeFixed(derived.donGiaChuaHaoHut - derived.prevChuaHaoHut, 0) : '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-2 py-2 text-center">4</td>
                        <td className="px-3 py-2">Trừ giá trị vật tư thu hồi cho phế bắt buộc & phế sản xuất <span className="text-[11px] text-slate-400">(sửa trực tiếp)</span></td>
                        <td className="px-3 py-2"><input value={thuHoiTl} onChange={e => setThuHoiTl(e.target.value)} inputMode="decimal" className={cellEditCls} /></td>
                        <td className="px-3 py-2"><input value={thuHoiTien} onChange={e => setThuHoiTien(e.target.value)} inputMode="numeric" className={cellEditCls} /></td>
                        <td className="px-3 py-2 text-right tabular-nums">{derived.thuTl > 0 ? safeFixed(derived.donGiaThuHoi, 0) : '-'}</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-2 py-2 text-center">5</td>
                        <td className="px-3 py-2">Hao hụt <span className="text-[11px] text-slate-400">(sửa trực tiếp)</span></td>
                        <td className="px-3 py-2"><input value={haoHutKg} onChange={e => setHaoHutKg(e.target.value)} inputMode="decimal" className={cellEditCls} /></td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-2 py-2 text-center">6</td>
                        <td className="px-3 py-2 font-semibold">Giá vật tư chính thực tế sau sản xuất có màng</td>
                        <td className="px-3 py-2">
                          <input value={tlThucTeOverride} onChange={e => setTlThucTeOverride(e.target.value)} inputMode="decimal" className={cellEditCls} placeholder={formatNumber(derived.tlThucTe)} title="Để trống = tự tính (chính − thu hồi − hao hụt)" />
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{formatMoney(Math.round(derived.tienThucTe))}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#b91c1c]">{safeFixed(derived.donGiaChinhThucTe)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{derived.prevDonGiaChinhThucTe ? safeFixed(derived.prevDonGiaChinhThucTe) : '-'}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#1d4ed8]">{derived.prevDonGiaChinhThucTe ? safeFixed(derived.donGiaChinhThucTe - derived.prevDonGiaChinhThucTe, 0) : '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-2 py-2 text-center">7</td>
                        <td className="px-3 py-2">Giá vật tư thực tế sau sản xuất có hao hụt vật tư sản xuất như phế sản xuất, hao hụt không tên, phế bắt buộc <span className="text-[11px] text-slate-400">(sửa trực tiếp)</span></td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2"><input value={donGiaTongOverride} onChange={e => setDonGiaTongOverride(e.target.value)} inputMode="decimal" className={cellEditCls} placeholder={safeFixed(derived.donGiaChinhThucTe + derived.donGiaPhu)} title="Để trống = tự tính (chính thực tế + phụ)" /></td>
                        <td className="px-3 py-2 text-right tabular-nums">{derived.prevDonGiaTong ? safeFixed(derived.prevDonGiaTong) : '-'}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#1d4ed8]">{derived.prevDonGiaTong ? safeFixed(derived.donGiaTong - derived.prevDonGiaTong, 0) : '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200 bg-[#1d4ed8] font-bold text-white">
                        <td className="px-2 py-2 text-center">8</td>
                        <td className="px-3 py-2">Chênh lệch trước và sau hao hụt <span className="text-[11px] opacity-70">(sửa trực tiếp)</span></td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2"><input value={chenhLechOverride} onChange={e => setChenhLechOverride(e.target.value)} inputMode="decimal" className="h-8 w-full min-w-[90px] rounded-md border border-white/40 bg-white/10 px-1.5 text-right text-[12.5px] font-bold tabular-nums text-white outline-none placeholder:text-white/50 focus:border-white focus:ring-1 focus:ring-white/40" placeholder={safeFixed(derived.donGiaTong - derived.donGiaChuaHaoHut, 0)} title="Để trống = tự tính (tổng − chưa hao hụt)" /></td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                      </tr>
                      <tr className="bg-[#1d4ed8] font-bold text-white">
                        <td className="px-2 py-2 text-center">9</td>
                        <td className="px-3 py-2">Tỉ lệ chênh lệch trước và sau hao hụt <span className="text-[11px] opacity-70">(sửa trực tiếp)</span></td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1">
                            <input value={tiLeOverride} onChange={e => setTiLeOverride(e.target.value)} inputMode="decimal" className="h-8 w-full min-w-[70px] rounded-md border border-white/40 bg-white/10 px-1.5 text-right text-[12.5px] font-bold tabular-nums text-white outline-none placeholder:text-white/50 focus:border-white focus:ring-1 focus:ring-white/40" placeholder={safeFixed(derived.donGiaChuaHaoHut !== 0 ? (derived.donGiaTong - derived.donGiaChuaHaoHut) / derived.donGiaChuaHaoHut * 100 : 0)} title="Để trống = tự tính (%)" />
                            <span>%</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">-</td>
                        <td className="px-3 py-2 text-right">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 bg-emerald-50/60 px-4 py-2.5 text-[12.5px] font-semibold text-emerald-800">
                  BQ giá vật tư & nhân công {tenDot || `đợt ${dotSo}`} là {safeFixed(derived.bqVatTuNhanCong)} đồng/kg
                  {ghiChu ? ` — ${ghiChu}` : ' — nhập ghi chú nếu máy chạy ổn định/không phát sinh sự cố.'}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                <div className="bg-[#1d4ed8] px-4 py-2.5 text-[13px] font-black uppercase tracking-wide text-white">
                  ĐẶC - Kết quả định giá nhân công thực tế sản xuất {tenDot || `đợt ${dotSo}`}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-[12.5px]">
                    <thead>
                      <tr className="bg-[#1d4ed8] text-white">
                        <th className="px-3 py-2 text-left">Đợt</th>
                        <th className="px-3 py-2 text-left">Số công <span className="font-semibold normal-case opacity-80">(sửa trực tiếp)</span></th>
                        <th className="px-3 py-2 text-right">Số nhân công (số công)</th>
                        <th className="px-3 py-2 text-right">Tổng chi phí nhân công</th>
                        <th className="px-3 py-2 text-right">Đơn giá nhân công/kg đợt này</th>
                        <th className="px-3 py-2 text-right">Đơn giá nhân công/kg đợt trước</th>
                        <th className="px-3 py-2 text-right">Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-200">
                        <td className="px-3 py-2 font-bold" rowSpan={4}>{tenDot || `Đợt ${dotSo}`}</td>
                        <td className="px-3 py-2 text-slate-500">Trực</td>
                        <td className="px-3 py-2"><input value={soCongTruc} onChange={e => setSoCongTruc(e.target.value)} inputMode="decimal" className={cellEditCls} /></td>
                        <td className="px-3 py-2" rowSpan={4}><input value={tongChiPhiNhanCong} onChange={e => setTongChiPhiNhanCong(e.target.value)} inputMode="numeric" className={cellEditCls} /></td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums" rowSpan={4}>{safeFixed(derived.donGiaNhanCong, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums" rowSpan={4}>{derived.prevDonGiaNhanCong ? safeFixed(derived.prevDonGiaNhanCong, 0) : '-'}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-[#1d4ed8]" rowSpan={4}>{derived.prevDonGiaNhanCong ? safeFixed(derived.donGiaNhanCong - derived.prevDonGiaNhanCong, 0) : '-'}</td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-3 py-2 text-slate-500">Đầu máy</td>
                        <td className="px-3 py-2"><input value={soCongDauMay} onChange={e => setSoCongDauMay(e.target.value)} inputMode="decimal" className={cellEditCls} /></td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="px-3 py-2 text-slate-500">Cuối máy</td>
                        <td className="px-3 py-2"><input value={soCongCuoiMay} onChange={e => setSoCongCuoiMay(e.target.value)} inputMode="decimal" className={cellEditCls} /></td>
                      </tr>
                      <tr className="border-t border-slate-200 bg-slate-50 font-bold">
                        <td className="px-3 py-2">Tổng chi phí nhân công</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatNumber(toNum(soCongTruc) + toNum(soCongDauMay) + toNum(soCongCuoiMay))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingId ? 'Cập nhật đợt' : 'Lưu đợt sản xuất'}
                </button>
                <button
                  type="button"
                  onClick={() => openPrintPreview(buildPrintDataFromForm())}
                  disabled={!preview}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" /> Xem trước bản in
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-500 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" /> Lập đợt mới
                  </button>
                ) : null}
                {saveMsg ? <span className="text-[12.5px] font-semibold text-slate-600">{saveMsg}</span> : null}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-[13px] text-slate-500">
              Chọn Từ ngày → Đến ngày → Máy rồi bấm <b>Truy xuất lệnh + phiếu xuất</b> để xem tổng vật tư chính/phụ và lập báo cáo đợt.
            </div>
          )}
        </>
      )}
      <DotSanXuatPrintPreviewModal open={printOpen} data={printData} onClose={() => setPrintOpen(false)} />
    </div>
  );
}

export default DotSanXuatPanel;
