import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Eye, Loader2, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { useTabAccess } from '../../app/useTabAccess';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { getProductionShiftOptions, normalizeShiftSettings } from '../../utils/shiftSettings';
import { LichLamViecPrintModal } from './LichLamViecPrintModal';

/** 4 vai trò mặc định — luôn hiển thị, không xóa được. */
const DEFAULT_ROLES = ['Trưởng ca', 'Nhân sự chính', 'Thợ phụ', 'Học việc'] as const;

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

// ── Kiểu dữ liệu ─────────────────────────────────────────────────────────────
type SchedRow = {
  id: string;
  ma_lenh_sx: string;
  ngay_lam_viec: string;
  ca_lam_viec: string;
  vai_tro: string;
  ma_nhan_su: string;
  ma_may: string;
  may: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  ghi_chu: string;
  removable: boolean;
};

type SchedGroup = {
  key: string;
  ma_may: string;
  ten_may: string;
  ma_lenh_sx: string;
  ngay_lam_viec: string;
  ca_lam_viec: string;
  ghi_chu: string;
  rows: SchedRow[];
};

type MachineOpt = { code: string; name: string };
type StaffOpt = { code: string; name: string; department: string };
type ShiftOpt = { value: string; label: string };

type PersonForm = {
  key: string;
  vaiTro: string;
  maNhanSu: string;
  thoiGianBatDau: string;
  thoiGianKetThuc: string;
  removable: boolean;
};

type ScheduleForm = {
  maMay: string;
  caLamViec: string;
  ngayLamViec: string;
  ghiChu: string;
  people: PersonForm[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Bỏ trùng + bỏ rỗng, giữ kiểu string[] (tránh quirk [...new Set()] → unknown[] trong tsconfig hiện tại). */
function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

const groupKey = (maMay: string, ngay: string, ca: string) => `${maMay}||${ngay}||${ca}`;

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function timeHHMM(v: unknown): string {
  const s = str(v);
  return s ? s.slice(0, 5) : '';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : dateStr;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function normalizeRows(data: unknown): SchedRow[] {
  const items = data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
    ? (data as { items: unknown[] }).items
    : [];
  return items
    .map((raw): SchedRow | null => {
      if (!raw || typeof raw !== 'object') return null;
      const r = raw as Record<string, unknown>;
      const id = str(r.id);
      if (!id) return null;
      return {
        id,
        ma_lenh_sx: str(r.ma_lenh_sx),
        ngay_lam_viec: str(r.ngay_lam_viec).slice(0, 10),
        ca_lam_viec: str(r.ca_lam_viec ?? r.ca),
        vai_tro: str(r.vai_tro),
        ma_nhan_su: str(r.ma_nhan_su),
        ma_may: str(r.ma_may),
        may: str(r.may ?? r.ten_may),
        thoi_gian_bat_dau: timeHHMM(r.thoi_gian_bat_dau),
        thoi_gian_ket_thuc: timeHHMM(r.thoi_gian_ket_thuc),
        ghi_chu: str(r.ghi_chu),
        removable: Boolean(r.removable)
      };
    })
    // Cần đủ máy + ngày + ca để gom nhóm theo máy.
    .filter((r): r is SchedRow => Boolean(r && r.ma_may && r.ngay_lam_viec && r.ca_lam_viec));
}

function buildGroups(rows: SchedRow[], machineName: (code: string, fallback?: string) => string): SchedGroup[] {
  const map = new Map<string, SchedGroup>();
  for (const row of rows) {
    const key = groupKey(row.ma_may, row.ngay_lam_viec, row.ca_lam_viec);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        ma_may: row.ma_may,
        ten_may: machineName(row.ma_may, row.may),
        ma_lenh_sx: row.ma_lenh_sx,
        ngay_lam_viec: row.ngay_lam_viec,
        ca_lam_viec: row.ca_lam_viec,
        ghi_chu: '',
        rows: []
      };
      map.set(key, group);
    }
    group.rows.push(row);
    if (!group.ghi_chu && row.ghi_chu) group.ghi_chu = row.ghi_chu;
    if (!group.ma_lenh_sx && row.ma_lenh_sx) group.ma_lenh_sx = row.ma_lenh_sx;
  }
  return [...map.values()].sort((a, b) => {
    if (a.ngay_lam_viec !== b.ngay_lam_viec) return b.ngay_lam_viec.localeCompare(a.ngay_lam_viec);
    if (a.ten_may !== b.ten_may) return a.ten_may.localeCompare(b.ten_may, 'vi');
    return a.ca_lam_viec.localeCompare(b.ca_lam_viec, 'vi');
  });
}

function normalizeMachines(data: unknown): MachineOpt[] {
  const list = data && typeof data === 'object' && Array.isArray((data as { machines?: unknown }).machines)
    ? (data as { machines: unknown[] }).machines
    : [];
  const byCode = new Map<string, MachineOpt>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const code = str(r.ma_may ?? r.code);
    const name = str(r.ten_may ?? r.name ?? code);
    if (!code && !name) continue;
    const key = code || name;
    if (!byCode.has(key)) byCode.set(key, { code: code || name, name: name || code });
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function normalizeStaff(data: unknown): StaffOpt[] {
  const branches = data && typeof data === 'object' && Array.isArray((data as { branches?: unknown }).branches)
    ? (data as { branches: unknown[] }).branches
    : [];
  const byCode = new Map<string, StaffOpt>();
  for (const branch of branches) {
    const depts = branch && typeof branch === 'object' && Array.isArray((branch as { departments?: unknown }).departments)
      ? (branch as { departments: unknown[] }).departments
      : [];
    for (const dept of depts) {
      const deptName = str((dept as { name?: unknown })?.name);
      const members = dept && typeof dept === 'object' && Array.isArray((dept as { members?: unknown }).members)
        ? (dept as { members: unknown[] }).members
        : [];
      for (const m of members) {
        if (!m || typeof m !== 'object') continue;
        const mr = m as Record<string, unknown>;
        const code = str(mr.code ?? mr.ma_nhan_su ?? mr.id);
        const name = str(mr.name);
        if (!code || !name) continue;
        if (!byCode.has(code)) byCode.set(code, { code, name, department: deptName });
      }
    }
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

const emptyPerson = (vaiTro: string, removable: boolean): PersonForm => ({
  key: uid(),
  vaiTro,
  maNhanSu: '',
  thoiGianBatDau: '',
  thoiGianKetThuc: '',
  removable
});

const emptyForm = (): ScheduleForm => ({
  maMay: '',
  caLamViec: '',
  ngayLamViec: '',
  ghiChu: '',
  people: DEFAULT_ROLES.map(role => emptyPerson(role, false))
});

/** Ghép các dòng đã lưu của 1 nhóm vào 4 vai trò mặc định + các dòng bổ sung. */
function groupToForm(group: SchedGroup): ScheduleForm {
  const used = new Set<number>();
  const people: PersonForm[] = DEFAULT_ROLES.map(role => {
    const idx = group.rows.findIndex((row, i) => !used.has(i) && row.vai_tro === role);
    if (idx >= 0) {
      used.add(idx);
      const row = group.rows[idx];
      return {
        key: uid(),
        vaiTro: role,
        maNhanSu: row.ma_nhan_su,
        thoiGianBatDau: row.thoi_gian_bat_dau,
        thoiGianKetThuc: row.thoi_gian_ket_thuc,
        removable: false
      };
    }
    return emptyPerson(role, false);
  });
  group.rows.forEach((row, i) => {
    if (used.has(i)) return;
    people.push({
      key: uid(),
      vaiTro: row.vai_tro || 'Nhân sự bổ sung',
      maNhanSu: row.ma_nhan_su,
      thoiGianBatDau: row.thoi_gian_bat_dau,
      thoiGianKetThuc: row.thoi_gian_ket_thuc,
      removable: true
    });
  });
  return {
    maMay: group.ma_may,
    caLamViec: group.ca_lam_viec,
    ngayLamViec: group.ngay_lam_viec,
    ghiChu: group.ghi_chu,
    people
  };
}

// ── Component ───────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
}

export default function SapXepLichLamViecPanel({ onBack }: Props) {
  const { canCreate, canEdit, canDelete } = useTabAccess('sap-xep-lich-lam-viec');

  const [rows, setRows] = useState<SchedRow[]>([]);
  const [machines, setMachines] = useState<MachineOpt[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [shiftOptions, setShiftOptions] = useState<ShiftOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [filterDate, setFilterDate] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterMachine, setFilterMachine] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState('');
  const [form, setForm] = useState<ScheduleForm>(emptyForm);

  const [detailGroup, setDetailGroup] = useState<SchedGroup | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  const [printDate, setPrintDate] = useState(todayISO());

  const staffByCode = useMemo(() => {
    const map = new Map<string, StaffOpt>();
    for (const s of staff) map.set(s.code, s);
    return map;
  }, [staff]);

  const machineByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of machines) if (m.code) map.set(m.code, m.name);
    return map;
  }, [machines]);

  const staffName = useCallback((code: string) => staffByCode.get(code)?.name || code || '—', [staffByCode]);
  const machineName = useCallback(
    (code: string, fallback = '') => machineByCode.get(code) || fallback || code || '',
    [machineByCode]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [schedRes, mayRes, staffRes, settingRes] = await Promise.all([
        fetch('/api/phan-cong-nhan-su'),
        fetch('/api/danh-sach-may'),
        fetch('/api/nhan-su?format=groups&scope=all'),
        fetch('/api/cai-dat')
      ]);
      const [schedData, mayData, staffData, settingData] = await Promise.all([
        schedRes.json().catch(() => ({})),
        mayRes.json().catch(() => ({})),
        staffRes.json().catch(() => ({})),
        settingRes.json().catch(() => ({}))
      ]);
      setMachines(normalizeMachines(mayData));
      setStaff(normalizeStaff(staffData));
      setShiftOptions(getProductionShiftOptions(normalizeShiftSettings(settingData)));
      setRows(normalizeRows(schedData));
    } catch (err: any) {
      setError(err?.message || 'Không tải được dữ liệu lịch làm việc.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const groups = useMemo(() => buildGroups(rows, machineName), [rows, machineName]);

  const filterDates = useMemo(
    () => uniq(groups.map(g => g.ngay_lam_viec)).sort((a, b) => b.localeCompare(a)),
    [groups]
  );
  const filterShifts = useMemo(
    () => uniq(groups.map(g => g.ca_lam_viec)).sort((a, b) => a.localeCompare(b, 'vi')),
    [groups]
  );
  const filterMachines = useMemo(
    () => uniq(groups.map(g => g.ma_may)).sort((a, b) => machineName(a).localeCompare(machineName(b), 'vi')),
    [groups, machineName]
  );

  const filteredGroups = useMemo(
    () =>
      groups.filter(g => {
        if (filterDate && g.ngay_lam_viec !== filterDate) return false;
        if (filterShift && g.ca_lam_viec !== filterShift) return false;
        if (filterMachine && g.ma_may !== filterMachine) return false;
        return true;
      }),
    [groups, filterDate, filterShift, filterMachine]
  );

  /** Ca options cho form = ca từ cài đặt + ca đã dùng trong lịch + ca đang chọn. */
  const formShiftOptions = useMemo<ShiftOpt[]>(() => {
    const seen = new Set<string>();
    const out: ShiftOpt[] = [];
    const push = (value: string, label: string) => {
      if (value && !seen.has(value)) {
        seen.add(value);
        out.push({ value, label: label || value });
      }
    };
    for (const s of shiftOptions) push(s.value, s.label);
    for (const g of groups) push(g.ca_lam_viec, g.ca_lam_viec);
    if (form.caLamViec) push(form.caLamViec, form.caLamViec);
    return out;
  }, [shiftOptions, groups, form.caLamViec]);

  /** "maMay||ngay" → tập ca đã có lịch (để loại ca đã sắp khi thêm mới). */
  const scheduledCaByMachineDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const g of groups) {
      const k = `${g.ma_may}||${g.ngay_lam_viec}`;
      let set = map.get(k);
      if (!set) {
        set = new Set<string>();
        map.set(k, set);
      }
      set.add(g.ca_lam_viec);
    }
    return map;
  }, [groups]);

  const availableShiftOptions = useMemo<ShiftOpt[]>(() => {
    if (editingKey || !form.maMay || !form.ngayLamViec) return formShiftOptions;
    const taken = scheduledCaByMachineDate.get(`${form.maMay}||${form.ngayLamViec}`) ?? new Set<string>();
    const list = formShiftOptions.filter(s => !taken.has(s.value) || s.value === form.caLamViec);
    return list;
  }, [editingKey, form.maMay, form.ngayLamViec, form.caLamViec, formShiftOptions, scheduledCaByMachineDate]);

  const duplicateGroup = useMemo(() => {
    if (!form.maMay || !form.ngayLamViec || !form.caLamViec) return false;
    const key = groupKey(form.maMay, form.ngayLamViec, form.caLamViec);
    return key !== editingKey && groups.some(g => g.key === key);
  }, [form.maMay, form.ngayLamViec, form.caLamViec, editingKey, groups]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    if (!canCreate) return;
    setEditingKey('');
    setForm({
      ...emptyForm(),
      maMay: filterMachine || '',
      caLamViec: filterShift || '',
      ngayLamViec: filterDate || todayISO()
    });
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const openEdit = (group: SchedGroup) => {
    if (!canEdit) return;
    setEditingKey(group.key);
    setForm(groupToForm(group));
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingKey('');
    setForm(emptyForm());
  };

  const updatePerson = (key: string, patch: Partial<PersonForm>) => {
    setForm(prev => ({
      ...prev,
      people: prev.people.map(p => (p.key === key ? { ...p, ...patch } : p))
    }));
  };

  const addPerson = () => {
    setForm(prev => ({ ...prev, people: [...prev.people, emptyPerson('Nhân sự bổ sung', true)] }));
  };

  const removePerson = (key: string) => {
    setForm(prev => ({ ...prev, people: prev.people.filter(p => !(p.key === key && p.removable)) }));
  };

  const handleSave = async () => {
    if (!form.maMay.trim()) return setError('Vui lòng chọn máy.');
    if (!form.caLamViec.trim()) return setError('Vui lòng chọn ca làm việc.');
    if (!form.ngayLamViec.trim()) return setError('Vui lòng chọn ngày làm việc.');

    const filled = form.people.filter(p => p.maNhanSu.trim());
    if (filled.length === 0) return setError('Vui lòng chọn ít nhất 1 nhân sự.');

    const seen = new Set<string>();
    for (const p of filled) {
      if (seen.has(p.maNhanSu)) {
        return setError(`Nhân sự ${staffName(p.maNhanSu)} bị chọn trùng trong cùng lịch.`);
      }
      seen.add(p.maNhanSu);
      if (p.thoiGianBatDau && p.thoiGianKetThuc && p.thoiGianBatDau >= p.thoiGianKetThuc) {
        return setError(`${staffName(p.maNhanSu)}: giờ bắt đầu phải nhỏ hơn giờ kết thúc.`);
      }
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ma_may: form.maMay.trim(),
        may: machineName(form.maMay.trim()),
        ngay_lam_viec: form.ngayLamViec.trim(),
        ca_lam_viec: form.caLamViec.trim(),
        ghi_chu: form.ghiChu.trim(),
        nhan_su: filled.map(p => ({
          vai_tro: p.vaiTro,
          ma_nhan_su: p.maNhanSu.trim(),
          thoi_gian_bat_dau: p.thoiGianBatDau,
          thoi_gian_ket_thuc: p.thoiGianKetThuc,
          removable: p.removable
        }))
      };
      const res = await fetch('/api/phan-cong-nhan-su/nhom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không lưu được lịch làm việc.');
      setMessage(editingKey ? 'Đã cập nhật lịch làm việc.' : 'Đã thêm lịch làm việc.');
      closeForm();
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Không lưu được lịch làm việc.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (group: SchedGroup) => {
    if (!canDelete) return;
    if (!window.confirm(`Xóa toàn bộ lịch làm việc của ${group.ten_may || group.ma_may} · ${formatDate(group.ngay_lam_viec)} · ${group.ca_lam_viec}?`)) return;
    setError('');
    setMessage('');
    try {
      const params = new URLSearchParams({
        ma_may: group.ma_may,
        ngay_lam_viec: group.ngay_lam_viec,
        ca_lam_viec: group.ca_lam_viec
      });
      const res = await fetch(`/api/phan-cong-nhan-su/nhom?${params}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không xóa được lịch làm việc.');
      setMessage('Đã xóa lịch làm việc.');
      if (detailGroup?.key === group.key) setDetailGroup(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Không xóa được lịch làm việc.');
    }
  };

  const handleDeleteRow = async (row: SchedRow) => {
    if (!canDelete) return;
    if (!window.confirm(`Xóa ${staffName(row.ma_nhan_su)} (${row.vai_tro || '—'}) khỏi lịch này?`)) return;
    try {
      const res = await fetch(`/api/phan-cong-nhan-su/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không xóa được dòng phân công.');
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Không xóa được dòng phân công.');
    }
  };

  // Đồng bộ detailGroup với dữ liệu mới sau reload.
  useEffect(() => {
    if (!detailGroup) return;
    const fresh = groups.find(g => g.key === detailGroup.key) || null;
    setDetailGroup(fresh);
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Quay lại
          </button>
          <h1 className="text-lg font-black text-zinc-950">Sắp xếp lịch làm việc nhân viên</h1>
        </div>

        {/* In lịch làm việc theo ngày */}
        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <label className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Ngày in lịch</span>
            <input
              type="date"
              value={printDate}
              onChange={e => setPrintDate(e.target.value)}
              className={`${inputClass} w-44`}
            />
          </label>
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            disabled={!printDate}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-xs font-extrabold text-zinc-800 transition hover:border-zinc-950 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Xem trước &amp; in lịch làm việc
          </button>
        </section>

        {error && !showForm ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>
        ) : null}
        {message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            {message}
          </p>
        ) : null}

        {/* Filter bar */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Ngày</span>
              <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className={inputClass}>
                <option value="">Tất cả</option>
                {filterDates.map(d => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Ca</span>
              <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className={inputClass}>
                <option value="">Tất cả</option>
                {filterShifts.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Máy</span>
              <select value={filterMachine} onChange={e => setFilterMachine(e.target.value)} className={inputClass}>
                <option value="">Tất cả</option>
                {filterMachines.map(code => (
                  <option key={code} value={code}>{machineName(code)}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              {canCreate ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
                >
                  <Plus className="h-4 w-4" />
                  Thêm lịch làm việc
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* List */}
        <section className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white py-16">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm font-bold text-zinc-500">
              Chưa có lịch làm việc. Bấm “Thêm lịch làm việc”.
            </div>
          ) : (
            filteredGroups.map(group => {
              const filledRows = group.rows.filter(r => r.ma_nhan_su);
              return (
                <div key={group.key} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-zinc-950 px-2 py-1 text-xs font-bold text-white">
                          {group.ten_may || group.ma_may}
                        </span>
                        <span className="text-sm font-black text-zinc-800">{formatDate(group.ngay_lam_viec)}</span>
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-bold text-zinc-600">
                          {group.ca_lam_viec}
                        </span>
                        <span className="text-xs font-bold text-zinc-400">· {filledRows.length} nhân sự</span>
                        {group.ma_lenh_sx ? (
                          <span className="font-mono text-[11px] font-bold text-zinc-400">· {group.ma_lenh_sx}</span>
                        ) : null}
                      </div>
                      {group.ghi_chu ? (
                        <p className="text-xs font-semibold text-zinc-500">Ghi chú: {group.ghi_chu}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailGroup(group)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-[11px] font-bold text-sky-700 hover:bg-sky-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Chi tiết
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => openEdit(group)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteGroup(group)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {filledRows.map(row => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-xs"
                      >
                        <span className="min-w-[92px] font-bold text-zinc-500">{row.vai_tro || '—'}</span>
                        <span className="font-black text-zinc-800">{staffName(row.ma_nhan_su)}</span>
                        {row.thoi_gian_bat_dau || row.thoi_gian_ket_thuc ? (
                          <span className="text-zinc-400">
                            · {row.thoi_gian_bat_dau || '--:--'} - {row.thoi_gian_ket_thuc || '--:--'}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* Form modal */}
      {showForm && (canCreate || canEdit) ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                {editingKey ? 'Sửa lịch làm việc' : 'Thêm lịch làm việc'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>
              ) : null}
              {duplicateGroup ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                  Nhóm lịch này (Máy · ngày · ca) đã tồn tại — lưu sẽ ghi đè lịch cũ.
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                    Máy <span className="text-[#ef1b2d]">*</span>
                  </span>
                  <SearchableSelect
                    value={form.maMay}
                    onChange={value => setForm(prev => ({ ...prev, maMay: value, caLamViec: editingKey ? prev.caLamViec : '' }))}
                    options={machines}
                    placeholder="Chọn máy..."
                    getValue={item => (item as MachineOpt).code}
                    getLabel={item => (item as MachineOpt).name}
                    getSearchText={item => `${(item as MachineOpt).code} ${(item as MachineOpt).name}`}
                    maxResults={80}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                    Ca làm việc <span className="text-[#ef1b2d]">*</span>
                  </span>
                  <select
                    value={form.caLamViec}
                    onChange={e => setForm(prev => ({ ...prev, caLamViec: e.target.value }))}
                    disabled={!form.maMay}
                    className={inputClass}
                  >
                    <option value="">Chọn ca</option>
                    {availableShiftOptions.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                    Ngày làm việc <span className="text-[#ef1b2d]">*</span>
                  </span>
                  <input
                    type="date"
                    value={form.ngayLamViec}
                    onChange={e => setForm(prev => ({ ...prev, ngayLamViec: e.target.value }))}
                    disabled={!form.maMay}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Ghi chú lịch làm việc</span>
                <input
                  value={form.ghiChu}
                  onChange={e => setForm(prev => ({ ...prev, ghiChu: e.target.value }))}
                  className={inputClass}
                  placeholder="Nội dung chung của lịch (không phụ thuộc ca hay máy)"
                />
              </label>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Nhân sự ({form.people.filter(p => p.maNhanSu).length}/{form.people.length})
                </p>
                <button
                  type="button"
                  onClick={addPerson}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-2.5 text-[11px] font-extrabold text-[#ef1b2d] hover:bg-red-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm nhân sự
                </button>
              </div>

              <div className="space-y-2">
                {form.people.map(person => (
                  <div
                    key={person.key}
                    className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 sm:grid-cols-[130px_minmax(0,1fr)_100px_100px_32px]"
                  >
                    {person.removable ? (
                      <input
                        value={person.vaiTro}
                        onChange={e => updatePerson(person.key, { vaiTro: e.target.value })}
                        className={`${inputClass} h-9`}
                        placeholder="Vai trò"
                      />
                    ) : (
                      <span className="flex h-9 items-center rounded-lg bg-white px-2 text-xs font-black text-zinc-600 ring-1 ring-inset ring-zinc-200">
                        {person.vaiTro}
                      </span>
                    )}
                    <SearchableSelect
                      value={person.maNhanSu}
                      onChange={value => updatePerson(person.key, { maNhanSu: value })}
                      options={staff}
                      placeholder="Chọn nhân sự..."
                      getValue={item => (item as StaffOpt).code}
                      getLabel={item => `${(item as StaffOpt).name}`}
                      getSearchText={item => `${(item as StaffOpt).code} ${(item as StaffOpt).name} ${(item as StaffOpt).department}`}
                      inputClassName={`${inputClass} h-9`}
                    />
                    <input
                      type="time"
                      value={person.thoiGianBatDau}
                      onChange={e => updatePerson(person.key, { thoiGianBatDau: e.target.value })}
                      className={`${inputClass} h-9 px-1 text-xs`}
                    />
                    <input
                      type="time"
                      value={person.thoiGianKetThuc}
                      onChange={e => updatePerson(person.key, { thoiGianKetThuc: e.target.value })}
                      className={`${inputClass} h-9 px-1 text-xs`}
                    />
                    <button
                      type="button"
                      onClick={() => removePerson(person.key)}
                      disabled={!person.removable}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                      title={person.removable ? 'Xóa dòng' : 'Vai trò mặc định không xóa được'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingKey ? 'Cập nhật' : 'Lưu lịch'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Detail modal */}
      {detailGroup ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết lịch làm việc</h3>
              <button
                type="button"
                onClick={() => setDetailGroup(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Máy</p>
                  <p className="font-black text-zinc-800">{detailGroup.ten_may || detailGroup.ma_may}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Ngày làm việc</p>
                  <p className="font-bold text-zinc-800">{formatDate(detailGroup.ngay_lam_viec)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Ca làm việc</p>
                  <p className="font-bold text-zinc-800">{detailGroup.ca_lam_viec}</p>
                </div>
                {detailGroup.ma_lenh_sx ? (
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Lệnh sản xuất</p>
                    <p className="font-mono font-bold text-zinc-700">{detailGroup.ma_lenh_sx}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Số nhân sự</p>
                  <p className="font-bold text-zinc-800">{detailGroup.rows.filter(r => r.ma_nhan_su).length}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Ghi chú chung</p>
                  <p className="font-semibold text-zinc-700">{detailGroup.ghi_chu || '—'}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => {
                        const g = detailGroup;
                        setDetailGroup(null);
                        openEdit(g);
                      }}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Sửa
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteGroup(detailGroup)}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-3 py-2 font-black">Vai trò</th>
                      <th className="px-3 py-2 font-black">Nhân sự</th>
                      <th className="px-3 py-2 font-black">Khung giờ</th>
                      {canDelete ? <th className="px-3 py-2 text-center font-black">Xóa</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detailGroup.rows.filter(r => r.ma_nhan_su).map(row => (
                      <tr key={row.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-bold text-zinc-500">{row.vai_tro || '—'}</td>
                        <td className="px-3 py-2 font-black text-zinc-800">{staffName(row.ma_nhan_su)}</td>
                        <td className="px-3 py-2 text-zinc-600">
                          {row.thoi_gian_bat_dau || row.thoi_gian_ket_thuc
                            ? `${row.thoi_gian_bat_dau || '--:--'} - ${row.thoi_gian_ket_thuc || '--:--'}`
                            : '—'}
                        </td>
                        {canDelete ? (
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => void handleDeleteRow(row)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {detailGroup.rows.filter(r => r.ma_nhan_su).length === 0 ? (
                      <tr>
                        <td colSpan={canDelete ? 4 : 3} className="px-3 py-6 text-center font-bold text-zinc-400">
                          Chưa có nhân sự.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <LichLamViecPrintModal ngay={printDate} isOpen={printOpen} onClose={() => setPrintOpen(false)} />
    </div>
  );
}
