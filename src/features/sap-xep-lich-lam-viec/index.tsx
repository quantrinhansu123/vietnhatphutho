import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, ChevronLeft, Eye, Loader2, MessageSquarePlus, Pencil, Plus, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import { useTabAccess } from '../../app/useTabAccess';
import { DateInputVi } from '../../components/shared/DateInputVi';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import {
  getProductionShiftOptions,
  normalizeShiftSettings,
  type ShiftSetting
} from '../../utils/shiftSettings';
import { LichLamViecPrintModal } from './LichLamViecPrintModal';

/** Vai trò mặc định cũ — dùng cho batch / dữ liệu chưa gắn máy. */
const DEFAULT_ROLES = ['Trưởng ca', 'Nhân sự chính', 'Thợ phụ', 'Học việc'] as const;

/** Vai trò cố định theo nhóm máy (thêm form lịch). */
const ROLES_DAC_SONG_RONG = ['Trưởng ca', 'Trộn', 'Ra Tấm'] as const;
const ROLES_BAM_NEP = ['Trưởng ca', 'Thợ'] as const;

/** Tên phòng ban được lọc — chỉ load nhân sự thuộc phòng ban này. */
const PRODUCTION_WORKSHOP_DEPT = 'PHÂN XƯỞNG SẢN XUẤT';

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
const SCHEDULE_NOTE_MARKER = '__SCHEDULE_NOTE__';

function normalizeMachineText(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Vai trò cố định theo tên/mã máy — chưa gồm ô trống cuối. */
function resolveFixedRolesForMachine(machineName: string, machineCode = ''): string[] {
  const text = normalizeMachineText(`${machineName} ${machineCode}`);
  if (
    text.includes('bam nuoc') ||
    text.includes('may bam') ||
    /(^| )nep( |$)/.test(text) ||
    text.includes('may nep')
  ) {
    return [...ROLES_BAM_NEP];
  }
  if (text.includes('dac') || text.includes('song') || text.includes('rong')) {
    return [...ROLES_DAC_SONG_RONG];
  }
  return [...ROLES_DAC_SONG_RONG];
}

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

/** Mỗi dòng vai trò — maNhanSuList là mảng mã nhân sự (chọn nhiều). */
type PersonForm = {
  key: string;
  vaiTro: string;
  maNhanSuList: string[];
  removable: boolean;
};

type ScheduleBlock = {
  key: string;
  maMay: string;
  caLamViecList: string[];
  people: PersonForm[];
};

type ShiftTimeRange = { start: string; end: string };

function buildShiftTimeMap(settings: ShiftSetting[]): Map<string, ShiftTimeRange> {
  const map = new Map<string, ShiftTimeRange>();
  for (const s of settings) {
    const range = {
      start: s.startTime || '',
      end: s.endTime || ''
    };
    if (s.name) map.set(s.name, range);
    if (s.code) map.set(s.code, range);
  }
  return map;
}

function lookupShiftTimes(ca: string, timeMap: Map<string, ShiftTimeRange>): ShiftTimeRange {
  const key = String(ca || '').trim();
  if (!key) return { start: '', end: '' };
  if (timeMap.has(key)) return timeMap.get(key)!;
  for (const [name, range] of timeMap.entries()) {
    if (name.toLowerCase() === key.toLowerCase()) return range;
    if (key.includes(name) || name.includes(key)) return range;
  }
  return { start: '', end: '' };
}


// ── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Bỏ trùng + bỏ rỗng, giữ kiểu string[] */
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
  return d && m && y ? `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}` : dateStr;
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
      if (str(r.ma_nhan_su) === SCHEDULE_NOTE_MARKER) return null;
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

/** Chỉ lấy nhân sự thuộc phòng ban PHÂN XƯỞNG SẢN XUẤT. */
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
      // Chỉ lấy phòng ban PHÂN XƯỞNG SẢN XUẤT (so sánh không phân biệt hoa thường)
      if (deptName.trim().toUpperCase() !== PRODUCTION_WORKSHOP_DEPT.toUpperCase()) continue;
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
  maNhanSuList: [],
  removable
});

/**
 * Gắn vai trò theo máy, giữ nguyên nhân sự theo thứ tự ô.
 * Luôn có thêm 1 ô trống (removable) ngay sau các vai trò cố định.
 */
function buildPeopleForMachineRoles(
  machineName: string,
  machineCode: string,
  existing: PersonForm[] = []
): PersonForm[] {
  const fixedRoles = resolveFixedRolesForMachine(machineName, machineCode);
  const next: PersonForm[] = fixedRoles.map((role, index) => {
    const prev = existing[index];
    return {
      key: prev?.key || uid(),
      vaiTro: role,
      maNhanSuList: prev ? [...prev.maNhanSuList] : [],
      removable: false
    };
  });

  const emptySlotIndex = fixedRoles.length;
  const prevEmpty = existing[emptySlotIndex];
  next.push({
    key: prevEmpty?.key || uid(),
    vaiTro: '',
    maNhanSuList: prevEmpty ? [...prevEmpty.maNhanSuList] : [],
    removable: true
  });

  for (let i = emptySlotIndex + 1; i < existing.length; i++) {
    const prev = existing[i];
    next.push({
      key: prev.key,
      vaiTro: prev.vaiTro,
      maNhanSuList: [...prev.maNhanSuList],
      removable: true
    });
  }

  return next;
}

const emptyBlock = (
  overrides: Partial<Omit<ScheduleBlock, 'key' | 'people'>> & { people?: PersonForm[] } = {}
): ScheduleBlock => ({
  key: uid(),
  maMay: overrides.maMay ?? '',
  caLamViecList: overrides.caLamViecList ? [...overrides.caLamViecList] : [],
  people: overrides.people
    ? overrides.people.map(p => ({
        key: uid(),
        vaiTro: p.vaiTro,
        maNhanSuList: [...p.maNhanSuList],
        removable: p.removable
      }))
    : [emptyPerson('', true)]
});

/** Ghép các dòng đã lưu của 1 nhóm vào 4 vai trò mặc định + các dòng bổ sung. */
function groupToBlock(group: SchedGroup): ScheduleBlock {
  // Gom nhân sự theo vai trò
  const byRole = new Map<string, string[]>();
  for (const row of group.rows) {
    const role = row.vai_tro || 'Nhân sự bổ sung';
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(row.ma_nhan_su);
  }

  const usedRoles = new Set<string>();
  const people: PersonForm[] = DEFAULT_ROLES.map(role => {
    usedRoles.add(role);
    return {
      key: uid(),
      vaiTro: role,
      maNhanSuList: byRole.get(role) || [],
      removable: false
    };
  });

  // Thêm các vai trò bổ sung không phải mặc định
  for (const [role, codes] of byRole.entries()) {
    if (usedRoles.has(role)) continue;
    people.push({
      key: uid(),
      vaiTro: role,
      maNhanSuList: codes,
      removable: true
    });
  }

  return {
    key: uid(),
    maMay: group.ma_may,
    caLamViecList: [group.ca_lam_viec],
    people
  };
}

// ── Multi-select cho nhân sự ──────────────────────────────────────────────────
interface MultiStaffSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  staff: StaffOpt[];
  staffByCode: Map<string, StaffOpt>;
}

function MultiStaffSelect({ values, onChange, staff, staffByCode }: MultiStaffSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return staff.slice(0, 80);
    const q = search.toLowerCase();
    return staff.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    ).slice(0, 80);
  }, [staff, search]);

  const toggle = (code: string) => {
    const current = Array.isArray(values) ? values : [];
    if (current.includes(code)) {
      onChange(current.filter(v => v !== code));
    } else {
      onChange([...current, code]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="min-h-[36px] w-full cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm focus-within:border-[#ef1b2d]"
        onClick={() => setOpen(o => !o)}
      >
        {(!values || values.length === 0) ? (
          <span className="text-zinc-400">Chọn nhân sự...</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {values.map(code => (
              <span
                key={code}
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-[#ef1b2d] ring-1 ring-inset ring-red-200"
              >
                {staffByCode.get(code)?.name || code}
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(code); }}
                  className="hover:text-red-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-xl">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-full rounded border border-zinc-200 px-2 text-xs outline-none focus:border-[#ef1b2d]"
              placeholder="Tìm nhân sự..."
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">Không tìm thấy.</p>
            ) : (
              filtered.map(s => (
                <label
                  key={s.code}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={values.includes(s.code)}
                    onChange={() => toggle(s.code)}
                    className="accent-[#ef1b2d]"
                  />
                  <span className="font-semibold text-zinc-800">{s.name}</span>
                  <span className="text-zinc-400">{s.code}</span>
                </label>
              ))
            )}
          </div>
          <div className="border-t border-zinc-100 px-3 py-2 text-right">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-800"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Multi-select cho ca làm việc ──────────────────────────────────────────────
interface MultiShiftSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: ShiftOpt[];
  /** Tăng giá trị này để mở dropdown từ nút bên ngoài. */
  openRequest?: number;
}

function MultiShiftSelect({ values, onChange, options, openRequest = 0 }: MultiShiftSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openRequest > 0) setOpen(true);
  }, [openRequest]);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (value: string) => {
    const current = Array.isArray(values) ? values : [];
    if (current.includes(value)) {
      onChange(current.filter(v => v !== value));
    } else {
      onChange([...current, value]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="min-h-[40px] w-full cursor-pointer rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm focus-within:border-[#ef1b2d]"
        onClick={() => setOpen(o => !o)}
      >
        {(!values || values.length === 0) ? (
          <span className="flex h-8 items-center text-zinc-400">Chọn ca làm việc...</span>
        ) : (
          <div className="flex flex-wrap gap-1 py-0.5">
            {values.map(v => {
              const opt = options.find(o => o.value === v);
              return (
                <span
                  key={v}
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-700 ring-1 ring-inset ring-zinc-200"
                >
                  {opt?.label || v}
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(v); }}
                    className="hover:text-zinc-950"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-xl">
          <div className="max-h-52 overflow-y-auto p-1">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">Chưa có ca nào. Hãy chọn máy và ngày trước.</p>
            ) : (
              options.map(s => (
                <label
                  key={s.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-xs hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={values.includes(s.value)}
                    onChange={() => toggle(s.value)}
                    className="accent-[#ef1b2d]"
                  />
                  <span className="font-semibold text-zinc-800">{s.label}</span>
                </label>
              ))
            )}
          </div>
          <div className="border-t border-zinc-100 px-3 py-2 text-right">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-800"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
  const [shiftTimeMap, setShiftTimeMap] = useState<Map<string, ShiftTimeRange>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [filterDate, setFilterDate] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterMachine, setFilterMachine] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState('');
  const [formNgayLamViec, setFormNgayLamViec] = useState('');
  const [formBlocks, setFormBlocks] = useState<ScheduleBlock[]>(() => [emptyBlock()]);

  const [detailGroup, setDetailGroup] = useState<SchedGroup | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  const [printDate, setPrintDate] = useState(todayISO());

  // ── Batch edit (sửa lịch theo ngày & máy) ─────────────────────────────────
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchDate, setBatchDate] = useState('');
  const [batchMachine, setBatchMachine] = useState('');
  const [batchCaList, setBatchCaList] = useState<string[]>([]);
  const [batchPeople, setBatchPeople] = useState<PersonForm[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [batchMessage, setBatchMessage] = useState('');

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
      const settings = normalizeShiftSettings(settingData);
      setMachines(normalizeMachines(mayData));
      setStaff(normalizeStaff(staffData));
      setShiftOptions(getProductionShiftOptions(settings));
      setShiftTimeMap(buildShiftTimeMap(settings));
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

  const groupsForFilterDate = useMemo(
    () => (filterDate ? groups.filter(g => g.ngay_lam_viec === filterDate) : groups),
    [groups, filterDate]
  );
  const filterShifts = useMemo(
    () => uniq(groupsForFilterDate.map(g => g.ca_lam_viec)).sort((a, b) => a.localeCompare(b, 'vi')),
    [groupsForFilterDate]
  );
  const filterMachines = useMemo(
    () =>
      uniq(groupsForFilterDate.map(g => g.ma_may)).sort((a, b) =>
        machineName(a).localeCompare(machineName(b), 'vi')
      ),
    [groupsForFilterDate, machineName]
  );

  useEffect(() => {
    if (filterShift && !filterShifts.includes(filterShift)) setFilterShift('');
  }, [filterShift, filterShifts]);
  useEffect(() => {
    if (filterMachine && !filterMachines.includes(filterMachine)) setFilterMachine('');
  }, [filterMachine, filterMachines]);

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

  /**
   * Ca options cho từng tổ hợp:
   * - Chỉ hiển thị khi đã chọn máy VÀ ngày (ngày dùng chung ở đầu form)
   * - Loại ca đã có lịch + ca đã chọn ở tổ hợp khác cùng máy/ngày
   */
  const getBlockShiftOptions = useCallback(
    (block: ScheduleBlock): ShiftOpt[] => {
      if (!block.maMay || !formNgayLamViec) return [];

      const taken = new Set<string>();
      for (const g of groups) {
        if (g.ma_may === block.maMay && g.ngay_lam_viec === formNgayLamViec) {
          if (g.key === editingKey) continue;
          taken.add(g.ca_lam_viec);
        }
      }
      for (const other of formBlocks) {
        if (other.key === block.key) continue;
        if (other.maMay !== block.maMay) continue;
        for (const ca of other.caLamViecList) taken.add(ca);
      }

      const seen = new Set<string>();
      const out: ShiftOpt[] = [];
      const push = (value: string, label: string) => {
        if (value && !seen.has(value)) {
          seen.add(value);
          out.push({ value, label: label || value });
        }
      };
      for (const s of shiftOptions) {
        if (!taken.has(s.value)) push(s.value, s.label);
      }
      for (const ca of block.caLamViecList) push(ca, ca);
      return out;
    },
    [shiftOptions, groups, formBlocks, editingKey, formNgayLamViec]
  );

  const duplicateGroup = useMemo(() => {
    return formBlocks.some(block => {
      if (!block.maMay || !formNgayLamViec || block.caLamViecList.length === 0) return false;
      return block.caLamViecList.some(ca => {
        const key = groupKey(block.maMay, formNgayLamViec, ca);
        return key !== editingKey && groups.some(g => g.key === key);
      });
    });
  }, [formBlocks, editingKey, groups, formNgayLamViec]);

  const updateBlock = (blockKey: string, patch: Partial<ScheduleBlock>) => {
    setFormBlocks(prev => prev.map(b => (b.key === blockKey ? { ...b, ...patch } : b)));
  };

  // ── Sửa lịch theo ngày & máy ──────────────────────────────────────────────
  const batchMatchingGroups = useMemo(() => {
    if (!batchMachine || !batchDate) return [];
    return groups.filter(g => g.ma_may === batchMachine && g.ngay_lam_viec === batchDate);
  }, [groups, batchMachine, batchDate]);

  const batchShiftOptions = useMemo<ShiftOpt[]>(() => {
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
    for (const ca of batchCaList) push(ca, ca);
    return out;
  }, [shiftOptions, groups, batchCaList]);

  // Nạp dữ liệu khi đổi máy hoặc ngày
  const loadBatchDataForMachineAndDate = useCallback((date: string, machineCode: string) => {
    if (!date || !machineCode) {
      setBatchCaList([]);
      setBatchPeople(DEFAULT_ROLES.map(role => emptyPerson(role, false)));
      return;
    }
    const matching = groups
      .filter(g => g.ma_may === machineCode && g.ngay_lam_viec === date)
      .sort((a, b) => a.ca_lam_viec.localeCompare(b.ca_lam_viec, 'vi'));

    if (matching.length === 0) {
      setBatchCaList([]);
      setBatchPeople(DEFAULT_ROLES.map(role => emptyPerson(role, false)));
      return;
    }

    // Gom vai trò và nhân sự từ các ca hiện có
    const byRole = new Map<string, string[]>();
    for (const g of matching) {
      for (const row of g.rows) {
        const role = row.vai_tro || 'Nhân sự bổ sung';
        if (!byRole.has(role)) byRole.set(role, []);
        byRole.get(role)!.push(row.ma_nhan_su);
      }
    }
    const usedRoles = new Set<string>();
    const people: PersonForm[] = DEFAULT_ROLES.map(role => {
      usedRoles.add(role);
      return {
        key: uid(),
        vaiTro: role,
        maNhanSuList: uniq(byRole.get(role) || []),
        removable: false
      };
    });
    for (const [role, codes] of byRole.entries()) {
      if (usedRoles.has(role)) continue;
      people.push({
        key: uid(),
        vaiTro: role,
        maNhanSuList: uniq(codes),
        removable: true
      });
    }

    setBatchCaList(matching.map(g => g.ca_lam_viec));
    setBatchPeople(people);
  }, [groups]);

  const openBatchModal = () => {
    const initDate = filterDate || todayISO();
    const initMachine = filterMachine || '';
    setBatchDate(initDate);
    setBatchMachine(initMachine);
    setBatchError('');
    setBatchMessage('');
    loadBatchDataForMachineAndDate(initDate, initMachine);
    setShowBatchModal(true);
  };

  const closeBatchModal = () => {
    setShowBatchModal(false);
    setBatchDate('');
    setBatchMachine('');
    setBatchCaList([]);
    setBatchPeople(DEFAULT_ROLES.map(role => emptyPerson(role, false)));
    setBatchError('');
    setBatchMessage('');
  };

  const updateBatchPerson = (key: string, patch: Partial<PersonForm>) => {
    setBatchPeople(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)));
  };

  const addBatchPerson = () => {
    setBatchPeople(prev => [...prev, emptyPerson('Nhân sự bổ sung', true)]);
  };

  const removeBatchPerson = (key: string) => {
    setBatchPeople(prev => prev.filter(p => !(p.key === key && p.removable)));
  };

  const handleSaveBatch = async () => {
    if (!batchMachine.trim()) return setBatchError('Vui lòng chọn máy.');
    if (!batchDate.trim()) return setBatchError('Vui lòng chọn ngày làm việc.');
    if (batchCaList.length === 0) return setBatchError('Vui lòng chọn ít nhất 1 ca làm việc.');

    const filledPeople = batchPeople.filter(p => p.maNhanSuList.length > 0);
    if (filledPeople.length === 0) return setBatchError('Vui lòng chọn ít nhất 1 nhân sự.');

    // Kiểm tra trùng nhân sự trong cùng lịch
    const allCodes = filledPeople.flatMap(p => p.maNhanSuList);
    const seenCodes = new Set<string>();
    for (const code of allCodes) {
      if (seenCodes.has(code)) {
        return setBatchError(`Nhân sự ${staffName(code)} bị chọn trùng trong cùng lịch.`);
      }
      seenCodes.add(code);
    }

    // Kiểm tra trùng nhân sự với các máy khác trong cùng ca
    for (const ca of batchCaList) {
      const conflictingGroup = groups.find(group =>
        !(group.ma_may === batchMachine && group.ngay_lam_viec === batchDate) &&
        group.ngay_lam_viec === batchDate &&
        group.ca_lam_viec === ca &&
        group.rows.some(row => allCodes.includes(row.ma_nhan_su))
      );
      if (conflictingGroup) {
        const dupCode = allCodes.find(code =>
          conflictingGroup.rows.some(row => row.ma_nhan_su === code)
        );
        return setBatchError(
          `Ca ${ca}: Nhân sự ${dupCode ? staffName(dupCode) : ''} đã được xếp ở máy ${conflictingGroup.ten_may || conflictingGroup.ma_may} trong cùng ca.`
        );
      }
    }

    setBatchSaving(true);
    setBatchError('');
    setBatchMessage('');
    try {
      // Xóa các ca cũ đã được xếp trên máy này trong ngày này nhưng không còn trong batchCaList
      const existingMatching = groups.filter(g => g.ma_may === batchMachine && g.ngay_lam_viec === batchDate);
      for (const g of existingMatching) {
        if (!batchCaList.includes(g.ca_lam_viec)) {
          const params = new URLSearchParams({
            ma_may: g.ma_may,
            ngay_lam_viec: g.ngay_lam_viec,
            ca_lam_viec: g.ca_lam_viec
          });
          await fetch(`/api/phan-cong-nhan-su/nhom?${params}`, { method: 'DELETE' });
        }
      }

      // Lưu từng ca đã chọn
      for (const ca of batchCaList) {
        const times = resolveTimesForCa(ca);
        const nhanSuList = filledPeople.flatMap(p =>
          p.maNhanSuList.map(code => ({
            vai_tro: p.vaiTro,
            ma_nhan_su: code.trim(),
            thoi_gian_bat_dau: times.start,
            thoi_gian_ket_thuc: times.end,
            removable: p.removable
          }))
        );
        const payload = {
          ma_may: batchMachine.trim(),
          may: machineName(batchMachine.trim()),
          ngay_lam_viec: batchDate.trim(),
          ca_lam_viec: ca,
          ghi_chu: '',
          nhan_su: nhanSuList
        };
        const res = await fetch('/api/phan-cong-nhan-su/nhom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Không lưu được lịch ca ${ca}.`);
      }

      setMessage('Đã cập nhật lịch làm việc theo ngày và máy thành công.');
      closeBatchModal();
      await loadAll();
    } catch (err: any) {
      setBatchError(err?.message || 'Không lưu được lịch làm việc.');
    } finally {
      setBatchSaving(false);
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const resolveTimesForCa = useCallback(
    (ca: string) => lookupShiftTimes(ca, shiftTimeMap),
    [shiftTimeMap]
  );

  const openCreate = () => {
    if (!canCreate) return;
    setEditingKey('');
    setFormNgayLamViec('');
    setFormBlocks([emptyBlock()]);
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const addScheduleBlock = () => {
    setFormBlocks(prev => {
      const last = prev[prev.length - 1];
      if (!last) return [emptyBlock()];
      return [
        ...prev,
        emptyBlock({
          maMay: last.maMay,
          caLamViecList: [...last.caLamViecList],
          people: last.people
        })
      ];
    });
  };

  const removeScheduleBlock = (blockKey: string) => {
    setFormBlocks(prev => (prev.length <= 1 ? prev : prev.filter(b => b.key !== blockKey)));
  };

  const clearBlockPeople = (blockKey: string) => {
    setFormBlocks(prev =>
      prev.map(block => {
        if (block.key !== blockKey) return block;
        if (!block.maMay) {
          return { ...block, people: [emptyPerson('', true)] };
        }
        const label = machineName(block.maMay);
        return {
          ...block,
          people: buildPeopleForMachineRoles(label, block.maMay, [])
        };
      })
    );
  };

  const openEdit = (group: SchedGroup) => {
    if (!canEdit) return;
    setEditingKey(group.key);
    setFormNgayLamViec(group.ngay_lam_viec);
    setFormBlocks([groupToBlock(group)]);
    setError('');
    setMessage('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingKey('');
    setFormNgayLamViec('');
    setFormBlocks([emptyBlock()]);
  };

  const updatePerson = (blockKey: string, personKey: string, patch: Partial<PersonForm>) => {
    setFormBlocks(prev =>
      prev.map(block =>
        block.key !== blockKey
          ? block
          : {
              ...block,
              people: block.people.map(p => (p.key === personKey ? { ...p, ...patch } : p))
            }
      )
    );
  };

  const addPerson = (blockKey: string) => {
    setFormBlocks(prev =>
      prev.map(block =>
        block.key !== blockKey
          ? block
          : { ...block, people: [...block.people, emptyPerson('Nhân sự bổ sung', true)] }
      )
    );
  };

  const removePerson = (blockKey: string, personKey: string) => {
    setFormBlocks(prev =>
      prev.map(block =>
        block.key !== blockKey
          ? block
          : {
              ...block,
              people: block.people.filter(p => !(p.key === personKey && p.removable))
            }
      )
    );
  };

  const handleSave = async () => {
    if (!formNgayLamViec.trim()) return setError('Vui lòng chọn ngày làm việc.');
    if (formBlocks.length === 0) return setError('Chưa có tổ hợp ca làm việc.');

    for (let i = 0; i < formBlocks.length; i++) {
      const block = formBlocks[i];
      const label = formBlocks.length > 1 ? `Tổ hợp ${i + 1}: ` : '';
      if (!block.maMay.trim()) return setError(`${label}Vui lòng chọn máy.`);
      if (block.caLamViecList.length === 0) return setError(`${label}Vui lòng chọn ít nhất 1 ca làm việc.`);

      const filledPeople = block.people.filter(p => p.maNhanSuList.length > 0);
      if (filledPeople.length === 0) return setError(`${label}Vui lòng chọn ít nhất 1 nhân sự.`);

      const allCodes = filledPeople.flatMap(p => p.maNhanSuList);
      const seenCodes = new Set<string>();
      for (const code of allCodes) {
        if (seenCodes.has(code)) {
          return setError(`${label}Nhân sự ${staffName(code)} bị chọn trùng trong cùng lịch.`);
        }
        seenCodes.add(code);
      }

      for (const ca of block.caLamViecList) {
        const conflictingGroup = groups.find(
          group =>
            group.key !== editingKey &&
            group.ngay_lam_viec === formNgayLamViec.trim() &&
            group.ca_lam_viec === ca &&
            group.rows.some(row => allCodes.includes(row.ma_nhan_su))
        );
        if (conflictingGroup) {
          const dupCode = allCodes.find(code =>
            conflictingGroup.rows.some(row => row.ma_nhan_su === code)
          );
          return setError(
            `${label}Ca ${ca}: Nhân sự ${dupCode ? staffName(dupCode) : ''} đã được xếp ở máy ${conflictingGroup.ten_may || conflictingGroup.ma_may} trong cùng ca.`
          );
        }
      }
    }

    // Trùng ca giữa các tổ hợp trong cùng form
    const seenCombos = new Set<string>();
    for (let i = 0; i < formBlocks.length; i++) {
      const block = formBlocks[i];
      for (const ca of block.caLamViecList) {
        const combo = groupKey(block.maMay.trim(), formNgayLamViec.trim(), ca);
        if (seenCombos.has(combo)) {
          return setError(`Tổ hợp ${i + 1}: trùng máy / ca với tổ hợp khác trong form.`);
        }
        seenCombos.add(combo);
      }
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      for (const block of formBlocks) {
        const filledPeople = block.people.filter(p => p.maNhanSuList.length > 0);
        for (const ca of block.caLamViecList) {
          const times = resolveTimesForCa(ca);
          const nhanSuList = filledPeople.flatMap(p =>
            p.maNhanSuList.map(code => ({
              vai_tro: p.vaiTro,
              ma_nhan_su: code.trim(),
              thoi_gian_bat_dau: times.start,
              thoi_gian_ket_thuc: times.end,
              removable: p.removable
            }))
          );
          const payload = {
            ma_may: block.maMay.trim(),
            may: machineName(block.maMay.trim()),
            ngay_lam_viec: formNgayLamViec.trim(),
            ca_lam_viec: ca,
            ghi_chu: '',
            nhan_su: nhanSuList
          };
          const res = await fetch('/api/phan-cong-nhan-su/nhom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Không lưu được lịch ca ${ca}.`);
        }
      }

      setMessage(
        editingKey
          ? 'Đã cập nhật ca làm việc.'
          : formBlocks.length > 1
            ? `Đã thêm ${formBlocks.length} tổ hợp ca làm việc.`
            : 'Đã thêm ca làm việc.'
      );
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

  const handleNavigateToDispatch = (group: SchedGroup, row: SchedRow) => {
    const prefill = {
      date: group.ngay_lam_viec,
      ma_nhan_su: row.ma_nhan_su,
      ten_nhan_su: staffName(row.ma_nhan_su),
      vai_tro: row.vai_tro || '',
      ma_may: group.ma_may || '',
      ten_may: group.ten_may || machineName(group.ma_may) || group.ma_may || '',
      ca: group.ca_lam_viec || '',
      thoi_gian_bat_dau: row.thoi_gian_bat_dau || '',
      thoi_gian_ket_thuc: row.thoi_gian_ket_thuc || '',
      ma_lenh_sx: group.ma_lenh_sx || row.ma_lenh_sx || ''
    };

    try {
      localStorage.setItem('dieu_dong_prefill', JSON.stringify(prefill));
      sessionStorage.setItem('dieu_dong_prefill', JSON.stringify(prefill));
    } catch {
      // ignore
    }

    const params = new URLSearchParams({
      date: prefill.date,
      ma_nhan_su: prefill.ma_nhan_su,
      ten_nhan_su: prefill.ten_nhan_su,
      vai_tro: prefill.vai_tro,
      ma_may: prefill.ma_may,
      ten_may: prefill.ten_may,
      ca: prefill.ca,
      thoi_gian_bat_dau: prefill.thoi_gian_bat_dau,
      thoi_gian_ket_thuc: prefill.thoi_gian_ket_thuc,
      ma_lenh_sx: prefill.ma_lenh_sx
    });

    window.open(`/dieu-dong-nhan-su?${params.toString()}`, '_blank');
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
            <DateInputVi
              value={printDate}
              onChange={setPrintDate}
              className="w-44"
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
              <div className="flex gap-2">
                <DateInputVi
                  value={filterDate}
                  onChange={next => {
                    setFilterDate(next);
                    if (next) setPrintDate(next);
                  }}
                  className="flex-1"
                />
                {filterDate ? (
                  <button
                    type="button"
                    onClick={() => setFilterDate('')}
                    className="h-10 shrink-0 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                  >
                    Tất cả
                  </button>
                ) : null}
              </div>
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
            <div className="flex items-end gap-2">
              {canCreate ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#ef1b2d] px-2 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
                  title="Thêm ca làm việc"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">Thêm ca làm việc</span>
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={openBatchModal}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-extrabold text-amber-800 transition hover:bg-amber-100"
                  title="Sửa lịch làm việc theo ngày và máy"
                >
                  <Pencil className="h-4 w-4 shrink-0" />
                  <span className="truncate">Sửa theo ngày &amp; máy</span>
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
              {filterDate
                ? `Không có lịch làm việc ngày ${formatDate(filterDate)}.`
                : 'Chưa có lịch làm việc. Bấm "Thêm ca làm việc".'}
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
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintDate(group.ngay_lam_viec);
                          setPrintOpen(true);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 text-[11px] font-bold text-violet-700 hover:bg-violet-100"
                        title="Thêm mới hoặc sửa nhiều ghi chú theo máy / ca"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        Thêm ghi chú
                      </button>
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
                        className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                          <span className="min-w-[80px] font-bold text-zinc-500">{row.vai_tro || '—'}</span>
                          <span className="font-black text-zinc-800">{staffName(row.ma_nhan_su)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleNavigateToDispatch(group, row)}
                          className="inline-flex items-center gap-1 rounded bg-[#ef1b2d] px-2 py-0.5 text-[11px] font-extrabold text-white shadow-xs transition hover:bg-[#b30d1c] shrink-0"
                          title={`Điều động nhân sự ${staffName(row.ma_nhan_su)}`}
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          Điều động
                        </button>
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
                {editingKey ? 'Sửa ca làm việc' : 'Thêm ca làm việc'}
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
                  Một hoặc nhiều ca đã có lịch tồn tại — lưu sẽ ghi đè lịch cũ.
                </p>
              ) : null}

              <label className="block space-y-1.5 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                  Ngày làm việc <span className="text-[#ef1b2d]">*</span>
                  <span className="ml-1 font-normal normal-case text-zinc-400">(chọn 1 lần cho toàn bộ máy / ca)</span>
                </span>
                <DateInputVi
                  value={formNgayLamViec}
                  onChange={val => {
                    setFormNgayLamViec(val);
                    setFormBlocks(prev => prev.map(block => ({ ...block, caLamViecList: [] })));
                  }}
                />
              </label>

              {formBlocks.map((block, blockIndex) => {
                const blockShiftOptions = getBlockShiftOptions(block);
                return (
                  <div
                    key={block.key}
                    className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 sm:p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-wider text-zinc-700">
                        Máy / ca {blockIndex + 1}
                        {formBlocks.length > 1 ? (
                          <span className="ml-2 font-semibold normal-case text-zinc-400">
                            / {formBlocks.length}
                          </span>
                        ) : null}
                      </p>
                      {formBlocks.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeScheduleBlock(block.key)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                          title="Xóa tổ hợp này"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa
                        </button>
                      ) : null}
                    </div>

                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                        Máy <span className="text-[#ef1b2d]">*</span>
                      </span>
                      <SearchableSelect
                        value={block.maMay}
                        onChange={value => {
                          const label =
                            machines.find(item => item.code === value)?.name ||
                            machineName(value) ||
                            value;
                          setFormBlocks(prev =>
                            prev.map(item =>
                              item.key !== block.key
                                ? item
                                : {
                                    ...item,
                                    maMay: value,
                                    caLamViecList: [],
                                    people: buildPeopleForMachineRoles(label, value, item.people)
                                  }
                            )
                          );
                        }}
                        options={machines}
                        placeholder="Chọn máy..."
                        getValue={item => (item as MachineOpt).code}
                        getLabel={item => (item as MachineOpt).name}
                        getSearchText={item => `${(item as MachineOpt).code} ${(item as MachineOpt).name}`}
                        maxResults={80}
                      />
                    </label>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                        Ca làm việc <span className="text-[#ef1b2d]">*</span>
                        {(!block.maMay || !formNgayLamViec) && (
                          <span className="ml-1 font-normal normal-case text-zinc-400">— hãy chọn ngày và máy trước</span>
                        )}
                        {block.maMay && formNgayLamViec && (
                          <span className="ml-1 font-normal normal-case text-zinc-400">(chỉ hiển thị ca chưa có lịch)</span>
                        )}
                      </span>
                      <MultiShiftSelect
                        values={block.caLamViecList}
                        onChange={vals => updateBlock(block.key, { caLamViecList: vals })}
                        options={blockShiftOptions}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                        Nhân sự theo vai trò ({block.people.filter(p => p.maNhanSuList.length > 0).length} vai trò có người)
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {block.people.some(p => p.maNhanSuList.length > 0) && (
                          <button
                            type="button"
                            onClick={() => clearBlockPeople(block.key)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-bold text-zinc-600 hover:bg-zinc-50"
                            title="Xóa trắng danh sách nhân sự đang chọn"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Xóa trắng
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => addPerson(block.key)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-2.5 text-[11px] font-extrabold text-[#ef1b2d] hover:bg-red-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Thêm vai trò
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {block.people.map(person => (
                        <div
                          key={person.key}
                          className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-white p-2.5 sm:grid-cols-[160px_minmax(0,1fr)_32px]"
                        >
                          <input
                            value={person.vaiTro}
                            onChange={e => updatePerson(block.key, person.key, { vaiTro: e.target.value })}
                            className={`${inputClass} h-9`}
                            placeholder="Vai trò"
                          />
                          <MultiStaffSelect
                            values={person.maNhanSuList}
                            onChange={vals => updatePerson(block.key, person.key, { maNhanSuList: vals })}
                            staff={staff}
                            staffByCode={staffByCode}
                          />
                          <button
                            type="button"
                            onClick={() => removePerson(block.key, person.key)}
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
                );
              })}

              <button
                type="button"
                onClick={addScheduleBlock}
                className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#ef1b2d]/40 bg-red-50/50 px-3 text-xs font-extrabold text-[#ef1b2d] hover:bg-red-50"
              >
                <Plus className="h-4 w-4" />
                Thêm máy / ca
              </button>
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
                {editingKey ? 'Cập nhật' : 'Lưu ca'}
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
                      <th className="px-3 py-2 text-center font-black">Điều động</th>
                      {canDelete ? <th className="px-3 py-2 text-center font-black">Xóa</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detailGroup.rows.filter(r => r.ma_nhan_su).map(row => (
                      <tr key={row.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-bold text-zinc-500">{row.vai_tro || '—'}</td>
                        <td className="px-3 py-2 font-black text-zinc-800">{staffName(row.ma_nhan_su)}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleNavigateToDispatch(detailGroup, row)}
                            className="inline-flex items-center gap-1 rounded bg-[#ef1b2d] px-2 py-1 text-[11px] font-extrabold text-white shadow-xs transition hover:bg-[#b30d1c]"
                            title={`Điều động nhân sự ${staffName(row.ma_nhan_su)}`}
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            Điều động
                          </button>
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

      {/* Modal: Sửa lịch làm việc theo ngày và máy */}
      {showBatchModal && canEdit ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  Sửa lịch làm việc theo ngày và máy
                </h3>
              </div>
              <button
                type="button"
                onClick={closeBatchModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {batchError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{batchError}</p>
              ) : null}
              {batchMessage ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{batchMessage}</p>
              ) : null}

              {/* 1. Chọn ngày và chọn máy */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                    Ngày làm việc <span className="text-[#ef1b2d]">*</span>
                  </span>
                  <DateInputVi
                    value={batchDate}
                    onChange={val => {
                      setBatchDate(val);
                      loadBatchDataForMachineAndDate(val, batchMachine);
                    }}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                    Máy <span className="text-[#ef1b2d]">*</span>
                  </span>
                  <SearchableSelect
                    value={batchMachine}
                    onChange={value => {
                      setBatchMachine(value);
                      loadBatchDataForMachineAndDate(batchDate, value);
                    }}
                    options={machines}
                    placeholder="Chọn máy..."
                    getValue={item => (item as MachineOpt).code}
                    getLabel={item => (item as MachineOpt).name}
                    getSearchText={item => `${(item as MachineOpt).code} ${(item as MachineOpt).name}`}
                    maxResults={80}
                  />
                </label>
              </div>

              {/* Thông báo trạng thái lịch hiện có */}
              {!batchDate || !batchMachine ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-xs font-bold text-zinc-500">
                  Vui lòng chọn Ngày làm việc và Máy để tải thông tin ca và danh sách nhân sự.
                </div>
              ) : (
                <>
                  {batchMatchingGroups.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800">
                      Chưa có lịch làm việc cho máy <strong className="font-extrabold">{machineName(batchMachine)}</strong> vào ngày <strong className="font-extrabold">{formatDate(batchDate)}</strong>. Bạn có thể chọn ca và thêm nhân sự để lưu mới ngay tại đây.
                    </div>
                  ) : null}

                  {/* 2. Ca làm việc (chọn nhiều - giống lúc thêm) */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                      Ca làm việc <span className="text-[#ef1b2d]">*</span>
                      <span className="ml-1 text-zinc-400 normal-case">(chọn nhiều ca)</span>
                    </span>
                    <MultiShiftSelect
                      values={batchCaList}
                      onChange={vals => setBatchCaList(vals)}
                      options={batchShiftOptions}
                    />
                  </div>

                  {/* 3. Danh sách nhân viên theo vai trò (giống lúc thêm) */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                      Nhân sự theo vai trò ({batchPeople.filter(p => p.maNhanSuList.length > 0).length} vai trò có người)
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={addBatchPerson}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-2.5 text-[11px] font-extrabold text-[#ef1b2d] hover:bg-red-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Thêm vai trò
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {batchPeople.map(person => (
                      <div
                        key={person.key}
                        className="grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 sm:grid-cols-[160px_minmax(0,1fr)_32px]"
                      >
                        {/* Tên vai trò — luôn cho phép sửa */}
                        <input
                          value={person.vaiTro}
                          onChange={e => updateBatchPerson(person.key, { vaiTro: e.target.value })}
                          className={`${inputClass} h-9`}
                          placeholder="Vai trò"
                        />
                        {/* Chọn nhiều nhân sự */}
                        <MultiStaffSelect
                          values={person.maNhanSuList}
                          onChange={vals => updateBatchPerson(person.key, { maNhanSuList: vals })}
                          staff={staff}
                          staffByCode={staffByCode}
                        />
                        <button
                          type="button"
                          onClick={() => removeBatchPerson(person.key)}
                          disabled={!person.removable}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                          title={person.removable ? 'Xóa dòng' : 'Vai trò mặc định không xóa được'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={closeBatchModal}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSaveBatch()}
                disabled={batchSaving || !batchDate || !batchMachine}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:opacity-60"
              >
                {batchSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cập nhật lịch làm việc
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <LichLamViecPrintModal ngay={printDate} isOpen={printOpen} onClose={() => setPrintOpen(false)} />
    </div>
  );
}
