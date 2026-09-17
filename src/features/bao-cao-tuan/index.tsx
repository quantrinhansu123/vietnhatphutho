import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Cpu, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { SoTronDatePicker, formatNgayVN } from '../so-tron/SoTronDatePicker';
import { normalizeHrBranches } from '../_shared/hr';
import {
  buildMachineSelectOptions,
  machineSelectLabel,
  machineSelectValue,
  normalizeMachines,
  type MachineRow
} from '../danh-sach-may';

// =========================================================================
// BIỂU MẪU BÁO CÁO TUẦN (BC01-V3) — UI giống phiếu giấy, chưa tính toán số
// liệu tự động (phần I nhập tay, tính toán để sau).
// =========================================================================

const DRAFT_KEY = 'bao-cao-tuan-draft-v1';

const pad2 = (n: number) => String(n).padStart(2, '0');

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

function parseIsoDay(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Tuần thứ mấy trong tháng của ngày ISO (1–5). */
function weekOfMonth(iso: string): string {
  const p = parseIsoDay(iso);
  if (!p) return '';
  return String(Math.ceil(p.d / 7));
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface BaoCaoTuanMayRow {
  key: string;
  may: string;
  soNgayHoatDong: string;
  soNgayKhongHoatDong: string;
  lyDo: string;
  luuY: string;
}

export interface BaoCaoTuanSuCoRow {
  key: string;
  suCo: string;
  giaiPhap: string;
}

export interface BaoCaoTuanPhoiHopRow {
  key: string;
  matXich: string;
  thuanLoi: string;
  khoKhan: string;
}

export interface BaoCaoTuanDiemRow {
  key: string;
  donVi: string;
  hdcv: string;
  tuanThu5S: string;
  ghiChep: string;
  noiQuy: string;
  hieuSuat: string;
}

export interface BaoCaoTuanDaoTaoRow {
  key: string;
  /** Tên nhân viên được đào tạo (chỉ chọn trong danh sách đang làm) */
  tenNhanVien: string;
  noiDung: string;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultMayRows(): BaoCaoTuanMayRow[] {
  return [0, 1].map(() => ({
    key: uid(),
    may: '',
    soNgayHoatDong: '',
    soNgayKhongHoatDong: '',
    lyDo: '',
    luuY: ''
  }));
}

function defaultDaoTaoRows(): BaoCaoTuanDaoTaoRow[] {
  return [{ key: uid(), tenNhanVien: '', noiDung: '' }];
}

function defaultSuCoRows(): BaoCaoTuanSuCoRow[] {
  return [0, 1, 2, 3].map(() => ({ key: uid(), suCo: '', giaiPhap: '' }));
}

function defaultPhoiHopRows(): BaoCaoTuanPhoiHopRow[] {
  return [
    { matXich: 'Kế hoạch sản xuất', thuanLoi: 'Tốt', khoKhan: 'Không' },
    { matXich: 'Kho vật tư', thuanLoi: 'Tốt', khoKhan: 'Không' },
    { matXich: 'Kho thành phẩm', thuanLoi: 'Tốt', khoKhan: 'Không' },
    { matXich: 'Bộ phận kinh doanh', thuanLoi: 'Tốt', khoKhan: 'Không' }
  ].map(r => ({ key: uid(), ...r }));
}

function defaultDiemRows(): BaoCaoTuanDiemRow[] {
  return [
    { donVi: 'Trộn', hdcv: '9', tuanThu5S: '9', ghiChep: '8,5', noiQuy: '9', hieuSuat: '8,5' },
    { donVi: 'Dầu máy', hdcv: '9', tuanThu5S: '9', ghiChep: '9', noiQuy: '9', hieuSuat: '8,5' },
    { donVi: 'Ra hàng, cuối máy', hdcv: '9', tuanThu5S: '9', ghiChep: '9', noiQuy: '9', hieuSuat: '8,5' }
  ].map(r => ({ key: uid(), ...r }));
}

const cellInputClass =
  'w-full bg-transparent outline-none placeholder:text-slate-300 placeholder:font-normal text-slate-900 focus:bg-amber-50/60 rounded px-1 -mx-1 py-0.5';
const handInputClass =
  'w-full bg-transparent outline-none placeholder:text-slate-300 text-blue-900 italic focus:bg-amber-50/60 rounded px-1 -mx-1 py-0.5';

export function BaoCaoTuanPanel({ onBack }: { onBack?: () => void }) {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);
  /** Tên nhân viên có trạng thái Đang làm (ô chọn ở mục III. Đào tạo). */
  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // ---- Đầu phiếu: tuần + khoảng ngày + máy ----
  const [tuan, setTuan] = useState('');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [thang, setThang] = useState('');
  const [maMay, setMaMay] = useState('');
  const [phanXuong, setPhanXuong] = useState('');
  const [nguoiThucHien, setNguoiThucHien] = useState('');

  // ---- I. Sản lượng, tiến độ ----
  const [tongVatTu, setTongVatTu] = useState('');
  const [thanhPhamMang, setThanhPhamMang] = useState('');
  const [thanhPhamKhongMang, setThanhPhamKhongMang] = useState('');
  const [munCua, setMunCua] = useState('');
  const [soNgaySx, setSoNgaySx] = useState('');
  const [hangHong, setHangHong] = useState('');
  const [pheTron, setPheTron] = useState('');
  const [haoHut, setHaoHut] = useState('');
  const [soCongNhan, setSoCongNhan] = useState('');
  const [tongNgayCong, setTongNgayCong] = useState('');
  const [gioTangCa, setGioTangCa] = useState('');
  const [nxSanLuong, setNxSanLuong] = useState('');
  const [nxHangHong, setNxHangHong] = useState('');
  const [nxNhanSu, setNxNhanSu] = useState('');

  // ---- II → VI ----
  const [mayRows, setMayRows] = useState<BaoCaoTuanMayRow[]>(defaultMayRows);
  const [suCoRows, setSuCoRows] = useState<BaoCaoTuanSuCoRow[]>(defaultSuCoRows);
  const [daoTaoRows, setDaoTaoRows] = useState<BaoCaoTuanDaoTaoRow[]>(defaultDaoTaoRows);
  const [daoTaoTuHoc, setDaoTaoTuHoc] = useState('');
  const [phoiHopRows, setPhoiHopRows] =
    useState<BaoCaoTuanPhoiHopRow[]>(defaultPhoiHopRows);
  const [diemRows, setDiemRows] = useState<BaoCaoTuanDiemRow[]>(defaultDiemRows);
  const [caiTien, setCaiTien] = useState('');
  const [ngayKy, setNgayKy] = useState('');
  const [thangKy, setThangKy] = useState('');
  const [namKy, setNamKy] = useState('');
  const [nguoiKy, setNguoiKy] = useState('');

  const [savedTick, setSavedTick] = useState('');

  // Nạp danh mục máy
  useEffect(() => {
    let alive = true;
    setIsLoadingMaster(true);
    fetch('/api/danh-sach-may')
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        if (!alive) return;
        setMachines(normalizeMachines(data));
      })
      .catch(() => {
        if (alive) setMachines([]);
      })
      .finally(() => {
        if (alive) setIsLoadingMaster(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Nạp danh sách nhân viên đang làm (ô chọn ở mục III. Đào tạo)
  useEffect(() => {
    let alive = true;
    setIsLoadingStaff(true);
    fetch('/api/nhan-su?format=groups&scope=all')
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        if (!alive) return;
        const names = normalizeHrBranches(data).flatMap(b =>
          b.departments.flatMap(d =>
            d.members
              .filter(m => String(m.status || 'Đang làm').trim() === 'Đang làm')
              .map(m => m.name)
          )
        );
        setStaffNames([...new Set(names)].sort((a, b) => a.localeCompare(b, 'vi')));
      })
      .catch(() => {
        if (alive) setStaffNames([]);
      })
      .finally(() => {
        if (alive) setIsLoadingStaff(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Nạp nháp đã lưu cục bộ
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.tuan === 'string') setTuan(d.tuan);
      if (typeof d.tuNgay === 'string') setTuNgay(d.tuNgay);
      if (typeof d.denNgay === 'string') setDenNgay(d.denNgay);
      if (typeof d.thang === 'string') setThang(d.thang);
      if (typeof d.maMay === 'string') setMaMay(d.maMay);
      if (typeof d.phanXuong === 'string') setPhanXuong(d.phanXuong);
      if (typeof d.nguoiThucHien === 'string') setNguoiThucHien(d.nguoiThucHien);
    } catch {
      /* bỏ qua nháp hỏng */
    }
    // Chỉ nạp 1 lần lúc mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chọn Từ ngày → gợi ý Tuần / Tháng / Đến ngày (giữ nguyên nếu đã nhập tay)
  const handleTuNgayChange = (v: string) => {
    setTuNgay(v);
    const p = parseIsoDay(v);
    if (!p) return;
    setTuan(prev => (prev ? prev : weekOfMonth(v)));
    setThang(prev => (prev ? prev : `Tháng ${p.m}`));
    setDenNgay(prev => {
      if (prev) return prev;
      const dt = new Date(p.y, p.m - 1, p.d + 6);
      return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    });
  };

  const machineOptions = useMemo(
    () => buildMachineSelectOptions(machines, maMay),
    [machines, maMay]
  );
  const selectedMachineLabel = useMemo(() => {
    if (!maMay) return '';
    const found = machines.find(m => machineSelectValue(m) === maMay);
    return found ? machineSelectLabel(found) : maMay;
  }, [machines, maMay]);

  /** Ô chọn nhân viên ở mục III — chỉ người đang làm (+ giữ giá trị đã chọn). */
  const staffOptionsFor = (current: string): string[] => {
    const trimmed = current.trim();
    if (trimmed && !staffNames.includes(trimmed)) return [trimmed, ...staffNames];
    return staffNames;
  };

  /** Số CBCNV được đào tạo = số dòng đã chọn tên (tự đếm). */
  const soCbDuocDaoTao = daoTaoRows.filter(r => r.tenNhanVien.trim()).length;

  const tuNgayVN = tuNgay ? formatNgayVN(tuNgay) : '.../.../......';
  const denNgayVN = denNgay ? formatNgayVN(denNgay) : '.../.../......';

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ tuan, tuNgay, denNgay, thang, maMay, phanXuong, nguoiThucHien })
      );
      setSavedTick(`Đã lưu nháp lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    } catch {
      setSavedTick('Không lưu được nháp trên trình duyệt này.');
    }
  };

  const updateMayRow = (key: string, patch: Partial<BaoCaoTuanMayRow>) =>
    setMayRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const updateSuCoRow = (key: string, patch: Partial<BaoCaoTuanSuCoRow>) =>
    setSuCoRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const updateDaoTaoRow = (key: string, patch: Partial<BaoCaoTuanDaoTaoRow>) =>
    setDaoTaoRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const updatePhoiHopRow = (key: string, patch: Partial<BaoCaoTuanPhoiHopRow>) =>
    setPhoiHopRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const updateDiemRow = (key: string, patch: Partial<BaoCaoTuanDiemRow>) =>
    setDiemRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const handlePrint = () => {
    const td = (v: string, extra = '') =>
      `<td style="border:1px solid #111;padding:6px 8px;vertical-align:top;font-size:13px;${extra}">${escapeHtml(v) || '&nbsp;'}</td>`;
    const th = (v: string, extra = '') =>
      `<th style="border:1px solid #111;padding:6px 8px;font-size:13px;background:#f1f5f9;${extra}">${escapeHtml(v)}</th>`;
    const mayHtml = mayRows
      .map(
        r =>
          `<tr>${td(r.may)}${td(r.soNgayHoatDong, 'text-align:center;')}${td(r.soNgayKhongHoatDong, 'text-align:center;')}${td(r.lyDo)}${td(r.luuY)}</tr>`
      )
      .join('');
    const suCoHtml = suCoRows
      .map(r => `<tr>${td(r.suCo)}${td(r.giaiPhap)}</tr>`)
      .join('');
    const daoTaoHtml = daoTaoRows
      .map(r => `<tr>${td(r.tenNhanVien)}${td(r.noiDung)}</tr>`)
      .join('');
    const phoiHopHtml = phoiHopRows
      .map(r => `<tr>${td(r.matXich)}${td(r.thuanLoi)}${td(r.khoKhan)}</tr>`)
      .join('');
    const diemHtml = diemRows
      .map(
        r =>
          `<tr>${td(r.donVi)}${td(r.hdcv, 'text-align:center;')}${td(r.tuanThu5S, 'text-align:center;')}${td(r.ghiChep, 'text-align:center;')}${td(r.noiQuy, 'text-align:center;')}${td(r.hieuSuat, 'text-align:center;')}</tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo tuần ${escapeHtml(tuan)} — ${escapeHtml(selectedMachineLabel || maMay)}</title>
<style>@page{size:A4 portrait;margin:12mm 10mm;}body{font-family:"Times New Roman",Times,serif;color:#111;}h1{font-size:18px;text-align:center;margin:4px 0;}h2{font-size:15px;margin:14px 0 6px;}table{width:100%;border-collapse:collapse;}p{font-size:13px;}</style></head><body>
<p style="display:flex;justify-content:space-between"><strong>CÔNG TY TNHH VIỆT NHẬT PHÚ THỌ</strong><span>Mẫu số: BC01-V3 — Ngày cấp nhật: 27/3/2024</span></p>
<h1>BÁO CÁO ĐÁNH GIÁ SẢN XUẤT TUẦN/THÁNG</h1>
<p style="text-align:center">TUẦN ${escapeHtml(tuan || '...')} TỪ ${escapeHtml(tuNgayVN)} ĐẾN ${escapeHtml(denNgayVN)} ${escapeHtml(thang || '')}</p>
<p>Phân xưởng: ${escapeHtml(phanXuong)} &nbsp;&nbsp; Máy: ${escapeHtml(selectedMachineLabel || maMay)} &nbsp;&nbsp; Người thực hiện: ${escapeHtml(nguoiThucHien)}</p>
<h2>I. SẢN LƯỢNG, TIẾN ĐỘ</h2>
<table><tr>${th('TIÊU CHÍ', 'width:28%')}${th('KẾT QUẢ', 'width:44%')}${th('TỰ NHẬN XÉT HIỆU SUẤT - HIỆU QUẢ', 'width:28%')}</tr>
<tr>${td('1. Tình hình sản xuất trong tháng')}${td(`1. Tổng vật tư sử dụng: ${tongVatTu}\n2. Tổng thành phẩm đạt màng: ${thanhPhamMang}\n3. Tổng thành phẩm không màng: ${thanhPhamKhongMang}\n4. Mùn cưa sử dụng: ${munCua}\n5. Số ngày sản xuất: ${soNgaySx}`, 'white-space:pre-line;')}${td(nxSanLuong)}</tr>
<tr>${td('Hàng hỏng và % lỗi trên sản lượng')}${td(`Hàng hỏng: ${hangHong}\nPhế trộn sản xuất: ${pheTron}\nHao hụt: ${haoHut}`, 'white-space:pre-line;')}${td(nxHangHong)}</tr>
<tr>${td('Số lượng CBCNV tham gia SX')}${td(`Số công nhân sản xuất: ${soCongNhan}\nTổng ngày công trong tháng: ${tongNgayCong}\nSố giờ tăng ca: ${gioTangCa}`, 'white-space:pre-line;')}${td(nxNhanSu)}</tr></table>
<h2>II. QUẢN LÝ MÁY MÓC</h2>
<table><tr>${th('Quản lý máy')}${th('Số ngày hoạt động')}${th('Số ngày không hoạt động')}${th('Lý do không hoạt động')}${th('Lưu ý vận hành / sửa chữa tuần kế tiếp')}</tr>${mayHtml}</table>
<h2>SỰ CỐ PHÁT SINH VÀ GIẢI PHÁP</h2>
<table><tr>${th('Sự cố phát sinh', 'width:50%')}${th('Giải pháp', 'width:50%')}</tr>${suCoHtml}</table>
<h2>III. ĐÀO TẠO (Số CBCNV được đào tạo: ${soCbDuocDaoTao})</h2>
<table><tr>${th('Người được đào tạo', 'width:35%')}${th('Nội dung đào tạo', 'width:65%')}</tr>${daoTaoHtml}</table>
<table><tr>${td('Nội dung tự học của quản lý sản xuất:', 'width:35%;font-weight:bold;')}${td(daoTaoTuHoc, 'width:65%;white-space:pre-line;')}</tr></table>
<h2>IV. PHỐI HỢP VỚI CÁC MẮT XÍCH</h2>
<table><tr>${th('Mắt xích')}${th('Thuận lợi')}${th('Khó khăn')}</tr>${phoiHopHtml}</table>
<h2>V. ĐÁNH GIÁ CHO ĐIỂM CÁC BỘ PHẬN (1→10)</h2>
<table><tr>${th('Tên đơn vị')}${th('Tuân thủ HDCV')}${th('Tuân thủ 5S')}${th('Ghi chép sản xuất')}${th('Nội quy - quy định')}${th('Hiệu suất công việc')}</tr>${diemHtml}</table>
<h2>VI. LƯU Ý CẢI TIẾN TUẦN/THÁNG KẾ TIẾP</h2>
<p style="white-space:pre-line;min-height:80px">${escapeHtml(caiTien) || '&nbsp;'}</p>
<p>Ngày ${escapeHtml(ngayKy || '..')} tháng ${escapeHtml(thangKy || '..')} năm ${escapeHtml(namKy || '....')}</p>
<p>Người thực hiện: Trưởng bộ phận — ${escapeHtml(nguoiKy)}</p>
<script>window.onload=function(){window.print();};</script></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-3">
      {/* Thanh tiêu đề */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          {onBack && <BackButton onClick={onBack} />}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">
              Biểu mẫu Báo cáo tuần
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
              Mẫu BC01-V3 — chọn tuần (từ ngày → đến ngày) và máy, nhập tay các mục I→VI. Số liệu
              tự động sẽ tính sau.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-bold text-slate-600 transition hover:bg-slate-50"
          >
            <Save className="h-4 w-4" /> Lưu nháp
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12.5px] font-bold text-white transition hover:bg-brand-700"
          >
            <Printer className="h-4 w-4" /> In phiếu
          </button>
        </div>
        {savedTick && <p className="mt-1.5 text-[11.5px] font-semibold text-emerald-600">{savedTick}</p>}
      </div>

      {/* Bộ lọc: ngày + máy (lịch popup tiếng Việt, không dùng input date native) */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" /> Từ ngày
            </span>
            <SoTronDatePicker value={tuNgay} onChange={handleTuNgayChange} placeholder="Chọn từ ngày" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" /> Đến ngày
            </span>
            <SoTronDatePicker value={denNgay} onChange={setDenNgay} placeholder="Chọn đến ngày" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
              <Cpu className="h-3.5 w-3.5" /> Máy
            </span>
            <SearchableSelect
              value={maMay}
              onChange={setMaMay}
              options={machineOptions}
              placeholder={isLoadingMaster ? 'Đang tải máy…' : 'Chọn máy'}
              isLoading={isLoadingMaster}
              getLabel={item => machineSelectLabel(item as MachineRow)}
              getValue={item => machineSelectValue(item as MachineRow)}
              allowCustomValue
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                Tuần
              </span>
              <input
                value={tuan}
                onChange={e => setTuan(e.target.value)}
                placeholder="VD: 3"
                inputMode="numeric"
                className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
                Tháng
              </span>
              <input
                value={thang}
                onChange={e => setThang(e.target.value)}
                placeholder="VD: Tháng 9"
                className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
              Phân xưởng
            </span>
            <input
              value={phanXuong}
              onChange={e => setPhanXuong(e.target.value)}
              placeholder="VD: Phân xưởng Sản xuất"
              className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
              Người thực hiện
            </span>
            <input
              value={nguoiThucHien}
              onChange={e => setNguoiThucHien(e.target.value)}
              placeholder="VD: Trưởng bộ phận"
              className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
        </div>
      </div>

      {/* Tờ phiếu giống mẫu giấy BC01-V3 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-card sm:p-5">
        <div
          className="mx-auto min-w-[720px] max-w-[920px] bg-white px-6 py-6 text-slate-900 shadow-md sm:px-9"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          {/* Đầu phiếu */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold uppercase tracking-wide">VIETHATIPT</p>
              <p className="text-[11px] italic text-slate-500">Công ty TNHH Việt Nhật Phú Thọ</p>
            </div>
            <div className="border border-slate-900 px-2.5 py-1 text-right text-[11.5px] leading-tight">
              <p>
                Mẫu số: <strong>BC01-V3</strong>
              </p>
              <p>
                Ngày cấp nhật: <strong>27/3/2024</strong>
              </p>
            </div>
          </div>

          <h1 className="mt-3 text-center text-[19px] font-bold uppercase leading-snug">
            Báo cáo đánh giá sản xuất tuần/tháng
          </h1>
          <p className="mt-1 text-center text-[14px] font-bold uppercase">
            Tuần{' '}
            <input
              value={tuan}
              onChange={e => setTuan(e.target.value)}
              placeholder="..."
              className="inline-block w-10 border-b border-dotted border-slate-400 bg-transparent text-center font-bold text-blue-900 outline-none"
            />{' '}
            từ <span className="text-blue-900">{tuNgayVN}</span> đến{' '}
            <span className="text-blue-900">{denNgayVN}</span>{' '}
            <input
              value={thang}
              onChange={e => setThang(e.target.value)}
              placeholder="Tháng ..."
              className="inline-block w-24 border-b border-dotted border-slate-400 bg-transparent text-center font-bold text-blue-900 outline-none"
            />
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-[13.5px]">
            <p>
              Phân xưởng:{' '}
              <input
                value={phanXuong}
                onChange={e => setPhanXuong(e.target.value)}
                placeholder="................................"
                className={handInputClass}
                style={{ width: 180 }}
              />
            </p>
            <p>
              Máy: <strong className="text-blue-900">{selectedMachineLabel || maMay || '........'}</strong>
            </p>
            <p>
              Người thực hiện:{' '}
              <input
                value={nguoiThucHien}
                onChange={e => setNguoiThucHien(e.target.value)}
                placeholder="................................"
                className={handInputClass}
                style={{ width: 180 }}
              />
            </p>
          </div>

          {/* I. SẢN LƯỢNG, TIẾN ĐỘ */}
          <h2 className="mb-1.5 mt-4 text-[14.5px] font-bold uppercase">I. Sản lượng, tiến độ</h2>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-[26%] border border-slate-900 px-2 py-1.5 font-bold uppercase">
                  Tiêu chí
                </th>
                <th className="w-[46%] border border-slate-900 px-2 py-1.5 font-bold uppercase">
                  Kết quả
                </th>
                <th className="border border-slate-900 px-2 py-1.5 font-bold uppercase">
                  Tự nhận xét hiệu suất - hiệu quả
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-900 px-2 py-1.5 align-top font-semibold">
                  1. Tình hình sản xuất trong tháng
                </td>
                <td className="border border-slate-900 px-2 py-1.5 align-top">
                  <ol className="space-y-1">
                    <li>
                      1. Tổng vật tư sử dụng:{' '}
                      <input value={tongVatTu} onChange={e => setTongVatTu(e.target.value)} placeholder="..." className={handInputClass} />
                    </li>
                    <li>
                      2. Tổng thành phẩm đạt màng:{' '}
                      <input value={thanhPhamMang} onChange={e => setThanhPhamMang(e.target.value)} placeholder="..." className={handInputClass} />
                    </li>
                    <li>
                      3. Tổng thành phẩm không màng:{' '}
                      <input value={thanhPhamKhongMang} onChange={e => setThanhPhamKhongMang(e.target.value)} placeholder="... cuộn / ..." className={handInputClass} />
                    </li>
                    <li>
                      4. Mùn cưa sử dụng:{' '}
                      <input value={munCua} onChange={e => setMunCua(e.target.value)} placeholder="..." className={handInputClass} />
                    </li>
                    <li>
                      5. Số ngày sản xuất:{' '}
                      <input value={soNgaySx} onChange={e => setSoNgaySx(e.target.value)} placeholder="..." className={handInputClass} />
                    </li>
                  </ol>
                </td>
                <td className="border border-slate-900 px-2 py-1.5 align-top">
                  <textarea value={nxSanLuong} onChange={e => setNxSanLuong(e.target.value)} rows={6} placeholder="Nhận xét…" className={cellInputClass} />
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2 py-1.5 align-top font-semibold">
                  Hàng hỏng và % lỗi trên sản lượng
                </td>
                <td className="border border-slate-900 px-2 py-1.5 align-top">
                  <p>
                    Hàng hỏng / chiếm:{' '}
                    <input value={hangHong} onChange={e => setHangHong(e.target.value)} placeholder="... %" className={handInputClass} />
                  </p>
                  <p className="mt-1">
                    Tổng phế trộn sản xuất:{' '}
                    <input value={pheTron} onChange={e => setPheTron(e.target.value)} placeholder="... %" className={handInputClass} />
                  </p>
                  <p className="mt-1">
                    3. Hao hụt:{' '}
                    <input value={haoHut} onChange={e => setHaoHut(e.target.value)} placeholder="..." className={handInputClass} />
                  </p>
                </td>
                <td className="border border-slate-900 px-2 py-1.5 align-top">
                  <textarea value={nxHangHong} onChange={e => setNxHangHong(e.target.value)} rows={4} placeholder="Nhận xét…" className={cellInputClass} />
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2 py-1.5 align-top font-semibold">
                  Số lượng CBCNV tham gia SX
                </td>
                <td className="border border-slate-900 px-2 py-1.5 align-top">
                  <p>
                    Số công nhân sản xuất:{' '}
                    <input value={soCongNhan} onChange={e => setSoCongNhan(e.target.value)} placeholder="..." className={handInputClass} />
                  </p>
                  <p className="mt-1">
                    Tổng ngày công trong tháng:{' '}
                    <input value={tongNgayCong} onChange={e => setTongNgayCong(e.target.value)} placeholder="..." className={handInputClass} />
                  </p>
                  <p className="mt-1">
                    Số giờ tăng ca:{' '}
                    <input value={gioTangCa} onChange={e => setGioTangCa(e.target.value)} placeholder="..." className={handInputClass} />
                  </p>
                </td>
                <td className="border border-slate-900 px-2 py-1.5 align-top">
                  <textarea value={nxNhanSu} onChange={e => setNxNhanSu(e.target.value)} rows={4} placeholder="Nhận xét…" className={cellInputClass} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* II. QUẢN LÝ MÁY MÓC */}
          <h2 className="mb-1.5 mt-4 text-[14.5px] font-bold uppercase">II. Quản lý máy móc</h2>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-100">
                {['Quản lý máy', 'Số ngày hoạt động', 'Số ngày không hoạt động', 'Lý do không hoạt động (không có đơn, máy hỏng v.v...)', 'Lưu ý vận hành / sửa chữa tuần kế tiếp (nếu có)'].map(h => (
                  <th key={h} className="border border-slate-900 px-2 py-1.5 font-bold">
                    {h}
                  </th>
                ))}
                <th className="w-10 border border-slate-900 px-1 py-1.5 font-bold" aria-label="Xóa dòng" />
              </tr>
            </thead>
            <tbody>
              {mayRows.map(r => (
                <tr key={r.key}>
                  <td className="min-w-[140px] border border-slate-900 px-2 py-1">
                    <SearchableSelect
                      value={r.may}
                      onChange={v => updateMayRow(r.key, { may: v })}
                      options={buildMachineSelectOptions(machines, r.may)}
                      placeholder={isLoadingMaster ? 'Đang tải…' : 'Chọn máy…'}
                      isLoading={isLoadingMaster}
                      getLabel={item => machineSelectLabel(item as MachineRow)}
                      getValue={item => machineSelectValue(item as MachineRow)}
                      allowCustomValue
                      inputClassName="w-full bg-transparent outline-none placeholder:text-slate-300 placeholder:font-normal px-1 -mx-1 py-0.5 text-[13px] font-semibold text-slate-900 rounded focus:bg-amber-50/60"
                    />
                  </td>
                  <td className="border border-slate-900 px-2 py-1 text-center">
                    <input value={r.soNgayHoatDong} onChange={e => updateMayRow(r.key, { soNgayHoatDong: e.target.value })} placeholder="…" className={`${cellInputClass} text-center`} />
                  </td>
                  <td className="border border-slate-900 px-2 py-1 text-center">
                    <input value={r.soNgayKhongHoatDong} onChange={e => updateMayRow(r.key, { soNgayKhongHoatDong: e.target.value })} placeholder="…" className={`${cellInputClass} text-center`} />
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    <input value={r.lyDo} onChange={e => updateMayRow(r.key, { lyDo: e.target.value })} placeholder="…" className={cellInputClass} />
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    <input value={r.luuY} onChange={e => updateMayRow(r.key, { luuY: e.target.value })} placeholder="…" className={cellInputClass} />
                  </td>
                  <td className="border border-slate-900 px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setMayRows(prev => (prev.length > 1 ? prev.filter(x => x.key !== r.key) : prev))}
                      title="Xóa dòng máy"
                      aria-label="Xóa dòng máy"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => setMayRows(prev => [...prev, { key: uid(), may: '', soNgayHoatDong: '', soNgayKhongHoatDong: '', lyDo: '', luuY: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm dòng máy
            </button>
          </div>

          {/* Sự cố phát sinh và giải pháp */}
          <h2 className="mb-1.5 mt-4 text-[14.5px] font-bold uppercase">Sự cố phát sinh và giải pháp</h2>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-[47%] border border-slate-900 px-2 py-1.5 font-bold">Sự cố phát sinh</th>
                <th className="w-[47%] border border-slate-900 px-2 py-1.5 font-bold">Giải pháp</th>
                <th className="w-10 border border-slate-900 px-1 py-1.5 font-bold" aria-label="Xóa dòng" />
              </tr>
            </thead>
            <tbody>
              {suCoRows.map(r => (
                <tr key={r.key}>
                  <td className="border border-slate-900 px-2 py-1">
                    <input value={r.suCo} onChange={e => updateSuCoRow(r.key, { suCo: e.target.value })} placeholder="…" className={cellInputClass} />
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    <input value={r.giaiPhap} onChange={e => updateSuCoRow(r.key, { giaiPhap: e.target.value })} placeholder="…" className={cellInputClass} />
                  </td>
                  <td className="border border-slate-900 px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setSuCoRows(prev => (prev.length > 1 ? prev.filter(x => x.key !== r.key) : prev))}
                      title="Xóa dòng sự cố"
                      aria-label="Xóa dòng sự cố"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => setSuCoRows(prev => [...prev, { key: uid(), suCo: '', giaiPhap: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm sự cố
            </button>
          </div>

          {/* III. ĐÀO TẠO */}
          <div className="mb-1.5 mt-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14.5px] font-bold uppercase">
              III. Đào tạo{' '}
              <span className="font-semibold normal-case text-slate-600">
                (Số CBCNV được đào tạo: <strong className="text-blue-900">{soCbDuocDaoTao}</strong>)
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setDaoTaoRows(prev => [...prev, { key: uid(), tenNhanVien: '', noiDung: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm mới
            </button>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-[18%] border border-slate-900 px-2 py-1.5 font-bold">CBCNV</th>
                <th className="w-[37%] border border-slate-900 px-2 py-1.5 font-bold">
                  Người được đào tạo (đang làm)
                </th>
                <th className="w-[39%] border border-slate-900 px-2 py-1.5 font-bold">Nội dung đào tạo</th>
                <th className="w-10 border border-slate-900 px-1 py-1.5 font-bold" aria-label="Xóa dòng" />
              </tr>
            </thead>
            <tbody>
              {daoTaoRows.map((r, idx) => (
                <tr key={r.key}>
                  <td className="border border-slate-900 px-2 py-1 font-semibold text-slate-700">
                    CBCNV {idx + 1}
                  </td>
                  <td className="min-w-[150px] border border-slate-900 px-2 py-1">
                    <SearchableSelect
                      value={r.tenNhanVien}
                      onChange={v => updateDaoTaoRow(r.key, { tenNhanVien: v })}
                      options={staffOptionsFor(r.tenNhanVien)}
                      placeholder={isLoadingStaff ? 'Đang tải…' : 'Chọn nhân viên…'}
                      isLoading={isLoadingStaff}
                      getLabel={item => String(item ?? '')}
                      getValue={item => String(item ?? '')}
                      inputClassName="w-full bg-transparent outline-none placeholder:text-slate-300 placeholder:font-normal px-1 -mx-1 py-0.5 text-[13px] font-semibold italic text-blue-900 rounded focus:bg-amber-50/60"
                    />
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    <input
                      value={r.noiDung}
                      onChange={e => updateDaoTaoRow(r.key, { noiDung: e.target.value })}
                      placeholder="Nội dung đào tạo…"
                      className={cellInputClass}
                    />
                  </td>
                  <td className="border border-slate-900 px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setDaoTaoRows(prev => (prev.length > 1 ? prev.filter(x => x.key !== r.key) : prev))}
                      title="Xóa dòng đào tạo"
                      aria-label="Xóa dòng đào tạo"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="mt-1.5 w-full border-collapse text-[13px]">
            <tbody>
              <tr>
                <td className="w-[18%] border border-slate-900 px-2 py-1.5 align-top font-semibold">
                  Nội dung tự học của quản lý sản xuất:
                </td>
                <td className="border border-slate-900 px-2 py-1.5 align-top">
                  <textarea value={daoTaoTuHoc} onChange={e => setDaoTaoTuHoc(e.target.value)} rows={3} placeholder="…" className={cellInputClass} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* IV. PHỐI HỢP */}
          <h2 className="mb-1.5 mt-4 text-[14.5px] font-bold uppercase">IV. Phối hợp với các mắt xích</h2>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-[32%] border border-slate-900 px-2 py-1.5 font-bold">Mắt xích</th>
                <th className="w-[31%] border border-slate-900 px-2 py-1.5 font-bold">Thuận lợi</th>
                <th className="w-[31%] border border-slate-900 px-2 py-1.5 font-bold">Khó khăn</th>
                <th className="w-10 border border-slate-900 px-1 py-1.5 font-bold" aria-label="Xóa dòng" />
              </tr>
            </thead>
            <tbody>
              {phoiHopRows.map(r => (
                <tr key={r.key}>
                  <td className="border border-slate-900 px-2 py-1 font-semibold">
                    <input value={r.matXich} onChange={e => updatePhoiHopRow(r.key, { matXich: e.target.value })} className={cellInputClass} />
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    <input value={r.thuanLoi} onChange={e => updatePhoiHopRow(r.key, { thuanLoi: e.target.value })} className={handInputClass} />
                  </td>
                  <td className="border border-slate-900 px-2 py-1">
                    <input value={r.khoKhan} onChange={e => updatePhoiHopRow(r.key, { khoKhan: e.target.value })} className={handInputClass} />
                  </td>
                  <td className="border border-slate-900 px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setPhoiHopRows(prev => (prev.length > 1 ? prev.filter(x => x.key !== r.key) : prev))}
                      title="Xóa dòng phối hợp"
                      aria-label="Xóa dòng phối hợp"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => setPhoiHopRows(prev => [...prev, { key: uid(), matXich: '', thuanLoi: '', khoKhan: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm mắt xích
            </button>
          </div>

          {/* V. ĐÁNH GIÁ CHO ĐIỂM */}
          <h2 className="mb-1 mt-4 text-[14.5px] font-bold uppercase">
            V. Đánh giá cho điểm các bộ phận tuần theo hệ thống quản trị
          </h2>
          <p className="mb-1.5 text-[12.5px] italic">
            Tự đánh giá cho điểm từ 1→10 về mức độ tuân thủ hệ thống quản trị của từng công đoạn
            sản xuất.
          </p>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-100">
                {['Tên đơn vị', 'Tuân thủ HDCV', 'Tuân thủ 5S', 'Ghi chép sản xuất', 'Nội quy - quy định', 'Hiệu suất công việc'].map(h => (
                  <th key={h} className="border border-slate-900 px-2 py-1.5 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diemRows.map(r => (
                <tr key={r.key}>
                  <td className="border border-slate-900 px-2 py-1 font-semibold">
                    <input value={r.donVi} onChange={e => updateDiemRow(r.key, { donVi: e.target.value })} className={cellInputClass} />
                  </td>
                  {(
                    [
                      ['hdcv', r.hdcv],
                      ['tuanThu5S', r.tuanThu5S],
                      ['ghiChep', r.ghiChep],
                      ['noiQuy', r.noiQuy],
                      ['hieuSuat', r.hieuSuat]
                    ] as const
                  ).map(([field, val]) => (
                    <td key={field} className="border border-slate-900 px-2 py-1 text-center">
                      <input
                        value={val}
                        onChange={e => updateDiemRow(r.key, { [field]: e.target.value } as Partial<BaoCaoTuanDiemRow>)}
                        inputMode="decimal"
                        className={`${handInputClass} text-center`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* VI. LƯU Ý CẢI TIẾN */}
          <h2 className="mb-1.5 mt-4 text-[14.5px] font-bold uppercase">
            VI. Lưu ý cải tiến tuần/tháng kế tiếp
          </h2>
          <textarea
            value={caiTien}
            onChange={e => setCaiTien(e.target.value)}
            rows={4}
            placeholder="Ghi các lưu ý cải tiến…"
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[13px] outline-none focus:border-brand-400"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          />
          <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-[13.5px]">
            <p>
              Ngày{' '}
              <input value={ngayKy} onChange={e => setNgayKy(e.target.value)} placeholder=".." className="inline-block w-8 border-b border-dotted border-slate-400 bg-transparent text-center outline-none" />{' '}
              tháng{' '}
              <input value={thangKy} onChange={e => setThangKy(e.target.value)} placeholder=".." className="inline-block w-8 border-b border-dotted border-slate-400 bg-transparent text-center outline-none" />{' '}
              Năm{' '}
              <input value={namKy} onChange={e => setNamKy(e.target.value)} placeholder="...." className="inline-block w-12 border-b border-dotted border-slate-400 bg-transparent text-center outline-none" />
            </p>
            <p>
              Người thực hiện: Trưởng bộ phận{' '}
              <input value={nguoiKy} onChange={e => setNguoiKy(e.target.value)} placeholder="Ký, ghi rõ họ tên…" className={`${handInputClass} inline-block`} style={{ width: 260 }} />
            </p>
          </div>
        </div>
      </div>

      <p className="text-[11.5px] italic text-slate-400">
        Hôm nay: {formatNgayVN(todayIso())} — Dữ liệu mục I nhập tay, công thức tự động sẽ bổ sung
        sau khi chốt nguồn số liệu.
      </p>
    </div>
  );
}

export function BackToFormsButton({ onClick }: { onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-slate-800"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Về phiếu báo cáo
    </button>
  );
}
