import React from 'react';
import { X, Loader2 } from 'lucide-react';

export type SelectedDispatchItem = {
  key: string;
  maMay: string;
  tenMayGoc: string;
  caGoc: string;
  /** Giờ bắt đầu hiện tại của nhân sự trong lịch (để đối chiếu khi điều động cùng máy & cùng ca). */
  gocBatDau: string;
  maLenhSx: string;
  person: { ma_nhan_su: string; vai_tro: string };
  caDieuDong: string;
  mayDieuDong: string;
  thoiGianBatDau: string;
  thoiGianKetThuc: string;
};

interface Props {
  selectedList: SelectedDispatchItem[];
  machineNames: string[];
  shiftOptions: Array<{ value: string; label: string }>;
  onUpdatePerson: (key: string, update: Partial<SelectedDispatchItem>) => void;
  onRemovePerson: (key: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
  formError: string;
  staffMap: Map<string, string>;
}

const cellInput =
  'w-full rounded border border-zinc-300 px-2 py-1 text-xs focus:border-[#ef1b2d] focus:outline-none';

export function DispatchFormInline({
  selectedList,
  machineNames,
  shiftOptions,
  onUpdatePerson,
  onRemovePerson,
  onSubmit,
  onCancel,
  isSaving,
  formError,
  staffMap
}: Props) {
  if (selectedList.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <h3 className="text-sm font-semibold text-zinc-900">THIẾT LẬP THÔNG TIN ĐIỀU ĐỘNG</h3>
      </div>

      {formError && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="text-xs text-rose-700">{formError}</p>
        </div>
      )}

      <div className="mb-4 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="border-b border-amber-100 bg-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Nhân sự</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Vai trò</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Máy gốc</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Ca gốc</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Ca chuyển đến *</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Máy chuyển đến *</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Bắt đầu *</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-700">Kết thúc *</th>
              <th className="w-8 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {selectedList.map(item => {
              const personName = staffMap.get(item.person.ma_nhan_su) || item.person.ma_nhan_su || '-';
              return (
                <tr key={item.key} className="border-b border-amber-100 transition-colors hover:bg-white">
                  <td className="px-3 py-2 font-medium text-zinc-900">{personName}</td>
                  <td className="px-3 py-2 text-zinc-600">{item.person.vai_tro || '-'}</td>
                  <td className="px-3 py-2 text-zinc-700">{item.tenMayGoc}</td>
                  <td className="px-3 py-2 text-zinc-700">{item.caGoc || '-'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={item.caDieuDong}
                      onChange={e => onUpdatePerson(item.key, { caDieuDong: e.target.value })}
                      className={cellInput}
                    >
                      <option value="">-- Chọn ca --</option>
                      {shiftOptions.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.mayDieuDong}
                      onChange={e => onUpdatePerson(item.key, { mayDieuDong: e.target.value })}
                      className={cellInput}
                    >
                      <option value="">-- Chọn máy --</option>
                      {machineNames.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={item.thoiGianBatDau}
                      onChange={e => onUpdatePerson(item.key, { thoiGianBatDau: e.target.value })}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={item.thoiGianKetThuc}
                      onChange={e => onUpdatePerson(item.key, { thoiGianKetThuc: e.target.value })}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onRemovePerson(item.key)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-rose-600 hover:bg-rose-100 hover:text-rose-700"
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

      <div className="flex items-center justify-end gap-2 border-t border-amber-200 pt-4">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          onClick={onSubmit}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-[#ef1b2d] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b30d1c] disabled:opacity-50"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSaving ? 'Đang lưu...' : `Lưu điều động (${selectedList.length})`}
        </button>
      </div>
    </div>
  );
}
