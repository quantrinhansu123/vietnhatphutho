import React, { useState, useEffect, useCallback } from 'react';
import { BackButton } from '../../components/layout/NavButtons';
import { ChiPhiNhanCongList } from './ChiPhiNhanCongList';
import { ChiPhiNhanCongForm } from './ChiPhiNhanCongForm';
import type { ChiPhiNhanCongRecord, MachineInfo } from './types';
import { normalizeShiftSettings } from '../../utils/shiftSettings';

interface ChiPhiNhanCongPanelProps {
  onBack: () => void;
  currentUser?: any;
}

export function ChiPhiNhanCongPanel({ onBack, currentUser }: ChiPhiNhanCongPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [selectedRecord, setSelectedRecord] = useState<ChiPhiNhanCongRecord | null>(null);

  // Filters for list view
  const [filterThang, setFilterThang] = useState(() => new Date().getMonth() + 1);
  const [filterNam, setFilterNam] = useState(() => new Date().getFullYear());
  const [filterMaMay, setFilterMaMay] = useState('');

  // Reference state
  const [machines, setMachines] = useState<MachineInfo[]>([]);
  const [staffList, setStaffList] = useState<Array<{ code: string; name: string; position?: string }>>([]);
  const [shiftSettings, setShiftSettings] = useState<Array<{ code: string; name: string; startTime: string; endTime: string }>>([]);

  // Records state
  const [records, setRecords] = useState<ChiPhiNhanCongRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // 1. Tải danh mục dùng chung (máy, nhân sự, ca)
  useEffect(() => {
    let alive = true;
    const loadReferences = async () => {
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

        if (!alive) return;

        // Normalise machines
        const rawMachines = Array.isArray(mayData.machines) ? mayData.machines : [];
        const mList: MachineInfo[] = rawMachines
          .map((m: any) => ({
            code: String(m.ma_may || m.code || '').trim(),
            name: String(m.ten_may || m.name || m.ma_may || '').trim()
          }))
          .filter((m: MachineInfo) => Boolean(m.code));
        setMachines(mList);

        // Normalise staff
        const staffArr: Array<{ code: string; name: string; position?: string }> = [];
        const branches = Array.isArray(staffData.branches) ? staffData.branches : [];
        for (const b of branches) {
          for (const d of b.departments || []) {
            for (const member of d.members || []) {
              const code = String(member.code || member.id || '').trim();
              const name = String(member.name || '').trim();
              if (code || name) {
                staffArr.push({
                  code: code || name,
                  name: name || code,
                  position: String(member.position || member.chuc_vu || '').trim()
                });
              }
            }
          }
        }
        setStaffList(staffArr);

        // Normalise shift settings
        const shifts = normalizeShiftSettings(settingData);
        setShiftSettings(
          shifts.map(s => ({
            code: s.code,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime
          }))
        );
      } catch (err) {
        console.error('Error loading references for ChiPhiNhanCong:', err);
      }
    };

    loadReferences();
    return () => {
      alive = false;
    };
  }, []);

  // 2. Tải danh sách chi phí nhân công theo bộ lọc
  const loadRecords = useCallback(async (thang: number, nam: number, maMay: string) => {
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams();
      if (thang) params.set('thang', String(thang));
      if (nam) params.set('nam', String(nam));
      if (maMay) params.set('ma_may', maMay);

      const res = await fetch(`/api/chi-phi-nhan-cong?${params.toString()}`);
      const data = await res.json().catch(() => ({ items: [] }));
      setRecords(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error('Error loading chi phi nhan cong records:', err);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    loadRecords(filterThang, filterNam, filterMaMay);
  }, [filterThang, filterNam, filterMaMay, loadRecords]);

  // Handlers
  const handleFilterChange = (thang: number, nam: number, maMay: string) => {
    setFilterThang(thang);
    setFilterNam(nam);
    setFilterMaMay(maMay);
  };

  const handleAddNew = () => {
    setSelectedRecord(null);
    setViewMode('create');
  };

  const handleEdit = (record: ChiPhiNhanCongRecord) => {
    setSelectedRecord(record);
    setViewMode('edit');
  };

  const handleView = (record: ChiPhiNhanCongRecord) => {
    setSelectedRecord(record);
    setViewMode('view');
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/chi-phi-nhan-cong/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Lỗi khi xóa bảng chi phí nhân công.');
      }
      loadRecords(filterThang, filterNam, filterMaMay);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa bảng chi phí.');
    }
  };

  const handleSaveRecord = async (recordData: Partial<ChiPhiNhanCongRecord>) => {
    const isUpdate = Boolean(recordData.id);
    const url = isUpdate
      ? `/api/chi-phi-nhan-cong/${encodeURIComponent(recordData.id!)}`
      : '/api/chi-phi-nhan-cong';
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recordData)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Không thể lưu bảng chi phí nhân công.');
    }

    // Refresh list and go back
    loadRecords(filterThang, filterNam, filterMaMay);
    setViewMode('list');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-3 sm:px-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="flex items-center gap-3">
          <BackButton onClick={viewMode === 'list' ? onBack : () => setViewMode('list')} />
          <div>
            <h1 className="font-display text-base font-semibold tracking-tight text-slate-900">
              Chi phí nhân công
            </h1>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
              Quản lý và tính toán chi phí nhân công theo tháng và máy từ lịch làm việc & điều động
            </p>
          </div>
        </div>
      </div>

      {/* Body contents based on viewMode */}
      {viewMode === 'list' ? (
        <ChiPhiNhanCongList
          records={records}
          machines={machines}
          loading={loadingRecords}
          filterThang={filterThang}
          filterNam={filterNam}
          filterMaMay={filterMaMay}
          onFilterChange={handleFilterChange}
          onRefresh={() => loadRecords(filterThang, filterNam, filterMaMay)}
          onAddNew={handleAddNew}
          onEdit={handleEdit}
          onView={handleView}
          onDelete={handleDelete}
        />
      ) : (
        <ChiPhiNhanCongForm
          initialRecord={selectedRecord}
          machines={machines}
          staffList={staffList}
          shiftSettings={shiftSettings}
          currentUser={currentUser}
          onSave={handleSaveRecord}
          onCancel={() => setViewMode('list')}
        />
      )}
    </div>
  );
}

export default ChiPhiNhanCongPanel;
