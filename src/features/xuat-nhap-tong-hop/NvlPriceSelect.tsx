import React, { useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { formatNvlPriceValue, parseNvlPrice } from './model';

export type NvlPriceOption = { id: string; label: string; donGia: number };

function priceKey(value: number) {
  return String(value);
}

function priceDecimalDigits(raw: string) {
  const text = raw.trim().replace(/\s/g, '');
  const dot = text.lastIndexOf('.');
  const comma = text.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) return dot > comma ? text.length - dot - 1 : text.length - comma - 1;
  if (comma >= 0) return 0;
  if (dot >= 0) return (text.match(/\./g) || []).length > 1 ? 0 : text.length - dot - 1;
  return 0;
}

function formatPriceExact(value: number, fractionDigits: number) {
  const digits = Math.max(0, Math.min(20, fractionDigits));
  const fixed = Math.abs(value).toFixed(digits);
  const [integer, fraction = ''] = fixed.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}${grouped}${digits ? `.${fraction}` : ''}`;
}

/** Gõ 12000000 → 12,000,000; phần lẻ sau dấu chấm được giữ nguyên. */
export function formatNvlPriceTyped(raw: string): string {
  const text = String(raw || '').trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!text) return '';
  const parsed = parseNvlPrice(text);
  if (!Number.isFinite(parsed)) return text;
  if (text.endsWith('.')) return `${formatPriceExact(parsed, 0)}.`;
  return formatPriceExact(parsed, priceDecimalDigits(text));
}

export function toNvlPriceOption(donGia: number, soLan?: number): NvlPriceOption | null {
  if (!Number.isFinite(donGia) || donGia < 0) return null;
  const label = formatNvlPriceValue(donGia);
  return {
    id: priceKey(donGia),
    label: soLan && soLan > 1 ? `${label} · ${soLan} lần` : label,
    donGia
  };
}

export async function fetchNvlPriceOptions(maNpl: string): Promise<NvlPriceOption[]> {
  const code = String(maNpl || '').trim();
  if (!code) return [];
  const res = await fetch(`/api/phieu-xuat-kho/gia-nvl?ma_npl=${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  const rows = Array.isArray((data as { prices?: unknown }).prices)
    ? (data as { prices: Array<{ don_gia?: number; so_lan?: number }> }).prices
    : [];
  return rows
    .map(row => toNvlPriceOption(Number(row.don_gia), Number(row.so_lan) || undefined))
    .filter(Boolean) as NvlPriceOption[];
}

/** Dropdown đơn giá NVL: chọn giá đã nhập trước, hoặc gõ tay giá mới. */
export function NvlPriceSelect({
  maHang,
  value,
  onChange,
  disabled,
  inputClassName,
  placeholder,
  extraPrices
}: {
  maHang: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  inputClassName?: string;
  placeholder?: string;
  /** Giá thêm từ lô tồn / ngữ cảnh hiện tại. */
  extraPrices?: number[];
}) {
  const [remote, setRemote] = useState<NvlPriceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const code = String(maHang || '').trim();

  useEffect(() => {
    if (!code) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchNvlPriceOptions(code)
      .then(rows => {
        if (!cancelled) setRemote(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const options = useMemo(() => {
    const map = new Map<string, NvlPriceOption>();
    for (const item of remote) map.set(item.id, item);
    for (const raw of extraPrices || []) {
      const opt = toNvlPriceOption(raw);
      if (opt && !map.has(opt.id)) map.set(opt.id, opt);
    }
    const current = parseNvlPrice(value);
    if (Number.isFinite(current) && current >= 0) {
      const opt = toNvlPriceOption(current);
      if (opt && !map.has(opt.id)) map.set(opt.id, { ...opt, label: formatNvlPriceValue(current) });
    }
    return [...map.values()].sort((a, b) => b.donGia - a.donGia);
  }, [remote, extraPrices, value]);

  const selectedId = (() => {
    const parsed = parseNvlPrice(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !String(value || '').trim()) return '';
    return priceKey(parsed);
  })();

  return (
    <SearchableSelect
      value={selectedId || String(value || '').trim()}
      onChange={next => {
        const hit = options.find(item => item.id === next);
        if (hit) {
          onChange(formatNvlPriceValue(hit.donGia));
          return;
        }
        const custom = String(next || '').trim();
        if (!custom) {
          onChange('');
          return;
        }
        const parsed = parseNvlPrice(custom);
        onChange(Number.isFinite(parsed) ? formatNvlPriceValue(custom) : custom);
      }}
      options={options}
      getValue={(item: NvlPriceOption) => item.id}
      getLabel={(item: NvlPriceOption) => item.label}
      getSearchText={(item: NvlPriceOption) => `${item.label} ${item.donGia}`}
      placeholder={
        !code
          ? 'Chọn mã trước'
          : loading
            ? 'Đang tải giá...'
            : placeholder || (options.length ? 'Chọn hoặc gõ giá' : 'Gõ giá mới')
      }
      disabled={disabled || !code}
      inputClassName={inputClassName}
      comboboxMode
      comboboxSearchable
      allowCustomValue
      allowEmpty
      openUpward
      formatTypedQuery={formatNvlPriceTyped}
      formatCustomAddLabel={formatNvlPriceTyped}
    />
  );
}
