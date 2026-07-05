import React from 'react';
import { ShiftInfo, STANDARD_MACHINES, STANDARD_SHIFTS } from '../types';
import { Cpu, Users, CalendarDays, UserCheck } from 'lucide-react';

interface ShiftInfoFormProps {
  data: ShiftInfo;
  onChange: (updated: Partial<ShiftInfo>) => void;
}

export default function ShiftInfoForm({ data, onChange }: ShiftInfoFormProps) {
  return (
    <div className="form-section" id="shift-info-section">
      <h3 className="form-header">
        <CalendarDays className="w-4 h-4 text-accent-700" />
        Ca & kíp sản xuất
      </h3>

      {/* Máy Sản Xuất */}
      <div className="space-y-1">
        <label className="field-label" htmlFor="machineId">
          <Cpu className="w-3 h-3 text-ink-400" />
          Máy sản xuất <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <select
            id="machineId"
            className="field-input appearance-none cursor-pointer pr-8"
            value={data.machineId}
            onChange={(e) => onChange({ machineId: e.target.value })}
          >
            <option value="">-- Chọn máy đùn / dệt sọi --</option>
            {STANDARD_MACHINES.map((machine) => (
              <option key={machine} value={machine}>
                {machine}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-ink-400">
            <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Ca Làm Việc */}
      <div className="space-y-1">
        <label className="field-label" htmlFor="shiftName">
          <CalendarDays className="w-3 h-3 text-ink-400" />
          Ca trực <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {STANDARD_SHIFTS.map((shift) => {
            const isSelected = data.shiftName === shift;
            return (
              <button
                key={shift}
                type="button"
                id={`shift-opt-${shift.replace(/\s+/g, '-')}`}
                className={`flex text-left items-center px-2.5 py-2 rounded-md border text-[12px] font-medium transition ${
                  isSelected
                    ? 'border-accent-700 bg-accent-50 text-accent-800'
                    : 'border-ink-200 bg-white hover:bg-ink-50 text-ink-700'
                }`}
                onClick={() => onChange({ shiftName: shift })}
              >
                <span className={`w-3 h-3 rounded-full border mr-2 flex items-center justify-center transition ${
                  isSelected ? 'border-accent-700 bg-accent-700 text-white' : 'border-ink-300 bg-white'
                }`}>
                  {isSelected && <span className="w-1 h-1 rounded-full bg-white" />}
                </span>
                {shift}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thợ Chính & Thợ Phụ */}
      <div className="field-grid-2">
        <div className="space-y-1">
          <label className="field-label" htmlFor="operatorName">
            <UserCheck className="w-3 h-3 text-ink-400" />
            Thợ chính <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="operatorName"
            className="field-input"
            placeholder="Nhập họ tên thợ chính"
            value={data.operatorName}
            onChange={(e) => onChange({ operatorName: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="field-label" htmlFor="assistantName">
            <Users className="w-3 h-3 text-ink-400" />
            Thợ phụ <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="assistantName"
            className="field-input"
            placeholder="Nhập họ tên thợ phụ"
            value={data.assistantName}
            onChange={(e) => onChange({ assistantName: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}