import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

// Ô chọn ngày kiểu lịch popup 1 nút (theo yêu cầu riêng của màn hình sổ trộn):
// hiển thị DD/MM/YYYY, bấm mở lịch tháng tiếng Việt — KHÔNG dùng 3 ô Ngày/Tháng/Năm rời.

const pad2 = (n: number) => String(n).padStart(2, '0');

function parseIso(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(y, mo, 0).getDate()) return null;
  return { y, m: mo, d };
}

/** ISO YYYY-MM-DD → DD/MM/YYYY (hiển thị tiếng Việt). */
export function formatNgayVN(value: string): string {
  const p = parseIso(value);
  return p ? `${pad2(p.d)}/${pad2(p.m)}/${p.y}` : '';
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function SoTronDatePicker({
  value,
  onChange,
  placeholder = 'Chọn ngày'
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const now = new Date();
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth() + 1);
  // Panel chọn nhanh tháng/năm (để nhảy năm khác không phải bấm từng tháng).
  const [pickMY, setPickMY] = useState(false);

  // Mỗi lần mở lịch: nhảy tới tháng của ngày đang chọn (hoặc tháng hiện tại).
  useEffect(() => {
    if (!open) return;
    setPickMY(false);
    const p = parseIso(value);
    if (p) {
      setViewY(p.y);
      setViewM(p.m);
    } else {
      const t = new Date();
      setViewY(t.getFullYear());
      setViewM(t.getMonth() + 1);
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const moveMonth = (delta: number) => {
    let m = viewM + delta;
    let y = viewY;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setViewM(m);
    setViewY(Math.min(2999, Math.max(1, y)));
  };

  /** Nhảy nhanh ±1 năm (giữ nguyên tháng). */
  const moveYear = (delta: number) => {
    setViewY(y => Math.min(2999, Math.max(1, y + delta)));
  };

  const commitYear = (raw: string) => {
    if (raw === '') return;
    const y = Number(raw);
    if (Number.isFinite(y)) setViewY(Math.min(2999, Math.max(1, Math.trunc(y))));
  };

  const firstWeekdayMon0 = (new Date(viewY, viewM - 1, 1).getDay() + 6) % 7;
  const totalDays = new Date(viewY, viewM, 0).getDate();
  const selected = parseIso(value);
  const today = parseIso(todayIso());

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
      >
        <span className={value ? 'tabular-nums' : 'font-semibold text-slate-400'}>{value ? formatNgayVN(value) : placeholder}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[248px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between gap-0.5">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => moveYear(-1)}
                aria-label="Năm trước"
                title="Năm trước"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Tháng trước"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPickMY(v => !v)}
              title="Chọn nhanh tháng/năm"
              className={`rounded-lg px-2 py-1 text-[13px] font-bold transition hover:bg-slate-100 ${pickMY ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800'}`}
            >
              Tháng {viewM} / {viewY}
            </button>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Tháng sau"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveYear(1)}
                aria-label="Năm sau"
                title="Năm sau"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {pickMY && (
            <div className="mb-1.5 rounded-xl bg-slate-50 p-1.5">
              <div className="mb-1.5 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => moveYear(-1)}
                  aria-label="Giảm 1 năm"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <label className="flex items-center gap-1 text-[12px] font-bold text-slate-600">
                  Năm
                  <input
                    type="number"
                    min={1}
                    max={2999}
                    value={viewY}
                    onChange={e => commitYear(e.target.value)}
                    aria-label="Nhập năm"
                    className="w-20 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-center text-[12.5px] font-bold tabular-nums text-slate-800 outline-none focus:border-indigo-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => moveYear(1)}
                  aria-label="Tăng 1 năm"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-0.5">
                {Array.from({ length: 12 }, (_, i) => {
                  const m = i + 1;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setViewM(m);
                        setPickMY(false);
                      }}
                      className={`rounded-lg px-1 py-1.5 text-[12px] font-semibold tabular-nums transition ${
                        m === viewM
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Tháng {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10.5px] font-bold uppercase text-slate-400">
            {WEEKDAYS.map(w => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstWeekdayMon0 }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: totalDays }, (_, i) => {
              const d = i + 1;
              const iso = `${viewY}-${pad2(viewM)}-${pad2(d)}`;
              const isSelected = selected?.y === viewY && selected?.m === viewM && selected?.d === d;
              const isToday = today?.y === viewY && today?.m === viewM && today?.d === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`flex h-8 items-center justify-center rounded-lg text-[12.5px] font-semibold tabular-nums transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : isToday
                        ? 'border border-indigo-400 text-indigo-700 hover:bg-indigo-50'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-1.5 border-t border-slate-100 pt-1.5">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso());
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-[11.5px] font-bold text-indigo-600 transition hover:bg-indigo-50"
            >
              Hôm nay
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-[11.5px] font-bold text-slate-500 transition hover:bg-slate-100"
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
