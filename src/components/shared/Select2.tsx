import React, { useEffect, useRef } from 'react';
import $ from 'jquery';
import select2Factory from 'select2/dist/js/select2.full.js';

type Select2JQuery = JQuery<HTMLSelectElement> & {
  select2: (options?: Record<string, unknown> | string) => JQuery<HTMLSelectElement>;
};

export type Select2Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  /** Giá trị được trả về khi người dùng chọn option. */
  onValueChange?: (value: string) => void;
  /** Cấu hình Select2 riêng cho từng instance, nếu cần. */
  select2Options?: Record<string, unknown>;
  /** Đổi giá trị này khi nội dung option thay đổi cần Select2 render lại. */
  refreshKey?: string | number;
};

const initializeSelect2 = select2Factory as unknown as (root: Window, jquery: typeof $) => void;

if (typeof window !== 'undefined' && typeof initializeSelect2 === 'function') {
  initializeSelect2(window, $);
}

function readSelectValue(select: Select2JQuery) {
  const rawValue = select.val();
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  return String(value ?? '');
}

export function Select2({
  onValueChange,
  select2Options,
  refreshKey,
  children,
  ...selectProps
}: Select2Props) {
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const onValueChangeRef = useRef(onValueChange);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    const element = selectRef.current;
    if (!element) return;

    const select = $(element) as Select2JQuery;
    select.select2({
      width: '100%',
      ...select2Options
    });

    const handleChange = () => {
      onValueChangeRef.current?.(readSelectValue(select));
    };
    select.on('change.select2Component', handleChange);

    return () => {
      select.off('.select2Component');
      if (select.hasClass('select2-hidden-accessible')) {
        select.select2('destroy');
      }
    };
  }, [refreshKey, select2Options]);

  useEffect(() => {
    const element = selectRef.current;
    if (!element) return;
    const select = $(element) as Select2JQuery;
    select.val(selectProps.value || null).trigger('change.select2');
  }, [selectProps.value]);

  return (
    <select ref={selectRef} {...selectProps} onChange={() => undefined}>
      {children}
    </select>
  );
}
