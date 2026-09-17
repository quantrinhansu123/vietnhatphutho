import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Printer,
  Save,
  StickyNote,
  Trash2,
  X
} from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { normalizeHrBranches } from '../_shared/hr';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import { findMachineByRef, normalizeMachines, type MachineRow } from '../danh-sach-may';
import { useTabAccess } from '../../app/useTabAccess';
import { printSoCheDoMaySlips, type SoCheDoMayPrintSheet } from './print';

// =========================================================================
// SỔ CHẾ ĐỘ MÁY (MÁY ĐẶC) — lưới tháng: 8 khu vực x 3 ca x 31 ngày
// =========================================================================

export const KHU_VUC_MAY_CHE_DO = [
  'Khu Vực Trộn Nhựa',
  'Khu Vực Hút Chân Không',
  'Khu Vực Nòng Xoắn',
  'Khu Vực Khuôn',
  'Khu Vực Lô Ép Quang',
  'Khu Vực Gia Nhiệt Dầu',
  'Khu Vực Lô Kéo & Bàn Cắt',
  'Khu Vực Máy Cuốn + Máy Băm'
];

export const CA_CHE_DO_MAY = ['C1', 'C2', 'C3'];

const STT_W = 44;
const KHU_W = 160;
const CA_W = 52;
const DAY_W = 38;
const STICKY_W = STT_W + KHU_W + CA_W;

export interface SoCheDoMayNote {
  id: string;
  /** Ngày đầy đủ YYYY-MM-DD */
  tu_ngay: string;
  /** Ngày đầy đủ YYYY-MM-DD */
  den_ngay: string;
  /** Mã máy áp dụng (rỗng = tất cả máy) */
  may: string[];
  noi_dung: string;
}

export interface SoCheDoMayHandover {
  ban_giao: string;
  nhan: string;
}

export interface SoCheDoMayRecord {
  id: string;
  chi_nhanh: string;
  /** Mã máy (rỗng = sổ chung Tất cả máy) */
  ma_may: string;
  ten_may: string;
  thang: number;
  nam: number;
  o_che_do: Record<string, string>;
  ban_giao: Record<string, SoCheDoMayHandover>;
  ghi_chu: SoCheDoMayNote[];
}

export function cellKey(khuVuc: number, ca: string, ngay: number): string {
  return `${khuVuc}_${ca}_${ngay}`;
}

/** Số ngày trong tháng — tự tính (không dùng Date) để dùng được tới năm 2999. */
export function daysInMonthCheDo(thang: number, nam: number): number {
  if (thang === 2) {
    const leap = (nam % 4 === 0 && nam % 100 !== 0) || nam % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(thang) ? 30 : 31;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Chuẩn YYYY-MM cho picker tháng + năm. */
export function toMonthStr(thang: number, nam: number): string {
  return `${nam}-${pad2(thang)}`;
}

export function parseMonthStr(value: string): { thang: number; nam: number } | null {
  const m = /^(\d{1,4})-(\d{1,2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const nam = Number(m[1]);
  const thang = Number(m[2]);
  if (!Number.isInteger(thang) || !Number.isInteger(nam)) return null;
  if (thang < 1 || thang > 12 || nam < 1 || nam > 2999) return null;
  return { thang, nam };
}

export function toDateStr(nam: number, thang: number, ngay: number): string {
  return `${nam}-${pad2(thang)}-${pad2(ngay)}`;
}

/** Parse ngày đầy đủ YYYY-MM-DD (năm tới 2999). Null = không hợp lệ. */
export function parseDateStr(value: string): { nam: number; thang: number; ngay: number } | null {
  const m = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const nam = Number(m[1]);
  const thang = Number(m[2]);
  const ngay = Number(m[3]);
  if (thang < 1 || thang > 12 || nam < 1 || nam > 2999) return null;
  if (!Number.isInteger(ngay) || ngay < 1 || ngay > daysInMonthCheDo(thang, nam)) return null;
  return { nam, thang, ngay };
}

export function formatDateVN(value: string): string {
  const p = parseDateStr(value);
  return p ? `${pad2(p.ngay)}/${pad2(p.thang)}/${p.nam}` : String(value || '');
}

/** Đoạn ngày của ghi chú nằm trong tháng sổ (để gộp ô). Null = ngoài tháng. */
export function noteSpanInMonth(
  note: SoCheDoMayNote,
  thang: number,
  nam: number,
  days: number
): { tu: number; den: number } | null {
  const tu = parseDateStr(note.tu_ngay);
  const den = parseDateStr(note.den_ngay);
  if (!tu || !den) return null;
  const start = tu.nam * 12 + tu.thang;
  const end = den.nam * 12 + den.thang;
  const cur = nam * 12 + thang;
  if (end < cur || start > cur) return null;
  const t = start < cur ? 1 : tu.ngay;
  const d = end > cur ? days : den.ngay;
  const from = Math.max(1, Math.min(t, days));
  const to = Math.min(days, Math.max(d, 1));
  if (from > to) return null;
  return { tu: from, den: to };
}

/** Ghi chú có áp dụng cho máy của sổ đang xem? */
export function noteAppliesToMachine(note: SoCheDoMayNote, maMay: string): boolean {
  if (!note.may || note.may.length === 0) return true;
  if (!maMay) return true;
  return note.may.includes(maMay);
}

/** Chỉ hiển thị tên cuối cùng (ô bàn giao hẹp). Hover (title) hiện đầy đủ họ tên. */
export function lastNameOf(fullName: string): string {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const hrKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');

/** Phòng ban lấy công nhân bàn giao/nhận (cột `phong_ban` bảng `nhan_su`). */
export const PHONG_BAN_SAN_XUAT = 'Phân xưởng sản xuất';
const PHONG_BAN_SAN_XUAT_KEY = hrKey(PHONG_BAN_SAN_XUAT);

function useProductionWorkers(): string[] {
  const [workers, setWorkers] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    // format=list chỉ trả [{name}] (mất phòng ban) → dùng format=groups&scope=all
    // để có đủ phong_ban rồi lọc Phân xưởng sản xuất ở client.
    fetch('/api/nhan-su?format=groups&scope=all')
      .then(async res => {
        if (!res.ok) throw new Error('bad');
        const data = await res.json();
        const matches = normalizeHrBranches(data).flatMap(b =>
          b.departments.flatMap(d =>
            hrKey(d.name || '').includes(PHONG_BAN_SAN_XUAT_KEY)
              ? d.members.map(m => m.name)
              : []
          )
        );
        if (active) setWorkers([...new Set(matches)].sort((a, b) => a.localeCompare(b, 'vi')));
      })
      .catch(() => {
        if (active) setWorkers([]);
      });
    return () => {
      active = false;
    };
  }, []);
  return workers;
}

function useMachines(): { machines: MachineRow[]; loading: boolean } {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch('/api/danh-sach-may')
      .then(async res => {
        if (!res.ok) throw new Error('bad');
        const data = await res.json();
        if (alive) setMachines(normalizeMachines(data));
      })
      .catch(() => {
        if (alive) setMachines([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { machines, loading };
}

export function machineKeyOf(machine: MachineRow): string {
  return (machine.code || '').trim() || (machine.name || '').trim();
}

export function machineLabelOf(machine: MachineRow): string {
  const code = (machine.code || '').trim();
  const name = (machine.name || '').trim();
  if (code && name && code !== name) return `${code} - ${name}`;
  return name || code;
}

/** Nhãn phạm vi máy của sổ: rỗng = Tất cả. */
export function machineScopeLabel(maMay: string, tenMay: string): string {
  if (!maMay) return 'Tất cả';
  if (tenMay && tenMay !== maMay) return `${maMay} - ${tenMay}`;
  return tenMay || maMay;
}

export function noteScopeText(note: SoCheDoMayNote, machines: MachineRow[]): string {
  if (!note.may || note.may.length === 0) return 'Tất cả máy';
  return note.may
    .map(code => {
      const found = findMachineByRef(machines, code);
      return found ? machineLabelOf(found) : code;
    })
    .join(', ');
}

export function normalizeSoCheDoMayRecord(raw: unknown): SoCheDoMayRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const thang = Number(r.thang);
  const nam = Number(r.nam);
  if (!Number.isInteger(thang) || !Number.isInteger(nam)) return null;
  const oCheDo: Record<string, string> = {};
  const srcCells = r.o_che_do ?? r.oCheDo;
  if (srcCells && typeof srcCells === 'object' && !Array.isArray(srcCells)) {
    for (const [k, v] of Object.entries(srcCells as Record<string, unknown>)) {
      const val = String(v ?? '').trim().toLowerCase();
      if (val === 'v' || val === 'x') oCheDo[k] = val;
    }
  }
  const banGiao: Record<string, SoCheDoMayHandover> = {};
  const srcHandover = r.ban_giao ?? r.banGiao;
  if (srcHandover && typeof srcHandover === 'object' && !Array.isArray(srcHandover)) {
    for (const [k, v] of Object.entries(srcHandover as Record<string, unknown>)) {
      const row = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      banGiao[k] = {
        ban_giao: String(row.ban_giao ?? row.banGiao ?? '').trim(),
        nhan: String(row.nhan ?? row.nhanBanGiao ?? '').trim()
      };
    }
  }
  const days = daysInMonthCheDo(thang, nam);
  const toNoteDate = (value: unknown, fallbackDay: number): string => {
    if (typeof value === 'string') {
      const p = parseDateStr(value);
      if (p) return toDateStr(p.nam, p.thang, p.ngay);
    }
    const num = Number(value);
    if (Number.isInteger(num) && num >= 1 && num <= 31) {
      return toDateStr(nam, thang, Math.min(num, days));
    }
    return toDateStr(nam, thang, Math.min(Math.max(1, fallbackDay), days));
  };
  const ghiChu: SoCheDoMayNote[] = [];
  const srcNotes = r.ghi_chu ?? r.ghiChu;
  if (Array.isArray(srcNotes)) {
    for (const item of srcNotes) {
      if (!item || typeof item !== 'object') continue;
      const n = item as Record<string, unknown>;
      const tu = toNoteDate(n.tu_ngay ?? n.tuNgay, 1);
      const den = toNoteDate(n.den_ngay ?? n.denNgay, days);
      const mayRaw = n.may ?? n.machines ?? n.ma_may_list;
      const may = Array.isArray(mayRaw)
        ? mayRaw.map(v => String(v ?? '').trim()).filter(Boolean).slice(0, 50)
        : typeof mayRaw === 'string' && mayRaw.trim()
          ? [mayRaw.trim()]
          : [];
      ghiChu.push({
        id: String(n.id ?? uid()),
        tu_ngay: tu <= den ? tu : den,
        den_ngay: tu <= den ? den : tu,
        may,
        noi_dung: String(n.noi_dung ?? n.noiDung ?? '')
      });
    }
  }
  return {
    id: String(r.id ?? ''),
    chi_nhanh: String(r.chi_nhanh ?? r.chiNhanh ?? 'Phú Thọ'),
    ma_may: String(r.ma_may ?? r.maMay ?? '').trim(),
    ten_may: String(r.ten_may ?? r.tenMay ?? '').trim(),
    thang,
    nam,
    o_che_do: oCheDo,
    ban_giao: banGiao,
    ghi_chu: ghiChu
  };
}

// -------------------------------------------------------------------------
// Ô chọn công nhân bàn giao: dropdown đầy đủ họ tên, nút chỉ hiện tên cuối
// -------------------------------------------------------------------------

function HandoverCell({
  value,
  workers,
  onChange
}: {
  value: string;
  workers: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open ]);

  const short = lastNameOf(value);
  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? workers.filter(w => w.toLowerCase().includes(q)) : workers;
    return list.slice(0, 200);
  }, [workers, filter]);

  return (
    <div ref={boxRef} className="relative flex h-full w-full items-center justify-center">
      <button
        type="button"
        title={value || 'Chọn công nhân'}
        onClick={() => {
          setFilter('');
          setOpen(o => !o);
        }}
        className="flex h-full w-full items-center justify-center px-0.5 text-[11px] font-semibold text-blue-900 hover:bg-blue-50"
      >
        {short ? (
          <span style={{ writingMode: 'vertical-rl' }} className="max-h-full truncate leading-tight">
            {short}
          </span>
        ) : (
          <span className="text-slate-300">+</span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-[105%] left-1/2 z-50 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-1.5">
            <input
              autoFocus
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Tìm công nhân..."
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="block w-full px-2.5 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                Xóa lựa chọn
              </button>
            )}
            {options.map(name => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={`block w-full truncate px-2.5 py-1.5 text-left text-xs hover:bg-blue-50 ${
                  name === value ? 'font-bold text-blue-700' : 'text-slate-700'
                }`}
              >
                {name}
              </button>
            ))}
            {options.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-slate-400">Không tìm thấy công nhân</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Lưới sổ chế độ máy dùng chung (sửa / chỉ xem)
// -------------------------------------------------------------------------

export function SoCheDoMayGrid({
  thang,
  nam,
  maMay,
  machines,
  oCheDo,
  banGiao,
  ghiChu,
  editable,
  workers,
  onToggleCell,
  onHandoverChange,
  onDeleteNote
}: {
  thang: number;
  nam: number;
  maMay: string;
  machines: MachineRow[];
  oCheDo: Record<string, string>;
  banGiao: Record<string, SoCheDoMayHandover>;
  ghiChu: SoCheDoMayNote[];
  editable: boolean;
  workers: string[];
  onToggleCell?: (khuVuc: number, ca: string, ngay: number) => void;
  onHandoverChange?: (ngay: number, field: 'ban_giao' | 'nhan', value: string) => void;
  onDeleteNote?: (id: string) => void;
}) {
  const days = daysInMonthCheDo(thang, nam);
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days]);
  const totalW = STICKY_W + days * DAY_W;

  const headRef = useRef<HTMLTableSectionElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const dayCellRef = useRef<HTMLTableCellElement>(null);
  const [metrics, setMetrics] = useState({ top: 64, dayW: DAY_W, bodyH: 720 });

  useLayoutEffect(() => {
    const measure = () => {
      setMetrics({
        top: headRef.current?.offsetHeight ?? 64,
        dayW: dayCellRef.current?.offsetWidth || DAY_W,
        bodyH: bodyRef.current?.offsetHeight ?? 720
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [days, thang, nam, maMay, ghiChu.length]);

  /** Ghi chú hiển thị trên lưới: giao với tháng sổ + đúng phạm vi máy. */
  const visibleNotes = useMemo(() => {
    const out: { note: SoCheDoMayNote; tu: number; den: number }[] = [];
    for (const n of ghiChu) {
      if (!noteAppliesToMachine(n, maMay)) continue;
      const span = noteSpanInMonth(n, thang, nam, days);
      if (span) out.push({ note: n, ...span });
    }
    return out;
  }, [ghiChu, maMay, thang, nam, days]);

  const coveredDays = useMemo(() => {
    const set = new Set<number>();
    for (const v of visibleNotes) {
      for (let d = v.tu; d <= v.den; d++) set.add(d);
    }
    return set;
  }, [visibleNotes]);

  const mayTitle = useMemo(() => {
    if (!maMay) return 'Sổ chế độ máy';
    const found = findMachineByRef(machines, maMay);
    return (found?.name || '').trim() || maMay;
  }, [maMay, machines]);

  return (
    <div>
      <div className="border border-slate-500 bg-white">
        <div className="border-b border-slate-500 bg-slate-50 px-2 py-1.5 text-center">
          <p className="text-[12px] font-bold uppercase tracking-wide text-slate-900">
            {mayTitle} - Tháng {thang} năm {nam} - (v: máy bình thường - x: máy có phát sinh bất
            thường)
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="relative" style={{ width: totalW, minWidth: totalW }}>
            <table className="border-collapse" style={{ width: totalW, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: STT_W }} />
                <col style={{ width: KHU_W }} />
                <col style={{ width: CA_W }} />
                {dayList.map(d => (
                  <col key={d} style={{ width: DAY_W }} />
                ))}
              </colgroup>
              <thead ref={headRef}>
                <tr>
                  <th
                    rowSpan={2}
                    className="border border-slate-500 bg-slate-100 text-[11px] font-bold"
                    style={{ position: 'sticky', left: 0, zIndex: 20, width: STT_W }}
                  >
                    Stt
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-500 bg-slate-100 text-[11px] font-bold"
                    style={{ position: 'sticky', left: STT_W, zIndex: 20, width: KHU_W }}
                  >
                    Khu Vực Máy
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-500 bg-slate-100 text-[11px] font-bold"
                    style={{ position: 'sticky', left: STT_W + KHU_W, zIndex: 20, width: CA_W }}
                  >
                    Ca
                  </th>
                  <th
                    colSpan={days}
                    className="h-8 border border-slate-500 bg-slate-100 text-[11px] font-bold uppercase"
                  >
                    Ngày trong tháng
                  </th>
                </tr>
                <tr>
                  {dayList.map(d => (
                    <th
                      key={d}
                      ref={d === 1 ? dayCellRef : undefined}
                      className="h-8 border border-slate-500 bg-slate-100 text-[10px] font-bold text-slate-700"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={bodyRef}>
                {KHU_VUC_MAY_CHE_DO.map((khu, kv) =>
                  CA_CHE_DO_MAY.map((ca, ci) => (
                    <tr key={`${kv}-${ca}`} className="h-[30px]">
                      {ci === 0 && (
                        <td
                          rowSpan={3}
                          className="border border-slate-500 bg-white text-center text-[11px] font-bold"
                          style={{ position: 'sticky', left: 0, zIndex: 10 }}
                        >
                          {kv + 1}
                        </td>
                      )}
                      {ci === 0 && (
                        <td
                          rowSpan={3}
                          className="border border-slate-500 bg-white px-1 text-center text-[10.5px] font-semibold leading-tight"
                          style={{ position: 'sticky', left: STT_W, zIndex: 10 }}
                        >
                          {khu}
                        </td>
                      )}
                      <td
                        className="border border-slate-500 bg-white text-center text-[11px] font-bold"
                        style={{ position: 'sticky', left: STT_W + KHU_W, zIndex: 10 }}
                      >
                        {ca}
                      </td>
                      {dayList.map(d => {
                        const val = oCheDo[cellKey(kv, ca, d)] || '';
                        const covered = coveredDays.has(d);
                        return (
                          <td
                            key={d}
                            className={`border border-slate-500 p-0 text-center ${
                              covered ? 'bg-amber-50' : 'bg-white'
                            }`}
                          >
                            {editable ? (
                              <button
                                type="button"
                                title="Bấm để đổi: trống → v → x"
                                onClick={() => onToggleCell?.(kv, ca, d)}
                                className={`h-[30px] w-full text-[13px] font-bold italic leading-none hover:bg-blue-50 ${
                                  val === 'v' ? 'text-blue-800' : val === 'x' ? 'text-rose-700' : 'text-transparent'
                                }`}
                              >
                                {val || '·'}
                              </button>
                            ) : (
                              <span
                                className={`flex h-[30px] items-center justify-center text-[13px] font-bold italic ${
                                  val === 'v' ? 'text-blue-800' : val === 'x' ? 'text-rose-700' : 'text-slate-200'
                                }`}
                              >
                                {val || ''}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                {(
                  [
                    { field: 'ban_giao' as const, label: 'Người bàn giao' },
                    { field: 'nhan' as const, label: 'Người nhận bàn giao' }
                  ]
                ).map(row => (
                  <tr key={row.field} className="h-[44px]">
                    <td
                      colSpan={3}
                      className="border border-slate-500 bg-slate-50 px-1 text-center text-[10.5px] font-bold leading-tight"
                      style={{ position: 'sticky', left: 0, zIndex: 10, width: STICKY_W }}
                    >
                      {row.label}
                    </td>
                    {dayList.map(d => {
                      const full = banGiao[String(d)]?.[row.field] || '';
                      const short = lastNameOf(full);
                      return (
                        <td key={d} className="border border-slate-500 bg-white p-0">
                          {editable ? (
                            <HandoverCell
                              value={full}
                              workers={workers}
                              onChange={v => onHandoverChange?.(d, row.field, v)}
                            />
                          ) : (
                            <span
                              title={full}
                              className="flex h-[44px] cursor-default items-center justify-center px-0.5 text-[10.5px] font-semibold text-blue-900"
                            >
                              {short ? (
                                <span style={{ writingMode: 'vertical-rl' }} className="max-h-full truncate leading-tight">
                                  {short}
                                </span>
                              ) : (
                                <span className="text-slate-200">·</span>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tfoot>
            </table>
            {/* Ghi chú gộp ô: khối dọc phủ đúng các cột từ ngày → đến ngày */}
            <div className="pointer-events-none absolute inset-x-0" style={{ top: metrics.top, height: metrics.bodyH }}>
              {visibleNotes.map(({ note: n, tu, den }) => (
                <div
                  key={n.id}
                  title={`Từ ${formatDateVN(n.tu_ngay)} đến ${formatDateVN(n.den_ngay)}: ${n.noi_dung}`}
                  className="pointer-events-auto absolute flex items-center justify-center overflow-hidden border border-amber-500 bg-amber-100/80"
                  style={{
                    left: STICKY_W + (tu - 1) * metrics.dayW,
                    width: (den - tu + 1) * metrics.dayW,
                    top: 0,
                    height: metrics.bodyH
                  }}
                >
                  <span
                    style={{ writingMode: 'vertical-rl' }}
                    className="whitespace-nowrap text-[15px] font-bold italic text-slate-800"
                  >
                    {n.noi_dung}
                  </span>
                  {editable && onDeleteNote && (
                    <button
                      type="button"
                      title="Xóa ghi chú"
                      onClick={() => onDeleteNote(n.id)}
                      className="absolute right-0.5 top-0.5 rounded bg-white/90 p-0.5 text-rose-600 shadow hover:bg-rose-50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
        v: máy bình thường - x: máy có phát sinh bất thường. Stt / Khu vực máy / Ca cố định, các cột ngày
        cuộn ngang. Tên bàn giao chỉ hiện tên cuối, di chuột vào để xem đầy đủ họ tên.
      </p>
    </div>
  );
}

// -------------------------------------------------------------------------
// Modal thêm / sửa ghi chú từ ngày đến ngày
// -------------------------------------------------------------------------

const VN_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Thứ (0 = Thứ 2 … 6 = Chủ nhật) theo lịch Gregory mở rộng — đúng tới năm 2999. */
export function weekdayMondayFirst(nam: number, thang: number, ngay: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = thang < 3 ? nam - 1 : nam;
  const dow = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[thang - 1] + ngay) % 7;
  return (dow + 6) % 7;
}

/** Lịch popup tiếng Việt để chọn ngày (tuần bắt đầu Thứ 2). Giá trị YYYY-MM-DD. */
function VnCalendarPicker({
  value,
  onChange,
  alignRight
}: {
  value: string;
  onChange: (v: string) => void;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseDateStr(value);
  const today = new Date();
  const [view, setView] = useState({
    thang: parsed?.thang ?? today.getMonth() + 1,
    nam: parsed?.nam ?? today.getFullYear()
  });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const p = parseDateStr(value);
    const t = new Date();
    setView({ thang: p?.thang ?? t.getMonth() + 1, nam: p?.nam ?? t.getFullYear() });
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, value]);

  const days = daysInMonthCheDo(view.thang, view.nam);
  const offset = weekdayMondayFirst(view.nam, view.thang, 1);
  const isMin = view.nam === 1 && view.thang === 1;
  const isMax = view.nam === 2999 && view.thang === 12;

  const stepMonth = (delta: number) => {
    setView(v => {
      const total = Math.min(35999, Math.max(12, v.nam * 12 + (v.thang - 1) + delta));
      const m = total % 12;
      return { thang: m + 1, nam: (total - m) / 12 };
    });
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex w-full items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 hover:border-blue-400"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        {parsed ? formatDateVN(value) : 'Chọn ngày'}
      </button>
      {open && (
        <div
          className={`absolute top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          <div className="mb-1.5 flex items-center gap-1">
            <button
              type="button"
              aria-label="Tháng trước"
              disabled={isMin}
              onClick={() => stepMonth(-1)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex-1 text-center text-sm font-bold text-slate-800">
              Tháng {view.thang} - {view.nam}
            </span>
            <button
              type="button"
              aria-label="Tháng sau"
              disabled={isMax}
              onClick={() => stepMonth(1)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <label className="mb-1.5 flex items-center justify-center gap-1 text-xs font-semibold text-slate-500">
            Năm
            <input
              type="number"
              min={1}
              max={2999}
              value={view.nam}
              onChange={e =>
                setView(v => ({ ...v, nam: Math.min(2999, Math.max(1, Number(e.target.value) || 1)) }))
              }
              className="w-20 rounded-lg border border-slate-300 px-2 py-0.5 text-center text-xs outline-none focus:border-blue-400"
            />
          </label>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {VN_WEEKDAYS.map(d => (
              <span key={d} className="py-1 text-[10px] font-bold uppercase text-slate-400">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const d = i + 1;
              const selected =
                parsed?.nam === view.nam && parsed?.thang === view.thang && parsed?.ngay === d;
              const isToday =
                today.getFullYear() === view.nam &&
                today.getMonth() + 1 === view.thang &&
                today.getDate() === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onChange(toDateStr(view.nam, view.thang, d));
                    setOpen(false);
                  }}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    selected
                      ? 'bg-blue-600 text-white'
                      : isToday
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const t = new Date();
              onChange(toDateStr(t.getFullYear(), t.getMonth() + 1, t.getDate()));
              setOpen(false);
            }}
            className="mt-1.5 w-full rounded-lg bg-slate-50 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Hôm nay
          </button>
        </div>
      )}
    </div>
  );
}

function NoteModal({
  thang,
  nam,
  machines,
  initial,
  onClose,
  onSave
}: {
  thang: number;
  nam: number;
  machines: MachineRow[];
  initial: SoCheDoMayNote | null;
  onClose: () => void;
  onSave: (note: SoCheDoMayNote) => void;
}) {
  const days = daysInMonthCheDo(thang, nam);
  const [tu, setTu] = useState(initial?.tu_ngay ?? toDateStr(nam, thang, 1));
  const [den, setDen] = useState(initial?.den_ngay ?? toDateStr(nam, thang, days));
  const [may, setMay] = useState<string[]>(initial?.may ?? []);
  const [content, setContent] = useState(initial?.noi_dung ?? '');
  const [error, setError] = useState('');

  const machineCodes = useMemo(
    () => machines.map(machineKeyOf).filter(Boolean),
    [machines]
  );
  const machineMap = useMemo(() => {
    const map = new Map<string, MachineRow>();
    machines.forEach(m => {
      const key = machineKeyOf(m);
      if (key && !map.has(key)) map.set(key, m);
    });
    return map;
  }, [machines]);

  const submit = () => {
    const t = parseDateStr(tu);
    const d = parseDateStr(den);
    if (!t || !d) {
      setError('Ngày chưa hợp lệ (năm 1–2999).');
      return;
    }
    if (!content.trim()) {
      setError('Vui lòng nhập nội dung ghi chú.');
      return;
    }
    const tuStr = toDateStr(t.nam, t.thang, t.ngay);
    const denStr = toDateStr(d.nam, d.thang, d.ngay);
    onSave({
      id: initial?.id || uid(),
      tu_ngay: tuStr <= denStr ? tuStr : denStr,
      den_ngay: tuStr <= denStr ? denStr : tuStr,
      may,
      noi_dung: content.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            {initial ? 'Sửa ghi chú' : 'Thêm ghi chú từ ngày đến ngày'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Từ ngày - tháng - năm</span>
            <VnCalendarPicker value={tu} onChange={setTu} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-600">Đến ngày - tháng - năm</span>
            <VnCalendarPicker value={den} onChange={setDen} alignRight />
          </div>
        </div>
        <div className="mt-2">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Áp dụng cho máy (để trống = tất cả máy, có thể chọn nhiều)
          </span>
          <SearchableMultiSelect<string>
            values={may}
            onChange={setMay}
            options={machineCodes}
            placeholder="Chọn máy (có thể chọn nhiều)..."
            getValue={code => code}
            getLabel={code => {
              const found = machineMap.get(code);
              return found ? machineLabelOf(found) : code;
            }}
            allowCustomValues={false}
            hideSelectedFromList
            maxResults={100}
          />
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Nội dung ghi chú</span>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder="Ví dụ: Tết Nguyên Đán"
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
          />
        </label>
        {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Lưu xong các ô từ {formatDateVN(tu) || '?'} đến {formatDateVN(den) || '?'} sẽ tự gộp lại và
          hiển thị ghi chú bên trong (phần giao với tháng {thang}/{nam}). Ghi chú chỉ được lưu vào
          các máy đang chọn ở màn hình.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            Lưu ghi chú
          </button>
        </div>
      </div>
    </div>
  );
}

/** Picker Tháng + Năm kiểu lịch popup tiếng Việt (năm 1–2999). Giá trị YYYY-MM. */
function MonthYearPicker({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
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
    <div ref={boxRef} className="relative">
      <span className="mb-1 block text-xs font-semibold text-slate-600">Tháng + Năm</span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-blue-400"
      >
        {parsed ? `Tháng ${parsed.thang} - Năm ${parsed.nam}` : 'Chọn tháng + năm'}
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
                  className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
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

// =========================================================================
// PANEL THÊM MỚI / SỬA
// =========================================================================

/** Dữ liệu nhập liệu đang làm của 1 máy trong lô nhiều máy. */
export type SoCheDoMayBookState = {
  existingId: string;
  oCheDo: Record<string, string>;
  banGiao: Record<string, SoCheDoMayHandover>;
};

const blankBookState = (): SoCheDoMayBookState => ({ existingId: '', oCheDo: {}, banGiao: {} });

export function SoCheDoMayWorkspace({
  onBack
}: {
  onBack?: () => void;
}) {
  const now = new Date();
  const workers = useProductionWorkers();
  const { machines } = useMachines();
  const { canCreate, canEdit, canDelete } = useTabAccess('so-che-do-may-list');
  const canWrite = canCreate || canEdit;
  const [monthStr, setMonthStr] = useState(toMonthStr(now.getMonth() + 1, now.getFullYear()));
  const [selectedMays, setSelectedMays] = useState<string[]>([]);
  /** Máy bỏ tick (không lưu/in) — máy mới thêm mặc định được tick. */
  const [uncheckedMays, setUncheckedMays] = useState<string[]>([]);
  const updateSelected = (next: string[]) => {
    setSelectedMays(next);
    setUncheckedMays(prev => prev.filter(c => next.includes(c)));
  };
  /** Sổ đã lưu của cả tháng theo mã máy (kể cả sổ chung '' để fill sang máy mới). */
  const [monthData, setMonthData] = useState<Record<string, SoCheDoMayRecord> | null>(null);
  /** Dữ liệu nhập liệu đang làm theo từng máy. */
  const [books, setBooks] = useState<Record<string, SoCheDoMayBookState>>({});
  const [booksKey, setBooksKey] = useState('');
  const [ghiChu, setGhiChu] = useState<SoCheDoMayNote[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [saveResults, setSaveResults] = useState<Record<string, string> | null>(null);
  const [noteModal, setNoteModal] = useState<{ open: boolean; editing: SoCheDoMayNote | null }>({
    open: false,
    editing: null
  });

  const month = parseMonthStr(monthStr);
  const machineCodes = useMemo(() => machines.map(machineKeyOf).filter(Boolean), [machines]);
  const machineMap = useMemo(() => {
    const map = new Map<string, MachineRow>();
    machines.forEach(m => {
      const key = machineKeyOf(m);
      if (key && !map.has(key)) map.set(key, m);
    });
    return map;
  }, [machines]);
  const machineLabel = (code: string) => {
    const found = machineMap.get(code);
    return found ? machineLabelOf(found) : code;
  };
  const orderedMays = useMemo(() => {
    const order = new Map(machineCodes.map((c, i) => [c, i] as [string, number]));
    return [...selectedMays].sort((a, b) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999));
  }, [selectedMays, machineCodes]);
  /** Máy được tick chọn để lưu/in. */
  const checkedCodes = useMemo(
    () => orderedMays.filter(c => !uncheckedMays.includes(c)),
    [orderedMays, uncheckedMays]
  );
  const allChecked = machineCodes.length > 0 && selectedMays.length === machineCodes.length;
  const ready = Boolean(month) && selectedMays.length > 0;

  // Tải toàn bộ sổ đã lưu của tháng (mọi máy) để fill sẵn
  useEffect(() => {
    if (!month) {
      setMonthData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    // Đổi tháng → reset lưới đang làm, chờ tải sổ mới về fill lại
    setBooks({});
    setBooksKey('');
    setGhiChu([]);
    setSaveResults(null);
    setCollapsed({});
    fetch(`/api/so-che-do-may?thang=${month.thang}&nam=${month.nam}&limit=300`)
      .then(async res => {
        if (!res.ok) throw new Error('bad');
        const data = await res.json();
        const list = Array.isArray(data.records) ? data.records : [];
        if (!alive) return;
        const map: Record<string, SoCheDoMayRecord> = {};
        for (const raw of list) {
          const rec = normalizeSoCheDoMayRecord(raw);
          if (rec && rec.thang === month.thang && rec.nam === month.nam) {
            map[rec.ma_may || ''] = rec;
          }
        }
        setMonthData(map);
      })
      .catch(() => {
        if (alive) {
          setMonthData({});
          setMessage({ type: 'error', text: 'Không tải được sổ tháng này.' });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr]);

  const bookFromRecord = (rec: SoCheDoMayRecord | undefined): SoCheDoMayBookState =>
    rec
      ? { existingId: rec.id, oCheDo: { ...rec.o_che_do }, banGiao: { ...rec.ban_giao } }
      : blankBookState();

  // Tự sinh lưới nhập liệu khi đủ tháng + máy (giữ nguyên dữ liệu đang nhập dở)
  useEffect(() => {
    if (!month || !monthData) return;
    if (booksKey !== monthStr) {
      const next: Record<string, SoCheDoMayBookState> = {};
      for (const code of selectedMays) {
        next[code] = bookFromRecord(monthData[code] ?? monthData['']);
      }
      setBooks(next);
      const seen = new Set<string>();
      const union: SoCheDoMayNote[] = [];
      for (const code of selectedMays) {
        const rec = monthData[code] ?? monthData[''];
        if (!rec) continue;
        for (const n of rec.ghi_chu) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          if (!n.may?.length || n.may.some(c => selectedMays.includes(c))) union.push({ ...n, may: [...n.may] });
        }
      }
      setGhiChu(union);
      setBooksKey(monthStr);
      return;
    }
    const missing = selectedMays.filter(code => !books[code]);
    const removed = Object.keys(books).filter(code => !selectedMays.includes(code));
    if (missing.length === 0 && removed.length === 0) return;
    setBooks(prev => {
      const next = { ...prev };
      for (const code of missing) next[code] = bookFromRecord(monthData[code] ?? monthData['']);
      for (const code of removed) delete next[code];
      return next;
    });
    if (missing.length > 0) {
      setGhiChu(prev => {
        const seen = new Set(prev.map(n => n.id));
        const add: SoCheDoMayNote[] = [];
        for (const code of missing) {
          const rec = monthData[code] ?? monthData[''];
          if (!rec) continue;
          for (const n of rec.ghi_chu) {
            if (seen.has(n.id)) continue;
            seen.add(n.id);
            if (!n.may?.length || n.may.some(c => selectedMays.includes(c))) add.push({ ...n, may: [...n.may] });
          }
        }
        return add.length > 0 ? [...prev, ...add] : prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthData, selectedMays, monthStr, booksKey]);

  // Bỏ chọn máy → loại ghi chú chỉ còn áp dụng cho máy đã bỏ
  useEffect(() => {
    setGhiChu(prev => {
      const next = prev.filter(n => !n.may?.length || n.may.some(c => selectedMays.includes(c)));
      return next.length === prev.length ? prev : next;
    });
  }, [selectedMays]);

  const toggleCell = (code: string, kv: number, ca: string, ngay: number) => {
    const key = cellKey(kv, ca, ngay);
    setBooks(prev => {
      const st = prev[code] ?? blankBookState();
      const cur = st.oCheDo[key] || '';
      const next = cur === '' ? 'v' : cur === 'v' ? 'x' : '';
      const oCheDo = { ...st.oCheDo };
      if (next) oCheDo[key] = next;
      else delete oCheDo[key];
      return { ...prev, [code]: { ...st, oCheDo } };
    });
  };

  const changeHandover = (code: string, ngay: number, field: 'ban_giao' | 'nhan', value: string) => {
    setBooks(prev => {
      const st = prev[code] ?? blankBookState();
      const cur = st.banGiao[String(ngay)] || { ban_giao: '', nhan: '' };
      const row = { ...cur, [field]: value };
      const banGiao = { ...st.banGiao };
      if (row.ban_giao || row.nhan) banGiao[String(ngay)] = row;
      else delete banGiao[String(ngay)];
      return { ...prev, [code]: { ...st, banGiao } };
    });
  };

  const saveNote = (note: SoCheDoMayNote) => {
    setGhiChu(prev => {
      const exists = prev.some(n => n.id === note.id);
      return exists ? prev.map(n => (n.id === note.id ? note : n)) : [...prev, note];
    });
    setNoteModal({ open: false, editing: null });
  };

  /** In phiếu các máy đã tick (khổ ngang A4) — đúng dữ liệu đang hiển thị, kể cả phiếu chưa có dữ liệu. */
  const printSelected = () => {
    if (!month) return;
    if (checkedCodes.length === 0) {
      setMessage({ type: 'error', text: 'Tick chọn ít nhất 1 máy để in.' });
      return;
    }
    const days = daysInMonthCheDo(month.thang, month.nam);
    const sheets: SoCheDoMayPrintSheet[] = [];
    for (const code of checkedCodes) {
      const st = books[code] ?? blankBookState();
      const scoped = ghiChu.filter(n => noteAppliesToMachine(n, code));
      sheets.push({
        thang: month.thang,
        nam: month.nam,
        mayLabel: (machineMap.get(code)?.name || '').trim() || code,
        days,
        cells: st.oCheDo,
        handover: st.banGiao,
        notes: scoped.map(n => ({
          tu: formatDateVN(n.tu_ngay),
          den: formatDateVN(n.den_ngay),
          mayText: noteScopeText(n, machines),
          noi_dung: n.noi_dung,
          span: noteSpanInMonth(n, month.thang, month.nam, days)
        })),
        areas: KHU_VUC_MAY_CHE_DO,
        cas: CA_CHE_DO_MAY
      });
    }
    if (sheets.length === 0) {
      setMessage({ type: 'error', text: 'Tick chọn ít nhất 1 máy để in.' });
      return;
    }
    printSoCheDoMaySlips(sheets);
  };

  const removeBook = async (code: string) => {
    if (!month) return;
    const st = books[code];
    if (!st?.existingId) return;
    if (!window.confirm(`Xóa sổ tháng ${month.thang}/${month.nam} (Máy: ${machineLabel(code)})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/so-che-do-may/${encodeURIComponent(st.existingId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Không xóa được sổ.');
      setMonthData(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        delete next[code];
        return next;
      });
      setBooks(prev => ({ ...prev, [code]: blankBookState() }));
      setMessage({ type: 'success', text: `Đã xóa sổ máy ${machineLabel(code)}.` });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Không xóa được sổ.' });
    }
  };

  /** Lưu các máy đã tick theo kiểu insert-or-update: chưa có thì POST, có rồi thì PUT; POST trùng 409 tự chuyển PUT. */
  const save = async () => {
    if (!month || checkedCodes.length === 0) {
      setMessage({ type: 'error', text: 'Chọn tháng + năm và tick ít nhất 1 máy để lưu.' });
      return;
    }
    setSaving(true);
    setSaveResults(null);
    setMessage(null);
    const results: Record<string, string> = {};
    let okCount = 0;
    for (const code of checkedCodes) {
      const st = books[code] ?? blankBookState();
      const scopedNotes = ghiChu.filter(n => !n.may?.length || n.may.includes(code));
      const ten = machineMap.get(code)?.name ?? '';
      try {
        const payload = {
          ma_may: code,
          ten_may: ten,
          thang: month.thang,
          nam: month.nam,
          o_che_do: st.oCheDo,
          ban_giao: st.banGiao,
          ghi_chu: scopedNotes
        };
        const sendJson = (url: string, method: 'POST' | 'PUT') =>
          fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        let saved: SoCheDoMayRecord | null = null;
        if (st.existingId) {
          const res = await sendJson(`/api/so-che-do-may/${encodeURIComponent(st.existingId)}`, 'PUT');
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(String(data.error || `Lỗi ${res.status}`));
          saved = normalizeSoCheDoMayRecord(data.record);
        } else {
          const res = await sendJson('/api/so-che-do-may', 'POST');
          const data = await res.json().catch(() => ({}));
          if (res.status === 409) {
            // Sổ đã tồn tại (máy khác tạo / tải sót) → lấy về rồi cập nhật thay vì báo lỗi
            const reload = await fetch(
              `/api/so-che-do-may?thang=${month.thang}&nam=${month.nam}&ma_may=${encodeURIComponent(code)}&limit=5`
            ).then(r => r.json());
            const list = Array.isArray(reload.records) ? reload.records : [];
            const found = normalizeSoCheDoMayRecord(list[0]);
            if (!found || (found.ma_may || '') !== code) {
              throw new Error(String(data.error || 'Đã tồn tại sổ máy này.'));
            }
            const putRes = await sendJson(
              `/api/so-che-do-may/${encodeURIComponent(found.id)}`,
              'PUT'
            );
            const putData = await putRes.json().catch(() => ({}));
            if (!putRes.ok) throw new Error(String(putData.error || 'Không cập nhật được sổ.'));
            saved = normalizeSoCheDoMayRecord(putData.record);
          } else {
            if (!res.ok) throw new Error(String(data.error || `Lỗi ${res.status}`));
            saved = normalizeSoCheDoMayRecord(data.record);
          }
        }
        if (saved) {
          setBooks(prev => ({
            ...prev,
            [code]: { existingId: saved.id, oCheDo: saved.o_che_do, banGiao: saved.ban_giao }
          }));
        }
        results[code] = 'ok';
        okCount++;
      } catch (err) {
        results[code] = err instanceof Error ? err.message : 'Không lưu được.';
      }
    }
    setSaveResults(results);
    const orphans = ghiChu.filter(n => n.may?.length && !n.may.some(c => checkedCodes.includes(c)));
    const orphanText =
      orphans.length > 0
        ? ` Có ${orphans.length} ghi chú không thuộc máy đã tick nên chưa được lưu.`
        : '';
    setMessage(
      okCount === checkedCodes.length && orphans.length === 0
        ? { type: 'success', text: `Đã lưu ${okCount}/${checkedCodes.length} sổ tháng ${month.thang}/${month.nam}.` }
        : {
            type: 'error',
            text: `Lưu được ${okCount}/${checkedCodes.length} sổ tháng ${month.thang}/${month.nam}.${orphanText}`
          }
    );
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">
            Sổ chế độ máy
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
            Chọn tháng + năm và máy — lưới tự sinh, có dữ liệu sẽ tự điền (bấm ô ngày để đổi: trống →
            v → x). Tích Tất cả để làm toàn bộ máy, rồi lưu cả lô một lần.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-card">
        <MonthYearPicker value={monthStr} onChange={setMonthStr} />
        <div className="min-w-52 flex-1 sm:max-w-80">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Máy (chọn nhiều)</span>
          <SearchableMultiSelect<string>
            values={selectedMays}
            onChange={updateSelected}
            options={machineCodes}
            placeholder="Chọn máy để nhập liệu..."
            getValue={code => code}
            getLabel={code => machineLabel(code)}
            allowCustomValues={false}
            hideSelectedFromList
            maxResults={100}
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={e => updateSelected(e.target.checked ? machineCodes : [])}
            className="h-3.5 w-3.5 accent-slate-900"
          />
          Tất cả ({machineCodes.length})
        </label>
        <button
          type="button"
          onClick={printSelected}
          disabled={!ready || !monthData}
          title="In phiếu các máy đã chọn (khổ ngang A4)"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Printer className="h-3.5 w-3.5" />
          In phiếu đã chọn
        </button>
        {loading && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
          </span>
        )}
      </div>

      {message && (
        <p
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : message.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {message.text}
        </p>
      )}

      {!ready && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Chọn tháng + năm và ít nhất 1 máy ở trên — lưới nhập liệu sẽ tự sinh theo từng máy.
        </p>
      )}

      {ready && month && !monthData && (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải sổ tháng {month.thang}/{month.nam}...
        </p>
      )}

      {ready && month && monthData && (canWrite || ghiChu.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 shadow-card">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Ghi chú chung ({ghiChu.length})
            </h3>
            <span className="flex-1" />
            {canWrite && (
              <button
                type="button"
                onClick={() => setNoteModal({ open: true, editing: null })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
              >
                <StickyNote className="h-3.5 w-3.5" />
                Thêm ghi chú
              </button>
            )}
          </div>
          {ghiChu.length === 0 ? (
            <p className="text-xs text-slate-400">
              Chưa có ghi chú. Ghi chú lưu chung, khi lưu từng sổ sẽ tự lọc theo phạm vi máy.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ghiChu.map(n => (
                <li
                  key={n.id}
                  className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs"
                >
                  <span className="shrink-0 font-bold text-amber-800">
                    {formatDateVN(n.tu_ngay)} → {formatDateVN(n.den_ngay)}:
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate font-semibold text-slate-800"
                    title={`${n.noi_dung} (${noteScopeText(n, machines)})`}
                  >
                    {n.noi_dung}
                    <span className="ml-1 font-normal text-slate-500">({noteScopeText(n, machines)})</span>
                  </span>
                  {canWrite && (
                    <>
                      <button
                        type="button"
                        title="Sửa ghi chú"
                        onClick={() => setNoteModal({ open: true, editing: n })}
                        className="rounded p-1 text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Xóa ghi chú"
                        onClick={() => setGhiChu(prev => prev.filter(x => x.id !== n.id))}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ready &&
        month &&
        monthData &&
        orderedMays.map(code => {
          const st = books[code] ?? blankBookState();
          const isCollapsed = collapsed[code];
          const cellCount = Object.keys(st.oCheDo).length;
          return (
            <section
              key={code}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
            >
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={!uncheckedMays.includes(code)}
                  onChange={() =>
                    setUncheckedMays(prev =>
                      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
                    )
                  }
                  title="Tick chọn máy này để lưu/in"
                  aria-label={`Chọn ${machineLabel(code)} để lưu/in`}
                  className="h-4 w-4 shrink-0 accent-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setCollapsed(prev => ({ ...prev, [code]: !prev[code] }))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                  <span
                    className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-slate-900"
                    title={`Máy: ${machineLabel(code)}`}
                  >
                    Máy: {machineLabel(code)}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                    {st.existingId ? 'Đã có sổ — lưu sẽ cập nhật' : 'Chưa có sổ'} · {cellCount} ô đã nhập
                  </span>
                </button>
                {canDelete && st.existingId && (
                  <button
                    type="button"
                    title="Xóa sổ máy này"
                    onClick={() => void removeBook(code)}
                    className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {!isCollapsed && (
                <div className="p-2">
                  <SoCheDoMayGrid
                    thang={month.thang}
                    nam={month.nam}
                    maMay={code}
                    machines={machines}
                    oCheDo={st.oCheDo}
                    banGiao={st.banGiao}
                    ghiChu={ghiChu}
                    editable={st.existingId ? canEdit : canCreate}
                    workers={workers}
                    onToggleCell={(kv, ca, d) => toggleCell(code, kv, ca, d)}
                    onHandoverChange={(day, field, v) => changeHandover(code, day, field, v)}
                    onDeleteNote={id => setGhiChu(prev => prev.filter(x => x.id !== id))}
                  />
                </div>
              )}
            </section>
          );
        })}

      {ready && month && canWrite && monthData && (
        <div className="sticky bottom-0 z-30 rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              Đã tick {checkedCodes.length}/{selectedMays.length} máy — tháng {month.thang}/{month.nam}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={save}
              disabled={saving || checkedCodes.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Đang lưu...' : `Lưu đã chọn (${checkedCodes.length} máy)`}
            </button>
          </div>
          {saveResults && (
            <ul className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
              {checkedCodes.map(code => (
                <li key={code} className="flex items-center gap-2 text-xs">
                  <span
                    className="min-w-0 flex-1 truncate font-semibold text-slate-700"
                    title={machineLabel(code)}
                  >
                    {machineLabel(code)}
                  </span>
                  {saveResults[code] === 'ok' ? (
                    <span className="shrink-0 font-bold text-emerald-600">Đã lưu</span>
                  ) : (
                    <span className="shrink-0 font-bold text-rose-600" title={saveResults[code]}>
                      Lỗi: {saveResults[code]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {noteModal.open && month && canWrite && (
        <NoteModal
          thang={month.thang}
          nam={month.nam}
          machines={machines}
          initial={noteModal.editing}
          onClose={() => setNoteModal({ open: false, editing: null })}
          onSave={saveNote}
        />
      )}
    </div>
  );
}


