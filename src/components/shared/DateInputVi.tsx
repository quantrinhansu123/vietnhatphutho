import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

export function toDisplayDate(iso: string): string {
  if (!iso) return '';
  const trimmed = iso.trim().slice(0, 10);
  const parts = trimmed.split('-');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const [y, m, d] = parts;
    if (y.length === 4) {
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }
  return iso;
}

export function parseDisplayDateToIso(display: string): string | null {
  const trimmed = display.trim();
  if (!trimmed) return '';

  let day = 0;
  let month = 0;
  let year = 0;

  // Case 1: dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  const mSep = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (mSep) {
    day = parseInt(mSep[1], 10);
    month = parseInt(mSep[2], 10);
    year = parseInt(mSep[3], 10);
  } else {
    // Case 2: 8 digits ddmmyyyy (e.g. 07092026)
    const mDigits = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (mDigits) {
      day = parseInt(mDigits[1], 10);
      month = parseInt(mDigits[2], 10);
      year = parseInt(mDigits[3], 10);
    } else {
      // Case 3: already yyyy-mm-dd
      const mIso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (mIso) {
        year = parseInt(mIso[1], 10);
        month = parseInt(mIso[2], 10);
        day = parseInt(mIso[3], 10);
      } else {
        return null;
      }
    }
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;

  // Validate real calendar days in month (leap years, 30 vs 31 days)
  const dateObj = new Date(year, month - 1, day);
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return null;
  }

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface DateInputViProps {
  value: string; // ISO format 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
}

export function DateInputVi({
  value,
  onChange,
  className = '',
  inputClassName = '',
  placeholder = 'dd/mm/yyyy',
  disabled = false,
  required = false,
  name,
  id
}: DateInputViProps) {
  const [text, setText] = useState(() => toDisplayDate(value));
  const nativePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(toDisplayDate(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setText(next);

    if (!next.trim()) {
      onChange('');
      return;
    }

    const iso = parseDisplayDateToIso(next);
    if (iso) {
      onChange(iso);
    }
  };

  const handleBlur = () => {
    if (!text.trim()) {
      setText('');
      if (value) onChange('');
      return;
    }

    const iso = parseDisplayDateToIso(text);
    if (iso) {
      setText(toDisplayDate(iso));
      if (iso !== value) onChange(iso);
    } else {
      // Revert to valid prop value if entered text is invalid
      setText(toDisplayDate(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleOpenPicker = () => {
    if (disabled) return;
    if (nativePickerRef.current) {
      if (typeof nativePickerRef.current.showPicker === 'function') {
        try {
          nativePickerRef.current.showPicker();
        } catch {
          // ignore
        }
      }
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        type="text"
        id={id}
        name={name}
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`h-10 w-full rounded-lg border border-zinc-200 bg-white pl-2.5 pr-8 text-sm font-semibold text-zinc-800 outline-none transition focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10 disabled:bg-zinc-100 disabled:text-zinc-400 ${inputClassName}`}
      />
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-400">
        <Calendar className="h-4 w-4" />
      </div>
      <input
        ref={nativePickerRef}
        type="date"
        value={value || ''}
        onChange={e => {
          const nextIso = e.target.value;
          setText(toDisplayDate(nextIso));
          onChange(nextIso);
        }}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onClick={handleOpenPicker}
        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-7 cursor-pointer opacity-0"
      />
    </div>
  );
}

export default DateInputVi;
