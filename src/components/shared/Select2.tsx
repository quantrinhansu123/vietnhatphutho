import React, { useEffect, useRef } from 'react';
import $ from 'jquery';
import select2Factory from 'select2/dist/js/select2.full.js';

type Select2JQuery = JQuery<HTMLSelectElement> & {
  select2: (options?: Record<string, unknown> | string) => JQuery<HTMLSelectElement>;
};

export type Select2Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & {
  /** Giá trị hiện tại (chuỗi đơn hoặc mảng chuỗi khi multiple) */
  value?: string | number | readonly string[] | string[];
  /** Giá trị được trả về khi người dùng chọn option (đơn). */
  onValueChange?: (value: string) => void;
  /** Danh sách giá trị được trả về khi chọn nhiều (multiple). */
  onValuesChange?: (values: string[]) => void;
  /** Cấu hình Select2 riêng cho từng instance, nếu cần. */
  select2Options?: Record<string, unknown>;
  /** Đổi giá trị này khi nội dung option thay đổi cần Select2 render lại. */
  refreshKey?: string | number;
  /** Gắn dropdown vào phần tử này (form overlay/modal) để không bị cắt bởi overflow. */
  dropdownParent?: HTMLElement | null;
};

const initializeSelect2 = select2Factory as unknown as (root: Window, jquery: typeof $) => void;

if (typeof window !== 'undefined' && typeof initializeSelect2 === 'function') {
  initializeSelect2(window, $);
}

function readSelectValue(select: Select2JQuery): string {
  const rawValue = select.val();
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  return String(value ?? '');
}

function readSelectValues(select: Select2JQuery): string[] {
  const rawValue = select.val();
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) return rawValue.map(String);
  return [String(rawValue)];
}

export function Select2({
  onValueChange,
  onValuesChange,
  select2Options,
  refreshKey,
  dropdownParent,
  children,
  ...selectProps
}: Select2Props) {
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const onValueChangeRef = useRef(onValueChange);
  const onValuesChangeRef = useRef(onValuesChange);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
    onValuesChangeRef.current = onValuesChange;
  }, [onValueChange, onValuesChange]);

  useEffect(() => {
    const element = selectRef.current;
    if (!element) return;

    const select = $(element) as Select2JQuery;
    select.select2({
      width: '100%',
      ...(dropdownParent ? { dropdownParent: $(dropdownParent) } : {}),
      ...select2Options
    });

    const handleChange = () => {
      const vals = readSelectValues(select);
      onValuesChangeRef.current?.(vals);
      onValueChangeRef.current?.(vals[0] ?? '');
    };
    select.on('change.select2Component', handleChange);

    return () => {
      select.off('.select2Component');
      if (select.hasClass('select2-hidden-accessible')) {
        select.select2('destroy');
      }
    };
  }, [refreshKey, select2Options, dropdownParent]);

  useEffect(() => {
    const element = selectRef.current;
    if (!element) return;
    const select = $(element) as Select2JQuery;

    const currentVal = select.val();
    const targetVal = selectProps.value;

    const currentArr = Array.isArray(currentVal) ? currentVal.map(String) : (currentVal ? [String(currentVal)] : []);
    const targetArr = Array.isArray(targetVal) ? targetVal.map(String) : (targetVal ? [String(targetVal)] : []);

    if (JSON.stringify(currentArr) !== JSON.stringify(targetArr)) {
      const valToSet = selectProps.multiple
        ? (targetVal ? (Array.isArray(targetVal) ? [...targetVal] : [targetVal]) : [])
        : (targetVal ?? null);
      select.val(valToSet as any).trigger('change.select2');
    }
  }, [selectProps.value, selectProps.multiple]);

  return (
    <select ref={selectRef} {...selectProps} onChange={() => undefined}>
      {children}
    </select>
  );
}
