import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { orderFieldClass } from '../../features/_shared/orderHelpers';

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  isLoading,
  disabled,
  getLabel,
  getValue,
  inputClassName,
  maxResults = 50,
  allowEmpty = true,
  onSelectOption,
  resolveSelectedItem,
  getOptionLabel,
  getSearchText,
  displaySelectedAsValue = false
}: {
  value: string;
  onChange: (value: string) => void;
  options: unknown[];
  placeholder: string;
  isLoading?: boolean;
  disabled?: boolean;
  getLabel: (item: unknown) => string;
  getValue: (item: unknown) => string;
  inputClassName?: string;
  maxResults?: number;
  allowEmpty?: boolean;
  onSelectOption?: (item: unknown | null) => void;
  resolveSelectedItem?: (options: unknown[], value: string) => unknown | null;
  getOptionLabel?: (item: unknown) => string;
  getSearchText?: (item: unknown) => string;
  displaySelectedAsValue?: boolean;
}) {
  const fieldClass = inputClassName || orderFieldClass;
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const selectedItem = useMemo(() => {
    if (resolveSelectedItem) {
      return resolveSelectedItem(options, value);
    }
    return options.find(item => getValue(item) === value) ?? null;
  }, [options, value, getValue, resolveSelectedItem]);
  const selectedLabel = selectedItem
    ? displaySelectedAsValue
      ? getValue(selectedItem)
      : getLabel(selectedItem)
    : value;

  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel);
    }
  }, [selectedLabel, open]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = normalized
      ? options.filter(item => {
          const label = (getSearchText ?? getLabel)(item).toLowerCase();
          const optionValue = getValue(item).toLowerCase();
          return label.includes(normalized) || optionValue.includes(normalized);
        })
      : options;
    return list.slice(0, maxResults);
  }, [options, query, getLabel, getSearchText, getValue, maxResults]);

  const commitValue = (nextValue: string, item: unknown | null = null) => {
    const trimmed = nextValue.trim();
    onChange(trimmed);
    onSelectOption?.(item);
    if (item) {
      setQuery(getLabel(item));
    } else if (trimmed) {
      const match = options.find(opt => getValue(opt) === trimmed);
      setQuery(match ? getLabel(match) : trimmed);
    } else {
      setQuery('');
    }
    setOpen(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        if (allowEmpty) {
          commitValue('', null);
        } else {
          setQuery(selectedLabel);
          setOpen(false);
        }
        return;
      }

      const exactValue = options.find(item => getValue(item).toLowerCase() === normalized);
      if (exactValue) {
        commitValue(getValue(exactValue), exactValue);
        return;
      }

      const exactLabel = options.find(item => getLabel(item).toLowerCase() === normalized);
      if (exactLabel) {
        commitValue(getValue(exactLabel), exactLabel);
        return;
      }

      if (filteredOptions.length === 1) {
        commitValue(getValue(filteredOptions[0]), filteredOptions[0]);
        return;
      }

      setQuery(selectedLabel);
      setOpen(false);
    }, 120);
  };

  const isDisabled = Boolean(disabled || isLoading);
  const emptyText = isLoading ? 'Đang tải...' : options.length === 0 ? 'Không có dữ liệu' : placeholder;

  const updateMenuPosition = () => {
    const element = inputRef.current;
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
  }, [open, query, filteredOptions.length]);

  const dropdownPanelClass =
    'fixed z-[120] max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg';

  const renderDropdown = () => {
    if (!open || isDisabled || !menuStyle) return null;

    if (filteredOptions.length > 0) {
      return createPortal(
        <div className={dropdownPanelClass} style={menuStyle}>
          {allowEmpty && !query.trim() && (
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => commitValue('', null)}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-zinc-500 transition hover:bg-zinc-50"
            >
              {placeholder}
            </button>
          )}
          {filteredOptions.map((item, index) => {
            const optionValue = getValue(item);
            const optionLabel = (getOptionLabel ?? getLabel)(item);
            return (
              <button
                key={`${optionValue}-${index}`}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => commitValue(optionValue, item)}
                className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-red-50 ${
                  optionValue === value ? 'bg-red-50 font-black text-[#ef1b2d]' : 'font-semibold text-zinc-800'
                }`}
              >
                {optionLabel}
              </button>
            );
          })}
        </div>,
        document.body
      );
    }

    if (query.trim()) {
      return createPortal(
        <div className={dropdownPanelClass} style={menuStyle}>
          <div className="px-3 py-2 text-xs font-semibold text-zinc-500">Không tìm thấy kết quả</div>
        </div>,
        document.body
      );
    }

    return null;
  };

  return (
    <div className="relative min-w-0 w-full">
      <input
        ref={inputRef}
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (!isDisabled) setOpen(true);
        }}
        onBlur={handleBlur}
        disabled={isDisabled}
        placeholder={emptyText}
        className={fieldClass}
      />
      {renderDropdown()}
    </div>
  );
}

export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
  isLoading,
  disabled,
  getLabel,
  getValue
}: {
  value: string;
  onChange: (value: string) => void;
  options: unknown[];
  placeholder: string;
  isLoading?: boolean;
  disabled?: boolean;
  getLabel: (item: unknown) => string;
  getValue: (item: unknown) => string;
}) {
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      isLoading={isLoading}
      disabled={disabled}
      getLabel={getLabel}
      getValue={getValue}
    />
  );
}

