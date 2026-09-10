import React from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function splitTime(value: string): { hour: string; minute: string } {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { hour: '', minute: '' };
  return {
    hour: String(Number(match[1])).padStart(2, '0'),
    minute: match[2]
  };
}

/** Picker giờ phút theo khung 24h (00:00–23:59), không dùng AM/PM. */
export function TimePicker24h({ value, onChange, className, required, disabled, ...rest }: Props) {
  const { hour, minute } = splitTime(value);

  const commit = (nextHour: string, nextMinute: string) => {
    if (!nextHour && !nextMinute) {
      onChange('');
      return;
    }
    const h = nextHour || '00';
    const m = nextMinute || '00';
    onChange(`${h}:${m}`);
  };

  const selectClass =
    className ||
    'rounded border border-zinc-300 px-1.5 py-1 text-xs focus:border-[#ef1b2d] focus:outline-none';

  return (
    <div className="inline-flex items-center gap-0.5" aria-label={rest['aria-label'] || 'Chọn giờ 24h'}>
      <select
        value={hour}
        required={required}
        disabled={disabled}
        onChange={e => commit(e.target.value, minute || (e.target.value ? '00' : ''))}
        className={selectClass}
        aria-label="Giờ"
      >
        <option value="">--</option>
        {HOURS.map(h => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-xs font-bold text-zinc-500">:</span>
      <select
        value={minute}
        required={required}
        disabled={disabled}
        onChange={e => commit(hour || (e.target.value ? '00' : ''), e.target.value)}
        className={selectClass}
        aria-label="Phút"
      >
        <option value="">--</option>
        {MINUTES.map(m => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
