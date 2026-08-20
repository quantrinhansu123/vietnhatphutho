import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AssignedPersonnel } from '../features/ke-hoach-san-xuat';
import type { HrMember } from '../features/_shared/hr';
import { orderFieldClass } from '../features/_shared/orderHelpers';

type PersonnelAssignmentBlockProps = {
  items: AssignedPersonnel[];
  staffOptions: Array<HrMember & { id?: string }>;
  isLoadingStaff?: boolean;
  onChange: (id: string, patch: Partial<AssignedPersonnel>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function PersonnelAssignmentBlock({
  items,
  staffOptions,
  isLoadingStaff = false,
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
              <div className="flex gap-2">
                <select
                  value={item.personnelId}
                  onChange={(e) => onChange(item.id, { personnelId: e.target.value })}
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
                  value={item.date}
                  onChange={(e) => onChange(item.id, { date: e.target.value })}
                  className="h-11 w-[130px] shrink-0 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                />
                <input
                  type="time"
                  title="Bắt đầu"
                  value={item.time}
                  onChange={(e) => onChange(item.id, { time: e.target.value })}
                  className="h-11 w-[100px] shrink-0 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                />
                <input
                  type="time"
                  title="Kết thúc"
                  value={item.endTime || ''}
                  onChange={(e) => onChange(item.id, { endTime: e.target.value })}
                  className="h-11 w-[100px] shrink-0 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
