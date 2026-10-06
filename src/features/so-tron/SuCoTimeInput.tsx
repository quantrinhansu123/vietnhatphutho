import React from 'react';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function splitTime(value: string) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hh: '', mm: '' };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hh: '', mm: '' };
  }
  return { hh: String(hour).padStart(2, '0'), mm: String(minute).padStart(2, '0') };
}

/** Chọn giờ 24h (00–23) và phút, không gõ tay. Giá trị lưu dạng HH:MM. */
export function SuCoTimeInput({
  value,
  onChange,
  title,
  className
}: {
  value: string;
  onChange: (v: string) => void;
  title?: string;
  className?: string;
}) {
  const { hh, mm } = splitTime(value);
  const label = title || 'Giờ';
  const selectClass =
    className ||
    'h-7 rounded border border-slate-300 bg-white px-0.5 text-[13px] font-bold tabular-nums text-black outline-none';

  const emit = (nextHour: string, nextMinute: string) => {
    if (!nextHour && !nextMinute) {
      onChange('');
      return;
    }
    onChange(`${nextHour || '00'}:${nextMinute || '00'}`);
  };

  return (
    <span className="inline-flex items-center gap-0.5" title={`${label} (chọn giờ 24h)`}>
      <select
        aria-label={`${label} — giờ`}
        value={hh}
        onChange={event => emit(event.target.value, mm)}
        className={selectClass}
      >
        <option value="">Giờ</option>
        {HOURS.map(hour => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="text-[13px] font-bold text-black">:</span>
      <select
        aria-label={`${label} — phút`}
        value={mm}
        onChange={event => emit(hh, event.target.value)}
        className={selectClass}
      >
        <option value="">Phút</option>
        {MINUTES.map(minute => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
    </span>
  );
}
