import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AssignedPersonnel } from '../features/ke-hoach-san-xuat';
import type { HrMember } from '../features/_shared/hr';
import { orderFieldClass } from '../features/_shared/orderHelpers';
import { formatProductionOrderShiftLabel } from '../features/ke-hoach-san-xuat';

type PersonnelAssignmentBlockProps = {
  items: AssignedPersonnel[];
  staffOptions: Array<HrMember & { id?: string }>;
  isLoadingStaff?: boolean;
  shiftOptions?: string[];
  shiftSettings?: any[];
  onChange: (id: string, patch: Partial<AssignedPersonnel>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function PersonnelAssignmentBlock({
  items,
  staffOptions,
  isLoadingStaff = false,
  shiftOptions = [],
  shiftSettings = [],
  onChange,
  onAdd,
  onRemove
}: PersonnelAssignmentBlockProps) {
  return (
    <div className="col-span-2 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Phân công nhân sự</span>
          <p className="mt-1 text-[11px] font-semibold text-zinc-400">
            Trưởng ca / Nhân sự chính / Thợ phụ / Học việc lấy từ phòng ban PHÂN XƯỞNG SẢN XUẤT.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={isLoadingStaff}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm nhân sự</span>
        </button>
      </div>

      {staffOptions.length === 0 && !isLoadingStaff ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs font-semibold text-zinc-400">
          Chưa có nhân sự thuộc phòng PHÂN XƯỞNG SẢN XUẤT.
        </p>
      ) : (
        <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{item.role}</span>
                {item.removable && (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="text-zinc-400 transition hover:text-red-600"
                    title="Xóa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    value={item.ma_nhan_su}
                    onChange={(e) => onChange(item.id, { ma_nhan_su: e.target.value })}
                    disabled={isLoadingStaff}
                    className={`${orderFieldClass} flex-1 min-w-0`}
                  >
                    <option value="">{isLoadingStaff ? 'Đang tải...' : 'Chọn nhân sự'}</option>
                    {staffOptions.map((staff) => (
                      <option key={staff.id || staff.code} value={staff.id || staff.code}>
                        {staff.name}
                        {staff.role ? ` · ${staff.role}` : ''}
                        {staff.shift ? ` · ${staff.shift}` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={item.ngay_lam_viec}
                    onChange={(e) => onChange(item.id, { ngay_lam_viec: e.target.value })}
                    className="h-11 w-[130px] shrink-0 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                  />
                  {shiftOptions.length > 0 && (
                    <select
                      value={item.ca_lam_viec || ''}
                      onChange={(e) => onChange(item.id, { ca_lam_viec: e.target.value })}
                      className="h-11 w-[130px] shrink-0 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                      title="Chọn ca làm việc"
                    >
                      <option value="">Chọn ca</option>
                      {shiftOptions.map(shift => (
                        <option key={shift} value={shift}>
                          {formatProductionOrderShiftLabel(shift, shiftSettings)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="time"
                    placeholder="HH:mm"
                    title="Bắt đầu (24 giờ)"
                    value={item.thoi_gian_bat_dau}
                    onChange={(e) => onChange(item.id, { thoi_gian_bat_dau: e.target.value })}
                    className="h-11 flex-1 w-[130px] rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10 placeholder-zinc-400"
                  />
                  <input
                    type="time"
                    placeholder="HH:mm"
                    title="Kết thúc (24 giờ)"
                    value={item.thoi_gian_ket_thuc || ''}
                    onChange={(e) => onChange(item.id, { thoi_gian_ket_thuc: e.target.value })}
                    className="h-11 flex-1 w-[130px] rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10 placeholder-zinc-400"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
