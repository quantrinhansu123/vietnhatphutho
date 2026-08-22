import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Loader2, Save, Trash2 } from 'lucide-react';
import type { AssignedPersonnel } from '../ke-hoach-san-xuat';
import { createDefaultPersonnelList, addPersonnelEntry, removePersonnelEntry } from '../ke-hoach-san-xuat';
import { PersonnelAssignmentBlock } from '../../components/PersonnelAssignmentBlock';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { getProductionShiftOptions } from '../../utils/shiftSettings';
import type { HrBranch, HrMember } from '../_shared/hr';
import { normalizeHrBranches } from '../_shared/hr';
import { orderFieldClass } from '../_shared/orderHelpers';

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

type RawLenhSxRow = {
  id: string;
  ngay_bat_dau: string;
  ca: string;
  ma_lenh_sx: string;
  vi_tri: string;
  may: string;
  phan_cong_nhan_su: string;
};

type PersonnelAssignmentPanelProps = {
  onBack: () => void;
};

export function PersonnelAssignmentPanel({ onBack }: PersonnelAssignmentPanelProps) {
  const [lenhSxRows, setLenhSxRows] = useState<RawLenhSxRow[]>([]);
  const [staffBranches, setStaffBranches] = useState<HrBranch[]>([]);
  const [isLoadingLenhSx, setIsLoadingLenhSx] = useState(false);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [settings, setSettings] = useState<any[]>([]);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedOrderCode, setSelectedOrderCode] = useState('');
  const [personnel, setPersonnel] = useState<AssignedPersonnel[]>(createDefaultPersonnelList());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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
    () => (selectedDate ? [...new Set(lenhSxRows.filter(r => r.ngay_bat_dau === selectedDate).map(r => r.ca).filter(Boolean))] : []),
    [lenhSxRows, selectedDate]
  );

  const availableOrders = useMemo(
    () =>
      selectedDate && selectedShift
        ? [...new Set(lenhSxRows.filter(r => r.ngay_bat_dau === selectedDate && r.ca === selectedShift).map(r => r.ma_lenh_sx).filter(Boolean))]
        : [],
    [lenhSxRows, selectedDate, selectedShift]
  );

  const shiftOptions = useMemo(() => {
    const fromSettings = settings
      .filter(
        setting =>
          setting.loaiCaiDat === 'Thời gian' ||
          setting.loaiCaiDat === 'Sản xuất' ||
          /ca/i.test(setting.name) ||
          /ca/i.test(setting.code)
      )
      .map((setting: any) => setting.name || setting.code)
      .filter((name: string, index: number, arr: string[]) => name && arr.indexOf(name) === index);

    return fromSettings.length > 0 ? fromSettings : getProductionShiftOptions({ settings: [] });
  }, [settings]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingLenhSx(true);
      setIsLoadingStaff(true);
      try {
        const [lenhRes, staffRes, settingRes] = await Promise.all([
          fetch('/api/lenh-sx'),
          fetch('/api/nhan-su?format=groups&scope=all'),
          fetch('/api/cai-dat')
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

        if (settingRes.ok) {
          const settingData = await settingRes.json();
          setSettings(settingData.settings || []);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setFormError('Không thể tải dữ liệu.');
      } finally {
        setIsLoadingLenhSx(false);
        setIsLoadingStaff(false);
      }
    };

    loadData();
  }, []);

  const handleDateChange = (v: string) => {
    setSelectedDate(v);
    setSelectedShift('');
    setSelectedOrderCode('');
    setPersonnel(createDefaultPersonnelList());
    setFormError('');
    setSuccessMessage('');
  };

  const handleShiftChange = (v: string) => {
    setSelectedShift(v);
    setSelectedOrderCode('');
    setPersonnel(createDefaultPersonnelList());
    setFormError('');
    setSuccessMessage('');
  };

  const handleOrderChange = (v: string) => {
    setSelectedOrderCode(v);

    // Tìm lệnh SX được chọn và load phân công nhân sự cũ nếu có
    const selectedOrder = lenhSxRows.find(r => r.ma_lenh_sx === v && r.ngay_bat_dau === selectedDate && r.ca === selectedShift);
    if (selectedOrder) {
      try {
        const phanCong = JSON.parse(selectedOrder.phan_cong_nhan_su || '[]');
        if (Array.isArray(phanCong) && phanCong.length > 0) {
          setPersonnel(phanCong);
        } else {
          setPersonnel(createDefaultPersonnelList());
        }
      } catch {
        setPersonnel(createDefaultPersonnelList());
      }
    } else {
      setPersonnel(createDefaultPersonnelList());
    }

    setFormError('');
    setSuccessMessage('');
  };

  const handleSubmit = async () => {
    if (!selectedOrderCode) {
      setFormError('Vui lòng chọn lệnh sản xuất.');
      return;
    }

    const selectedOrder = lenhSxRows.find(r => r.ma_lenh_sx === selectedOrderCode && r.ngay_bat_dau === selectedDate && r.ca === selectedShift);
    if (!selectedOrder) {
      setFormError('Không tìm thấy lệnh sản xuất được chọn.');
      return;
    }

    setIsSaving(true);
    setFormError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/lenh-sx/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phan_cong_nhan_su: JSON.stringify(personnel)
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể cập nhật phân công nhân sự.');
      }

      setSuccessMessage(`Đã cập nhật phân công nhân sự cho lệnh ${selectedOrderCode}.`);

      // Reload dữ liệu
      const lenhRes = await fetch('/api/lenh-sx');
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
    } catch (error: any) {
      setFormError(error.message || 'Không thể cập nhật phân công nhân sự.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4 overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Phân công nhân sự</h3>
          <p className="mt-0.5 text-xs font-semibold text-zinc-500">Chọn ngày, ca và lệnh sản xuất để phân công nhân sự</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Quay lại
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="space-y-4 pb-4">
          {/* Thông báo lỗi */}
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {formError}
            </div>
          )}

          {/* Thông báo thành công */}
          {successMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
              ✓ {successMessage}
            </div>
          )}

          {/* Chọn ngày */}
          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày làm việc *</span>
            <select
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              disabled={isLoadingLenhSx}
              className={orderFieldClass}
            >
              <option value="">{isLoadingLenhSx ? 'Đang tải...' : 'Chọn ngày'}</option>
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>

          {/* Chọn ca */}
          {selectedDate && (
            <label className="block space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ca làm việc *</span>
              <select
                value={selectedShift}
                onChange={e => handleShiftChange(e.target.value)}
                disabled={isLoadingLenhSx || availableShifts.length === 0}
                className={orderFieldClass}
              >
                <option value="">Chọn ca</option>
                {availableShifts.map(shift => (
                  <option key={shift} value={shift}>
                    {shift}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Chọn lệnh SX */}
          {selectedShift && (
            <label className="block space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Lệnh sản xuất *</span>
              <select
                value={selectedOrderCode}
                onChange={e => handleOrderChange(e.target.value)}
                disabled={isLoadingLenhSx || availableOrders.length === 0}
                className={orderFieldClass}
              >
                <option value="">Chọn lệnh sản xuất</option>
                {availableOrders.map(code => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Phân công nhân sự */}
          {selectedOrderCode && (
            <PersonnelAssignmentBlock
              items={personnel}
              staffOptions={workshopStaff}
              isLoadingStaff={isLoadingStaff}
              shiftOptions={shiftOptions}
              shiftSettings={settings}
              onChange={(id, patch) => {
                setPersonnel(prev =>
                  prev.map(item => (item.id === id ? { ...item, ...patch } : item))
                );
              }}
              onAdd={() => {
                setPersonnel(prev => addPersonnelEntry(prev));
              }}
              onRemove={(id) => {
                setPersonnel(prev => removePersonnelEntry(prev, id));
              }}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      {selectedOrderCode && (
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="h-10 rounded-xl border border-zinc-200 px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu phân công'}
          </button>
        </div>
      )}
    </div>
  );
}
