import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  RotateCcw,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  Layers,
  Zap,
  Loader2
} from 'lucide-react';
import type { ChiPhiDienRecord } from './types';
import { YearPickerVi } from './YearPickerVi';
import { fmtInt } from './aggregate';

interface ChiPhiDienListProps {
  records: ChiPhiDienRecord[];
  loaiOptions: string[];
  loading: boolean;
  filterNam: number;
  filterLoai: string;
  onFilterChange: (nam: number, loai: string) => void;
  onRefresh: () => void;
  onAddNew: () => void;
  onEdit: (record: ChiPhiDienRecord) => void;
  onView: (record: ChiPhiDienRecord) => void;
  onDelete: (id: string) => void;
}

export function ChiPhiDienList({
  records,
  loaiOptions,
  loading,
  filterNam,
  filterLoai,
  onFilterChange,
  onRefresh,
  onAddNew,
  onEdit,
  onView,
  onDelete
}: ChiPhiDienListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    let list = records;
    if (filterLoai) {
      list = list.filter(r =>
        Array.isArray(r.loai_may_list) ? r.loai_may_list.includes(filterLoai) : false
      );
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        r =>
          (r.ten_bao_cao || '').toLowerCase().includes(q) ||
          (r.ghi_chu || '').toLowerCase().includes(q) ||
          (r.nguoi_lap || '').toLowerCase().includes(q) ||
          (r.loai_may_list || []).some(m => String(m).toLowerCase().includes(q))
      );
    }
    return list;
  }, [records, filterLoai, searchTerm]);

  const totalTienDien = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + (Number(r.tong_tien_dien) || 0), 0),
    [filteredRecords]
  );
  const totalThanhPham = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + (Number(r.tong_thanh_pham) || 0), 0),
    [filteredRecords]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <YearPickerVi
              nam={filterNam}
              onChange={y => onFilterChange(y, filterLoai)}
              label="Tìm theo Năm"
            />
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Tìm theo loại máy
              </label>
              <select
                value={filterLoai}
                onChange={e => onFilterChange(filterNam, e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">-- Tất cả loại --</option>
                {loaiOptions.map(loai => (
                  <option key={loai} value={loai}>
                    {loai}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Từ khóa tìm kiếm
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tên bảng, người lập..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 w-48 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs font-medium text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95"
              title="Tải lại dữ liệu"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Làm mới
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Thêm mới chi phí điện
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
            <Layers className="h-4 w-4 text-slate-500" />
            <div>
              <div className="text-[11px] font-medium text-slate-500">Số bảng đã lưu</div>
              <div className="text-sm font-bold text-slate-800">{filteredRecords.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-amber-50/70 px-3 py-2">
            <Zap className="h-4 w-4 text-amber-600" />
            <div>
              <div className="text-[11px] font-medium text-amber-600">Tổng tiền điện</div>
              <div className="text-sm font-bold text-amber-900">{fmtInt(totalTienDien)} đ</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50/70 px-3 py-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <div>
              <div className="text-[11px] font-medium text-emerald-600">Tổng thành phẩm</div>
              <div className="text-sm font-bold text-emerald-900">{fmtInt(totalThanhPham)} kg</div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <p className="mt-2 text-xs font-medium">Đang tải danh sách chi phí điện...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <Calendar className="h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">Không có bản ghi chi phí điện nào</p>
            <p className="text-xs text-slate-400">
              Năm {filterNam} chưa có bản ghi chi phí điện nào.
            </p>
            <button
              type="button"
              onClick={onAddNew}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Tạo bảng chi phí năm {filterNam}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="w-12 px-3.5 py-3 text-center">STT</th>
                  <th className="px-3.5 py-3">Tên bảng / Báo cáo</th>
                  <th className="px-3.5 py-3 text-center">Năm</th>
                  <th className="px-3.5 py-3">Loại máy</th>
                  <th className="px-3.5 py-3 text-right">Tổng tiền điện</th>
                  <th className="px-3.5 py-3 text-right">Tổng thành phẩm</th>
                  <th className="px-3.5 py-3 text-right">TB/SL (đ/kg)</th>
                  <th className="px-3.5 py-3">Người lập / Ngày tạo</th>
                  <th className="w-28 px-3.5 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec, idx) => {
                  const loaiNames =
                    Array.isArray(rec.loai_may_list) && rec.loai_may_list.length > 0
                      ? rec.loai_may_list.join(', ')
                      : '—';
                  const createdDate = rec.created_at
                    ? new Date(rec.created_at).toLocaleDateString('vi-VN')
                    : '';
                  return (
                    <tr key={rec.id} className="transition hover:bg-slate-50/80">
                      <td className="px-3.5 py-3 text-center font-medium text-slate-400">{idx + 1}</td>
                      <td className="px-3.5 py-3 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() => onView(rec)}
                          className="text-left hover:text-brand-600 hover:underline focus:outline-none"
                        >
                          {rec.ten_bao_cao || `Chi phí điện Năm ${rec.nam}`}
                        </button>
                        {rec.ghi_chu && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] font-normal text-slate-400">
                            {rec.ghi_chu}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3 text-center">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                          Năm {rec.nam}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-3.5 py-3 font-medium text-slate-700" title={loaiNames}>
                        {loaiNames}
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold text-amber-700">
                        {fmtInt(Number(rec.tong_tien_dien) || 0)} đ
                      </td>
                      <td className="px-3.5 py-3 text-right font-semibold text-slate-700">
                        {fmtInt(Number(rec.tong_thanh_pham) || 0)} kg
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold text-red-600">
                        {fmtInt(Number(rec.tb_dong_kg) || 0)}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3 text-slate-500">
                        <div className="font-medium text-slate-700">{rec.nguoi_lap || '—'}</div>
                        <div className="text-[10.5px] text-slate-400">{createdDate}</div>
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onView(rec)}
                            title="Xem chi tiết"
                            className="rounded p-1 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(rec)}
                            title="Chỉnh sửa"
                            className="rounded p-1 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc muốn xóa bản ghi "${rec.ten_bao_cao || `Chi phí điện Năm ${rec.nam}`}" không?`)) {
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChiPhiDienList;
