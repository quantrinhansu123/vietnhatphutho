import React from 'react';
import { ChevronLeft, Home } from 'lucide-react';
import { pathFromTab } from '../../routes';

export function BackButton({
  onClick,
  variant = 'light',
  className = ''
}: {
  onClick: () => void;
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const styles =
    variant === 'dark'
      ? 'border-white/15 text-white hover:border-brand-500 hover:bg-brand-500'
      : 'border-slate-200 text-slate-600 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border px-3 text-xs font-bold transition ${styles} ${className}`}
    >
      <ChevronLeft className="h-4 w-4" />
      Quay lại
    </button>
  );
}

export function HomeNavButton({
  active,
  onClick,
  variant = 'sidebar'
}: {
  active: boolean;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  variant?: 'sidebar' | 'bottom';
}) {
  const isSidebar = variant === 'sidebar';
  const activeClass = active
    ? isSidebar
      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
      : 'bg-brand-50 text-brand-700'
    : isSidebar
      ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
      : 'text-slate-500 hover:bg-slate-50 hover:text-brand-500';

  return (
    <a
      href={pathFromTab('menu')}
      onClick={onClick}
      aria-label="Trang chủ"
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 transition active:scale-95 ${
        isSidebar
          ? `w-14 rounded-xl px-1 py-2 ${activeClass}`
          : `min-h-[40px] flex-1 py-1 px-2 rounded-lg ${activeClass}`
      }`}
    >
      <Home className="h-4 w-4" />
      <span className={`font-bold uppercase leading-none ${isSidebar ? 'text-[8px] tracking-wide' : 'text-[9px] tracking-wider'}`}>
        Trang chủ
      </span>
    </a>
  );
}

// Bảng ánh xạ tab hiện tại → tab cha (dùng cho nút Quay lại ở bottom nav)
export const BACK_TAB_MAP: Record<string, string> = {
  'acceptance-report-list': 'report-lists',
  'report-lists': 'production-reports',
  'report-forms': 'production-reports',
  'production-reports': 'menu',
  'facility-management': 'menu',
  'hcns': 'menu',
  'business': 'menu',
  'factory': 'menu',
  'products': 'facility-management',
  'machines': 'facility-management',
  'materials': 'facility-management',
  'warehouse-slip': 'facility-management',
  'warehouse-history': 'facility-management',
  'hr': 'hcns',
  'vehicles': 'hcns',
  'driver-policy': 'hcns',
  'settings': 'hcns',
  'orders': 'menu',
  'customers': 'business',
  'production-orders': 'factory',
  'production-plan-history': 'production-reports',
  'weighing-summary': 'report-forms',
  'weighing-summary-list': 'report-lists',
  'damaged-goods-report': 'report-forms',
  'damaged-goods-report-list': 'report-lists',
  'machine-nvl-report': 'report-forms',
  'machine-nvl-report-list': 'report-lists',
  'machine-downtime-list': 'report-lists',
  'machine-downtime-report': 'report-forms',
  'machine-run-log': 'report-forms',
  'machine-run-log-list': 'report-lists',
  'acceptance-report': 'report-forms'
};

export function MobileBackNavButton({
  onClick,
  variant = 'bottom'
}: {
  onClick: () => void;
  variant?: 'bottom' | 'sidebar';
}) {
  const isSidebar = variant === 'sidebar';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Quay lại"
      className={`flex flex-col items-center justify-center gap-0.5 transition active:scale-95 ${
        isSidebar
          ? 'w-14 rounded-xl px-1 py-2 text-slate-400 hover:bg-slate-800 hover:text-white'
          : 'min-h-[40px] flex-1 py-1 px-2 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand-500'
      }`}
    >
      <ChevronLeft className="h-4 w-4" />
      <span className={`font-bold uppercase leading-none ${isSidebar ? 'text-[8px] tracking-wide' : 'text-[9px] tracking-wide'}`}>
        Quay lại
      </span>
    </button>
  );
}
