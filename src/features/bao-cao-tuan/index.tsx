import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Cpu,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2
} from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { SoTronDatePicker, formatNgayVN } from '../so-tron/SoTronDatePicker';
import { hasMang } from '../so-tron/summary';
import { normalizeHrBranches } from '../_shared/hr';
import {
  buildMachineSelectOptions,
  findMachineByRef,
  machineSelectLabel,
  machineSelectValue,
  normalizeMachines,
  type MachineRow
} from '../danh-sach-may';

// =========================================================================
// BIỂU MẪU BÁO CÁO TUẦN (BC01-V3) — Tự động tính toán số liệu từ bảng so_tron
// khi chọn từ ngày -> đến ngày và máy.
// =========================================================================

const DRAFT_KEY = 'bao-cao-tuan-draft-v1';

const pad2 = (n: number) => String(n).padStart(2, '0');

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SoTronRecord {
  id: string;
  ngay: string;
  ma_may: string;
  ten_may: string;
  ca: string;
  tong_nvl: number;
  tong_sp_co_mang: number;
  tong_sp_khong_mang: number;
  tong_loi_hong: number;
  tong_loi_hang?: number;
  chi_tieu_phan_tram: number;
  bang_nvl?: any[];
  bang_san_pham?: any[];
  bang_hang_loi?: any[];
  bang_ban_giao?: any[];
}

export interface CalculatedSoTronStats {
  countReports: number;
  countDays: number;
  totalNvl: number;
  totalCoMang: number;
  totalKhongMang: number;
  totalLoiHong: number;
  avgChiTieu: number;
  errorRate: number;
}

export function fmtNumberVN(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString('vi-VN');
}

export function matchRecordMachine(
  r: { ma_may?: string; ten_may?: string },
  targetMay: string,
  machine: MachineRow | null
): boolean {
  if (!targetMay) return false;
  const t1 = targetMay.trim().toLowerCase();
  const tCode = (machine?.code || '').trim().toLowerCase();
  const tName = (machine?.name || '').trim().toLowerCase();

  const rCode = (r.ma_may || '').trim().toLowerCase();
  const rName = (r.ten_may || '').trim().toLowerCase();

  if (rCode && (rCode === t1 || (tCode && rCode === tCode) || (tName && rCode === tName))) return true;
  if (rName && (rName === t1 || (tCode && rName === tCode) || (tName && rName === tName))) return true;
  return false;
}

export function calculateSoTronStats(reports: SoTronRecord[]): CalculatedSoTronStats {
  let totalNvl = 0;
  let totalCoMang = 0;
  let totalKhongMang = 0;
  let totalLoiHong = 0;
  const validChiTieu: number[] = [];
  const distinctDays = new Set<string>();

  for (const r of reports) {
    if (r.ngay) distinctDays.add(r.ngay);

    // 1. Tổng NVL
    let nvl = Number(r.tong_nvl) || 0;
    if (nvl === 0) {
      if (Array.isArray(r.bang_ban_giao) && r.bang_ban_giao.length > 0) {
        nvl = r.bang_ban_giao.reduce((acc, bg) => acc + (Number(bg.tong_su_dung) || 0), 0);
      } else if (Array.isArray(r.bang_nvl) && r.bang_nvl.length > 0) {
        nvl = r.bang_nvl.reduce((acc, n) => {
          const lanSum = Array.isArray(n.lan)
            ? n.lan.reduce((ls: number, v: unknown) => ls + (Number(String(v ?? '').replace(',', '.')) || 0), 0)
            : 0;
          return acc + (Number(n.tong) || lanSum);
        }, 0);
      }
    }
    totalNvl += nvl;

    // 2. SP có màng & không màng
    let coMang = Number(r.tong_sp_co_mang) || 0;
    let khongMang = Number(r.tong_sp_khong_mang) || 0;
    if (coMang === 0 && khongMang === 0 && Array.isArray(r.bang_san_pham) && r.bang_san_pham.length > 0) {
      for (const sp of r.bang_san_pham) {
        const tl = Number(String(sp.trong_luong ?? '').replace(',', '.')) || 0;
        if (hasMang(sp.mang)) coMang += tl;
        else khongMang += tl;
      }
    }
    totalCoMang += coMang;
    totalKhongMang += khongMang;

    // 3. Lỗi hỏng / phế bắt buộc
    let loi = Number(r.tong_loi_hong) || Number(r.tong_loi_hang) || 0;
    if (loi === 0 && Array.isArray(r.bang_hang_loi) && r.bang_hang_loi.length > 0) {
      loi = r.bang_hang_loi.reduce(
        (acc, l) => acc + (Number(String(l.so_luong ?? '').replace(',', '.')) || 0),
        0
      );
    }
    totalLoiHong += loi;

    // 4. Chỉ tiêu % (dữ liệu ô đạt)
    let chiTieu = Number(r.chi_tieu_phan_tram) || 0;
    if (chiTieu === 0) {
      const spSum = coMang + khongMang;
      if (spSum > 0) {
        chiTieu = (spSum / 3100) * 100;
      }
    }
    if (chiTieu > 0) {
      validChiTieu.push(chiTieu);
    }
  }

  const countDays = distinctDays.size;
  const countReports = reports.length;
  const totalSp = totalCoMang + totalKhongMang;
  const errorRate = totalSp > 0 ? Math.round(((totalLoiHong / totalSp) * 100) * 100) / 100 : 0;

  let avgChiTieu = 0;
  if (validChiTieu.length > 0) {
    const sumCt = validChiTieu.reduce((a, b) => a + b, 0);
    avgChiTieu = Math.round((sumCt / validChiTieu.length) * 100) / 100;
  } else if (countDays > 0 && totalSp > 0) {
    avgChiTieu = Math.round(((totalSp / (3100 * countDays)) * 100) * 100) / 100;
  }

  return {
    countReports,
    countDays,
    totalNvl: Math.round((totalNvl + Number.EPSILON) * 100) / 100,
    totalCoMang: Math.round((totalCoMang + Number.EPSILON) * 100) / 100,
    totalKhongMang: Math.round((totalKhongMang + Number.EPSILON) * 100) / 100,
    totalLoiHong: Math.round((totalLoiHong + Number.EPSILON) * 100) / 100,
    avgChiTieu,
    errorRate
  };
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
    { donVi: 'Trộn', hdcv: '', tuanThu5S: '', ghiChep: '', noiQuy: '', hieuSuat: '' },
    { donVi: 'Đầu máy', hdcv: '', tuanThu5S: '', ghiChep: '', noiQuy: '', hieuSuat: '' },
    { donVi: 'Ra hàng, cuối máy', hdcv: '', tuanThu5S: '', ghiChep: '', noiQuy: '', hieuSuat: '' }
  ].map(r => ({ key: uid(), ...r }));
}

export function computeTuanThangFromDate(dateStr: string): { tuan: string; thang: string } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { tuan: '', thang: '' };
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return { tuan: '', thang: '' };

  const thang = `Tháng ${month}`;

  // Tính tuần trong tháng theo chuẩn Việt Nam (tuần bắt đầu từ Thứ Hai)
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const dayOfWeekFirst = (firstDayOfMonth.getDay() + 6) % 7;
  const weekNumber = Math.ceil((day + dayOfWeekFirst) / 7);

  return { tuan: String(weekNumber), thang };
}

const cellInputClass =
  'w-full bg-transparent outline-none placeholder:text-slate-400 placeholder:font-normal text-slate-900 focus:bg-amber-50/60 rounded px-1 -mx-1 py-0.5 text-[14px]';
const handInputClass =
  'w-full bg-transparent outline-none placeholder:text-slate-400 text-blue-900 italic focus:bg-amber-50/60 rounded px-1 -mx-1 py-0.5 text-[14px]';

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
  const [nguoiThucHien, setNguoiThucHien] = useState('');

  // Trạng thái đồng bộ tự động từ sổ trộn
  const [isLoadingSoTron, setIsLoadingSoTron] = useState(false);
  const [soTronStats, setSoTronStats] = useState<CalculatedSoTronStats | null>(null);
  const [soTronMessage, setSoTronMessage] = useState('');

  // ---- I. Sản lượng, tiến độ ----
  const [tongVatTu, setTongVatTu] = useState('');
  const [thanhPhamMang, setThanhPhamMang] = useState('');
  const [thanhPhamKhongMang, setThanhPhamKhongMang] = useState('');
  const [chiTieuTb, setChiTieuTb] = useState(''); // Đạt: n % chỉ tiêu
  const [munCua, setMunCua] = useState('');
  const [soNgaySx, setSoNgaySx] = useState('');

  // Hàng hỏng và % lỗi trên sản lượng:
  // 1. Phế bắt buộc (tong_loi_hong) + Chiếm: tong_loi_hong / (SP có màng + không màng) %
  const [pheBatBuoc, setPheBatBuoc] = useState('');
  const [tiLePheBatBuoc, setTiLePheBatBuoc] = useState('');
  // 2. Phế trong sản xuất + Chiếm % (chưa có công thức, để trống)
  const [pheTrongSx, setPheTrongSx] = useState('');
  const [tiLePheTrongSx, setTiLePheTrongSx] = useState('');
  // 3. Hao hụt: để người dùng điền
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
      if (typeof d.nguoiThucHien === 'string') setNguoiThucHien(d.nguoiThucHien);
      if (typeof d.tongVatTu === 'string') setTongVatTu(d.tongVatTu);
      if (typeof d.thanhPhamMang === 'string') setThanhPhamMang(d.thanhPhamMang);
      if (typeof d.thanhPhamKhongMang === 'string') setThanhPhamKhongMang(d.thanhPhamKhongMang);
      if (typeof d.chiTieuTb === 'string') setChiTieuTb(d.chiTieuTb);
      if (typeof d.munCua === 'string') setMunCua(d.munCua);
      if (typeof d.soNgaySx === 'string') setSoNgaySx(d.soNgaySx);
      if (typeof d.pheBatBuoc === 'string') setPheBatBuoc(d.pheBatBuoc);
      else if (typeof d.pheTron === 'string') setPheBatBuoc(d.pheTron);
      if (typeof d.tiLePheBatBuoc === 'string') setTiLePheBatBuoc(d.tiLePheBatBuoc);
      else if (typeof d.hangHong === 'string') setTiLePheBatBuoc(d.hangHong);
      if (typeof d.pheTrongSx === 'string') setPheTrongSx(d.pheTrongSx);
      if (typeof d.tiLePheTrongSx === 'string') setTiLePheTrongSx(d.tiLePheTrongSx);
      if (typeof d.haoHut === 'string') setHaoHut(d.haoHut);
      if (typeof d.soCongNhan === 'string') setSoCongNhan(d.soCongNhan);
      if (typeof d.tongNgayCong === 'string') setTongNgayCong(d.tongNgayCong);
      if (typeof d.gioTangCa === 'string') setGioTangCa(d.gioTangCa);
      if (typeof d.nxSanLuong === 'string') setNxSanLuong(d.nxSanLuong);
      if (typeof d.nxHangHong === 'string') setNxHangHong(d.nxHangHong);
      if (typeof d.nxNhanSu === 'string') setNxNhanSu(d.nxNhanSu);
      if (Array.isArray(d.diemRows)) setDiemRows(d.diemRows as BaoCaoTuanDiemRow[]);
    } catch {
      /* bỏ qua nháp hỏng */
    }
    // Chỉ nạp 1 lần lúc mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const machineOptions = useMemo(
    () => buildMachineSelectOptions(machines, maMay),
    [machines, maMay]
  );

  const selectedMachine = useMemo(() => {
    if (!maMay) return null;
    return (
      machines.find(m => machineSelectValue(m) === maMay || m.code === maMay || m.name === maMay) ||
      findMachineByRef(machines, maMay) ||
      null
    );
  }, [machines, maMay]);

  const selectedMachineLabel = useMemo(() => {
    if (!maMay) return '';
    return selectedMachine ? machineSelectLabel(selectedMachine) : maMay;
  }, [selectedMachine, maMay]);

  /** Tên máy hiển thị trên biểu mẫu và khi in (ưu tiên tên máy cụ thể) */
  const tenMayHienThi = useMemo(() => {
    if (selectedMachine?.name && selectedMachine.name.trim() !== '-') {
      return selectedMachine.name.trim();
    }
    return selectedMachineLabel || maMay || '';
  }, [selectedMachine, selectedMachineLabel, maMay]);

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

  // Tự động tính ra Tuần và Tháng khi chọn các ngày/tháng/năm
  useEffect(() => {
    const refDate = tuNgay || denNgay;
    if (refDate) {
      const { tuan: computedTuan, thang: computedThang } = computeTuanThangFromDate(refDate);
      if (computedTuan) setTuan(computedTuan);
      if (computedThang) setThang(computedThang);
    }
  }, [tuNgay, denNgay]);

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          tuan,
          tuNgay,
          denNgay,
          thang,
          maMay,
          nguoiThucHien,
          tongVatTu,
          thanhPhamMang,
          thanhPhamKhongMang,
          chiTieuTb,
          munCua,
          soNgaySx,
          pheBatBuoc,
          tiLePheBatBuoc,
          pheTrongSx,
          tiLePheTrongSx,
          haoHut,
          soCongNhan,
          tongNgayCong,
          gioTangCa,
          nxSanLuong,
          nxHangHong,
          nxNhanSu,
          diemRows
        })
      );
      setSavedTick(`Đã lưu nháp lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    } catch {
      setSavedTick('Không lưu được nháp trên trình duyệt này.');
    }
  };

  /**
   * Tự động lọc từ bảng so_tron: theo máy (ma_may / ten_may) và ngày (ngay từ tuNgay đến denNgay).
   * Tính tổng NVL, TP có màng, TP không màng, lỗi hàng (Phế bắt buộc) và trung bình chi_tieu_phan_tram (ô đạt).
   */
  const fetchAndApplySoTron = async () => {
    if (!tuNgay || !denNgay || !maMay) {
      setSoTronStats(null);
      setSoTronMessage('');
      return;
    }
    if (tuNgay > denNgay) {
      setSoTronMessage('Khoảng ngày không hợp lệ (Từ ngày lớn hơn Đến ngày).');
      return;
    }

    setIsLoadingSoTron(true);
    setSoTronMessage('Đang lấy dữ liệu từ sổ trộn…');

    try {
      const res = await fetch(
        `/api/so-tron?tu_ngay=${encodeURIComponent(tuNgay)}&den_ngay=${encodeURIComponent(denNgay)}&limit=1000`
      );
      const json = await res.json().catch(() => ({}));
      const allReports: SoTronRecord[] = Array.isArray(json.reports) ? json.reports : [];

      // Khớp máy linh hoạt theo mã hoặc tên máy
      const matched = allReports.filter(r => matchRecordMachine(r, maMay, selectedMachine));

      if (matched.length === 0) {
        setSoTronStats(null);
        setSoTronMessage(
          `Không tìm thấy phiếu sổ trộn nào của máy ${tenMayHienThi || maMay} từ ${tuNgayVN} đến ${denNgayVN}.`
        );
        return;
      }

      const stats = calculateSoTronStats(matched);
      setSoTronStats(stats);
      setSoTronMessage(
        `Đã lọc được ${stats.countReports} phiếu (${stats.countDays} ngày SX) của máy ${tenMayHienThi || maMay}.`
      );

      // Tự động điền các ô mục 1. Tình hình sản xuất trong tháng
      setTongVatTu(stats.totalNvl > 0 ? `${fmtNumberVN(stats.totalNvl)} kg` : '0 kg');
      setThanhPhamMang(stats.totalCoMang > 0 ? `${fmtNumberVN(stats.totalCoMang)} kg` : '0 kg');
      setThanhPhamKhongMang(stats.totalKhongMang > 0 ? `${fmtNumberVN(stats.totalKhongMang)} kg` : '0 kg');
      // Đạt: n % chỉ tiêu (dưới 3. Tổng thành phẩm không màng)
      setChiTieuTb(stats.avgChiTieu > 0 ? `${fmtNumberVN(stats.avgChiTieu)}` : '0');
      setSoNgaySx(stats.countDays > 0 ? String(stats.countDays) : '');

      // Hàng hỏng và % lỗi trên sản lượng:
      // 1. Phế bắt buộc = tong_loi_hong
      // Chiếm % = tổng tong_loi_hong / (tổng thành phẩm có màng và không có màng) * 100
      const totalSp = stats.totalCoMang + stats.totalKhongMang;
      const tiLePhe = totalSp > 0 ? Math.round(((stats.totalLoiHong / totalSp) * 100) * 100) / 100 : 0;
      setPheBatBuoc(stats.totalLoiHong > 0 ? `${fmtNumberVN(stats.totalLoiHong)} kg` : '0 kg');
      setTiLePheBatBuoc(totalSp > 0 ? `${fmtNumberVN(tiLePhe)}%` : '0%');
      // 2. Phế trong sản xuất & Chiếm %: chưa có công thức, đang để trống
      // 3. Hao hụt: để người dùng điền
    } catch {
      setSoTronMessage('Lỗi kết nối khi tải sổ trộn.');
    } finally {
      setIsLoadingSoTron(false);
    }
  };

  useEffect(() => {
    if (tuNgay && denNgay && maMay && tuNgay <= denNgay) {
      void fetchAndApplySoTron();
    } else {
      setSoTronStats(null);
      setSoTronMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuNgay, denNgay, maMay]);

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
      `<td style="border:1px solid #111;padding:6px 8px;vertical-align:top;font-size:14px;${extra}">${escapeHtml(v) || '&nbsp;'}</td>`;
    const th = (v: string, extra = '') =>
      `<th style="border:1px solid #111;padding:6px 8px;font-size:14px;background:#f1f5f9;${extra}">${escapeHtml(v)}</th>`;
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
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo tuần ${escapeHtml(tuan)} — ${escapeHtml(tenMayHienThi || maMay)}</title>
<style>@page{size:A4 portrait;margin:12mm 10mm;}body{font-family:"Times New Roman",Times,serif;color:#111;font-size:14px;}h1{font-size:20px;text-align:center;margin:4px 0;}h2{font-size:15px;margin:14px 0 6px;}table{width:100%;border-collapse:collapse;font-size:14px;}p{font-size:14px;}</style></head><body>
<p style="display:flex;justify-content:space-between"><strong>CÔNG TY TNHH VIỆT NHẬT PHÚ THỌ</strong><span style="font-size:13px">Mẫu số: BC01-V3 — Ngày cấp nhật: 27/3/2024</span></p>
<h1>BÁO CÁO ĐÁNH GIÁ SẢN XUẤT TUẦN/THÁNG</h1>
<p style="text-align:center">TUẦN ${escapeHtml(tuan || '...')} TỪ ${escapeHtml(tuNgayVN)} ĐẾN ${escapeHtml(denNgayVN)} ${escapeHtml(thang || '')}</p>
<p>Máy: ${escapeHtml(tenMayHienThi || maMay)} &nbsp;&nbsp; Người thực hiện: ${escapeHtml(nguoiThucHien)}</p>
<h2>I. SẢN LƯỢNG, TIẾN ĐỘ</h2>
<table><tr>${th('TIÊU CHÍ', 'width:28%')}${th('KẾT QUẢ', 'width:44%')}${th('TỰ NHẬN XÉT HIỆU SUẤT - HIỆU QUẢ', 'width:28%')}</tr>
<tr>${td('1. Tình hình sản xuất trong tháng')}${td(`1. Tổng vật tư sử dụng: ${tongVatTu}\n2. Tổng thành phẩm đạt màng: ${thanhPhamMang}\n3. Tổng thành phẩm không màng: ${thanhPhamKhongMang}${chiTieuTb ? `\n   Đạt: ${chiTieuTb} % chỉ tiêu` : ''}\n4. Mùn cưa sử dụng: ${munCua}\n5. Số ngày sản xuất: ${soNgaySx}`, 'white-space:pre-line;')}${td(nxSanLuong)}</tr>
<tr>${td('Hàng hỏng và % lỗi trên sản lượng')}${td(`1. Phế bắt buộc: ${pheBatBuoc}${tiLePheBatBuoc ? `\n   Chiếm: ${tiLePheBatBuoc}` : ''}\n2. Phế trong sản xuất: ${pheTrongSx}${tiLePheTrongSx ? `\n   Chiếm: ${tiLePheTrongSx}` : ''}\n3. Hao hụt: ${haoHut}`, 'white-space:pre-line;')}${td(nxHangHong)}</tr>
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
            <SoTronDatePicker
              value={tuNgay}
              onChange={setTuNgay}
              placeholder="Chọn từ ngày"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" /> Đến ngày
            </span>
            <SoTronDatePicker
              value={denNgay}
              onChange={setDenNgay}
              placeholder="Chọn đến ngày"
            />
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
              getLabel={item => {
                const m = item as MachineRow;
                const code = m.code?.trim() || '';
                const name = m.name?.trim() || '';
                if (code && name && code !== name && name !== '-') return `${code} · ${name}`;
                return name && name !== '-' ? name : code;
              }}
              getValue={item => machineSelectValue(item as MachineRow)}
              getSearchText={item => {
                const m = item as MachineRow;
                return `${m.code || ''} ${m.name || ''}`;
              }}
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
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <label className="block w-full sm:max-w-md">
            <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
              Người thực hiện
            </span>
            <SearchableSelect
              value={nguoiThucHien}
              onChange={setNguoiThucHien}
              options={staffNames}
              placeholder={isLoadingStaff ? 'Đang tải nhân sự…' : 'Chọn hoặc nhập người thực hiện (không bắt buộc)'}
              isLoading={isLoadingStaff}
              getLabel={item => String(item ?? '')}
              getValue={item => String(item ?? '')}
              allowCustomValue
              allowEmpty
            />
          </label>
          {tuNgay && denNgay && maMay && (
            <div className="flex items-center gap-2 pt-1 sm:pt-4">
              <button
                type="button"
                onClick={() => void fetchAndApplySoTron()}
                disabled={isLoadingSoTron}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingSoTron ? 'animate-spin' : ''}`} />
                {isLoadingSoTron ? 'Đang tính từ sổ trộn…' : 'Tính lại từ sổ trộn'}
              </button>
            </div>
          )}
        </div>

        {soTronMessage && (
          <div
            className={`mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[12px] ${
              soTronStats
                ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
                : isLoadingSoTron
                  ? 'border-blue-200 bg-blue-50/80 text-blue-800'
                  : 'border-amber-200 bg-amber-50/80 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {isLoadingSoTron ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : soTronStats ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              )}
              <span className="font-medium">{soTronMessage}</span>
            </div>
            {soTronStats && (
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-emerald-900">
                <span className="rounded bg-white/80 px-2.5 py-0.5 border border-emerald-200">
                  NVL: <b>{fmtNumberVN(soTronStats.totalNvl)} kg</b>
                </span>
                <span className="rounded bg-white/80 px-2.5 py-0.5 border border-emerald-200">
                  TP có màng: <b>{fmtNumberVN(soTronStats.totalCoMang)} kg</b>
                </span>
                <span className="rounded bg-white/80 px-2.5 py-0.5 border border-emerald-200">
                  TP không màng: <b>{fmtNumberVN(soTronStats.totalKhongMang)} kg</b>
                </span>
                <span className="rounded bg-white/80 px-2.5 py-0.5 border border-emerald-200">
                  Phế bắt buộc: <b>{fmtNumberVN(soTronStats.totalLoiHong)} kg</b> ({fmtNumberVN(soTronStats.errorRate)}%)
                </span>
                <span className="rounded bg-white/80 px-2.5 py-0.5 border border-emerald-200">
                  Đạt: <b>{fmtNumberVN(soTronStats.avgChiTieu)}%</b> chỉ tiêu
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tờ phiếu giống mẫu giấy BC01-V3 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-card sm:p-5">
        <div
          className="mx-auto min-w-[720px] max-w-[920px] bg-white px-6 py-6 text-slate-900 shadow-md sm:px-9 text-[14px]"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          {/* Đầu phiếu */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-bold uppercase tracking-wide">VIETHATIPT</p>
              <p className="text-[13px] italic text-slate-500">Công ty TNHH Việt Nhật Phú Thọ</p>
            </div>
            <div className="border border-slate-900 px-2.5 py-1 text-right text-[13px] leading-tight">
              <p>
                Mẫu số: <strong>BC01-V3</strong>
              </p>
              <p>
                Ngày cấp nhật: <strong>27/3/2024</strong>
              </p>
            </div>
          </div>

          <h1 className="mt-3 text-center text-[20px] font-bold uppercase leading-snug">
            Báo cáo đánh giá sản xuất tuần/tháng
          </h1>
          <p className="mt-1 text-center text-[15px] font-bold uppercase">
            Tuần{' '}
            <input
              value={tuan}
              onChange={e => setTuan(e.target.value)}
              placeholder="..."
              className="inline-block w-10 border-b border-dotted border-slate-400 bg-transparent text-center font-bold text-blue-900 outline-none text-[15px]"
            />{' '}
            từ <span className="text-blue-900">{tuNgayVN}</span> đến{' '}
            <span className="text-blue-900">{denNgayVN}</span>{' '}
            <input
              value={thang}
              onChange={e => setThang(e.target.value)}
              placeholder="Tháng ..."
              className="inline-block w-24 border-b border-dotted border-slate-400 bg-transparent text-center font-bold text-blue-900 outline-none text-[15px]"
            />
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
            <p className="flex items-center gap-1">
              Máy: <strong className="text-blue-900">{tenMayHienThi || '........'}</strong>
            </p>
            <p>
              Người thực hiện:{' '}
              <input
                value={nguoiThucHien}
                onChange={e => setNguoiThucHien(e.target.value)}
                placeholder="................................"
                className={handInputClass}
                style={{ width: 220 }}
              />
            </p>
          </div>

          {/* I. SẢN LƯỢNG, TIẾN ĐỘ */}
          <h2 className="mb-1.5 mt-4 text-[15px] font-bold uppercase">I. Sản lượng, tiến độ</h2>
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-[26%] border border-slate-900 px-2.5 py-1.5 font-bold uppercase text-[14px]">
                  Tiêu chí
                </th>
                <th className="w-[46%] border border-slate-900 px-2.5 py-1.5 font-bold uppercase text-[14px]">
                  Kết quả
                </th>
                <th className="border border-slate-900 px-2.5 py-1.5 font-bold uppercase text-[14px]">
                  Tự nhận xét hiệu suất - hiệu quả
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-900 px-2.5 py-2 align-top font-semibold text-[14px]">
                  1. Tình hình sản xuất trong tháng
                </td>
                <td className="border border-slate-900 px-2.5 py-2 align-top text-[14px]">
                  <ol className="space-y-1.5">
                    <li>
                      1. Tổng vật tư sử dụng:{' '}
                      <input value={tongVatTu} onChange={e => setTongVatTu(e.target.value)} placeholder="..." className={handInputClass} />
                    </li>
                    <li>
                      2. Tổng thành phẩm đạt màng:{' '}
                      <input value={thanhPhamMang} onChange={e => setThanhPhamMang(e.target.value)} placeholder="..." className={handInputClass} />
                    </li>
                    <li>
                      <div>
                        3. Tổng thành phẩm không màng:{' '}
                        <input value={thanhPhamKhongMang} onChange={e => setThanhPhamKhongMang(e.target.value)} placeholder="... cuộn / ..." className={handInputClass} />
                      </div>
                      <div className="ml-4 mt-1">
                        <span className="font-semibold text-slate-800">Đạt: </span>
                        <input
                          value={chiTieuTb}
                          onChange={e => setChiTieuTb(e.target.value)}
                          placeholder="..."
                          className={`${handInputClass} inline-block font-semibold`}
                          style={{ width: 90 }}
                        />
                        <span className="font-semibold text-slate-800"> % chỉ tiêu</span>
                      </div>
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
                <td className="border border-slate-900 px-2.5 py-2 align-top font-semibold text-[14px]">
                  Hàng hỏng và % lỗi trên sản lượng
                </td>
                <td className="border border-slate-900 px-2.5 py-2 align-top text-[14px]">
                  <div className="space-y-2">
                    <div>
                      <span>1. Phế bắt buộc: </span>
                      <input
                        value={pheBatBuoc}
                        onChange={e => setPheBatBuoc(e.target.value)}
                        placeholder="... kg"
                        className={`${handInputClass} inline-block`}
                        style={{ width: 140 }}
                      />
                      <div className="ml-4 mt-0.5">
                        <span className="italic text-slate-700">Chiếm: </span>
                        <input
                          value={tiLePheBatBuoc}
                          onChange={e => setTiLePheBatBuoc(e.target.value)}
                          placeholder="... %"
                          className={`${handInputClass} inline-block font-semibold`}
                          style={{ width: 100 }}
                        />
                      </div>
                    </div>
                    <div>
                      <span>2. Phế trong sản xuất: </span>
                      <input
                        value={pheTrongSx}
                        onChange={e => setPheTrongSx(e.target.value)}
                        placeholder="..."
                        className={`${handInputClass} inline-block`}
                        style={{ width: 140 }}
                      />
                      <div className="ml-4 mt-0.5">
                        <span className="italic text-slate-700">Chiếm: </span>
                        <input
                          value={tiLePheTrongSx}
                          onChange={e => setTiLePheTrongSx(e.target.value)}
                          placeholder="... %"
                          className={`${handInputClass} inline-block`}
                          style={{ width: 100 }}
                        />
                      </div>
                    </div>
                    <div>
                      <span>3. Hao hụt: </span>
                      <input
                        value={haoHut}
                        onChange={e => setHaoHut(e.target.value)}
                        placeholder="..."
                        className={`${handInputClass} inline-block`}
                        style={{ width: 140 }}
                      />
                    </div>
                  </div>
                </td>
                <td className="border border-slate-900 px-2 py-1.5 align-top">
                  <textarea value={nxHangHong} onChange={e => setNxHangHong(e.target.value)} rows={5} placeholder="Nhận xét…" className={cellInputClass} />
                </td>
              </tr>
              <tr>
                <td className="border border-slate-900 px-2.5 py-2 align-top font-semibold text-[14px]">
                  Số lượng CBCNV tham gia SX
                </td>
                <td className="border border-slate-900 px-2.5 py-2 align-top text-[14px]">
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
          <h2 className="mb-1.5 mt-4 text-[15px] font-bold uppercase">II. Quản lý máy móc</h2>
          <table className="w-full border-collapse text-[14px]">
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
                      inputClassName="w-full bg-transparent outline-none placeholder:text-slate-300 placeholder:font-normal px-1 -mx-1 py-0.5 text-[14px] font-semibold text-slate-900 rounded focus:bg-amber-50/60"
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm dòng máy
            </button>
          </div>

          {/* Sự cố phát sinh và giải pháp */}
          <h2 className="mb-1.5 mt-4 text-[15px] font-bold uppercase">Sự cố phát sinh và giải pháp</h2>
          <table className="w-full border-collapse text-[14px]">
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm sự cố
            </button>
          </div>

          {/* III. ĐÀO TẠO */}
          <div className="mb-1.5 mt-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold uppercase">
              III. Đào tạo{' '}
              <span className="font-semibold normal-case text-slate-600 text-[13px]">
                (Số CBCNV được đào tạo: <strong className="text-blue-900">{soCbDuocDaoTao}</strong>)
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setDaoTaoRows(prev => [...prev, { key: uid(), tenNhanVien: '', noiDung: '' }])}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm mới
            </button>
          </div>
          <table className="w-full border-collapse text-[14px]">
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
                      inputClassName="w-full bg-transparent outline-none placeholder:text-slate-300 placeholder:font-normal px-1 -mx-1 py-0.5 text-[14px] font-semibold italic text-blue-900 rounded focus:bg-amber-50/60"
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
          <table className="mt-1.5 w-full border-collapse text-[14px]">
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
          <h2 className="mb-1.5 mt-4 text-[15px] font-bold uppercase">IV. Phối hợp với các mắt xích</h2>
          <table className="w-full border-collapse text-[14px]">
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm mắt xích
            </button>
          </div>

          {/* V. ĐÁNH GIÁ CHO ĐIỂM */}
          <h2 className="mb-1 mt-4 text-[15px] font-bold uppercase">
            V. Đánh giá cho điểm các bộ phận tuần theo hệ thống quản trị
          </h2>
          <p className="mb-1.5 text-[13px] italic text-slate-600">
            Tự đánh giá cho điểm từ 1→10 về mức độ tuân thủ hệ thống quản trị của từng công đoạn
            sản xuất.
          </p>
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="bg-slate-100">
                {['Tên đơn vị', 'Tuân thủ HDCV', 'Tuân thủ 5S', 'Ghi chép sản xuất', 'Nội quy - quy định', 'Hiệu suất công việc'].map(h => (
                  <th key={h} className="border border-slate-900 px-2 py-1.5 font-bold">
                    {h}
                  </th>
                ))}
                <th className="w-10 border border-slate-900 px-1 py-1.5 font-bold" aria-label="Xóa dòng" />
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
                  <td className="border border-slate-900 px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setDiemRows(prev => (prev.length > 1 ? prev.filter(x => x.key !== r.key) : prev))}
                      title="Xóa dòng bộ phận"
                      aria-label="Xóa dòng bộ phận"
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
              onClick={() =>
                setDiemRows(prev => [
                  ...prev,
                  {
                    key: uid(),
                    donVi: '',
                    hdcv: '',
                    tuanThu5S: '',
                    ghiChep: '',
                    noiQuy: '',
                    hieuSuat: ''
                  }
                ])
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[13px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm bộ phận
            </button>
          </div>

          {/* VI. LƯU Ý CẢI TIẾN */}
          <h2 className="mb-1.5 mt-4 text-[15px] font-bold uppercase">
            VI. Lưu ý cải tiến tuần/tháng kế tiếp
          </h2>
          <textarea
            value={caiTien}
            onChange={e => setCaiTien(e.target.value)}
            rows={4}
            placeholder="Ghi các lưu ý cải tiến…"
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-[14px] outline-none focus:border-brand-400"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          />
          <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-[14px]">
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

      <p className="text-[13px] italic text-slate-400">
        Hôm nay: {formatNgayVN(todayIso())} — Dữ liệu mục I tự động tính từ sổ trộn theo máy và khoảng ngày chọn.
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
