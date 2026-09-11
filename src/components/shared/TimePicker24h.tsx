import React, { useEffect, useState } from 'react';

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

/** Picker giờ phút theo khung 24h (00:00–23:59). Để trống thì giữ trống — không ép thành 00:00. */
export function TimePicker24h({ value, onChange, className, required, disabled, ...rest }: Props) {
  const parsed = splitTime(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);

  useEffect(() => {
    const next = splitTime(value);
    setHour(next.hour);
    setMinute(next.minute);
  }, [value]);

  const commit = (nextHour: string, nextMinute: string) => {
    setHour(nextHour);
    setMinute(nextMinute);
    // Chỉ emit HH:mm khi đủ cả giờ và phút; còn lại giữ trống (không fallback 00).
    if (nextHour && nextMinute) {
      onChange(`${nextHour}:${nextMinute}`);
      return;
    }
    onChange('');
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
        onChange={e => commit(e.target.value, minute)}
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
        onChange={e => commit(hour, e.target.value)}
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
