import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { getProductionShiftOptions, normalizeShiftSettings } from '../../utils/shiftSettings';
import { MachineCardRow, type MachineGroup, type SchedPerson } from './MachineCardRow';
import { DispatchFormInline, type SelectedDispatchItem } from './DispatchFormInline';
import { EditDispatchModal, type DispatchRecord } from './EditDispatchModal';

type SchedRow = {
  id: string;
  ma_lenh_sx: string;
  ma_may: string;
  may: string;
  ca_lam_viec: string;
  vai_tro: string;
  ma_nhan_su: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
};

type MachineOpt = { code: string; name: string };
type HrMember = { id?: string; code: string; name: string };
type HrBranch = { name: string; departments: Array<{ name: string; members: HrMember[] }> };
type ShiftOpt = { value: string; label: string };

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function timeHHMM(v: unknown): string {
  const s = str(v);
  return s ? s.slice(0, 5) : '';
}

function timeToMinutes(value: string): number {
  const [h, m] = String(value).split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function rangesOverlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end);
}

function formatDispatchTimeRange(start: unknown, end: unknown): string {
  const s = timeHHMM(start);
  const e = timeHHMM(end);
  if (s && e) return `${s} - ${e}`;
  if (s) return `${s} - --:--`;
  if (e) return `--:-- - ${e}`;
  return '--:-- - --:--';
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const formatDate = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split('-');
  return day && m && y ? `${day}/${m}/${y}` : d;
};

function normalizeHrBranches(data: any): HrBranch[] {
  if (!data || typeof data !== 'object') return [];
  const branches = Array.isArray(data.branches) ? data.branches : [];
  return branches.map((branch: any) => ({
    name: String(branch.name || branch.ten_chi_nhanh || ''),
    departments: Array.isArray(branch.departments)
      ? branch.departments.map((dept: any) => ({
          name: String(dept.name || dept.ten_phong_ban || ''),
          members: Array.isArray(dept.members) ? dept.members : []
        }))
      : []
  }));
}

function normalizeMachines(data: unknown): MachineOpt[] {
  const list = data && typeof data === 'object' && Array.isArray((data as { machines?: unknown }).machines)
    ? (data as { machines: unknown[] }).machines
    : [];
  const byKey = new Map<string, MachineOpt>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const code = str(r.ma_may ?? r.code);
    const name = str(r.ten_may ?? r.name ?? code);
    if (!code && !name) continue;
    const key = code || name;
    if (!byKey.has(key)) byKey.set(key, { code: code || name, name: name || code });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function normalizeSchedRows(data: unknown): SchedRow[] {
  const items = data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
    ? (data as { items: unknown[] }).items
    : [];
  return items
    .map((raw): SchedRow | null => {
      if (!raw || typeof raw !== 'object') return null;
      const r = raw as Record<string, unknown>;
      const id = str(r.id);
      const maNhanSu = str(r.ma_nhan_su);
      const maMay = str(r.ma_may);
      if (!id || !maNhanSu || !maMay) return null;
      return {
        id,
        ma_lenh_sx: str(r.ma_lenh_sx),
        ma_may: maMay,
        may: str(r.may ?? r.ten_may),
        ca_lam_viec: str(r.ca_lam_viec ?? r.ca),
        vai_tro: str(r.vai_tro),
        ma_nhan_su: maNhanSu,
        thoi_gian_bat_dau: timeHHMM(r.thoi_gian_bat_dau),
        thoi_gian_ket_thuc: timeHHMM(r.thoi_gian_ket_thuc)
      };
    })
    .filter((r): r is SchedRow => Boolean(r));
}

const personKey = (maMay: string, maNhanSu: string, ca: string) => `${maMay}__${maNhanSu}__${ca}`;

interface DieuDongNhanSuPanelProps {
  onBack: () => void;
  currentUser?: any;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function DieuDongNhanSuPanel({ canEdit = true, canDelete = true }: DieuDongNhanSuPanelProps) {
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [schedRows, setSchedRows] = useState<SchedRow[]>([]);
  const [machines, setMachines] = useState<MachineOpt[]>([]);
  const [staffBranches, setStaffBranches] = useState<HrBranch[]>([]);
  const [shiftOptions, setShiftOptions] = useState<ShiftOpt[]>([]);
  const [history, setHistory] = useState<DispatchRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');

  const [selectedItems, setSelectedItems] = useState<SelectedDispatchItem[]>([]);
  const [editingRecord, setEditingRecord] = useState<DispatchRecord | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const branch of staffBranches) {
      for (const dept of branch.departments) {
        for (const member of dept.members) {
          if (!member.name) continue;
          if (member.id) map.set(member.id, member.name);
          if (member.code) map.set(member.code, member.name);
          map.set(member.name, member.name);
        }
      }
    }
    return map;
  }, [staffBranches]);

  const machineNames = useMemo(
    () => machines.map(m => m.name).filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')),
    [machines]
  );
  const machineNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of machines) if (m.code) map.set(m.code, m.name);
    return map;
  }, [machines]);

  const resolveName = useCallback((code: string) => staffMap.get(code) || code || '-', [staffMap]);

  const machineGroups: MachineGroup[] = useMemo(() => {
    const map = new Map<string, MachineGroup>();
    for (const row of schedRows) {
      let group = map.get(row.ma_may);
      if (!group) {
        group = {
          maMay: row.ma_may,
          tenMay: machineNameByCode.get(row.ma_may) || row.may || row.ma_may,
          personnel: []
        };
        map.set(row.ma_may, group);
      }
      group.personnel.push({
        sourceRowId: row.id,
        ma_nhan_su: row.ma_nhan_su,
        vai_tro: row.vai_tro,
        ca_lam_viec: row.ca_lam_viec,
        thoi_gian_bat_dau: row.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: row.thoi_gian_ket_thuc
      });
    }
    return [...map.values()].sort((a, b) => a.tenMay.localeCompare(b.tenMay, 'vi'));
  }, [schedRows, machineNameByCode]);

  const selectedKeys = useMemo(() => new Set(selectedItems.map(i => i.key)), [selectedItems]);

  const loadReference = useCallback(async () => {
    try {
      const [mayRes, staffRes, settingRes] = await Promise.all([
        fetch('/api/danh-sach-may'),
        fetch('/api/nhan-su?format=groups&scope=all'),
        fetch('/api/cai-dat')
      ]);
      const [mayData, staffData, settingData] = await Promise.all([
        mayRes.json().catch(() => ({})),
        staffRes.json().catch(() => ({})),
        settingRes.json().catch(() => ({}))
      ]);
      setMachines(normalizeMachines(mayData));
      setStaffBranches(normalizeHrBranches(staffData));
      setShiftOptions(getProductionShiftOptions(normalizeShiftSettings(settingData)));
    } catch {
      /* giữ partial data */
    }
  }, []);

  const loadForDate = useCallback(async (date: string) => {
    if (!date) return;
    setLoading(true);
    setLoadingHistory(true);
    setPageError('');
    setSelectedItems([]);
    try {
      const [schedRes, ddRes] = await Promise.all([
        fetch(`/api/phan-cong-nhan-su?ngay_lam_viec=${encodeURIComponent(date)}`),
        fetch(`/api/dieu-dong-nhan-su?ngay_lam_viec=${encodeURIComponent(date)}`)
      ]);
      const [schedData, ddData] = await Promise.all([
        schedRes.json().catch(() => ({})),
        ddRes.json().catch(() => ({}))
      ]);
      setSchedRows(normalizeSchedRows(schedData));
      setHistory(Array.isArray(ddData.items) ? (ddData.items as DispatchRecord[]) : []);
    } catch (err: any) {
      setPageError(err?.message || 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadReference();
  }, [loadReference]);

  useEffect(() => {
    void loadForDate(selectedDate);
  }, [selectedDate, loadForDate]);

  const reloadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/dieu-dong-nhan-su?ngay_lam_viec=${encodeURIComponent(selectedDate)}`);
      const data = await res.json().catch(() => ({}));
      setHistory(Array.isArray(data.items) ? (data.items as DispatchRecord[]) : []);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedDate]);

  const togglePersonnel = (group: MachineGroup, person: SchedPerson, checked: boolean) => {
    const key = personKey(group.maMay, person.ma_nhan_su, person.ca_lam_viec);
    setFormError('');
    if (checked) {
      const schedRow = schedRows.find(r => r.id === person.sourceRowId);
      setSelectedItems(prev => [
        ...prev,
        {
          key,
          maMay: group.maMay,
          tenMayGoc: group.tenMay,
          caGoc: person.ca_lam_viec,
          gocBatDau: person.thoi_gian_bat_dau,
          maLenhSx: schedRow?.ma_lenh_sx || '',
          person: { ma_nhan_su: person.ma_nhan_su, vai_tro: person.vai_tro },
          caDieuDong: person.ca_lam_viec,
          mayDieuDong: '',
          thoiGianBatDau: person.thoi_gian_bat_dau,
          thoiGianKetThuc: person.thoi_gian_ket_thuc
        }
      ]);
    } else {
      setSelectedItems(prev => prev.filter(i => i.key !== key));
    }
  };

  const updateItem = (key: string, patch: Partial<SelectedDispatchItem>) => {
    setSelectedItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));
  };
  const removeItem = (key: string) => setSelectedItems(prev => prev.filter(i => i.key !== key));

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return;

    for (const item of selectedItems) {
      const who = resolveName(item.person.ma_nhan_su);
      if (!item.caDieuDong || !item.mayDieuDong || !item.thoiGianBatDau || !item.thoiGianKetThuc) {
        setFormError(`${who}: vui lòng điền đầy đủ các trường bắt buộc.`);
        return;
      }
      
      if (timeToMinutes(item.thoiGianBatDau) >= timeToMinutes(item.thoiGianKetThuc)) {
        setFormError(`${who}: giờ bắt đầu phải nhỏ hơn giờ kết thúc.`);
        return;
      }
      const overlap = history.some(
        h =>
          h.ma_nhan_su === item.person.ma_nhan_su &&
          h.ngay_lam_viec === selectedDate &&
          rangesOverlap(
            { start: item.thoiGianBatDau, end: item.thoiGianKetThuc },
            { start: timeHHMM(h.thoi_gian_bat_dau), end: timeHHMM(h.thoi_gian_ket_thuc) }
          )
      );
      if (overlap) {
        setFormError(`${who}: đã có khoảng điều động trùng giờ trong ngày này.`);
        return;
      }
    }

    setIsSaving(true);
    setFormError('');
    try {
      for (const item of selectedItems) {
        const payload = {
          ngay_lam_viec: selectedDate,
          ca: item.caGoc,
          ca_dieu_dong: item.caDieuDong,
          goc_bat_dau: item.gocBatDau,
          ma_lenh_sx: item.maLenhSx,
          ma_nhan_su: item.person.ma_nhan_su,
          vai_tro: item.person.vai_tro,
          may_goc: item.tenMayGoc,
          may_dieu_dong: item.mayDieuDong,
          thoi_gian_bat_dau: item.thoiGianBatDau,
          thoi_gian_ket_thuc: item.thoiGianKetThuc
        };
        const res = await fetch('/api/dieu-dong-nhan-su', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFormError(`${resolveName(item.person.ma_nhan_su)}: ${err.error || 'Lỗi khi lưu.'}`);
          return;
        }
      }
      setSelectedItems([]);
      await reloadHistory();
    } catch (err: any) {
      setFormError(err?.message || 'Lỗi khi lưu điều động.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (patch: Partial<DispatchRecord>) => {
    if (!editingRecord) return;
    const payload = {
      ngay_lam_viec: editingRecord.ngay_lam_viec,
      ca: editingRecord.ca,
      ma_lenh_sx: editingRecord.ma_lenh_sx,
      ma_nhan_su: editingRecord.ma_nhan_su,
      vai_tro: editingRecord.vai_tro,
      may_goc: editingRecord.may_goc,
      ...patch
    };
    const res = await fetch(`/api/dieu-dong-nhan-su/${editingRecord.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Lỗi khi lưu.');
    }
    setIsEditOpen(false);
    setEditingRecord(null);
    await reloadHistory();
  };

  const handleDeleteHistory = async (record: DispatchRecord) => {
    if (!window.confirm(`Xóa điều động của ${resolveName(record.ma_nhan_su)}?`)) return;
    const res = await fetch(`/api/dieu-dong-nhan-su/${record.id}`, { method: 'DELETE' });
    if (res.ok) {
      await reloadHistory();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Lỗi khi xóa.');
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Ngày làm việc *</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#ef1b2d] focus:outline-none"
              />
            </div>
            <p className="pb-2 text-xs text-zinc-500">
              Hiển thị toàn bộ nhân sự có lịch làm việc ngày {formatDate(selectedDate)}, gom theo máy.
            </p>
          </div>
        </div>

        {pageError ? (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 md:mx-6">
            {pageError}
          </div>
        ) : null}

        <div className="px-4 py-4 md:px-6 md:py-6">
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">
              NHÂN SỰ CÓ LỊCH LÀM VIỆC NGÀY {formatDate(selectedDate)}
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : machineGroups.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-600">
                Không có nhân sự nào có lịch làm việc trong ngày này.
              </div>
            ) : (
              <MachineCardRow
                machineGroups={machineGroups}
                staffMap={staffMap}
                selectedKeys={selectedKeys}
                personKey={personKey}
                onTogglePersonnel={togglePersonnel}
                formatTimeRange={formatDispatchTimeRange}
              />
            )}
          </div>

          {selectedItems.length > 0 && (
            <DispatchFormInline
              selectedList={selectedItems}
              machineNames={machineNames}
              shiftOptions={shiftOptions}
              onUpdatePerson={updateItem}
              onRemovePerson={removeItem}
              onSubmit={handleSubmit}
              onCancel={() => {
                setSelectedItems([]);
                setFormError('');
              }}
              isSaving={isSaving}
              formError={formError}
              staffMap={staffMap}
            />
          )}

          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">
              LỊCH SỬ ĐIỀU ĐỘNG NGÀY {formatDate(selectedDate)}
            </h3>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-600">
                Chưa có điều động nào.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700">Nhân sự</th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700">Vai trò</th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700">Máy gốc</th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700">Ca gốc</th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700">Máy chuyển đến</th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700">Ca chuyển đến</th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700">Khung giờ</th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-700">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, idx) => (
                      <tr key={record.id || idx} className="border-b border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">{resolveName(record.ma_nhan_su)}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600">{record.vai_tro || '-'}</td>
                        <td className="px-4 py-3 text-zinc-700">{record.may_goc}</td>
                        <td className="px-4 py-3 text-zinc-700">{record.ca || '-'}</td>
                        <td className="px-4 py-3 text-zinc-700">{record.may_dieu_dong}</td>
                        <td className="px-4 py-3 text-zinc-700">{record.ca_dieu_dong || record.ca || '-'}</td>
                        <td className="px-4 py-3 text-zinc-700">
                          {formatDispatchTimeRange(record.thoi_gian_bat_dau, record.thoi_gian_ket_thuc)}
                        </td>
                        <td className="flex items-center gap-2 px-4 py-3">
                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingRecord(record);
                                setIsEditOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Pencil className="h-4 w-4" />
                              Sửa
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => void handleDeleteHistory(record)}
                              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
                            >
                              <Trash2 className="h-4 w-4" />
                              Xóa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <EditDispatchModal
        isOpen={isEditOpen}
        record={editingRecord}
        machineNames={machineNames}
        shiftOptions={shiftOptions}
        onSubmit={handleEditSubmit}
        onCancel={() => {
          setIsEditOpen(false);
          setEditingRecord(null);
        }}
        staffMap={staffMap}
      />
    </div>
  );
}
