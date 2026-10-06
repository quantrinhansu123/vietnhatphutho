import React from 'react';

/** Ô nhập giờ 24h (HH:MM) cho sự cố tự do — thay `input type="time"` để hiển thị luôn 24h. */
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
  const formatDigits = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  };
  return (
    <input
      value={value || ''}
      inputMode="numeric"
      placeholder="07:30"
      title={`${title || 'Giờ'} (24h, HH:MM)`}
      onChange={e => {
        const text = e.target.value;
        // Cho gõ dấu : tự nhiên, còn lại chỉ giữ số
        if (/^\d{0,2}:?\d{0,2}$/.test(text)) {
          onChange(text.includes(':') ? text : formatDigits(text));
        }
      }}
      onBlur={e => {
        const text = e.target.value.trim();
        if (!text) {
          onChange('');
          return;
        }
        let normalized = text;
        // Gõ "7" hoặc "0730" → chuẩn hóa HH:MM
        if (/^\d{1,4}$/.test(text)) {
          const digits = text.padStart(4, '0');
          normalized = `${digits.slice(0, 2)}:${digits.slice(2)}`;
        }
        const m = normalized.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return;
        const hh = Math.min(23, Math.max(0, Number(m[1])));
        const mm = Math.min(59, Math.max(0, Number(m[2])));
        onChange(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      }}
      className={
        className ||
        'h-7 rounded border border-slate-300 px-1 text-[13px] font-bold tabular-nums text-black outline-none'
      }
    />
  );
}
