import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export type SearchableMultiSelectProps<T> = {
  values: T[];
  onChange: (values: T[]) => void;
  options: T[];
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  /** Khoá nhận diện duy nhất cho mỗi item — mặc định coi T là string (identity). */
  getValue?: (item: T) => string;
  /** Nhãn hiển thị — mặc định giống getValue. */
  getLabel?: (item: T) => string;
  getSearchText?: (item: T) => string;
  /** Cho phép gõ tự do rồi thêm giá trị mới chưa có trong options (mặc định: true, dùng cho tag tự do). */
  allowCustomValues?: boolean;
  /** Ẩn giá trị đã chọn khỏi danh sách dropdown — chip phía trên vẫn giữ để bỏ chọn. */
  hideSelectedFromList?: boolean;
};

function defaultGetValue<T>(item: T): string {
  return String(item).trim();
}

export default function SearchableMultiSelect<T = string>({
  values,
  onChange,
  options,
  placeholder = 'Gõ để tìm hoặc chọn...',
  disabled,
  inputClassName,
  getValue = defaultGetValue,
  getLabel,
  getSearchText,
  allowCustomValues = true,
  hideSelectedFromList = false
}: SearchableMultiSelectProps<T>) {
  const resolvedGetLabel = getLabel ?? ((item: T) => String(item));
  const resolvedGetSearchText = getSearchText ?? resolvedGetLabel;

  const fieldClass =
    inputClassName ||
    'min-h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedKeySet = useMemo(
    () => new Set(values.map(item => getValue(item)).filter(Boolean)),
    [values, getValue]
  );

  /** Gộp options ∪ values hiện tại (phòng khi 1 giá trị đã chọn không còn trong options). */
  const itemsByKey = useMemo(() => {
    const map = new Map<string, T>();
    options.forEach(item => {
      const key = getValue(item);
      if (key) map.set(key, item);
    });
    values.forEach(item => {
      const key = getValue(item);
      if (key && !map.has(key)) map.set(key, item);
    });
    return map;
  }, [options, values, getValue]);

  const allKeys = useMemo(
    () =>
      [...itemsByKey.keys()].sort((a, b) =>
        resolvedGetLabel(itemsByKey.get(a) as T).localeCompare(resolvedGetLabel(itemsByKey.get(b) as T), 'vi')
      ),
    [itemsByKey, resolvedGetLabel]
  );

  const filteredKeys = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let list = normalized
      ? allKeys.filter(key => resolvedGetSearchText(itemsByKey.get(key) as T).toLowerCase().includes(normalized))
      : allKeys;
    if (hideSelectedFromList) {
      list = list.filter(key => !selectedKeySet.has(key));
    }
    return list.slice(0, 50);
  }, [allKeys, query, itemsByKey, resolvedGetSearchText, hideSelectedFromList, selectedKeySet]);

  const trimmedQuery = query.trim();
  const canCreate =
    allowCustomValues &&
    Boolean(trimmedQuery) &&
    !allKeys.some(key => resolvedGetLabel(itemsByKey.get(key) as T).toLowerCase() === trimmedQuery.toLowerCase());

  const updateMenuPosition = () => {
    const element = containerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    });
  };

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, query, filteredKeys.length, values.length]);

  const toggleValue = (key: string) => {
    if (!key) return;
    if (selectedKeySet.has(key)) {
      onChange(values.filter(item => getValue(item) !== key));
      return;
    }
    const item = itemsByKey.get(key);
    if (!item) return;
    onChange([...values, item]);
    setQuery('');
  };

  const removeValue = (key: string) => {
    onChange(values.filter(item => getValue(item) !== key));
  };

  const addNewValue = () => {
    if (!allowCustomValues || !trimmedQuery) return;
    if (!selectedKeySet.has(trimmedQuery)) {
      onChange([...values, trimmedQuery as unknown as T]);
    }
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (next && containerRef.current?.contains(next)) return;
    window.setTimeout(() => setOpen(false), 120);
  };

  const renderDropdown = () => {
    if (!open || disabled || !menuStyle) return null;

    return createPortal(
      <div
        className="fixed z-[120] max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg"
        style={menuStyle}
        onMouseDown={event => event.preventDefault()}
      >
        {filteredKeys.length === 0 && !canCreate ? (
          <div className="px-3 py-2 text-xs font-semibold text-zinc-500">Không có lựa chọn phù hợp</div>
        ) : null}
        {filteredKeys.map(key => {
          const item = itemsByKey.get(key) as T;
          const checked = selectedKeySet.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleValue(key)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-red-50 ${
                checked ? 'bg-red-50/70 font-bold text-[#ef1b2d]' : 'font-semibold text-zinc-800'
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  checked ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white' : 'border-zinc-300 bg-white'
                }`}
              >
                {checked ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className="min-w-0 flex-1">{resolvedGetLabel(item)}</span>
            </button>
          );
        })}
        {canCreate ? (
          <button
            type="button"
            onClick={addNewValue}
            className="block w-full border-t border-zinc-100 px-3 py-2 text-left text-sm font-bold text-[#ef1b2d] transition hover:bg-red-50"
          >
            Thêm &quot;{trimmedQuery}&quot;
          </button>
        ) : null}
      </div>,
      document.body
    );
  };

  return (
    <div ref={containerRef} className="relative space-y-2" onBlur={handleBlur}>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map(item => {
            const key = getValue(item);
            return (
              <span
                key={key}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-[#ef1b2d]"
              >
                <span className="truncate">{resolvedGetLabel(item)}</span>
                {!disabled ? (
                  <button
                    type="button"
                    onClick={() => removeValue(key)}
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#ef1b2d] transition hover:bg-red-100"
                    title="Bỏ chọn"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      ) : null}
      <input
        ref={inputRef}
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && canCreate) {
            event.preventDefault();
            addNewValue();
          }
        }}
        disabled={disabled}
        placeholder={values.length > 0 ? (allowCustomValues ? 'Gõ thêm...' : placeholder) : placeholder}
        className={fieldClass}
      />
      {renderDropdown()}
    </div>
  );
}
