import React from 'react';
import { Loader2, Search } from 'lucide-react';

export function DashboardWindow({
  title,
  subtitle,
  icon: Icon,
  accentClass,
  count,
  countLabel,
  search,
  onSearchChange,
  isLoading,
  error,
  onOpen,
  openLabel,
  disabled,
  secondaryAction,
  tertiaryAction,
  summaryExtra,
  compact = false,
  filterDate,
  onFilterDateChange,
  filterShift,
  onFilterShiftChange,
  shiftOptions,
  formatShiftLabel,
  children
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  count: number;
  countLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  error: string;
  onOpen: () => void;
  openLabel: string;
  disabled?: boolean;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  tertiaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  summaryExtra?: React.ReactNode;
  compact?: boolean;
  filterDate?: string;
  onFilterDateChange?: (value: string) => void;
  filterShift?: string;
  onFilterShiftChange?: (value: string) => void;
  shiftOptions?: string[];
  formatShiftLabel?: (shift: string) => string;
  children: React.ReactNode;
}) {
  const actionButtonClass =
    'inline-flex h-8 min-w-0 items-center justify-center rounded-md border border-white/25 bg-white/10 px-2.5 text-[10px] font-extrabold leading-none text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[11px]';

  return (
    <section
      className={`flex min-w-0 w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${
        compact ? 'mb-2.5 break-inside-avoid' : ''
      }`}
    >
      <div
        className={`flex flex-col gap-2 border-b border-black/10 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-3 ${accentClass}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10"
          >
            <Icon className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h3 className="truncate text-xs font-black text-white sm:text-sm">{title}</h3>
              <span className="rounded-md border border-white/15 bg-black/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/90">
                {countLabel} {isLoading ? '...' : count}
              </span>
              {summaryExtra ? (
                <span className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/85">
                  {summaryExtra}
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[10px] font-semibold text-white/65">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled || secondaryAction.loading}
              className={actionButtonClass}
            >
              {secondaryAction.loading ? (
                <span className="inline-flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="truncate">Đang tạo...</span>
                </span>
              ) : (
                <span className="block truncate">{secondaryAction.label}</span>
              )}
            </button>
          )}
          {tertiaryAction && (
            <button
              type="button"
              onClick={tertiaryAction.onClick}
              disabled={tertiaryAction.disabled || tertiaryAction.loading}
              className={actionButtonClass}
            >
              {tertiaryAction.loading ? (
                <span className="inline-flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="truncate">Đang in...</span>
                </span>
              ) : (
                <span className="block truncate">{tertiaryAction.label}</span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onOpen}
            disabled={disabled}
            className="inline-flex h-8 min-w-0 items-center justify-center rounded-md bg-white px-2.5 text-[10px] font-black leading-none text-zinc-900 shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[11px]"
          >
            <span className="block truncate">{openLabel}</span>
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2">
        <label
          className="flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 focus-within:border-[#ef1b2d] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#ef1b2d]/10"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <input
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Lọc nhanh..."
            disabled={isLoading}
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {onFilterDateChange && onFilterShiftChange && shiftOptions ? (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Ngày</span>
              <input
                type="date"
                value={filterDate ?? ''}
                onChange={event => onFilterDateChange(event.target.value)}
                disabled={isLoading}
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-bold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10"
              />
            </label>
            <label className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Ca</span>
              <select
                value={filterShift ?? 'all'}
                onChange={event => onFilterShiftChange(event.target.value)}
                disabled={isLoading}
                className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-bold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10"
              >
                <option value="all">Tất cả ca</option>
                {shiftOptions.map(shift => (
                  <option key={shift} value={shift}>
                    {formatShiftLabel ? formatShiftLabel(shift) : shift}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {error && (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-bold text-rose-700 sm:rounded-xl sm:px-3 sm:text-xs">
            {error}
          </p>
        )}

        <div
          className={`mt-1.5 min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-zinc-100 ${
            compact ? 'max-h-[280px]' : 'max-h-[460px]'
          }`}
        >
          {isLoading ? (
            <div
              className={`flex h-full items-center justify-center font-bold text-zinc-400 ${
                compact ? 'min-h-[120px] text-xs sm:min-h-[160px]' : 'min-h-[160px] text-xs sm:min-h-[240px] sm:text-sm'
              }`}
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang tải...
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </section>
  );
}
