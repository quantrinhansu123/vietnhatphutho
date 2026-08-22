import React from 'react';
import { Users, Clock } from 'lucide-react';
import { AssignedPersonnel } from '../ke-hoach-san-xuat/index';

type MachineGroup = {
  machineValue: string;
  personnel: Array<AssignedPersonnel & { sourceRowId: string }>;
};

type SelectedPersonnelKey = `${string}-${string}`; // "machineValue-personnelId"

interface MachineCardRowProps {
  machineGroups: MachineGroup[];
  staffMap: Map<string, string>;
  selectedKeys: Set<SelectedPersonnelKey>;
  onTogglePersonnel: (machineValue: string, person: AssignedPersonnel, checked: boolean) => void;
  formatTimeRange: (start: unknown, end: unknown) => string;
}

export function MachineCardRow({
  machineGroups,
  staffMap,
  selectedKeys,
  onTogglePersonnel,
  formatTimeRange
}: MachineCardRowProps) {
  if (machineGroups.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-0.5 px-0.5">
      {machineGroups.map(group => (
        <div
          key={group.machineValue}
          className="shrink-0 w-72 rounded-lg border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Card Header */}
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 flex items-center justify-between">
            <div className="font-medium text-zinc-900 text-sm">{group.machineValue}</div>
            <div className="flex items-center gap-1 text-xs text-zinc-600">
              <Users className="h-4 w-4" />
              <span>{group.personnel.length} người</span>
            </div>
          </div>

          {/* Card Body — Personnel List with vertical scroll if needed */}
          <div className="max-h-64 overflow-y-auto">
            {group.personnel.length === 0 ? (
              <div className="px-4 py-3 text-center text-xs text-zinc-500">Chưa có nhân sự</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {group.personnel.map((person, idx) => {
                  const personKey: SelectedPersonnelKey = `${group.machineValue}-${person.ma_nhan_su}`;
                  const isSelected = selectedKeys.has(personKey);
                  const personName = staffMap.get(person.ma_nhan_su) || person.ma_nhan_su || '-';
                  const timeRange = formatTimeRange(person.thoi_gian_bat_dau, person.thoi_gian_ket_thuc);

                  return (
                    <label
                      key={`${idx}-${person.ma_nhan_su}`}
                      className={`px-4 py-3 cursor-pointer transition-colors flex gap-3 items-start ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-zinc-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => onTogglePersonnel(group.machineValue, person, e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />

                      {/* Person Name & Role & Time */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-zinc-900 truncate">{personName}</div>
                        <div className="text-xs text-zinc-500 truncate">{person.role || '-'}</div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-600">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{timeRange}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
