import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  ImageUp,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  X
} from 'lucide-react';
import {
  cloudinaryPreviewUrl,
  fileToOptimizedImageDataUrl,
  uploadImage
} from '../_shared/recordHelpers';

export type VehicleOption = {
  id: string;
  loai_xe: string;
  bien_so_xe: string;
};

export type StaffOption = {
  code: string;
  name: string;
};

type VehicleExpense = {
  id: string;
  ngay_gio: string;
  loai_chi_phi: string;
  ten_chi_phi: string;
  so_tien: number;
  xe_id: string;
  bien_so_xe: string;
  ma_nhan_su: string;
  nhan_vien_phu_trach: string;
  hoa_don_url: string;
  hoa_don_public_id: string;
  ghi_chu: string;
};

type VehicleLogProductLine = {
  id: string;
  loai: string;
  ten_mat_hang: string;
  ma_san_pham: string;
  so_luong: number;
  doanh_thu: number;
};

type VehicleLog = {
  id: string;
  ngay_gio: string;
  ca: string;
  xe_id: string;
  bien_so_xe: string;
  ma_nhan_su: string;
  nhan_vien_phu_trach: string;
  tong_mat_hang: number;
  tong_doanh_thu: number;
  tong_chi_phi: number;
  chi_tiet_mat_hang: VehicleLogProductLine[];
  ten_mat_hang: string;
  ma_san_pham: string;
  sl_cuon_cach_nhiet: number;
  doanh_thu_cach_nhiet: number;
  so_luong_bao_bi: number;
  doanh_thu_bao_bi: number;
  so_luong_tui_tam_gia_cong: number;
  doanh_thu_tui_tam_gia_cong: number;
  so_luong_tui_niem_phong: number;
  doanh_thu_tui_niem_phong: number;
  so_luong_tui_cao_cap_chong_soc: number;
  thanh_tien_tui_cao_cap_chong_soc: number;
  ds_poly: number;
  thuong_chuyen_giao_hang: number;
  cong_lai_xe_theo_km: number;
  thuong_km_di: number;
  chi_so_km_truoc: number;
  chi_so_km_ve: number;
  so_km_thuc_te: number;
  so_lenh: number;
  so_chuyen: number;
  ten_lx1: string;
  cong_lx1: number;
  luong_lx1: number;
  tien_an_lx1: number;
  tien_ds_lx1: number;
  tien_thuong_chuyen_lx1: number;
  tien_luat_lx1: number;
  ghi_chu: string;
};

type LogFormTab = 'doanh_thu' | 'km' | 'luong';

type ProductOption = {
  code: string;
  name: string;
};

const PRODUCT_LINE_TYPES = [
  { id: 'cach_nhiet', label: 'Cách nhiệt (cuộn)' },
  { id: 'bao_bi', label: 'Bao bì (cuộn)' },
  { id: 'tui_tam_gia_cong', label: 'Túi/tấm gia công (cái)' },
  { id: 'tui_niem_phong', label: 'Túi niêm phong (cuộn)' },
  { id: 'tui_cao_cap_chong_soc', label: 'Túi cao cấp chống sốc' },
  { id: 'ds_poly', label: 'DS POLY' }
] as const;

function createProductLine(partial?: Partial<VehicleLogProductLine>): VehicleLogProductLine {
  return {
    id: partial?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    loai: partial?.loai || '',
    ten_mat_hang: partial?.ten_mat_hang || '',
    ma_san_pham: partial?.ma_san_pham || '',
    so_luong: numberValue(partial?.so_luong),
    doanh_thu: numberValue(partial?.doanh_thu)
  };
}

function parseProductLines(value: unknown): VehicleLogProductLine[] {
  if (typeof value === 'string') {
    try {
      return parseProductLines(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map(row => createProductLine({
      id: text(row.id) || undefined,
      loai: text(row.loai),
      ten_mat_hang: text(row.ten_mat_hang),
      ma_san_pham: text(row.ma_san_pham),
      so_luong: numberValue(row.so_luong),
      doanh_thu: numberValue(row.doanh_thu)
    }));
}

function productLinesFromFlat(row: Record<string, unknown>): VehicleLogProductLine[] {
  const existing = parseProductLines(row.chi_tiet_mat_hang);
  if (existing.length > 0) return existing;

  const fallbackName = text(row.ten_mat_hang);
  const fallbackCode = text(row.ma_san_pham);
  const pairs: Array<{ loai: string; so_luong: number; doanh_thu: number }> = [
    { loai: 'cach_nhiet', so_luong: numberValue(row.sl_cuon_cach_nhiet), doanh_thu: numberValue(row.doanh_thu_cach_nhiet) },
    { loai: 'bao_bi', so_luong: numberValue(row.so_luong_bao_bi), doanh_thu: numberValue(row.doanh_thu_bao_bi) },
    { loai: 'tui_tam_gia_cong', so_luong: numberValue(row.so_luong_tui_tam_gia_cong), doanh_thu: numberValue(row.doanh_thu_tui_tam_gia_cong) },
    { loai: 'tui_niem_phong', so_luong: numberValue(row.so_luong_tui_niem_phong), doanh_thu: numberValue(row.doanh_thu_tui_niem_phong) },
    { loai: 'tui_cao_cap_chong_soc', so_luong: numberValue(row.so_luong_tui_cao_cap_chong_soc), doanh_thu: numberValue(row.thanh_tien_tui_cao_cap_chong_soc) },
    { loai: 'ds_poly', so_luong: 0, doanh_thu: numberValue(row.ds_poly) }
  ];
  return pairs
    .filter(item => item.so_luong > 0 || item.doanh_thu > 0)
    .map(item => createProductLine({
      loai: item.loai,
      ten_mat_hang: fallbackName,
      ma_san_pham: fallbackCode,
      so_luong: item.so_luong,
      doanh_thu: item.doanh_thu
    }));
}

function flattenProductLines(lines: VehicleLogProductLine[]) {
  const sumBy = (loai: string, field: 'so_luong' | 'doanh_thu') =>
    lines.filter(line => line.loai === loai).reduce((sum, line) => sum + numberValue(line[field]), 0);

  return {
    ten_mat_hang: lines.find(line => line.ten_mat_hang)?.ten_mat_hang || '',
    ma_san_pham: lines.find(line => line.ma_san_pham)?.ma_san_pham || '',
    sl_cuon_cach_nhiet: sumBy('cach_nhiet', 'so_luong'),
    doanh_thu_cach_nhiet: sumBy('cach_nhiet', 'doanh_thu'),
    so_luong_bao_bi: sumBy('bao_bi', 'so_luong'),
    doanh_thu_bao_bi: sumBy('bao_bi', 'doanh_thu'),
    so_luong_tui_tam_gia_cong: sumBy('tui_tam_gia_cong', 'so_luong'),
    doanh_thu_tui_tam_gia_cong: sumBy('tui_tam_gia_cong', 'doanh_thu'),
    so_luong_tui_niem_phong: sumBy('tui_niem_phong', 'so_luong'),
    doanh_thu_tui_niem_phong: sumBy('tui_niem_phong', 'doanh_thu'),
    so_luong_tui_cao_cap_chong_soc: sumBy('tui_cao_cap_chong_soc', 'so_luong'),
    thanh_tien_tui_cao_cap_chong_soc: sumBy('tui_cao_cap_chong_soc', 'doanh_thu'),
    ds_poly: sumBy('ds_poly', 'doanh_thu'),
    tong_mat_hang: lines.reduce((sum, line) => sum + numberValue(line.so_luong), 0),
    tong_doanh_thu: lines.reduce((sum, line) => sum + numberValue(line.doanh_thu), 0)
  };
}

const EXPENSE_TYPES = ['CHI PHÍ XĂNG DẦU', 'CÁC CHI PHÍ KHÁC CỦA XE'] as const;

function text(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function localDateTimeValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function apiDateTimeValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || '—'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value || 0)} đ`;
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Không thể xử lý yêu cầu.');
  return data;
}

function normalizeExpenses(data: unknown): VehicleExpense[] {
  const rows = data && typeof data === 'object' && Array.isArray((data as { rows?: unknown }).rows)
    ? (data as { rows: unknown[] }).rows
    : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map(row => ({
      id: text(row.id),
      ngay_gio: text(row.ngay_gio),
      loai_chi_phi: text(row.loai_chi_phi),
      ten_chi_phi: text(row.ten_chi_phi),
      so_tien: numberValue(row.so_tien),
      xe_id: text(row.xe_id),
      bien_so_xe: text(row.bien_so_xe),
      ma_nhan_su: text(row.ma_nhan_su),
      nhan_vien_phu_trach: text(row.nhan_vien_phu_trach),
      hoa_don_url: text(row.hoa_don_url),
      hoa_don_public_id: text(row.hoa_don_public_id),
      ghi_chu: text(row.ghi_chu)
    }));
}

function normalizeLogs(data: unknown): VehicleLog[] {
  const rows = data && typeof data === 'object' && Array.isArray((data as { rows?: unknown }).rows)
    ? (data as { rows: unknown[] }).rows
    : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map(row => ({
      id: text(row.id),
      ngay_gio: text(row.ngay_gio),
      ca: text(row.ca),
      xe_id: text(row.xe_id),
      bien_so_xe: text(row.bien_so_xe),
      ma_nhan_su: text(row.ma_nhan_su),
      nhan_vien_phu_trach: text(row.nhan_vien_phu_trach),
      tong_mat_hang: numberValue(row.tong_mat_hang),
      tong_doanh_thu: numberValue(row.tong_doanh_thu),
      tong_chi_phi: numberValue(row.tong_chi_phi),
      chi_tiet_mat_hang: productLinesFromFlat(row),
      ten_mat_hang: text(row.ten_mat_hang),
      ma_san_pham: text(row.ma_san_pham),
      sl_cuon_cach_nhiet: numberValue(row.sl_cuon_cach_nhiet),
      doanh_thu_cach_nhiet: numberValue(row.doanh_thu_cach_nhiet),
      so_luong_bao_bi: numberValue(row.so_luong_bao_bi),
      doanh_thu_bao_bi: numberValue(row.doanh_thu_bao_bi),
      so_luong_tui_tam_gia_cong: numberValue(row.so_luong_tui_tam_gia_cong),
      doanh_thu_tui_tam_gia_cong: numberValue(row.doanh_thu_tui_tam_gia_cong),
      so_luong_tui_niem_phong: numberValue(row.so_luong_tui_niem_phong),
      doanh_thu_tui_niem_phong: numberValue(row.doanh_thu_tui_niem_phong),
      so_luong_tui_cao_cap_chong_soc: numberValue(row.so_luong_tui_cao_cap_chong_soc),
      thanh_tien_tui_cao_cap_chong_soc: numberValue(row.thanh_tien_tui_cao_cap_chong_soc),
      ds_poly: numberValue(row.ds_poly),
      thuong_chuyen_giao_hang: numberValue(row.thuong_chuyen_giao_hang),
      cong_lai_xe_theo_km: numberValue(row.cong_lai_xe_theo_km),
      thuong_km_di: numberValue(row.thuong_km_di),
      chi_so_km_truoc: numberValue(row.chi_so_km_truoc),
      chi_so_km_ve: numberValue(row.chi_so_km_ve),
      so_km_thuc_te: numberValue(row.so_km_thuc_te),
      so_lenh: numberValue(row.so_lenh),
      so_chuyen: numberValue(row.so_chuyen),
      ten_lx1: text(row.ten_lx1),
      cong_lx1: numberValue(row.cong_lx1),
      luong_lx1: numberValue(row.luong_lx1),
      tien_an_lx1: numberValue(row.tien_an_lx1),
      tien_ds_lx1: numberValue(row.tien_ds_lx1),
      tien_thuong_chuyen_lx1: numberValue(row.tien_thuong_chuyen_lx1),
      tien_luat_lx1: numberValue(row.tien_luat_lx1),
      ghi_chu: text(row.ghi_chu)
    }));
}

function emptyVehicleLogForm(): Omit<VehicleLog, 'id'> {
  return {
    ngay_gio: localDateTimeValue(),
    ca: '',
    xe_id: '',
    bien_so_xe: '',
    ma_nhan_su: '',
    nhan_vien_phu_trach: '',
    tong_mat_hang: 0,
    tong_doanh_thu: 0,
    tong_chi_phi: 0,
    chi_tiet_mat_hang: [],
    ten_mat_hang: '',
    ma_san_pham: '',
    sl_cuon_cach_nhiet: 0,
    doanh_thu_cach_nhiet: 0,
    so_luong_bao_bi: 0,
    doanh_thu_bao_bi: 0,
    so_luong_tui_tam_gia_cong: 0,
    doanh_thu_tui_tam_gia_cong: 0,
    so_luong_tui_niem_phong: 0,
    doanh_thu_tui_niem_phong: 0,
    so_luong_tui_cao_cap_chong_soc: 0,
    thanh_tien_tui_cao_cap_chong_soc: 0,
    ds_poly: 0,
    thuong_chuyen_giao_hang: 0,
    cong_lai_xe_theo_km: 0,
    thuong_km_di: 0,
    chi_so_km_truoc: 0,
    chi_so_km_ve: 0,
    so_km_thuc_te: 0,
    so_lenh: 0,
    so_chuyen: 0,
    ten_lx1: '',
    cong_lx1: 0,
    luong_lx1: 0,
    tien_an_lx1: 0,
    tien_ds_lx1: 0,
    tien_thuong_chuyen_lx1: 0,
    tien_luat_lx1: 0,
    ghi_chu: ''
  };
}

function ActionButton({
  label,
  danger = false,
  onClick,
  children
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
        danger
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function ViewHeader({
  title,
  subtitle,
  count,
  buttonLabel,
  onAdd
}: {
  title: string;
  subtitle: string;
  count: number;
  buttonLabel: string;
  onAdd: () => void;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div>
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{subtitle} · {count} dòng</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-extrabold text-white hover:bg-brand-600"
      >
        <Plus className="h-4 w-4" />
        {buttonLabel}
      </button>
    </section>
  );
}

function OperationModal({
  title,
  subtitle,
  onClose,
  onSave,
  isSaving,
  wide = false,
  children
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
      <div className={`flex h-[96dvh] max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:rounded-2xl ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="min-w-0 pr-2">
            <h3 className="truncate text-sm font-black uppercase tracking-wide text-slate-900">{title}</h3>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700">
            Huỷ
          </button>
          <button type="button" onClick={onSave} disabled={isSaving} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-extrabold text-white disabled:opacity-60">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10';

/** Ô nhập tiền: hiển thị dấu chấm phân cách hàng nghìn, lưu về number */
function MoneyInput({
  value,
  onChange,
  className = ''
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value ? new Intl.NumberFormat('vi-VN').format(value) : ''}
      onChange={event => {
        const digits = event.target.value.replace(/\D/g, '');
        onChange(digits ? Number(digits) : 0);
      }}
      placeholder="0"
      className={`${inputClass} text-right ${className}`}
    />
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ProductNameCombobox({
  products,
  code,
  name,
  onChange
}: {
  products: ProductOption[];
  code: string;
  name: string;
  onChange: (next: { code: string; name: string }) => void;
}) {
  const [query, setQuery] = useState(name);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(name);
  }, [name, code]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return products.slice(0, 80);
    return products
      .filter(product =>
        `${product.code} ${product.name}`.toLowerCase().includes(keyword)
      )
      .slice(0, 80);
  }, [products, query]);

  const selectProduct = (product: ProductOption) => {
    onChange({ code: product.code, name: product.name });
    setQuery(product.name);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={event => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            const matched = products.find(
              product =>
                product.name.toLowerCase() === next.trim().toLowerCase() ||
                `${product.code} · ${product.name}`.toLowerCase() === next.trim().toLowerCase()
            );
            if (matched) {
              onChange({ code: matched.code, name: matched.name });
            } else {
              onChange({ code: '', name: next });
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && filtered[0]) {
              event.preventDefault();
              selectProduct(filtered[0]);
            }
          }}
          className={`${inputClass} pr-9`}
          placeholder="Gõ để tìm sản phẩm..."
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(prev => !prev)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
          aria-label="Mở danh sách sản phẩm"
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs font-semibold text-slate-400">Không tìm thấy sản phẩm.</p>
          ) : (
            filtered.map(product => (
              <button
                key={`${product.code}-${product.name}`}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => selectProduct(product)}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-brand-50 ${
                  product.code === code && product.name === name ? 'bg-brand-50' : ''
                }`}
              >
                <span className="text-sm font-bold text-slate-800">{product.name}</span>
                {product.code && <span className="font-mono text-[10px] font-semibold text-slate-400">{product.code}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function VehicleExpensesView({
  vehicles,
  staff,
  currentUser
}: {
  vehicles: VehicleOption[];
  staff: StaffOption[];
  currentUser?: { id: string; name: string } | null;
}) {
  const [rows, setRows] = useState<VehicleExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [editing, setEditing] = useState<VehicleExpense | null | undefined>(undefined);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await readJson(await fetch('/api/chi-phi-xe'));
      setRows(normalizeExpenses(data));
      setWarning(text(data.warning));
    } catch (loadError: any) {
      setRows([]);
      setError(loadError.message || 'Không thể tải chi phí xe.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.so_tien, 0), [rows]);

  const deleteRow = async (row: VehicleExpense) => {
    if (!window.confirm(`Xóa chi phí "${row.ten_chi_phi}"?`)) return;
    try {
      await readJson(await fetch(`/api/chi-phi-xe/${encodeURIComponent(row.id)}`, { method: 'DELETE' }));
      await loadRows();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Không thể xóa chi phí xe.');
    }
  };

  return (
    <>
      <ViewHeader title="Chi phí xe" subtitle={`Tổng chi phí ${formatMoney(total)}`} count={rows.length} buttonLabel="Thêm chi phí" onAdd={() => setEditing(null)} />
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {warning && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{warning}</p>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1120px] text-left text-xs">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-black">ID</th>
                <th className="px-3 py-2.5 font-black">Ngày giờ</th>
                <th className="px-3 py-2.5 font-black">Loại chi phí</th>
                <th className="px-3 py-2.5 font-black">Tên chi phí</th>
                <th className="px-3 py-2.5 font-black">BSX</th>
                <th className="px-3 py-2.5 font-black">NV phụ trách</th>
                <th className="px-3 py-2.5 text-right font-black">Số tiền</th>
                <th className="px-3 py-2.5 text-center font-black">Hóa đơn</th>
                <th className="px-3 py-2.5 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono text-slate-500">{row.id}</td>
                  <td className="px-3 py-2.5 font-semibold">{formatDateTime(row.ngay_gio)}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-700">{row.loai_chi_phi}</td>
                  <td className="px-3 py-2.5 font-semibold">{row.ten_chi_phi}</td>
                  <td className="px-3 py-2.5 font-mono font-black text-brand-700">{row.bien_so_xe}</td>
                  <td className="px-3 py-2.5">{row.nhan_vien_phu_trach || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-black text-rose-700">{formatMoney(row.so_tien)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {row.hoa_don_url ? (
                      <a href={row.hoa_don_url} target="_blank" rel="noreferrer" className="inline-flex h-10 w-14 overflow-hidden rounded-lg border border-slate-200">
                        <img src={cloudinaryPreviewUrl(row.hoa_don_url, 160)} alt="Hóa đơn" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center gap-1">
                      <ActionButton label="Sửa" onClick={() => setEditing(row)}><Pencil className="h-3.5 w-3.5" /></ActionButton>
                      <ActionButton label="Xóa" danger onClick={() => void deleteRow(row)}><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">
          {rows.map(row => (
            <article key={row.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{row.ten_chi_phi}</p>
                  <p className="mt-1 font-mono text-xs font-black text-brand-700">{row.bien_so_xe} · {formatDateTime(row.ngay_gio)}</p>
                </div>
                <div className="flex gap-1">
                  <ActionButton label="Sửa" onClick={() => setEditing(row)}><Pencil className="h-3.5 w-3.5" /></ActionButton>
                  <ActionButton label="Xóa" danger onClick={() => void deleteRow(row)}><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                </div>
              </div>
              <p className="mt-2 text-sm font-black text-rose-700">{formatMoney(row.so_tien)}</p>
              <p className="mt-1 text-xs text-slate-500">{row.loai_chi_phi} · {row.nhan_vien_phu_trach || 'Chưa phân công'}</p>
            </article>
          ))}
        </div>
        {isLoading && <p className="px-4 py-10 text-center text-sm font-bold text-slate-400">Đang tải chi phí xe...</p>}
        {!isLoading && rows.length === 0 && <p className="px-4 py-10 text-center text-sm font-bold text-slate-400">Chưa có chi phí xe.</p>}
      </section>
      {editing !== undefined && (
        <ExpenseModal
          initial={editing || undefined}
          vehicles={vehicles}
          staff={staff}
          currentUser={currentUser}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await loadRows();
          }}
        />
      )}
    </>
  );
}

function ExpenseModal({
  initial,
  vehicles,
  staff,
  currentUser,
  onClose,
  onSaved
}: {
  initial?: VehicleExpense;
  vehicles: VehicleOption[];
  staff: StaffOption[];
  currentUser?: { id: string; name: string } | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<Omit<VehicleExpense, 'id'>>(() => ({
    ngay_gio: localDateTimeValue(initial?.ngay_gio),
    loai_chi_phi: initial?.loai_chi_phi || EXPENSE_TYPES[0],
    ten_chi_phi: initial?.ten_chi_phi || '',
    so_tien: initial?.so_tien || 0,
    xe_id: initial?.xe_id || '',
    bien_so_xe: initial?.bien_so_xe || '',
    ma_nhan_su: initial?.ma_nhan_su || '',
    nhan_vien_phu_trach: initial?.nhan_vien_phu_trach || '',
    hoa_don_url: initial?.hoa_don_url || '',
    hoa_don_public_id: initial?.hoa_don_public_id || '',
    ghi_chu: initial?.ghi_chu || ''
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial || form.ma_nhan_su || form.nhan_vien_phu_trach || !currentUser?.name) return;
    const normalizedName = currentUser.name.trim().toLocaleLowerCase('vi');
    const loggedInStaff = staff.find(item => item.name.trim().toLocaleLowerCase('vi') === normalizedName);
    if (!loggedInStaff) return;
    setForm(prev => ({
      ...prev,
      ma_nhan_su: loggedInStaff.code,
      nhan_vien_phu_trach: loggedInStaff.name
    }));
  }, [currentUser, form.ma_nhan_su, form.nhan_vien_phu_trach, initial, staff]);

  const uploadInvoice = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Hóa đơn/biên lai phải là file ảnh.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Ảnh hóa đơn không được vượt quá 12 MB.');
      return;
    }
    setIsUploading(true);
    setError('');
    try {
      const dataUrl = await fileToOptimizedImageDataUrl(file, { maxEdge: 1600, quality: 0.76 });
      const uploaded = await uploadImage(dataUrl, 'xe/hoa_don');
      setForm(prev => ({
        ...prev,
        hoa_don_url: uploaded.imageUrl,
        hoa_don_public_id: uploaded.imagePublicId
      }));
    } catch (uploadError: any) {
      setError(uploadError.message || 'Không thể tải ảnh hóa đơn.');
    } finally {
      setIsUploading(false);
    }
  };

  const save = async () => {
    if (!form.ngay_gio || !form.ten_chi_phi.trim() || !form.bien_so_xe) {
      setError('Vui lòng nhập ngày giờ, tên chi phí và chọn xe.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const endpoint = initial ? `/api/chi-phi-xe/${encodeURIComponent(initial.id)}` : '/api/chi-phi-xe';
      await readJson(await fetch(endpoint, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ngay_gio: apiDateTimeValue(form.ngay_gio) })
      }));
      await onSaved();
    } catch (saveError: any) {
      setError(saveError.message || 'Không thể lưu chi phí xe.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OperationModal title={initial ? 'Sửa chi phí xe' : 'Thêm chi phí xe'} subtitle="Lưu biển số, người phụ trách và ảnh hóa đơn/biên lai" onClose={onClose} onSave={() => void save()} isSaving={isSaving || isUploading}>
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ngày giờ *"><input type="datetime-local" value={form.ngay_gio} onChange={event => setForm(prev => ({ ...prev, ngay_gio: event.target.value }))} className={inputClass} /></Field>
        <Field label="Loại chi phí *">
          <select value={form.loai_chi_phi} onChange={event => setForm(prev => ({ ...prev, loai_chi_phi: event.target.value }))} className={inputClass}>
            {EXPENSE_TYPES.map(type => <option key={type}>{type}</option>)}
          </select>
        </Field>
        <Field label="Tên chi phí *"><input value={form.ten_chi_phi} onChange={event => setForm(prev => ({ ...prev, ten_chi_phi: event.target.value }))} className={inputClass} placeholder="VD: Đổ dầu chuyến Đà Nẵng" /></Field>
        <Field label="Số tiền"><MoneyInput value={form.so_tien} onChange={so_tien => setForm(prev => ({ ...prev, so_tien }))} /></Field>
        <Field label="Biển số xe (BSX) *">
          <select
            value={form.xe_id}
            onChange={event => {
              const vehicle = vehicles.find(item => item.id === event.target.value);
              setForm(prev => ({ ...prev, xe_id: vehicle?.id || '', bien_so_xe: vehicle?.bien_so_xe || '' }));
            }}
            className={inputClass}
          >
            <option value="">Chọn xe</option>
            {vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.bien_so_xe} · {vehicle.loai_xe}</option>)}
          </select>
        </Field>
        <Field label="Nhân viên phụ trách">
          <select
            value={`${form.ma_nhan_su}|${form.nhan_vien_phu_trach}`}
            onChange={event => {
              const selected = staff.find(item => `${item.code}|${item.name}` === event.target.value);
              setForm(prev => ({ ...prev, ma_nhan_su: selected?.code || '', nhan_vien_phu_trach: selected?.name || '' }));
            }}
            className={inputClass}
          >
            <option value="|">Chưa phân công</option>
            {staff.map(item => <option key={`${item.code}-${item.name}`} value={`${item.code}|${item.name}`}>{item.code ? `${item.code} · ` : ''}{item.name}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-3">
            {form.hoa_don_url ? (
              <a href={form.hoa_don_url} target="_blank" rel="noreferrer" className="relative block h-24 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img src={cloudinaryPreviewUrl(form.hoa_don_url, 400)} alt="Hóa đơn" className="h-full w-full object-cover" />
                <ExternalLink className="absolute right-1 top-1 h-4 w-4 rounded bg-white/90 p-0.5 text-slate-700" />
              </a>
            ) : (
              <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-[10px] font-black uppercase text-slate-400">Chưa có ảnh</div>
            )}
            <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
              {isUploading ? 'Đang tải...' : form.hoa_don_url ? 'Đổi ảnh' : 'Chọn ảnh hóa đơn'}
              <input type="file" accept="image/*" disabled={isUploading} onChange={event => { void uploadInvoice(event.target.files?.[0]); event.currentTarget.value = ''; }} className="hidden" />
            </label>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-400">Ảnh được nén trước khi tải lên để giảm thời gian chờ.</p>
        </div>
        <Field label="Ghi chú" wide><textarea value={form.ghi_chu} onChange={event => setForm(prev => ({ ...prev, ghi_chu: event.target.value }))} className={`${inputClass} min-h-20 py-2`} /></Field>
      </div>
    </OperationModal>
  );
}

export function VehicleLogsView({
  vehicles,
  staff
}: {
  vehicles: VehicleOption[];
  staff: StaffOption[];
}) {
  const [rows, setRows] = useState<VehicleLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [editing, setEditing] = useState<VehicleLog | null | undefined>(undefined);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await readJson(await fetch('/api/nhat-ky-xe'));
      setRows(normalizeLogs(data));
      setWarning(text(data.warning));
    } catch (loadError: any) {
      setRows([]);
      setError(loadError.message || 'Không thể tải nhật ký xe.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const totals = useMemo(
    () => rows.reduce(
      (sum, row) => ({
        items: sum.items + row.tong_mat_hang,
        revenue: sum.revenue + row.tong_doanh_thu,
        expense: sum.expense + row.tong_chi_phi
      }),
      { items: 0, revenue: 0, expense: 0 }
    ),
    [rows]
  );

  const deleteRow = async (row: VehicleLog) => {
    if (!window.confirm(`Xóa nhật ký xe ${row.bien_so_xe}?`)) return;
    try {
      await readJson(await fetch(`/api/nhat-ky-xe/${encodeURIComponent(row.id)}`, { method: 'DELETE' }));
      await loadRows();
    } catch (deleteError: any) {
      setError(deleteError.message || 'Không thể xóa nhật ký xe.');
    }
  };

  return (
    <>
      <ViewHeader title="Nhật ký xe" subtitle={`Doanh thu ${formatMoney(totals.revenue)} · Chi phí ${formatMoney(totals.expense)}`} count={rows.length} buttonLabel="Thêm nhật ký" onAdd={() => setEditing(null)} />
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {warning && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{warning}</p>}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-black">ID</th>
                <th className="px-3 py-2.5 font-black">Ngày giờ</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 font-black">BSX</th>
                <th className="px-3 py-2.5 font-black">NV phụ trách</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng mặt hàng</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng doanh thu</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng chi phí</th>
                <th className="px-3 py-2.5 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono text-slate-500">{row.id}</td>
                  <td className="px-3 py-2.5 font-semibold">{formatDateTime(row.ngay_gio)}</td>
                  <td className="px-3 py-2.5 font-bold">{row.ca || '—'}</td>
                  <td className="px-3 py-2.5 font-mono font-black text-brand-700">{row.bien_so_xe}</td>
                  <td className="px-3 py-2.5">{row.nhan_vien_phu_trach || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold">{new Intl.NumberFormat('vi-VN').format(row.tong_mat_hang)}</td>
                  <td className="px-3 py-2.5 text-right font-black text-emerald-700">{formatMoney(row.tong_doanh_thu)}</td>
                  <td className="px-3 py-2.5 text-right font-black text-rose-700">{formatMoney(row.tong_chi_phi)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center gap-1">
                      <ActionButton label="Sửa" onClick={() => setEditing(row)}><Pencil className="h-3.5 w-3.5" /></ActionButton>
                      <ActionButton label="Xóa" danger onClick={() => void deleteRow(row)}><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-black">
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-right uppercase">Tổng</td>
                  <td className="px-3 py-3 text-right">{new Intl.NumberFormat('vi-VN').format(totals.items)}</td>
                  <td className="px-3 py-3 text-right text-emerald-700">{formatMoney(totals.revenue)}</td>
                  <td className="px-3 py-3 text-right text-rose-700">{formatMoney(totals.expense)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {isLoading && <p className="px-4 py-10 text-center text-sm font-bold text-slate-400">Đang tải nhật ký xe...</p>}
        {!isLoading && rows.length === 0 && <p className="px-4 py-10 text-center text-sm font-bold text-slate-400">Chưa có nhật ký xe.</p>}
      </section>
      {editing !== undefined && (
        <LogModal
          initial={editing || undefined}
          vehicles={vehicles}
          staff={staff}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await loadRows();
          }}
        />
      )}
    </>
  );
}

function LogModal({
  initial,
  vehicles,
  staff,
  onClose,
  onSaved
}: {
  initial?: VehicleLog;
  vehicles: VehicleOption[];
  staff: StaffOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<Omit<VehicleLog, 'id'>>(() => {
    const base = emptyVehicleLogForm();
    if (!initial) return base;
    const { id: _id, ...rest } = initial;
    return {
      ...base,
      ...rest,
      ngay_gio: localDateTimeValue(initial.ngay_gio)
    };
  });
  const [activeTab, setActiveTab] = useState<LogFormTab>('doanh_thu');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<ProductOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await readJson(await fetch('/api/san-pham'));
        const rows = Array.isArray(data)
          ? data
          : Array.isArray((data as { products?: unknown }).products)
            ? (data as { products: unknown[] }).products
            : [];
        if (cancelled) return;
        setProducts(
          rows
            .map((row: unknown) => {
              if (!row || typeof row !== 'object') return null;
              const item = row as Record<string, unknown>;
              const name = text(item.productName ?? item.ten_sp ?? item.name);
              const code = text(item.productCode ?? item.ma_sp ?? item.code);
              if (!name && !code) return null;
              return { name: name || code, code };
            })
            .filter((item: ProductOption | null): item is ProductOption => Boolean(item))
        );
      } catch {
        if (!cancelled) setProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setNumber = (key: keyof Omit<VehicleLog, 'id'>, value: string) => {
    setForm(prev => ({ ...prev, [key]: Number(value) || 0 }));
  };

  const syncProductLines = (lines: VehicleLogProductLine[]) => {
    const flat = flattenProductLines(lines);
    setForm(prev => ({
      ...prev,
      chi_tiet_mat_hang: lines,
      ...flat
    }));
  };

  const addProductLine = () => {
    syncProductLines([...form.chi_tiet_mat_hang, createProductLine()]);
  };

  const updateProductLine = (lineId: string, patch: Partial<VehicleLogProductLine>) => {
    syncProductLines(
      form.chi_tiet_mat_hang.map(line => (line.id === lineId ? { ...line, ...patch } : line))
    );
  };

  const removeProductLine = (lineId: string) => {
    syncProductLines(form.chi_tiet_mat_hang.filter(line => line.id !== lineId));
  };

  const setKmField = (key: 'chi_so_km_truoc' | 'chi_so_km_ve', value: string) => {
    const next = Number(value) || 0;
    setForm(prev => {
      const chi_so_km_truoc = key === 'chi_so_km_truoc' ? next : prev.chi_so_km_truoc;
      const chi_so_km_ve = key === 'chi_so_km_ve' ? next : prev.chi_so_km_ve;
      return {
        ...prev,
        chi_so_km_truoc,
        chi_so_km_ve,
        so_km_thuc_te: Math.max(0, chi_so_km_ve - chi_so_km_truoc)
      };
    });
  };

  const save = async () => {
    if (!form.ngay_gio || !form.bien_so_xe) {
      setError('Vui lòng nhập ngày giờ và chọn xe.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const endpoint = initial ? `/api/nhat-ky-xe/${encodeURIComponent(initial.id)}` : '/api/nhat-ky-xe';
      await readJson(await fetch(endpoint, {
        method: initial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ngay_gio: apiDateTimeValue(form.ngay_gio) })
      }));
      await onSaved();
    } catch (saveError: any) {
      setError(saveError.message || 'Không thể lưu nhật ký xe.');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { id: LogFormTab; label: string }[] = [
    { id: 'doanh_thu', label: 'Doanh thu mặt hàng' },
    { id: 'km', label: 'Số KM thực đi' },
    { id: 'luong', label: 'Lương lái xe' }
  ];

  return (
    <OperationModal
      wide
      title={initial ? 'Sửa nhật ký xe' : 'Thêm nhật ký xe'}
      subtitle="Doanh thu mặt hàng · KM thực đi · Tổng hợp lương lái xe"
      onClose={onClose}
      onSave={() => void save()}
      isSaving={isSaving}
    >
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Ngày giờ *"><input type="datetime-local" value={form.ngay_gio} onChange={event => setForm(prev => ({ ...prev, ngay_gio: event.target.value }))} className={inputClass} /></Field>
        <Field label="Ca"><input value={form.ca} onChange={event => setForm(prev => ({ ...prev, ca: event.target.value }))} className={inputClass} placeholder="VD: Ca ngày / 12C1" /></Field>
        <Field label="Biển số xe (BSX) *">
          <select
            value={form.xe_id}
            onChange={event => {
              const vehicle = vehicles.find(item => item.id === event.target.value);
              setForm(prev => ({ ...prev, xe_id: vehicle?.id || '', bien_so_xe: vehicle?.bien_so_xe || '' }));
            }}
            className={inputClass}
          >
            <option value="">Chọn xe</option>
            {vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.bien_so_xe} · {vehicle.loai_xe}</option>)}
          </select>
        </Field>
        <Field label="Nhân viên phụ trách">
          <select
            value={`${form.ma_nhan_su}|${form.nhan_vien_phu_trach}`}
            onChange={event => {
              const selected = staff.find(item => `${item.code}|${item.name}` === event.target.value);
              setForm(prev => ({ ...prev, ma_nhan_su: selected?.code || '', nhan_vien_phu_trach: selected?.name || '' }));
            }}
            className={inputClass}
          >
            <option value="|">Chưa phân công</option>
            {staff.map(item => <option key={`${item.code}-${item.name}`} value={`${item.code}|${item.name}`}>{item.code ? `${item.code} · ` : ''}{item.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wide transition ${
              activeTab === tab.id
                ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'doanh_thu' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Doanh thu từng loại mặt hàng</h4>
            <button
              type="button"
              onClick={addProductLine}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-extrabold text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm dòng
            </button>
          </div>

          {form.chi_tiet_mat_hang.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-xs font-semibold text-slate-500">
              Chưa có dòng mặt hàng. Bấm <span className="font-black text-brand-700">Thêm dòng</span> để nhập từng loại.
            </div>
          ) : (
            <div className="space-y-3">
              {form.chi_tiet_mat_hang.map((line, index) => (
                <div key={line.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dòng {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeProductLine(line.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      title="Xóa dòng"
                      aria-label="Xóa dòng"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Loại mặt hàng">
                      <select
                        value={line.loai}
                        onChange={event => updateProductLine(line.id, { loai: event.target.value })}
                        className={inputClass}
                      >
                        <option value="">Chọn loại</option>
                        {PRODUCT_LINE_TYPES.map(type => (
                          <option key={type.id} value={type.id}>{type.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tên mặt hàng">
                      <ProductNameCombobox
                        products={products}
                        code={line.ma_san_pham}
                        name={line.ten_mat_hang}
                        onChange={({ code, name }) => updateProductLine(line.id, { ma_san_pham: code, ten_mat_hang: name })}
                      />
                    </Field>
                    <Field label="Số lượng">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={line.so_luong}
                        onChange={event => updateProductLine(line.id, { so_luong: Number(event.target.value) || 0 })}
                        className={`${inputClass} text-right`}
                      />
                    </Field>
                    <Field label="Doanh thu (VNĐ)">
                      <MoneyInput
                        value={line.doanh_thu}
                        onChange={doanh_thu => updateProductLine(line.id, { doanh_thu })}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tổng mặt hàng"><input type="number" min={0} step={1} value={form.tong_mat_hang} onChange={event => setNumber('tong_mat_hang', event.target.value)} className={`${inputClass} text-right`} /></Field>
            <Field label="Tổng doanh thu"><MoneyInput value={form.tong_doanh_thu} onChange={tong_doanh_thu => setForm(prev => ({ ...prev, tong_doanh_thu }))} /></Field>
            <Field label="Tổng chi phí"><MoneyInput value={form.tong_chi_phi} onChange={tong_chi_phi => setForm(prev => ({ ...prev, tong_chi_phi }))} /></Field>
            <Field label="Ghi chú" wide><textarea value={form.ghi_chu} onChange={event => setForm(prev => ({ ...prev, ghi_chu: event.target.value }))} className={`${inputClass} min-h-20 py-2`} /></Field>
          </div>
        </section>
      )}

      {activeTab === 'km' && (
        <section className="space-y-3">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Dữ liệu liên quan số KM thực đi của xe</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Thưởng chuyến (Giao hàng)"><MoneyInput value={form.thuong_chuyen_giao_hang} onChange={thuong_chuyen_giao_hang => setForm(prev => ({ ...prev, thuong_chuyen_giao_hang }))} /></Field>
            <Field label="Công lái xe theo số KM"><input type="number" min={0} step={0.01} value={form.cong_lai_xe_theo_km} onChange={event => setNumber('cong_lai_xe_theo_km', event.target.value)} className={`${inputClass} text-right`} /></Field>
            <Field label="Thưởng KM đi"><MoneyInput value={form.thuong_km_di} onChange={thuong_km_di => setForm(prev => ({ ...prev, thuong_km_di }))} /></Field>
            <Field label="Chỉ số KM trước khi đi"><input type="number" min={0} step={0.1} value={form.chi_so_km_truoc} onChange={event => setKmField('chi_so_km_truoc', event.target.value)} className={`${inputClass} text-right`} /></Field>
            <Field label="Chỉ số công tơ KM khi về"><input type="number" min={0} step={0.1} value={form.chi_so_km_ve} onChange={event => setKmField('chi_so_km_ve', event.target.value)} className={`${inputClass} text-right`} /></Field>
            <Field label="Số KM đi thực tế của chuyến"><input type="number" min={0} step={0.1} value={form.so_km_thuc_te} onChange={event => setNumber('so_km_thuc_te', event.target.value)} className={`${inputClass} text-right`} /></Field>
            <Field label="Số lệnh"><input type="number" min={0} step={1} value={form.so_lenh} onChange={event => setNumber('so_lenh', event.target.value)} className={`${inputClass} text-right`} /></Field>
            <Field label="Số chuyến"><input type="number" min={0} step={1} value={form.so_chuyen} onChange={event => setNumber('so_chuyen', event.target.value)} className={`${inputClass} text-right`} /></Field>
          </div>
          <p className="text-[11px] font-semibold text-slate-400">Số KM thực tế tự tính = KM về − KM trước (vẫn có thể sửa tay).</p>
        </section>
      )}

      {activeTab === 'luong' && (
        <section className="space-y-3">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Vùng dữ liệu tổng hợp lương lái xe</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tên LX1">
              <input
                list={`lx1-staff-${initial?.id || 'new'}`}
                value={form.ten_lx1}
                onChange={event => setForm(prev => ({ ...prev, ten_lx1: event.target.value }))}
                className={inputClass}
                placeholder="Chọn hoặc nhập tên lái xe"
              />
              <datalist id={`lx1-staff-${initial?.id || 'new'}`}>
                {staff.map(item => (
                  <option key={`lx1-${item.code}-${item.name}`} value={item.name}>
                    {item.code ? `${item.code} · ` : ''}{item.name}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="Công LX1"><input type="number" min={0} step={0.01} value={form.cong_lx1} onChange={event => setNumber('cong_lx1', event.target.value)} className={`${inputClass} text-right`} /></Field>
            <Field label="Lương LX1"><MoneyInput value={form.luong_lx1} onChange={luong_lx1 => setForm(prev => ({ ...prev, luong_lx1 }))} /></Field>
            <Field label="Tiền ăn LX1"><MoneyInput value={form.tien_an_lx1} onChange={tien_an_lx1 => setForm(prev => ({ ...prev, tien_an_lx1 }))} /></Field>
            <Field label="Tiền DS LX1"><MoneyInput value={form.tien_ds_lx1} onChange={tien_ds_lx1 => setForm(prev => ({ ...prev, tien_ds_lx1 }))} /></Field>
            <Field label="Tiền thưởng chuyến LX1"><MoneyInput value={form.tien_thuong_chuyen_lx1} onChange={tien_thuong_chuyen_lx1 => setForm(prev => ({ ...prev, tien_thuong_chuyen_lx1 }))} /></Field>
            <Field label="Tiền luật LX1"><MoneyInput value={form.tien_luat_lx1} onChange={tien_luat_lx1 => setForm(prev => ({ ...prev, tien_luat_lx1 }))} /></Field>
          </div>
        </section>
      )}
    </OperationModal>
  );
}

export const vehicleOperationIcons = {
  expenses: ReceiptText,
  logs: BookOpen
};
