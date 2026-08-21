import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { AssignedPersonnel } from '../ke-hoach-san-xuat/index';

type SelectedPersonnelKey = `${string}-${string}`;

type SelectedPersonnelWithForm = {
  key: SelectedPersonnelKey;
  machineValue: string;
  person: AssignedPersonnel;
  mayDieuDong: string;
  thoiGianBatDau: string;
  thoiGianKetThuc: string;
};

interface DispatchFormInlineProps {
  selectedList: SelectedPersonnelWithForm[];
  otherMachinesPerMachine: Record<string, string[]>; // machineValue -> [otherMachines]
  onUpdatePerson: (key: SelectedPersonnelKey, update: Partial<SelectedPersonnelWithForm>) => void;
  onRemovePerson: (key: SelectedPersonnelKey) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
  formError: string;
  staffMap: Map<string, string>;
}

export function DispatchFormInline({
  selectedList,
  otherMachinesPerMachine,
  onUpdatePerson,
  onRemovePerson,
  onSubmit,
  onCancel,
  isSaving,
  formError,
  staffMap
}: DispatchFormInlineProps) {
  if (selectedList.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 md:p-6">
      {/* Section Title */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <h3 className="text-sm font-semibold text-zinc-900">THIẾT LẬP THÔNG TIN ĐIỀU ĐỘNG</h3>
      </div>

      {/* Error Message */}
      {formError && (
        <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2">
          <p className="text-xs text-rose-700">{formError}</p>
        </div>
      )}

      {/* Desktop: Table-like Layout */}
      <div className="hidden md:block overflow-x-auto mb-4">
        <table className="min-w-full text-xs">
          <thead className="bg-white border-b border-amber-100">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-zinc-700 w-32">Nhân sự</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700 w-24">Vai trò</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700 w-24">Máy gốc</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700 w-32">Máy chuyển đến *</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700 w-20">Bắt đầu *</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700 w-20">Kết thúc *</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {selectedList.map(item => {
              const personName = staffMap.get(item.person.personnelId) || item.person.personnelId || '-';
              const otherMachines = otherMachinesPerMachine[item.machineValue] || [];
              const isDisabled = otherMachines.length === 0;

              return (
                <tr key={item.key} className="border-b border-amber-100 hover:bg-white transition-colors">
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900 truncate">{personName}</div>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 text-xs truncate">{item.person.role || '-'}</td>
                  <td className="px-3 py-2 text-zinc-700">{item.machineValue}</td>
                  <td className="px-3 py-2">
                    {isDisabled ? (
                      <div className="text-xs text-zinc-500">Không có máy khác</div>
                    ) : (
                      <select
                        value={item.mayDieuDong}
                        onChange={e => onUpdatePerson(item.key, { mayDieuDong: e.target.value })}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs focus:border-[#ef1b2d] focus:outline-none"
                      >
                        <option value="">-- Chọn --</option>
                        {otherMachines.map(m => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={item.thoiGianBatDau}
                      onChange={e => onUpdatePerson(item.key, { thoiGianBatDau: e.target.value })}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs focus:border-[#ef1b2d] focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={item.thoiGianKetThuc}
                      onChange={e => onUpdatePerson(item.key, { thoiGianKetThuc: e.target.value })}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs focus:border-[#ef1b2d] focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onRemovePerson(item.key)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-rose-100 text-rose-600 hover:text-rose-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: Stack Layout */}
      <div className="md:hidden space-y-3 mb-4">
        {selectedList.map(item => {
          const personName = staffMap.get(item.person.personnelId) || item.person.personnelId || '-';
          const otherMachines = otherMachinesPerMachine[item.machineValue] || [];
          const isDisabled = otherMachines.length === 0;

          return (
            <div key={item.key} className="rounded-md bg-white border border-amber-100 p-3">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="font-medium text-sm text-zinc-900">{personName}</div>
                  <div className="text-xs text-zinc-500">{item.person.role || '-'} • {item.machineValue}</div>
                </div>
                <button
                  onClick={() => onRemovePerson(item.key)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-rose-100 text-rose-600 hover:text-rose-700 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Máy chuyển đến *</label>
                  {isDisabled ? (
                    <div className="text-xs text-zinc-500 px-2 py-1.5 bg-zinc-50 rounded border border-zinc-200">
                      Không có máy khác
                    </div>
                  ) : (
                    <select
                      value={item.mayDieuDong}
                      onChange={e => onUpdatePerson(item.key, { mayDieuDong: e.target.value })}
                      className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs focus:border-[#ef1b2d] focus:outline-none"
                    >
                      <option value="">-- Chọn --</option>
                      {otherMachines.map(m => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-zinc-700 block mb-1">Bắt đầu *</label>
                    <input
                      type="time"
                      value={item.thoiGianBatDau}
                      onChange={e => onUpdatePerson(item.key, { thoiGianBatDau: e.target.value })}
                      className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs focus:border-[#ef1b2d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-700 block mb-1">Kết thúc *</label>
                    <input
                      type="time"
                      value={item.thoiGianKetThuc}
                      onChange={e => onUpdatePerson(item.key, { thoiGianKetThuc: e.target.value })}
                      className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs focus:border-[#ef1b2d] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-amber-200 pt-4">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Hủy
        </button>
        <button
          onClick={onSubmit}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-[#ef1b2d] px-4 py-2 text-sm font-medium text-white hover:bg-[#b30d1c] active:bg-[#8a0a15] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSaving ? 'Đang lưu...' : `Lưu điều động (${selectedList.length})`}
        </button>
      </div>
    </div>
  );
}
