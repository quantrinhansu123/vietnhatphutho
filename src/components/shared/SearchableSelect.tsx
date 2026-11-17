import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { orderFieldClass } from '../../features/_shared/orderHelpers';

const DIACRITIC_MARK_RANGE = [
  String.fromCharCode(0x0300),
  String.fromCharCode(0x036f)
];
const DIACRITIC_MARKS_PATTERN = new RegExp(`[${DIACRITIC_MARK_RANGE[0]}-${DIACRITIC_MARK_RANGE[1]}]`, 'g');

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_MARKS_PATTERN, '')
    .replace(/đ/g, 'd');
}

/** Giới hạn token khi search bằng dấu phẩy (AND) — tránh loop vô ích khi dán chuỗi dài. */
const MAX_COMMA_SEARCH_TOKENS = 16;

/**
 * Tách query theo dấu phẩy → nhiều từ khóa AND.
 * Ví dụ: `Hưng Yên, Phế` → ["hung yen", "phe"] (đã bỏ dấu).
 * Không có dấu phẩy → 1 token như search cũ.
 */
function parseCommaAndSearchTokens(query: string): string[] {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const normalized = normalizeSearchText(raw);
  if (!normalized) return [];
  if (!raw.includes(',')) return [normalized];

  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const part of normalized.split(',')) {
    const token = part.trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= MAX_COMMA_SEARCH_TOKENS) break;
  }
  return tokens;
}

function matchesAllSearchTokens(haystack: string, tokens: string[]): boolean {
  for (let i = 0; i < tokens.length; i += 1) {
    if (!haystack.includes(tokens[i])) return false;
  }
  return true;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyInputText,
  isLoading,
  disabled,
  getLabel,
  getValue,
  inputClassName,
  maxResults = 50,
  allowEmpty = true,
  allowCustomValue = false,
  onSelectOption,
  resolveSelectedItem,
  getOptionLabel,
  getSearchText,
  displaySelectedAsValue = false,
  desktopAutoFlip = false,
  dropdownMaxHeight = 208,
  openUpward = false,
  comboboxMode = false,
  comboboxSearchable = true,
  matchDropdownWidth = false,
  searchPlaceholder,
  selectedOptionClassName,
  skipUnchangedBlurCommit = false,
  title,
  showAllWhenQueryMatchesSelection = false,
  revertOnBlurMismatch = false
}: {
  value: string;
  onChange: (value: string) => void;
  options: unknown[];
  placeholder: string;
  /** Nội dung tùy chọn khi ô chưa có giá trị hoặc danh sách đang rỗng. */
  emptyInputText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  getLabel: (item: unknown) => string;
  getValue: (item: unknown) => string;
  inputClassName?: string;
  maxResults?: number;
  allowEmpty?: boolean;
  /** Cho phép giữ giá trị người dùng tự nhập dù không có trong danh sách gợi ý. */
  allowCustomValue?: boolean;
  onSelectOption?: (item: unknown | null) => void;
  resolveSelectedItem?: (options: unknown[], value: string) => unknown | null;
  getOptionLabel?: (item: unknown) => string;
  getSearchText?: (item: unknown) => string;
  displaySelectedAsValue?: boolean;
  /** Trên desktop, tự mở menu lên trên nếu phía dưới không đủ chỗ. */
  desktopAutoFlip?: boolean;
  /** Chiều cao ưu tiên của danh sách mở (px), vẫn tự giới hạn theo vùng nhìn thấy. */
  dropdownMaxHeight?: number;
  openUpward?: boolean;
  /** Hiển thị dạng combobox: nút có mũi tên, menu mở ra có ô tìm kiếm riêng. */
  comboboxMode?: boolean;
  /** Cho phép hiển thị ô tìm kiếm bên trong menu combobox. */
  comboboxSearchable?: boolean;
  matchDropdownWidth?: boolean;
  /** Placeholder riêng cho ô tìm kiếm trong menu combobox. */
  searchPlaceholder?: string;
  /** Class riêng cho option đang được chọn trong dropdown (mặc định: nền đỏ/chữ đỏ). */
  selectedOptionClassName?: string;
  /** Rời ô mà giá trị không đổi thì không gọi onChange (tránh nạp lại thông số mặc định khi chỉ click vào ô). */
  skipUnchangedBlurCommit?: boolean;
  /** Tooltip khi rê chuột vào ô (vd hiện đủ tên dài bị cắt). */
  title?: string;
  /**
   * Khi ô đang hiện đúng giá trị đã chọn, dropdown liệt kê đủ option
   * (vd tên sản xuất cùng mã AMIS). Chỉ lọc sau khi người dùng sửa chữ tìm.
   */
  showAllWhenQueryMatchesSelection?: boolean;
  /**
   * Blur mà chữ gõ không khớp option nào: đang gắn option thì hoàn lại lựa chọn cũ
   * (tránh gõ tìm rồi click ra ngoài làm nhảy thành tên mới ngoài ý muốn).
   * Enter / bấm Thêm / click option vẫn chốt bình thường.
   */
  revertOnBlurMismatch?: boolean;
}) {
  const fieldClass = inputClassName || orderFieldClass;
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const selectedItem = useMemo(() => {
    if (!value) return null;
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

  /** Cùng nhãn (vd cùng mã NVL) thì không lấy dòng đầu. Giữ dòng đang chọn nếu nhãn khớp. */
  function matchExactLabel(normalized: string) {
    const matches = options.filter(item => getLabel(item).toLowerCase() === normalized);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1 && selectedItem && getLabel(selectedItem).toLowerCase() === normalized) {
      return selectedItem;
    }
    return null;
  }

  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel);
    }
  }, [selectedLabel, open]);

  /** Index search đã normalize sẵn — tránh normalize lại từng option mỗi lần gõ. */
  const optionSearchIndex = useMemo(() => {
    const searchOf = getSearchText ?? getLabel;
    return options.map(item => ({
      item,
      haystack: normalizeSearchText(`${searchOf(item)} ${getValue(item)}`)
    }));
  }, [options, getSearchText, getLabel, getValue]);

  const filteredOptions = useMemo(() => {
    // Combobox không có ô tìm: luôn hiện đủ danh sách.
    // Nếu lọc theo `query` (= giá trị đang chọn) thì đổi ca sẽ mất option khác
    // (vd đang HC1 → "hc2" không chứa "hc1" → không chọn được HC2).
    if (comboboxMode && !comboboxSearchable) {
      return options.slice(0, maxResults);
    }
    const tokens = parseCommaAndSearchTokens(query);
    const selectedNormalized = normalizeSearchText(String(selectedLabel || '').trim());
    const queryNormalized = normalizeSearchText(query.trim());
    if (
      showAllWhenQueryMatchesSelection &&
      queryNormalized &&
      queryNormalized === selectedNormalized &&
      tokens.length <= 1
    ) {
      return options.slice(0, maxResults);
    }
    if (tokens.length === 0) {
      return options.slice(0, maxResults);
    }

    const list: unknown[] = [];
    for (let i = 0; i < optionSearchIndex.length; i += 1) {
      const row = optionSearchIndex[i];
      if (!matchesAllSearchTokens(row.haystack, tokens)) continue;
      list.push(row.item);
      if (list.length >= maxResults) break;
    }
    return list;
  }, [
    optionSearchIndex,
    options,
    query,
    maxResults,
    comboboxMode,
    comboboxSearchable,
    showAllWhenQueryMatchesSelection,
    selectedLabel
  ]);

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

  /** Rời ô mà giá trị không đổi (vd chỉ click vào ô rồi click ra) thì không gọi onChange — tránh nạp lại thông số mặc định. */
  const commitFromBlur = (nextValue: string, item: unknown | null = null) => {
    if (skipUnchangedBlurCommit && nextValue.trim() === String(value ?? '').trim()) {
      setQuery(selectedLabel);
      setOpen(false);
      return;
    }
    commitValue(nextValue, item);
  };

  const handleBlur = () => {
    // Commit đồng bộ ngay khi blur: nút Lưu bấm ngay sau khi xóa ô vẫn đọc đúng state mới.
    // Không dùng setTimeout — click chọn option đã chặn blur bằng preventDefault nên không xung đột.
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      if (allowEmpty) {
        commitFromBlur('', null);
      } else {
        setQuery(selectedLabel);
        setOpen(false);
      }
      return;
    }

    const exactValue = options.find(item => getValue(item).toLowerCase() === normalized);
    if (exactValue) {
      commitFromBlur(getValue(exactValue), exactValue);
      return;
    }

    const exactLabel = matchExactLabel(normalized);
    if (exactLabel) {
      commitFromBlur(getValue(exactLabel), exactLabel);
      return;
    }

    if (resolveSelectedItem) {
      const resolved = resolveSelectedItem(options, normalized);
      if (resolved) {
        commitFromBlur(getValue(resolved), resolved);
        return;
      }
    }

    if (revertOnBlurMismatch && selectedItem) {
      setQuery(selectedLabel);
      setOpen(false);
      return;
    }

    if (allowCustomValue) {
      commitFromBlur(query, null);
      return;
    }

    if (filteredOptions.length === 1) {
      commitFromBlur(getValue(filteredOptions[0]), filteredOptions[0]);
      return;
    }

    setQuery(selectedLabel);
    setOpen(false);
  };

  const isDisabled = Boolean(disabled || isLoading);
  const emptyText = isLoading
    ? emptyInputText ?? 'Đang tải...'
    : options.length === 0
      ? emptyInputText ?? 'Không có dữ liệu'
      : placeholder;

  const updateMenuPosition = () => {
    const element = anchorRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    // Trên mobile ô nhập rất hẹp → nới rộng menu để tên dài không bị xuống dòng nhiều
    const viewportWidth = document.documentElement.clientWidth;
    const margin = 8;
    const width = matchDropdownWidth
      ? Math.min(rect.width, viewportWidth - margin * 2)
      : Math.max(rect.width, Math.min(340, viewportWidth - margin * 2));
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewportWidth - width - margin));
    const isDesktop = window.matchMedia('(min-width: 1280px)').matches;
    const viewportHeight = document.documentElement.clientHeight;
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - margin);
    const spaceAbove = Math.max(0, rect.top - margin);
    const preferredHeight = openUpward ? spaceAbove : Math.max(120, dropdownMaxHeight);

    if (openUpward && spaceAbove > 0) {
      setMenuStyle({
        bottom: viewportHeight - rect.top + 4,
        left,
        width,
        maxHeight: Math.min(preferredHeight, spaceAbove)
      });
      return;
    }

    // Combobox / danh sách dài: luôn giới hạn chiều cao theo viewport để scroll được,
    // tránh tràn che mất nội dung phía dưới (vd Xuất đến máy/kho).
    const canFlip = openUpward || (desktopAutoFlip && isDesktop) || comboboxMode;
    if (canFlip && spaceBelow < preferredHeight && spaceAbove > spaceBelow) {
      setMenuStyle({
        bottom: viewportHeight - rect.top + 4,
        left,
        width,
        maxHeight: Math.max(120, Math.min(preferredHeight, spaceAbove))
      });
      return;
    }

    setMenuStyle({
      top: rect.bottom + 4,
      left,
      width,
      maxHeight: Math.max(120, Math.min(preferredHeight, spaceBelow || preferredHeight))
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener('resize', handleReposition);
    // Scroll của div bên trong modal không phải lúc nào cũng bắn event lên window.
    // Lắng nghe ở cả document (phase capture) giúp menu luôn bám theo ô nhập.
    window.addEventListener('scroll', handleReposition, true);
    document.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      document.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, query, filteredOptions.length, desktopAutoFlip, openUpward, matchDropdownWidth, comboboxMode]);

  useEffect(() => {
    if (!open || !comboboxMode) return;
    const focusTimer = comboboxSearchable
      ? window.setTimeout(() => searchInputRef.current?.focus(), 0)
      : null;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      const trimmed = query.trim();
      if (allowCustomValue && trimmed) {
        const exactValue = options.find(item => getValue(item).toLowerCase() === trimmed.toLowerCase());
        if (exactValue) {
          commitValue(getValue(exactValue), exactValue);
          return;
        }
        const exactLabel = matchExactLabel(trimmed.toLowerCase());
        if (exactLabel) {
          commitValue(getValue(exactLabel), exactLabel);
          return;
        }
        commitValue(trimmed, null);
        return;
      }
      setQuery(selectedLabel);
      setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => {
      if (focusTimer !== null) window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [
    open,
    comboboxMode,
    comboboxSearchable,
    selectedLabel,
    allowCustomValue,
    query,
    options,
    getValue,
    getLabel
  ]);

  const dropdownPanelClass =
    'fixed z-[200] max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg';

  const queryTrimmed = query.trim();
  const hasExactQueryMatch = useMemo(() => {
    if (!queryTrimmed) return false;
    const normalized = queryTrimmed.toLowerCase();
    return options.some(
      item =>
        getValue(item).toLowerCase() === normalized || getLabel(item).toLowerCase() === normalized
    );
  }, [options, queryTrimmed, getValue, getLabel]);

  const commitTypedOrMatchedValue = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const exactValue = options.find(item => getValue(item).toLowerCase() === trimmed.toLowerCase());
    if (exactValue) {
      commitValue(getValue(exactValue), exactValue);
      return;
    }
    const exactLabel = matchExactLabel(trimmed.toLowerCase());
    if (exactLabel) {
      commitValue(getValue(exactLabel), exactLabel);
      return;
    }
    if (allowCustomValue) {
      commitValue(trimmed, null);
      return;
    }
    if (filteredOptions.length === 1) {
      commitValue(getValue(filteredOptions[0]), filteredOptions[0]);
    }
  };

  const renderCustomAddOption = () => {
    if (!allowCustomValue || !queryTrimmed || hasExactQueryMatch) return null;
    return (
      <button
        type="button"
        onMouseDown={event => event.preventDefault()}
        onClick={() => commitValue(queryTrimmed, null)}
        className="block w-full px-3 py-2.5 text-left text-sm font-extrabold text-[#ef1b2d] transition hover:bg-red-50"
      >
        Thêm «{queryTrimmed}»
      </button>
    );
  };

  const renderDropdown = () => {
    if (!open || isDisabled || !menuStyle) return null;

    if (comboboxMode) {
      return createPortal(
        <div
          ref={menuRef}
          className="fixed z-[200] flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
          style={{ ...menuStyle, zIndex: 9999 }}
        >
          {comboboxSearchable ? (
            <div className="border-b border-zinc-100 bg-white p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    commitTypedOrMatchedValue();
                  }}
                  placeholder={searchPlaceholder || placeholder}
                  className="h-10 w-full rounded-lg bg-zinc-50 pl-9 pr-3 text-sm font-medium text-zinc-800 outline-none ring-1 ring-transparent placeholder:text-zinc-400 focus:bg-white focus:ring-red-200"
                />
              </div>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto py-1 pb-2">
            {allowEmpty && !query.trim() ? (
              <button
                type="button"
                onClick={() => commitValue('', null)}
                className={`block w-full px-3 py-2.5 text-left text-sm transition hover:bg-red-50 ${
                  value ? 'font-semibold text-zinc-500' : 'bg-red-50 font-black text-[#ef1b2d]'
                }`}
              >
                {placeholder}
              </button>
            ) : null}
            {renderCustomAddOption()}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item, index) => {
                const optionValue = getValue(item);
                const optionLabel = (getOptionLabel ?? getLabel)(item);
                return (
                  <button
                    key={`${optionValue}-${index}`}
                    type="button"
                    onClick={() => commitValue(optionValue, item)}
                    className={`block w-full px-3 py-2.5 text-left text-sm transition hover:bg-red-50 ${
                      optionValue === value
                        ? 'bg-red-50 font-black text-[#ef1b2d]'
                        : 'font-semibold text-zinc-800'
                    }`}
                  >
                    {optionLabel}
                  </button>
                );
              })
            ) : allowCustomValue && queryTrimmed ? null : (
              <div className="px-4 py-8 text-center text-sm font-medium text-zinc-400">
                {isLoading ? 'Đang tải...' : 'Không tìm thấy kết quả phù hợp'}
              </div>
            )}
          </div>
        </div>,
        document.body
      );
    }

    if (filteredOptions.length > 0 || (allowCustomValue && queryTrimmed && !hasExactQueryMatch)) {
      return createPortal(
        <div ref={menuRef} className={dropdownPanelClass} style={menuStyle} onMouseDown={event => event.preventDefault()}>
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
          {renderCustomAddOption()}
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
                  optionValue === value
                    ? (selectedOptionClassName ?? 'bg-red-50 font-black text-[#ef1b2d]')
                    : 'font-semibold text-zinc-800'
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
        <div ref={menuRef} className={dropdownPanelClass} style={menuStyle} onMouseDown={event => event.preventDefault()}>
          <div className="px-3 py-2 text-xs font-semibold text-zinc-500">Không tìm thấy kết quả</div>
        </div>,
        document.body
      );
    }

    return null;
  };

  return (
    <div ref={anchorRef} className="relative min-w-0 w-full">
      {comboboxMode ? (
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return;
            setQuery('');
            setOpen(current => !current);
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`${fieldClass} flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className={`min-w-0 truncate ${selectedItem || value ? 'text-zinc-800' : 'text-zinc-400'}`}>
            {isLoading ? 'Đang tải...' : selectedLabel || placeholder}
          </span>
          {isLoading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
          ) : (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          )}
        </button>
      ) : (
        <input
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commitTypedOrMatchedValue();
          }}
          onFocus={() => {
            if (!isDisabled) setOpen(true);
          }}
          onBlur={handleBlur}
          disabled={isDisabled}
          placeholder={emptyText}
          title={title}
          className={fieldClass}
        />
      )}
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

