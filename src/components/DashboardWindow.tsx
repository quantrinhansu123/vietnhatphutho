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
  children
}: {
  title: string;
  subtitle: string;
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
  children: React.ReactNode;
}) {
  const actionButtonClass =
    'min-w-0 rounded-lg border border-white/30 bg-white/15 px-2 py-1.5 text-[10px] font-extrabold leading-tight text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:py-2 sm:text-xs';

  return (
    <section
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm sm:rounded-2xl sm:border-2 sm:border-zinc-900/10 ${
        compact ? 'sm:min-h-[300px]' : 'sm:min-h-[440px]'
      }`}
    >
      <div
        className={`flex flex-col gap-2 border-b border-zinc-100 sm:flex-row sm:items-start sm:justify-between sm:gap-3 ${
          compact ? 'px-2.5 py-2 sm:px-3' : 'px-3 py-2.5 sm:px-4 sm:py-3'
        } ${accentClass}`}
      >
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={`flex shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 sm:rounded-xl ${
              compact ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-8 w-8 sm:h-10 sm:w-10'
            }`}
          >
            <Icon className={compact ? 'h-3.5 w-3.5 text-white sm:h-4 sm:w-4' : 'h-4 w-4 text-white sm:h-5 sm:w-5'} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className={`truncate font-black text-white ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
              {title}
            </h3>
            {!compact && (
              <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold text-white/75 sm:text-xs">{subtitle}</p>
            )}
            <p
              className={`font-bold uppercase tracking-wider text-white/60 ${
                compact ? 'mt-0.5 text-[9px] sm:text-[10px]' : 'mt-1 text-[10px] sm:text-[11px]'
              }`}
            >
              {countLabel}: <span className="text-white">{isLoading ? '...' : count}</span>
            </p>
            {summaryExtra ? (
              <p
                className={`font-bold uppercase tracking-wider text-white/70 ${
                  compact ? 'mt-0.5 text-[9px] sm:text-[10px]' : 'mt-1 text-[10px] sm:text-[11px]'
                }`}
              >
                {summaryExtra}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled || secondaryAction.loading}
              className={`col-span-1 ${actionButtonClass}`}
            >
              {secondaryAction.loading ? (
                <span className="inline-flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
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
              className={`col-span-1 ${actionButtonClass}`}
            >
              {tertiaryAction.loading ? (
                <span className="inline-flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
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
            className={`${secondaryAction || tertiaryAction ? 'col-span-2 sm:col-span-1' : 'col-span-2 sm:col-span-1'} rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[10px] font-extrabold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2 sm:text-xs`}
          >
            <span className="block truncate">{openLabel}</span>
          </button>
        </div>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${compact ? 'p-2' : 'p-2.5 sm:p-3'}`}>
        <label
          className={`flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 sm:rounded-xl ${
            compact ? 'h-8' : 'h-9 sm:h-10'
          }`}
        >
          <Search className={`shrink-0 text-zinc-400 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
          <input
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Lọc nhanh..."
            disabled={isLoading}
            className={`min-w-0 flex-1 bg-transparent font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none ${
              compact ? 'text-xs' : 'text-xs sm:text-sm'
            }`}
          />
        </label>

        {error && (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-bold text-rose-700 sm:rounded-xl sm:px-3 sm:text-xs">
            {error}
          </p>
        )}

        <div className="mt-2 min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-zinc-100 sm:rounded-xl">
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
