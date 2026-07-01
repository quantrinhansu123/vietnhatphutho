import React from 'react';
import { Plus } from 'lucide-react';

export type RepeatableLineColumn = {
  key: string;
  label: string;
  className?: string;
  required?: boolean;
};

type RepeatableLinesBlockProps = {
  title: string;
  required?: boolean;
  onAdd: () => void;
  addLabel?: string;
  hideAddButton?: boolean;
  columns: RepeatableLineColumn[];
  children: React.ReactNode;
  addButtonClassName?: string;
  className?: string;
};

export function RepeatableLinesBlock({
  title,
  required,
  onAdd,
  addLabel = 'Thêm dòng',
  hideAddButton = false,
  columns,
  children,
  addButtonClassName,
  className = ''
}: RepeatableLinesBlockProps) {
  const defaultAddClass =
    'flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-extrabold text-zinc-700 transition hover:bg-zinc-100';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
            {title}
            {required ? ' *' : ''}
          </span>
          {!hideAddButton && (
            <button type="button" onClick={onAdd} className={addButtonClassName || defaultAddClass}>
              <Plus className="h-3.5 w-3.5" />
              {addLabel}
            </button>
          )}
        </div>

        {columns.length > 0 && (
          <div className="hidden flex-wrap items-end gap-2 border-b border-zinc-200/80 pb-1.5 sm:flex">
            {columns.map(column => (
              <span
                key={column.key}
                className={`text-[10px] font-black uppercase tracking-wider text-zinc-500 ${column.className || ''}`}
              >
                {column.label}
                {column.required ? ' *' : ''}
              </span>
            ))}
          </div>
        )}

        <div className="divide-y divide-zinc-200/80">{children}</div>
      </div>
    </div>
  );
}

export function RepeatableLineRow({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-wrap items-end gap-2 py-2 first:pt-0 last:pb-0 ${className}`}>{children}</div>;
}
