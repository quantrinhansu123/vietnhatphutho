import React, { useMemo, useState } from 'react';
import { Plus, Search, RotateCcw, Pencil, Trash2, Eye, Calendar, Loader2, Wrench } from 'lucide-react';
import { VnCalendarPicker, formatDateVN } from '../so-che-do-may';
import type { ChiPhiBaoDuongRecord } from './types';
import { fmtMoney } from './types';

interface ChiPhiBaoDuongListProps {
  records: ChiPhiBaoDuongRecord[];
  loading: boolean;
  tuNgay: string;
  denNgay: string;
  onFilterChange: (tuNgay: string, denNgay: string) => void;
  onRefresh: () => void;
  onAddNew: () => void;
  onEdit: (record: ChiPhiBaoDuongRecord) => void;
  onView: (record: ChiPhiBaoDuongRecord) => void;
  onDelete: (id: string) => void;
  onOpenSummary: () => void;
}

export function ChiPhiBaoDuongList({
  records,
  loading,
  tuNgay,
  denNgay,
  onFilterChange,
  onRefresh,
  onAddNew,
  onEdit,
  onView,
  onDelete,
  onOpenSummary
}: ChiPhiBaoDuongListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      r =>
        String(r.ten_may || '').toLowerCase().includes(q) ||
        String(r.ma_may || '').toLowerCase().includes(q) ||
        String(r.sua_chua_ghi_chu || '').toLowerCase().includes(q) ||
        String(r.vat_tu_ghi_chu || '').toLowerCase().includes(q) ||
        String(r.nguoi_lap || '').toLowerCase().includes(q)
    );
  }, [records, searchTerm]);

  const totalSua = useMemo(
    () => filtered.reduce((s, r) => s + (Number(r.chi_phi_sua_chua) || 0), 0),
    [filtered]
  );
  const totalVatTu = useMemo(
    () => filtered.reduce((s, r) => s + (Number(r.chi_phi_vat_tu) || 0), 0),
    [filtered]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Từ ngày</label>
              <VnCalendarPicker value={tuNgay} onChange={v => onFilterChange(v, denNgay)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Đến ngày</label>
              <VnCalendarPicker value={denNgay} onChange={v => onFilterChange(tuNgay, v)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Từ khóa</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Máy, ghi chú, người lập..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 w-52 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs font-medium text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Làm mới
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenSummary}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-4 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-100 active:scale-95"
            >
              <Eye className="h-4 w-4" />
              Tổng hợp tháng
            </button>
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Thêm mới
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <div>
              <div className="text-[11px] font-medium text-slate-500">Số dòng đã nhập</div>
              <div className="text-sm font-bold text-slate-800">{filtered.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-amber-50/70 px-3 py-2">
            <Wrench className="h-4 w-4 text-amber-600" />
            <div>
              <div className="text-[11px] font-medium text-amber-600">Tổng sửa chữa</div>
              <div className="text-sm font-bold text-amber-900">{fmtMoney(totalSua)} đ</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50/70 px-3 py-2">
            <Wrench className="h-4 w-4 text-emerald-600" />
            <div>
              <div className="text-[11px] font-medium text-emerald-600">Tổng vật tư</div>
              <div className="text-sm font-bold text-emerald-900">{fmtMoney(totalVatTu)} đ</div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <p className="mt-2 text-xs font-medium">Đang tải chi phí bảo dưỡng...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <Calendar className="h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">Chưa có dữ liệu</p>
            <p className="text-xs text-slate-400">
              Từ {formatDateVN(tuNgay) || '?'} đến {formatDateVN(denNgay) || '?'} chưa nhập dòng nào.
            </p>
            <button
              type="button"
              onClick={onAddNew}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Nhập dòng đầu tiên
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="w-12 px-3.5 py-3 text-center">STT</th>
                  <th className="px-3.5 py-3">Ngày</th>
                  <th className="px-3.5 py-3">Máy</th>
                  <th className="px-3.5 py-3 text-right">Sửa chữa</th>
                  <th className="px-3.5 py-3 text-right">Vật tư</th>
                  <th className="px-3.5 py-3">Người lập</th>
                  <th className="w-28 px-3.5 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((rec, idx) => (
                  <tr key={rec.id} className="transition hover:bg-slate-50/80">
                    <td className="px-3.5 py-3 text-center font-medium text-slate-400">{idx + 1}</td>
                    <td className="whitespace-nowrap px-3.5 py-3 font-semibold text-slate-800">
                      {formatDateVN(rec.ngay || '') || '—'}
                    </td>
                    <td className="px-3.5 py-3 font-semibold text-slate-900">
                      <button
                        type="button"
                        onClick={() => onView(rec)}
                        className="text-left hover:text-brand-600 hover:underline focus:outline-none"
                      >
                        {rec.ten_may || rec.ma_may}
                      </button>
                      <p className="mt-0.5 text-[11px] font-normal text-slate-400">{rec.ma_may}</p>
                    </td>
                    <td className="px-3.5 py-3 text-right font-bold text-amber-700">
                      {fmtMoney(Number(rec.chi_phi_sua_chua) || 0)} đ
                    </td>
                    <td className="px-3.5 py-3 text-right font-bold text-emerald-700">
                      {fmtMoney(Number(rec.chi_phi_vat_tu) || 0)} đ
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 text-slate-500">
                      <div className="font-medium text-slate-700">{rec.nguoi_lap || '—'}</div>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onView(rec)}
                          title="Xem"
                          className="rounded p-1 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(rec)}
                          title="Sửa"
                          className="rounded p-1 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Xóa chi phí "${rec.ten_may || rec.ma_may}" ngày ${formatDateVN(rec.ngay || '')}?`
                              )
                            ) {
                              onDelete(rec.id);
                            }
                          }}
                          title="Xóa"
                          className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChiPhiBaoDuongList;
