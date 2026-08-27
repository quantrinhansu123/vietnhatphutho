import React from 'react';
import { Users, Clock } from 'lucide-react';

export type SchedPerson = {
  sourceRowId: string;
  ma_nhan_su: string;
  vai_tro: string;
  ca_lam_viec: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
};

export type MachineGroup = {
  maMay: string;
  tenMay: string;
  personnel: SchedPerson[];
};

interface MachineCardRowProps {
  machineGroups: MachineGroup[];
  staffMap: Map<string, string>;
  selectedKeys: Set<string>;
  personKey: (maMay: string, maNhanSu: string, ca: string) => string;
  onTogglePersonnel: (group: MachineGroup, person: SchedPerson, checked: boolean) => void;
  formatTimeRange: (start: unknown, end: unknown) => string;
}

export function MachineCardRow({
  machineGroups,
  staffMap,
  selectedKeys,
  personKey,
  onTogglePersonnel,
  formatTimeRange
}: MachineCardRowProps) {
  if (machineGroups.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-0.5 px-0.5">
      {machineGroups.map(group => (
        <div
          key={group.maMay}
          className="shrink-0 w-72 rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-900">{group.tenMay || group.maMay}</div>
            <div className="flex items-center gap-1 text-xs text-zinc-600">
              <Users className="h-4 w-4" />
              <span>{group.personnel.length} người</span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {group.personnel.length === 0 ? (
              <div className="px-4 py-3 text-center text-xs text-zinc-500">Chưa có nhân sự</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {group.personnel.map((person, idx) => {
                  const key = personKey(group.maMay, person.ma_nhan_su, person.ca_lam_viec);
                  const isSelected = selectedKeys.has(key);
                  const personName = staffMap.get(person.ma_nhan_su) || person.ma_nhan_su || '-';
                  const timeRange = formatTimeRange(person.thoi_gian_bat_dau, person.thoi_gian_ket_thuc);

                  return (
                    <label
                      key={`${idx}-${person.ma_nhan_su}-${person.ca_lam_viec}`}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => onTogglePersonnel(group, person, e.target.checked)}
                        className="mt-1 h-4 w-4 cursor-pointer rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-900">{personName}</div>
                        <div className="truncate text-xs text-zinc-500">{person.vai_tro || '-'}</div>
                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-600">
                          {person.ca_lam_viec ? (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-700">
                              {person.ca_lam_viec}
                            </span>
                          ) : null}
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
