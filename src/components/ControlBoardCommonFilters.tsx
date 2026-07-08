import React from 'react';
import type { MachineRow } from '../features/danh-sach-may';

const inputClass =
  'h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

export function ControlBoardCommonFilters({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  shift,
  onShiftChange,
  shiftOptions,
  formatShiftLabel,
  machine,
  onMachineChange,
  machines,
  onClear,
  isLoading
}: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  shift: string;
  onShiftChange: (value: string) => void;
  shiftOptions: string[];
  formatShiftLabel?: (shift: string) => string;
  machine: string;
  onMachineChange: (value: string) => void;
  machines: MachineRow[];
  onClear: () => void;
  isLoading?: boolean;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:border-2 sm:border-zinc-900/10 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Bộ lọc chung</p>
          <p className="mt-0.5 text-sm font-black text-zinc-950">Từ ngày · Đến ngày · Ca · Máy</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={isLoading}
          className="h-9 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Xóa lọc
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-5">
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
          <input
            type="date"
            value={dateFrom}
            onChange={event => onDateFromChange(event.target.value)}
            disabled={isLoading}
            className={`${inputClass} w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Đến ngày</span>
          <input
            type="date"
            value={dateTo}
            onChange={event => onDateToChange(event.target.value)}
            disabled={isLoading}
            className={`${inputClass} w-full`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ca</span>
          <select
            value={shift}
            onChange={event => onShiftChange(event.target.value)}
            disabled={isLoading}
            className={`${inputClass} w-full`}
          >
            <option value="all">Tất cả ca</option>
            {shiftOptions.map(shiftName => (
              <option key={shiftName} value={shiftName}>
                {formatShiftLabel ? formatShiftLabel(shiftName) : shiftName}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Máy</span>
          <select
            value={machine}
            onChange={event => onMachineChange(event.target.value)}
            disabled={isLoading}
            className={`${inputClass} w-full`}
          >
            <option value="all">Tất cả máy</option>
            {machines
              .filter(row => row.code && row.code !== '-')
              .sort((a, b) => a.code.localeCompare(b.code, 'vi'))
              .map(row => (
                <option key={row.id || row.code} value={row.code}>
                  {row.code}
                  {row.name && row.name !== '-' ? ` · ${row.name}` : ''}
                </option>
              ))}
          </select>
        </label>
      </div>
    </section>
  );
}
