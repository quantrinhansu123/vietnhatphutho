import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface YearPickerViProps {
  nam: number;
  onChange: (nam: number) => void;
  label?: string;
  className?: string;
}

/** Chọn năm kiểu Việt Nam (popup, không dùng input date native). */
export function YearPickerVi({
  nam,
  onChange,
  label = 'Năm',
  className = ''
}: YearPickerViProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(nam || new Date().getFullYear());
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setViewYear(nam || new Date().getFullYear());
    }
  }, [open, nam]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const clampYear = (y: number) => Math.min(2999, Math.max(1, Number.isFinite(y) ? Math.floor(y) : 1));
  const years = Array.from({ length: 12 }, (_, i) => viewYear - 5 + i);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {label && <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        <Calendar className="h-3.5 w-3.5 text-brand-600" />
        <span>Năm {nam}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="12 năm trước"
              onClick={() => setViewYear(y => clampYear(y - 12))}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
              <span>Năm</span>
              <input
                type="number"
                min={1}
                max={2999}
                value={viewYear}
                onChange={e => setViewYear(clampYear(Number(e.target.value) || 1))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onChange(clampYear(viewYear));
                    setOpen(false);
                  }
                }}
                className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-center text-sm font-bold text-slate-900 outline-none focus:border-brand-500"
              />
            </div>
            <button
              type="button"
              aria-label="12 năm sau"
              onClick={() => setViewYear(y => clampYear(y + 12))}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {years.map(y => {
              const isSelected = y === nam;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    onChange(y);
                    setOpen(false);
                  }}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default YearPickerVi;
