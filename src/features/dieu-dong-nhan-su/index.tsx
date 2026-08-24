import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, Pencil, Trash2, Loader2, Printer } from 'lucide-react';
import { AssignedPersonnel } from '../ke-hoach-san-xuat/index';
import { MachineCardRow } from './MachineCardRow';
import { DispatchFormInline } from './DispatchFormInline';
import { EditDispatchModal } from './EditDispatchModal';
import { LichLamViecPrint } from './LichLamViecPrint';

type RawLenhSxRow = {
  id: string;
  ngay_bat_dau: string;
  ca: string;
  ma_lenh_sx: string;
  vi_tri: string;
  may: string;
  phan_cong_nhan_su: string;
};

type MachineGroup = {
  machineValue: string;
  personnel: Array<AssignedPersonnel & { sourceRowId: string }>;
};

type SelectedPersonnelKey = `${string}-${string}`; // "machineValue-personnelId"

type SelectedPersonnelWithForm = {
  key: SelectedPersonnelKey;
  machineValue: string;
  person: AssignedPersonnel;
  mayDieuDong: string;
  thoiGianBatDau: string;
  thoiGianKetThuc: string;
};

type DispatchRecord = {
  id: string;
  ngay_lam_viec: string;
  ca: string;
  ma_lenh_sx: string;
  ma_nhan_su: string;
  vai_tro: string | null;
  may_goc: string;
  may_dieu_dong: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  ghi_chu?: string;
};

type HrMember = { id?: string; code: string; name: string; role?: string; shift?: string };
type HrBranch = { name: string; departments: Array<{ name: string; members: HrMember[] }> };

function formatDispatchTimeRange(start: unknown, end: unknown): string {
  const s = start === null || start === undefined || String(start).trim() === '' ? '' : String(start).trim().slice(0, 5);
  const e = end === null || end === undefined || String(end).trim() === '' ? '' : String(end).trim().slice(0, 5);
  if (s && e) return `${s} - ${e}`;
  if (s && !e) return `${s} - --:--`;
  if (!s && e) return `--:-- - ${e}`;
  return '--:-- - --:--';
}

function parseAssignedPersonnel(jsonStr: unknown): AssignedPersonnel[] {
  try {
    const list = JSON.parse(String(jsonStr || '[]'));
    return Array.isArray(list) ? list.filter((p: any) => String(p?.ma_nhan_su || '').trim()) : [];
  } catch {
    return [];
  }
}

function normalizeHrBranches(data: any): HrBranch[] {
  if (!data || typeof data !== 'object') return [];
  const branches = Array.isArray(data.branches) ? data.branches : [];
  return branches.map((branch: any) => ({
    name: String(branch.name || branch.ten_chi_nhanh || ''),
    departments: Array.isArray(branch.departments) ? branch.departments.map((dept: any) => ({
      name: String(dept.name || dept.ten_phong_ban || ''),
      members: Array.isArray(dept.members) ? dept.members : []
    })) : []
  }));
}

function collectWorkshopStaff(branches: HrBranch[]): HrMember[] {
  const result: HrMember[] = [];
  for (const branch of branches) {
    for (const dept of branch.departments) {
      for (const member of dept.members) {
        result.push(member);
      }
    }
  }
  return result;
}

function resolvePersonnelName(personId: string, staffMap: Map<string, string>): string {
  return staffMap.get(personId) || personId || '-';
}

function timeToMinutes(value: string): number {
  const [h, m] = String(value).split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function rangesOverlap(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  const aStart = timeToMinutes(a.start);
  const aEnd = timeToMinutes(a.end);
  const bStart = timeToMinutes(b.start);
  const bEnd = timeToMinutes(b.end);
  return aStart < bEnd && bStart < aEnd;
}

interface DieuDongNhanSuPanelProps {
  onBack: () => void;
  currentUser?: any;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function DieuDongNhanSuPanel({ onBack, currentUser, canEdit = true, canDelete = true }: DieuDongNhanSuPanelProps) {
  const [lenhSxRows, setLenhSxRows] = useState<RawLenhSxRow[]>([]);
  const [staffBranches, setStaffBranches] = useState<HrBranch[]>([]);
  const [isLoadingLenhSx, setIsLoadingLenhSx] = useState(false);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedOrderCode, setSelectedOrderCode] = useState('');

  const [printDate, setPrintDate] = useState('');
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  const [selectedPersonnelKeys, setSelectedPersonnelKeys] = useState<Set<SelectedPersonnelKey>>(new Set());
  const [selectedPersonnelWithForms, setSelectedPersonnelWithForms] = useState<SelectedPersonnelWithForm[]>([]);
  const [history, setHistory] = useState<DispatchRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DispatchRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const branch of staffBranches) {
      for (const dept of branch.departments) {
        for (const member of dept.members) {
          if (member.name) {
            if (member.id) map.set(member.id, member.name);
            if (member.code) map.set(member.code, member.name);
            map.set(member.name, member.name);
          }
        }
      }
    }
    return map;
  }, [staffBranches]);

  const workshopStaff = useMemo(() => collectWorkshopStaff(staffBranches), [staffBranches]);

  const availableDates = useMemo(
    () => [...new Set(lenhSxRows.map(r => r.ngay_bat_dau).filter(Boolean))].sort(),
    [lenhSxRows]
  );

  const availableShifts = useMemo(
    () => selectedDate ? [...new Set(lenhSxRows.filter(r => r.ngay_bat_dau === selectedDate).map(r => r.ca).filter(Boolean))] : [],
    [lenhSxRows, selectedDate]
  );

  const availableOrders = useMemo(
    () =>
      selectedDate && selectedShift
        ? [...new Set(lenhSxRows.filter(r => r.ngay_bat_dau === selectedDate && r.ca === selectedShift).map(r => r.ma_lenh_sx).filter(Boolean))]
        : [],
    [lenhSxRows, selectedDate, selectedShift]
  );

  const machineGroups: MachineGroup[] = useMemo(() => {
    if (!selectedOrderCode) return [];
    const rows = lenhSxRows.filter(r => r.ma_lenh_sx === selectedOrderCode && r.ngay_bat_dau === selectedDate && r.ca === selectedShift);
    const byMachine = new Map<string, MachineGroup>();
    for (const row of rows) {
      const machineValue = String(row.vi_tri || row.may || '').trim() || 'Chưa xác định';
      const personnelList = parseAssignedPersonnel(row.phan_cong_nhan_su);
      const group = byMachine.get(machineValue) || { machineValue, personnel: [] };
      group.personnel.push(...personnelList.map(p => ({ ...p, sourceRowId: String(row.id) })));
      byMachine.set(machineValue, group);
    }
    return [...byMachine.values()];
  }, [lenhSxRows, selectedOrderCode, selectedDate, selectedShift]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setPrintDate(today);

    const loadData = async () => {
      setIsLoadingLenhSx(true);
      setIsLoadingStaff(true);
      try {
        const [lenhRes, staffRes] = await Promise.all([
          fetch('/api/lenh-sx'),
          fetch('/api/nhan-su?format=groups&scope=all')
        ]);

        if (lenhRes.ok) {
          const lenhData = await lenhRes.json();
          const rows = Array.isArray(lenhData.productionOrders) ? lenhData.productionOrders : [];
          setLenhSxRows(
            rows.map((r: any) => ({
              id: r.id,
              ngay_bat_dau: String(r.ngay_bat_dau || ''),
              ca: String(r.ca || ''),
              ma_lenh_sx: String(r.ma_lenh_sx || ''),
              vi_tri: String(r.vi_tri || r.position || ''),
              may: String(r.may || r.machine || ''),
              phan_cong_nhan_su: String(r.phan_cong_nhan_su || '[]')
            }))
          );
        }

        if (staffRes.ok) {
          const staffData = await staffRes.json();
          setStaffBranches(normalizeHrBranches(staffData));
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsLoadingLenhSx(false);
        setIsLoadingStaff(false);
      }
    };

    loadData();
  }, []);

  const reloadHistory = async (orderCode?: string) => {
    if (!orderCode && !selectedOrderCode) return;
    const code = orderCode || selectedOrderCode;
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append('ngay_lam_viec', selectedDate);
      if (selectedShift) params.append('ca', selectedShift);
      if (code) params.append('ma_lenh_sx', code);
      const res = await fetch(`/api/dieu-dong-nhan-su?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data.items) ? data.items : []);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDateChange = (v: string) => {
    setSelectedDate(v);
    setSelectedShift('');
    setSelectedOrderCode('');
    setSelectedPersonnelKeys(new Set());
    setSelectedPersonnelWithForms([]);
    setFormError('');
  };

  const handleShiftChange = (v: string) => {
    setSelectedShift(v);
    setSelectedOrderCode('');
    setSelectedPersonnelKeys(new Set());
    setSelectedPersonnelWithForms([]);
    setFormError('');
  };

  const handleOrderChange = async (v: string) => {
    setSelectedOrderCode(v);
    setSelectedPersonnelKeys(new Set());
    setSelectedPersonnelWithForms([]);
    setFormError('');
    if (v) {
      await reloadHistory(v);
    }
  };

  const handleTogglePersonnel = (machineValue: string, person: AssignedPersonnel, checked: boolean) => {
    const key: SelectedPersonnelKey = `${machineValue}-${person.ma_nhan_su}`;
    if (checked) {
      setSelectedPersonnelKeys(prev => new Set(prev).add(key));
      setSelectedPersonnelWithForms(prev => [
        ...prev,
        {
          key,
          machineValue,
          person,
          mayDieuDong: '',
          thoiGianBatDau: '',
          thoiGianKetThuc: ''
        }
      ]);
    } else {
      setSelectedPersonnelKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
      setSelectedPersonnelWithForms(prev => prev.filter(p => p.key !== key));
    }
    setFormError('');
  };

  const handleUpdateFormField = (key: SelectedPersonnelKey, update: Partial<SelectedPersonnelWithForm>) => {
    setSelectedPersonnelWithForms(prev => prev.map(p => (p.key === key ? { ...p, ...update } : p)));
  };

  const handleRemoveFromSelected = (key: SelectedPersonnelKey) => {
    setSelectedPersonnelKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
    setSelectedPersonnelWithForms(prev => prev.filter(p => p.key !== key));
  };

  const handleSubmit = async () => {
    if (selectedPersonnelWithForms.length === 0) return;

    // Validate all items
    for (const item of selectedPersonnelWithForms) {
      if (!item.mayDieuDong || !item.thoiGianBatDau || !item.thoiGianKetThuc) {
        setFormError(`${resolvePersonnelName(item.person.ma_nhan_su, staffMap)}: Vui lòng điền đầy đủ các trường bắt buộc.`);
        return;
      }

      if (item.mayDieuDong === item.machineValue) {
        setFormError(`${resolvePersonnelName(item.person.ma_nhan_su, staffMap)}: Máy chuyển đến phải khác máy gốc.`);
        return;
      }

      const startMins = timeToMinutes(item.thoiGianBatDau);
      const endMins = timeToMinutes(item.thoiGianKetThuc);
      if (startMins >= endMins) {
        setFormError(`${resolvePersonnelName(item.person.ma_nhan_su, staffMap)}: Giờ bắt đầu phải nhỏ hơn giờ kết thúc.`);
        return;
      }

      // Overlap check
      const clientOverlap = history.some(h => {
        if (h.ma_nhan_su !== item.person.ma_nhan_su) return false;
        if (h.ngay_lam_viec !== selectedDate) return false;
        return rangesOverlap(
          { start: item.thoiGianBatDau, end: item.thoiGianKetThuc },
          { start: h.thoi_gian_bat_dau.slice(0, 5), end: h.thoi_gian_ket_thuc.slice(0, 5) }
        );
      });
      if (clientOverlap) {
        setFormError(`${resolvePersonnelName(item.person.ma_nhan_su, staffMap)}: Nhân sự đã có khoảng điều động trùng giờ trong ngày này.`);
        return;
      }
    }

    setIsSaving(true);
    setFormError('');
    try {
      for (const item of selectedPersonnelWithForms) {
        const payload = {
          ngay_lam_viec: selectedDate,
          ca: selectedShift,
          ma_lenh_sx: selectedOrderCode,
          ma_nhan_su: item.person.ma_nhan_su,
          vai_tro: item.person.role,
          may_goc: item.machineValue,
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
          const err = await res.json();
          setFormError(`${resolvePersonnelName(item.person.ma_nhan_su, staffMap)}: ${err.error || 'Lỗi khi lưu.'}`);
          return;
        }
      }

      setSelectedPersonnelKeys(new Set());
      setSelectedPersonnelWithForms([]);
      await reloadHistory();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu điều động.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditHistory = (record: DispatchRecord) => {
    setEditingRecord(record);
    setIsEditModalOpen(true);
  };

  const handleEditModalSubmit = async (payload: Partial<DispatchRecord>) => {
    if (!editingRecord) return;

    setIsSaving(true);
    try {
      const fullPayload = {
        ngay_lam_viec: editingRecord.ngay_lam_viec,
        ca: editingRecord.ca,
        ma_lenh_sx: editingRecord.ma_lenh_sx,
        ma_nhan_su: editingRecord.ma_nhan_su,
        vai_tro: editingRecord.vai_tro,
        may_goc: editingRecord.may_goc,
        ...payload
      };

      const res = await fetch(`/api/dieu-dong-nhan-su/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi khi lưu.');
      }

      setIsEditModalOpen(false);
      setEditingRecord(null);
      await reloadHistory();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (record: DispatchRecord) => {
    if (!window.confirm(`Xóa điều động của ${resolvePersonnelName(record.ma_nhan_su, staffMap)} từ ${record.may_goc} sang ${record.may_dieu_dong}?`)) return;

    try {
      const res = await fetch(`/api/dieu-dong-nhan-su/${record.id}`, { method: 'DELETE' });
      if (res.ok) {
        await reloadHistory();
      } else {
        const err = await res.json();
        alert(err.error || 'Lỗi khi xóa.');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa.');
    }
  };

  const otherMachinesPerMachine = useMemo(() => {
    const map: Record<string, string[]> = {};

    if (!selectedDate || !selectedShift) return map;

    // Lấy tất cả máy có cùng ca cùng ngày (từ tất cả LSX cùng ca+ngày đó)
    const machineSet = new Set<string>(
      lenhSxRows
        .filter(r => r.ngay_bat_dau === selectedDate && r.ca === selectedShift)
        .map(r => String(r.vi_tri || r.may || '').trim())
        .filter(Boolean)
    );
    const allMachinesThisShift: string[] = Array.from(machineSet).sort();

    for (const group of machineGroups) {
      // Máy chuyển đến = tất cả máy cùng ca cùng ngày, loại trừ máy gốc hiện tại
      const others = allMachinesThisShift.filter(v => v !== group.machineValue);
      map[group.machineValue] = others;
    }
    return map;
  }, [machineGroups, lenhSxRows, selectedDate, selectedShift]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Filter Bar */}
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 md:px-6 md:py-4">
          {/* Print Schedule Section */}
          <div className="mb-4 pb-4 border-b border-zinc-200">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Ngày làm việc</label>
                <input
                  type="date"
                  value={printDate}
                  onChange={e => setPrintDate(e.target.value)}
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#ef1b2d] focus:outline-none"
                />
              </div>
              <button
                onClick={() => setIsPrintDialogOpen(true)}
                disabled={!printDate}
                className="inline-flex items-center gap-2 rounded bg-[#ef1b2d] px-4 py-2 text-sm font-medium text-white hover:bg-[#d41623] disabled:bg-zinc-300 disabled:cursor-not-allowed"
              >
                <Printer className="h-4 w-4" />
                IN LỊCH LÀM VIỆC
              </button>
            </div>
          </div>

          {/* Dispatch Section */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Ngày */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Ngày *</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#ef1b2d] focus:outline-none"
              />
            </div>

            {/* Ca */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Ca làm việc *</label>
              <select
                value={selectedShift}
                onChange={e => handleShiftChange(e.target.value)}
                disabled={!selectedDate}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 focus:border-[#ef1b2d] focus:outline-none"
              >
                <option value="">-- Chọn ca --</option>
                {availableShifts.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Lệnh SX */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">Lệnh sản xuất *</label>
              <select
                value={selectedOrderCode}
                onChange={e => handleOrderChange(e.target.value)}
                disabled={!selectedShift}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 focus:border-[#ef1b2d] focus:outline-none"
              >
                <option value="">-- Chọn LSX --</option>
                {availableOrders.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Machine Cards + Form */}
        {selectedOrderCode ? (
          <div className="px-4 py-4 md:px-6 md:py-6">
            {/* Machine Card Row */}
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900">DANH SÁCH NHÂN SỰ THUỘC LỆNH SẢN XUẤT {selectedOrderCode}</h2>
              {machineGroups.length === 0 ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-600">
                  Lệnh sản xuất chưa có máy/vị trí hoặc chưa có nhân sự được phân công.
                </div>
              ) : (
                <MachineCardRow
                  machineGroups={machineGroups}
                  staffMap={staffMap}
                  selectedKeys={selectedPersonnelKeys}
                  onTogglePersonnel={handleTogglePersonnel}
                  formatTimeRange={formatDispatchTimeRange}
                />
              )}
            </div>

            {/* Dispatch Form Inline */}
            {selectedPersonnelWithForms.length > 0 && (
              <DispatchFormInline
                selectedList={selectedPersonnelWithForms}
                otherMachinesPerMachine={otherMachinesPerMachine}
                onUpdatePerson={handleUpdateFormField}
                onRemovePerson={handleRemoveFromSelected}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setSelectedPersonnelKeys(new Set());
                  setSelectedPersonnelWithForms([]);
                  setFormError('');
                }}
                isSaving={isSaving}
                formError={formError}
                staffMap={staffMap}
              />
            )}

            {/* History Table */}
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900">
                LỊCH SỬ ĐIỀU ĐỘNG {selectedDate && selectedShift && selectedOrderCode ? `(NGÀY ${selectedDate} - CA ${selectedShift} - LSX ${selectedOrderCode})` : ''}
              </h3>
              {isLoadingHistory ? (
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
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700 w-12">STT</th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700">Nhân sự</th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700">Vai trò</th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700">Máy gốc</th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700">Máy điều động</th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700">Khung giờ</th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700">Trạng thái</th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((record, idx) => (
                        <tr key={record.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                          <td className="px-4 py-3 text-zinc-700">{idx + 1}</td>
                          <td className="px-4 py-3 text-zinc-900 font-medium">{resolvePersonnelName(record.ma_nhan_su, staffMap)}</td>
                          <td className="px-4 py-3 text-zinc-600 text-xs">{record.vai_tro || '-'}</td>
                          <td className="px-4 py-3 text-zinc-700">{record.may_goc}</td>
                          <td className="px-4 py-3 text-zinc-700">{record.may_dieu_dong}</td>
                          <td className="px-4 py-3 text-zinc-700">{formatDispatchTimeRange(record.thoi_gian_bat_dau, record.thoi_gian_ket_thuc)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Đã ghi nhận
                            </span>
                          </td>
                          <td className="px-4 py-3 flex items-center gap-2">
                            {canEdit && (
                              <button
                                onClick={() => handleEditHistory(record)}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 active:text-blue-800"
                              >
                                <Pencil className="h-4 w-4" />
                                Sửa
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteHistory(record)}
                                className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 active:text-rose-800"
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
        ) : (
          <div className="flex items-center justify-center py-16">
            <div className="text-center text-zinc-600">
              <p className="text-sm">Vui lòng chọn Ngày, Ca làm việc và Lệnh sản xuất để xem danh sách nhân sự.</p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditDispatchModal
        isOpen={isEditModalOpen}
        record={editingRecord}
        otherMachines={editingRecord ? otherMachinesPerMachine[editingRecord.may_goc] || [] : []}
        onSubmit={handleEditModalSubmit}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingRecord(null);
        }}
        staffMap={staffMap}
      />

      {/* Print Schedule Modal */}
      <LichLamViecPrint
        ngay={printDate}
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
      />
    </div>
  );
}
