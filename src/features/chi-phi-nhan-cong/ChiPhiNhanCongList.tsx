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
  Users,
  Clock,
  Coins,
  Loader2
} from 'lucide-react';
import type { ChiPhiNhanCongRecord, MachineInfo } from './types';
import { MonthYearPickerVi } from './MonthYearPickerVi';

interface ChiPhiNhanCongListProps {
  records: ChiPhiNhanCongRecord[];
  machines: MachineInfo[];
  loading: boolean;
  filterThang: number;
  filterNam: number;
  filterMaMay: string;
  onFilterChange: (thang: number, nam: number, maMay: string) => void;
  onRefresh: () => void;
  onAddNew: () => void;
  onEdit: (record: ChiPhiNhanCongRecord) => void;
  onView: (record: ChiPhiNhanCongRecord) => void;
  onDelete: (id: string) => void;
}

export function ChiPhiNhanCongList({
  records,
  machines,
  loading,
  filterThang,
  filterNam,
  filterMaMay,
  onFilterChange,
  onRefresh,
  onAddNew,
  onEdit,
  onView,
  onDelete
}: ChiPhiNhanCongListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    let list = records;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        r =>
          (r.ten_bao_cao || '').toLowerCase().includes(q) ||
          (r.ghi_chu || '').toLowerCase().includes(q) ||
          (r.nguoi_lap || '').toLowerCase().includes(q) ||
          (r.ten_may_list || []).some(m => String(m).toLowerCase().includes(q))
      );
    }
    return list;
  }, [records, searchTerm]);

  const totalPersonnelSum = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + (r.tong_so_nguoi || 0), 0),
    [filteredRecords]
  );
  const totalHoursSum = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + (Number(r.tong_so_gio) || 0), 0),
    [filteredRecords]
  );
  const totalCostSum = useMemo(
    () => filteredRecords.reduce((sum, r) => sum + (Number(r.tong_chi_phi) || 0), 0),
    [filteredRecords]
  );

  return (
    <div className="space-y-4">
      {/* Thanh công cụ tìm kiếm và lọc */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Bộ chọn tháng và năm */}
            <MonthYearPickerVi
              thang={filterThang}
              nam={filterNam}
              onChange={(t, y) => onFilterChange(t, y, filterMaMay)}
              label="Tìm theo Tháng / Năm"
            />

            {/* Bộ lọc Máy */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Tìm theo Máy
              </label>
              <select
                value={filterMaMay}
                onChange={e => onFilterChange(filterThang, filterNam, e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-sm transition hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">-- Tất cả máy --</option>
                {machines.map(m => (
                  <option key={m.code} value={m.code}>
                    {m.name || m.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Tìm kiếm từ khóa */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Từ khóa tìm kiếm
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tên báo cáo, người lập..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 w-48 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs font-medium text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            {/* Nút làm mới */}
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

          {/* Nút Thêm mới */}
          <div>
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-brand-700 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Thêm mới chi phí nhân công
            </button>
          </div>
        </div>

        {/* Thẻ tóm tắt nhanh */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4">
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
            <Layers className="h-4 w-4 text-slate-500" />
            <div>
              <div className="text-[11px] font-medium text-slate-500">Số bảng đã lưu</div>
              <div className="text-sm font-bold text-slate-800">{filteredRecords.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-blue-50/70 px-3 py-2">
            <Users className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-[11px] font-medium text-blue-600">Tổng lượt nhân công</div>
              <div className="text-sm font-bold text-blue-900">{totalPersonnelSum.toLocaleString('vi-VN')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-amber-50/70 px-3 py-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <div>
              <div className="text-[11px] font-medium text-amber-600">Tổng số giờ công</div>
              <div className="text-sm font-bold text-amber-900">{totalHoursSum.toLocaleString('vi-VN')} giờ</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50/70 px-3 py-2">
            <Coins className="h-4 w-4 text-emerald-600" />
            <div>
              <div className="text-[11px] font-medium text-emerald-600">Tổng chi phí</div>
              <div className="text-sm font-bold text-emerald-900">{totalCostSum.toLocaleString('vi-VN')} đ</div>
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách bảng kết quả */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <p className="mt-2 text-xs font-medium">Đang tải danh sách chi phí nhân công...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <Calendar className="h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">Không có bản ghi chi phí nhân công nào</p>
            <p className="text-xs text-slate-400">
              {filterMaMay
                ? `Tháng ${filterThang}/${filterNam} chưa có dữ liệu cho máy đã chọn.`
                : `Tháng ${filterThang}/${filterNam} chưa có bản ghi chi phí nào.`}
            </p>
            <button
              type="button"
              onClick={onAddNew}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Tạo bảng chi phí tháng {filterThang}/{filterNam}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="px-3.5 py-3 text-center w-12">STT</th>
                  <th className="px-3.5 py-3">Tên bảng / Báo cáo</th>
                  <th className="px-3.5 py-3 text-center">Tháng / Năm</th>
                  <th className="px-3.5 py-3">Máy áp dụng</th>
                  <th className="px-3.5 py-3 text-center">Số NV</th>
                  <th className="px-3.5 py-3 text-right">Tổng giờ</th>
                  <th className="px-3.5 py-3 text-right">Số công (8h)</th>
                  <th className="px-3.5 py-3 text-right">Tổng chi phí</th>
                  <th className="px-3.5 py-3">Người lập / Ngày tạo</th>
                  <th className="px-3.5 py-3 text-center w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((rec, idx) => {
                  const machineNames = Array.isArray(rec.ten_may_list) && rec.ten_may_list.length > 0
                    ? rec.ten_may_list.join(', ')
                    : (rec.ma_may_list || []).join(', ') || 'Tất cả máy';

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
                          {rec.ten_bao_cao || `Chi phí nhân công T${rec.thang}/${rec.nam}`}
                        </button>
                        {rec.ghi_chu && (
                          <p className="mt-0.5 text-[11px] font-normal text-slate-400 line-clamp-1">
                            {rec.ghi_chu}
                          </p>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                          Tháng {rec.thang}/{rec.nam}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 font-medium text-slate-700 max-w-xs truncate" title={machineNames}>
                        {machineNames}
                      </td>
                      <td className="px-3.5 py-3 text-center font-semibold text-slate-800">
                        {rec.tong_so_nguoi}
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold text-blue-700">
                        {Number(rec.tong_so_gio || 0).toLocaleString('vi-VN')} h
                      </td>
                      <td className="px-3.5 py-3 text-right font-semibold text-slate-700">
                        {Number(rec.tong_so_cong || 0).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold text-emerald-700">
                        {Number(rec.tong_chi_phi || 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="px-3.5 py-3 text-slate-500 whitespace-nowrap">
                        <div className="font-medium text-slate-700">{rec.nguoi_lap || '—'}</div>
                        <div className="text-[10.5px] text-slate-400">{createdDate}</div>
                      </td>
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onView(rec)}
                            title="Xem chi tiết"
                            className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(rec)}
                            title="Chỉnh sửa"
                            className="rounded p-1 text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc muốn xóa bản ghi "${rec.ten_bao_cao || `Chi phí nhân công T${rec.thang}/${rec.nam}`}" không?`)) {
                                onDelete(rec.id);
                              }
                            }}
                            title="Xóa"
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
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
