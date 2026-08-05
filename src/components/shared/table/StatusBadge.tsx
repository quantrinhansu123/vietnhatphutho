const COLOR_CLASSES: Record<string, string> = {
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  zinc: 'border-zinc-200 bg-zinc-50 text-zinc-600'
};

export type StatusBadgeColor = keyof typeof COLOR_CLASSES;

/** Badge trạng thái dạng pill dùng chung cho các bảng, vd. "Chờ sx", "Hoàn thành". */
export function StatusBadge({ label, color = 'amber' }: { label: string; color?: StatusBadgeColor }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${COLOR_CLASSES[color]}`}>
      {label}
    </span>
  );
}
