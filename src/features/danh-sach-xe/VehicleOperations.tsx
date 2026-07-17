import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
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
  ghi_chu: string;
};

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
      ghi_chu: text(row.ghi_chu)
    }));
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
  children
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
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
      <div className="flex h-[96dvh] max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:rounded-2xl">
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

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function VehicleExpensesView({
  vehicles,
  staff
}: {
  vehicles: VehicleOption[];
  staff: StaffOption[];
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
  onClose,
  onSaved
}: {
  initial?: VehicleExpense;
  vehicles: VehicleOption[];
  staff: StaffOption[];
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
        <Field label="Số tiền"><input type="number" min={0} step={1000} value={form.so_tien} onChange={event => setForm(prev => ({ ...prev, so_tien: Number(event.target.value) || 0 }))} className={`${inputClass} text-right`} /></Field>
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
  const [form, setForm] = useState<Omit<VehicleLog, 'id'>>(() => ({
    ngay_gio: localDateTimeValue(initial?.ngay_gio),
    ca: initial?.ca || '',
    xe_id: initial?.xe_id || '',
    bien_so_xe: initial?.bien_so_xe || '',
    ma_nhan_su: initial?.ma_nhan_su || '',
    nhan_vien_phu_trach: initial?.nhan_vien_phu_trach || '',
    tong_mat_hang: initial?.tong_mat_hang || 0,
    tong_doanh_thu: initial?.tong_doanh_thu || 0,
    tong_chi_phi: initial?.tong_chi_phi || 0,
    ghi_chu: initial?.ghi_chu || ''
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <OperationModal title={initial ? 'Sửa nhật ký xe' : 'Thêm nhật ký xe'} subtitle="Theo dõi mặt hàng, doanh thu và chi phí theo xe/ca" onClose={onClose} onSave={() => void save()} isSaving={isSaving}>
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
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
        <Field label="Tổng mặt hàng"><input type="number" min={0} step={1} value={form.tong_mat_hang} onChange={event => setForm(prev => ({ ...prev, tong_mat_hang: Number(event.target.value) || 0 }))} className={`${inputClass} text-right`} /></Field>
        <Field label="Tổng doanh thu"><input type="number" min={0} step={1000} value={form.tong_doanh_thu} onChange={event => setForm(prev => ({ ...prev, tong_doanh_thu: Number(event.target.value) || 0 }))} className={`${inputClass} text-right`} /></Field>
        <Field label="Tổng chi phí"><input type="number" min={0} step={1000} value={form.tong_chi_phi} onChange={event => setForm(prev => ({ ...prev, tong_chi_phi: Number(event.target.value) || 0 }))} className={`${inputClass} text-right`} /></Field>
        <Field label="Ghi chú" wide><textarea value={form.ghi_chu} onChange={event => setForm(prev => ({ ...prev, ghi_chu: event.target.value }))} className={`${inputClass} min-h-20 py-2`} /></Field>
      </div>
    </OperationModal>
  );
}

export const vehicleOperationIcons = {
  expenses: ReceiptText,
  logs: BookOpen
};
