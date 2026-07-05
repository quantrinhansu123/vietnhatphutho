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
  extraHeaderButtons?: React.ReactNode;
  showColumnHeaders?: boolean;
  columns: RepeatableLineColumn[];
  children: React.ReactNode;
  addButtonClassName?: string;
  className?: string;
  /** Index của dòng đang được sửa (null = thêm mới) - dùng cho mobile highlight */
  editingIndex?: number | null;
};

export function RepeatableLinesBlock({
  title,
  required,
  onAdd,
  addLabel = 'Thêm dòng',
  hideAddButton = false,
  extraHeaderButtons,
  showColumnHeaders = false,
  columns,
  children,
  addButtonClassName,
  className = '',
  editingIndex
}: RepeatableLinesBlockProps) {
  const defaultAddClass =
    'flex h-8 items-center gap-1 rounded-md border border-brand-500 bg-brand-50 px-2.5 text-[11px] font-bold text-brand-700 transition hover:bg-brand-100';

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="space-y-2 rounded-xl border border-ink-200 bg-ink-50 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-ink-500">
            {title}
            {required ? ' *' : ''}
          </span>
          {!hideAddButton && (
            <div className="flex items-center gap-2">
              {extraHeaderButtons}
              <button
                type="button"
                onClick={onAdd}
                className={addButtonClassName || defaultAddClass}
              >
                <Plus className="h-4 w-4" />
                {addLabel}
              </button>
            </div>
          )}
          {hideAddButton && extraHeaderButtons ? (
            <div className="flex items-center gap-2">{extraHeaderButtons}</div>
          ) : null}
        </div>

        {columns.length > 0 && (
          <div
            className={`flex-wrap items-end gap-2 border-b border-ink-200/80 pb-1.5 ${
              showColumnHeaders ? 'flex' : 'hidden md:flex'
            }`}
          >
            {columns.map(column => (
              <span
                key={column.key}
                className={`text-[10px] font-black uppercase tracking-wider text-ink-500 ${column.className || ''}`}
              >
                {column.label}
                {column.required ? ' *' : ''}
              </span>
            ))}
          </div>
        )}

        <div className="divide-y divide-ink-200/80">{children}</div>

        {editingIndex !== undefined && editingIndex !== null && (
          <p className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[10px] font-bold text-brand-700 md:hidden">
            Đang sửa dòng số {editingIndex + 1}. Nhấn "Lưu" để cập nhật.
          </p>
        )}
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
  return (
    <div
      className={`hidden flex-wrap items-end gap-2 py-2 first:pt-0 last:pb-0 md:flex ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Card hiển thị 1 dòng dạng thu gọn trên mobile. Bấm vào card để mở sheet sửa dòng.
 * index bắt đầu từ 1.
 */
export function RepeatableLineCard({
  index,
  summary,
  onEdit,
  onRemove,
  badgeColor = 'brand'
}: {
  index: number;
  summary: React.ReactNode;
  onEdit?: () => void;
  onRemove?: () => void;
  badgeColor?: 'brand' | 'warning' | 'success' | 'danger' | 'ink';
}) {
  const badgeClass = {
    brand: 'bg-brand-500 text-white',
    warning: 'bg-warning-500 text-white',
    success: 'bg-success-500 text-white',
    danger: 'bg-danger-500 text-white',
    ink: 'bg-ink-700 text-white'
  }[badgeColor];

  return (
    <div className="md:hidden">
      <div className="flex items-stretch gap-2 py-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left transition active:scale-[0.98] hover:border-brand-300 hover:bg-brand-50"
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${badgeClass}`}
          >
            {index}
          </span>
          <span className="min-w-0 flex-1 text-xs font-bold text-ink-800">{summary}</span>
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-auto w-11 shrink-0 items-center justify-center rounded-xl border border-ink-200 text-ink-500 transition hover:border-danger-300 hover:bg-danger-50 hover:text-danger-700"
            aria-label="Xoá dòng"
          >
            <span className="text-sm font-black">×</span>
          </button>
        )}
      </div>
    </div>
  );
}
