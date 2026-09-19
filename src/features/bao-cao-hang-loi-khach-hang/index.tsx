import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { useTabAccess } from '../../app/useTabAccess';
import { VnCalendarPicker, parseDateStr, formatDateVN } from '../so-che-do-may';
import {
  TableToolbar,
  TableShell,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableEmptyRow
} from '../../components/shared/table';
import { showAppToast } from '../../lib/appToast';
import {
  HANG_LOI_KHU_VUC_OPTIONS,
  HANG_LOI_NHOM_OPTIONS,
  HANG_LOI_PHAN_LOAI_OPTIONS,
  emptyHangLoiForm,
  normalizeHangLoiRecords,
  shortNhomVthh,
  todayLocalISO,
  type HangLoiKhachHangForm,
  type HangLoiKhachHangRecord
} from './model';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-400';
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500';

function firstDayOfMonth(today: string): string {
  const parsed = parseDateStr(today);
  if (!parsed) return today;
  const month = String(parsed.thang).padStart(2, '0');
  return `${parsed.nam}-${month}-01`;
}

function toForm(record: HangLoiKhachHangRecord): HangLoiKhachHangForm {
  return {
    ngay: record.ngay,
    nhom_vthh: record.nhom_vthh,
    noi_dung: record.noi_dung,
    khu_vuc: record.khu_vuc || 'Bắc',
    phan_loai_hang: record.phan_loai_hang || '',
    xu_ly_cong_ty: record.xu_ly_cong_ty || '',
    xu_ly_khac: record.xu_ly_khac || '',
    ghi_chu: record.ghi_chu || ''
  };
}

export function HangLoiKhachHangPanel({ onBack }: { onBack?: () => void }) {
  const { canCreate, canEdit, canDelete } = useTabAccess('hang-loi-khach-hang');
  const today = useMemo(() => todayLocalISO(), []);

  const [tuNgay, setTuNgay] = useState(() => firstDayOfMonth(todayLocalISO()));
  const [denNgay, setDenNgay] = useState(() => todayLocalISO());
  const [records, setRecords] = useState<HangLoiKhachHangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HangLoiKhachHangForm>(() => emptyHangLoiForm(today));
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    if (!parseDateStr(tuNgay) || !parseDateStr(denNgay)) {
      setLoadError('Vui lòng chọn Từ ngày và Đến ngày hợp lệ.');
      return;
    }
    if (tuNgay > denNgay) {
      setLoadError('Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.');
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        limit: '1000'
      });
      const res = await fetch(`/api/bao-cao-hang-loi-khach-hang?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách phiếu lỗi hỏng.');
      setRecords(normalizeHangLoiRecords(data));
    } catch (error: any) {
      setRecords([]);
      setLoadError(error.message || 'Không thể tải danh sách phiếu lỗi hỏng.');
    } finally {
      setIsLoading(false);
    }
  }, [tuNgay, denNgay]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const openAddForm = () => {
    if (!canCreate) return;
    setEditingId(null);
    setForm(emptyHangLoiForm(today));
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (record: HangLoiKhachHangRecord) => {
    if (!canEdit) return;
    setEditingId(record.id);
    setForm(toForm(record));
    setFormError('');
    setFormOpen(true);
  };

  const validateForm = (): string => {
    if (!parseDateStr(form.ngay)) return 'Ngày không hợp lệ.';
    if (!HANG_LOI_NHOM_OPTIONS.includes(form.nhom_vthh as (typeof HANG_LOI_NHOM_OPTIONS)[number])) {
      return 'Vui lòng chọn Loại sản phẩm (Nhóm VTHH).';
    }
    if (!form.noi_dung.trim()) return 'Vui lòng nhập nội dung lỗi hỏng.';
    if (!HANG_LOI_KHU_VUC_OPTIONS.includes(form.khu_vuc as (typeof HANG_LOI_KHU_VUC_OPTIONS)[number])) {
      return 'Vui lòng chọn khu vực Bắc / Trung / Nam.';
    }
    if (form.phan_loai_hang && !HANG_LOI_PHAN_LOAI_OPTIONS.includes(form.phan_loai_hang as (typeof HANG_LOI_PHAN_LOAI_OPTIONS)[number])) {
      return 'Phân loại hàng không hợp lệ.';
    }
    if (form.xu_ly_cong_ty.trim().length > 500) return 'Xử lý Công ty tối đa 500 ký tự.';
    if (form.xu_ly_khac.trim().length > 500) return 'Xử lý Khác tối đa 500 ký tự.';
    return '';
  };

  const saveForm = async () => {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setIsSaving(true);
    setFormError('');
    try {
      const payload = {
        ngay: form.ngay,
        nhom_vthh: form.nhom_vthh,
        noi_dung: form.noi_dung.trim(),
        khu_vuc: form.khu_vuc,
        phan_loai_hang: form.phan_loai_hang,
        xu_ly_cong_ty: form.xu_ly_cong_ty.trim(),
        xu_ly_khac: form.xu_ly_khac.trim(),
        ghi_chu: form.ghi_chu.trim()
      };
      const res = editingId
        ? await fetch(`/api/bao-cao-hang-loi-khach-hang/${encodeURIComponent(editingId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch('/api/bao-cao-hang-loi-khach-hang', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể lưu phiếu lỗi hỏng.');
      showAppToast(editingId ? 'Đã cập nhật phiếu lỗi hỏng.' : 'Đã thêm phiếu lỗi hỏng.', 'success');
      setFormOpen(false);
      setEditingId(null);
      await loadRecords();
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu phiếu lỗi hỏng.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecord = async (record: HangLoiKhachHangRecord) => {
    if (!canDelete) return;
    if (!window.confirm(`Xóa phiếu ${formatDateVN(record.ngay)} — ${shortNhomVthh(record.nhom_vthh)} — ${record.noi_dung}?`)) {
      return;
    }
    setDeletingId(record.id);
    try {
      const res = await fetch(`/api/bao-cao-hang-loi-khach-hang/${encodeURIComponent(record.id)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa phiếu lỗi hỏng.');
      showAppToast('Đã xóa phiếu lỗi hỏng.', 'success');
      await loadRecords();
    } catch (error: any) {
      showAppToast(error.message || 'Không thể xóa phiếu lỗi hỏng.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const setField = <K extends keyof HangLoiKhachHangForm>(key: K, value: HangLoiKhachHangForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {onBack && <BackButton onClick={onBack} />}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
            Báo cáo hàng lỗi hỏng (Phát sinh ở khách hàng)
          </h2>
          <p className="text-xs font-semibold text-slate-500">
            Kinh doanh nhập từng phiếu theo Nhóm VTHH — QC tổng hợp ở màn hình Thống kê.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            Thêm phiếu
          </button>
        )}
      </div>

      <TableToolbar>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <span className={labelClass}>Từ ngày</span>
            <VnCalendarPicker value={tuNgay} onChange={setTuNgay} />
          </div>
          <div className="w-44">
            <span className={labelClass}>Đến ngày</span>
            <VnCalendarPicker value={denNgay} onChange={setDenNgay} alignRight />
          </div>
          <button
            type="button"
            onClick={() => void loadRecords()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Xem
          </button>
        </div>
      </TableToolbar>

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {loadError}
        </p>
      )}

      <TableShell>
        <TableHead>
          <TableHeadCell className="w-28">Ngày</TableHeadCell>
          <TableHeadCell className="w-36">Loại sản phẩm</TableHeadCell>
          <TableHeadCell>Nội dung</TableHeadCell>
          <TableHeadCell className="w-24">Khu vực</TableHeadCell>
          <TableHeadCell className="w-36">Phân loại hàng</TableHeadCell>
          <TableHeadCell className="w-24 text-right">XL Công ty</TableHeadCell>
          <TableHeadCell className="w-24 text-right">XL Khác</TableHeadCell>
          <TableHeadCell className="w-28 text-right">Thao tác</TableHeadCell>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <td colSpan={8} className="px-3 py-8 text-center text-xs font-semibold text-slate-500">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                Đang tải...
              </td>
            </TableRow>
          ) : records.length === 0 ? (
            <TableEmptyRow colSpan={8}>Chưa có phiếu nào trong khoảng ngày đã chọn.</TableEmptyRow>
          ) : (
            records.map(record => (
              <TableRow key={record.id}>
                <td className="px-3 py-2 text-xs font-bold text-slate-800">{formatDateVN(record.ngay)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-700">
                  {record.nhom_vthh}
                  <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">
                    {shortNhomVthh(record.nhom_vthh)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800">{record.noi_dung}</td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-700">{record.khu_vuc}</td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-700">{record.phan_loai_hang || '—'}</td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-700">
                  {record.xu_ly_cong_ty || '—'}
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-700">
                  {record.xu_ly_khac || '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        title="Sửa"
                        onClick={() => openEditForm(record)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        title="Xóa"
                        disabled={deletingId === record.id}
                        onClick={() => void deleteRecord(record)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </TableRow>
            ))
          )}
        </TableBody>
      </TableShell>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="flex-1 font-display text-base font-bold text-slate-900">
                {editingId ? 'Sửa phiếu lỗi hỏng' : 'Thêm phiếu lỗi hỏng'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className={labelClass}>Ngày *</span>
                <VnCalendarPicker value={form.ngay} onChange={v => setField('ngay', v)} />
              </div>
              <div>
                <span className={labelClass}>Loại sản phẩm (Nhóm VTHH) *</span>
                <select value={form.nhom_vthh} onChange={e => setField('nhom_vthh', e.target.value)} className={inputClass}>
                  <option value="">Chọn nhóm VTHH</option>
                  {HANG_LOI_NHOM_OPTIONS.map(nhom => (
                    <option key={nhom} value={nhom}>
                      {nhom}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <span className={labelClass}>Nội dung *</span>
                <input
                  value={form.noi_dung}
                  onChange={e => setField('noi_dung', e.target.value)}
                  placeholder="Ví dụ: Nứt vỡ"
                  className={inputClass}
                />
              </div>
              <div>
                <span className={labelClass}>Khu vực phát sinh *</span>
                <div className="flex gap-1.5">
                  {HANG_LOI_KHU_VUC_OPTIONS.map(khu => (
                    <button
                      key={khu}
                      type="button"
                      onClick={() => setField('khu_vuc', khu)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-[13px] font-bold transition ${
                        form.khu_vuc === khu
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {khu}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Bắc → MB, Trung / Nam → HCM&amp;MT trên báo cáo QC.
                </p>
              </div>
              <div>
                <span className={labelClass}>Phân loại hàng (Hàng phế)</span>
                <select
                  value={form.phan_loai_hang}
                  onChange={e => setField('phan_loai_hang', e.target.value)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {HANG_LOI_PHAN_LOAI_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelClass}>Xử lý — Công ty</span>
                <input
                  value={form.xu_ly_cong_ty}
                  onChange={e => setField('xu_ly_cong_ty', e.target.value)}
                  placeholder="Nhập nội dung xử lý"
                  className={inputClass}
                />
              </div>
              <div>
                <span className={labelClass}>Xử lý — Khác</span>
                <input
                  value={form.xu_ly_khac}
                  onChange={e => setField('xu_ly_khac', e.target.value)}
                  placeholder="Nhập nội dung xử lý"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <span className={labelClass}>Ghi chú</span>
                <textarea
                  value={form.ghi_chu}
                  onChange={e => setField('ghi_chu', e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </div>
            </div>

            {formError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {formError}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void saveForm()}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu phiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
