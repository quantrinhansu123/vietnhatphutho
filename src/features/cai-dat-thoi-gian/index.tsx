import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage, formatCell, formatTimeCell } from '../_shared/recordHelpers';
import { orderFieldClass } from '../_shared/orderHelpers';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { normalizeHrBranches, type HrBranch, type HrMember } from '../_shared/hr';
import { StaffViewPermissionsPicker } from '../nhan-su';
import type { StaffViewPermissions } from '../nhan-su/menuViews';
import { summarizeStaffViewPermissions } from '../nhan-su/menuViews';
import { buildPermissionKey, parsePermissionSettings } from './permissionKeys';
import {
  ChevronRight,
  Clock3,
  Eye,
  KeyRound,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2
} from 'lucide-react';

export interface SettingRow {
  id: string;
  code: string;
  name: string;
  loaiCaiDat: string;
  timeFrame: string;
  startTime: string;
  endTime: string;
  group: string;
  note: string;
}

export function normalizeSettings(data: unknown): SettingRow[] {
  if (!data || typeof data !== 'object') return [];
  const settings = (data as { settings?: unknown }).settings;
  if (!Array.isArray(settings)) return [];

  return settings
    .map((item): SettingRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = pickText(record, ['ma_cai_dat', 'ma', 'key', 'code'], '');
      const name = pickText(record, ['ten_cai_dat', 'hang_muc', 'ten', 'name', 'tieu_de'], '');
      const startTime = formatTimeCell(
        record.gio_bat_dau ?? record.thoi_gian_bat_dau ?? record.start_time ?? record.gio_bd
      );
      let endTime = formatTimeCell(
        record.gio_ket_thuc ?? record.thoi_gian_ket_thuc ?? record.end_time ?? record.gio_kt
      );
      if (startTime === '-' || endTime === '-') {
        const legacyValue = formatCell(record.gia_tri);
        if (legacyValue !== '-') {
          const parts = legacyValue.split(/\s*[-–—]\s*|\s+đến\s+/i).map(part => part.trim()).filter(Boolean);
          if (parts[0]) {
            const parsedStart = formatTimeCell(parts[0]);
            if (parsedStart !== '-') {
              const parsedEnd = parts[1] ? formatTimeCell(parts[1]) : '-';
              return {
                id: pickText(record, ['id'], code || name),
                code,
                name,
                loaiCaiDat: pickText(record, ['loai_cai_dat', 'loai'], '-'),
                timeFrame: pickText(record, ['khung_gio'], '-'),
                startTime: startTime === '-' ? parsedStart : startTime,
                endTime: endTime === '-' ? parsedEnd : endTime,
                group: pickText(record, ['nhom', 'group', 'phan_loai'], '-'),
                note: pickText(record, ['mo_ta', 'ghi_chu', 'note', 'description'], '')
              };
            }
          }
        }
      }
      if (!code && !name && startTime === '-' && endTime === '-') return null;

      return {
        id: pickText(record, ['id'], code || name),
        code,
        name,
        loaiCaiDat: pickText(record, ['loai_cai_dat', 'loai'], '-'),
        timeFrame: pickText(record, ['khung_gio'], '-'),
        startTime,
        endTime,
        group: pickText(record, ['nhom', 'group', 'phan_loai'], '-'),
        note: pickText(record, ['mo_ta', 'ghi_chu', 'note', 'description'], '')
      };
    })
    .filter((setting): setting is SettingRow => Boolean(setting));
}

export const SETTING_TYPE_OPTIONS = ['Thời gian', 'Ca máy', 'Sản xuất', 'Chung'] as const;

export type SettingFormState = {
  code: string;
  name: string;
  loaiCaiDat: string;
  startTime: string;
  endTime: string;
  group: string;
  note: string;
};

function sanitize24HourTimeInput(value: string) {
  if (value.includes(':')) {
    const [hours = '', minutes = ''] = value.split(':');
    return `${hours.replace(/\D/g, '').slice(0, 2)}:${minutes.replace(/\D/g, '').slice(0, 2)}`;
  }
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function isValid24HourTime(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

const emptySettingForm = (): SettingFormState => ({
  code: '',
  name: '',
  loaiCaiDat: SETTING_TYPE_OPTIONS[0],
  startTime: '',
  endTime: '',
  group: 'Chung',
  note: ''
});

export function settingToForm(setting: SettingRow): SettingFormState {
  const loaiCaiDat = (SETTING_TYPE_OPTIONS as readonly string[]).includes(setting.loaiCaiDat)
    ? setting.loaiCaiDat
    : SETTING_TYPE_OPTIONS[0];

  return {
    code: setting.code === '-' ? '' : setting.code,
    name: setting.name === '-' ? '' : setting.name,
    loaiCaiDat,
    startTime: setting.startTime === '-' ? '' : setting.startTime,
    endTime: setting.endTime === '-' ? '' : setting.endTime,
    group: setting.group === '-' ? 'Chung' : setting.group,
    note: setting.note === '-' ? '' : setting.note
  };
}

export function SettingsPanel({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [branches, setBranches] = useState<HrBranch[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [activeSection, setActiveSection] = useState<'settings' | 'permissions'>('settings');
  const [permissionSection, setPermissionSection] = useState<'keys' | 'menus'>('keys');
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingSetting, setViewingSetting] = useState<SettingRow | null>(null);
  const [deletingSettingId, setDeletingSettingId] = useState<string | null>(null);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [settingForm, setSettingForm] = useState<SettingFormState>(emptySettingForm);
  const [permissionForm, setPermissionForm] = useState<{
    id: string;
    department: string;
    position: string;
    viewPermissions: StaffViewPermissions;
  }>({
    id: '',
    department: '',
    position: '',
    viewPermissions: []
  });
  const [isSavingPermission, setIsSavingPermission] = useState(false);
  const [deletingPermissionId, setDeletingPermissionId] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [permissionMessage, setPermissionMessage] = useState('');
  const [isLoadingStaffOptions, setIsLoadingStaffOptions] = useState(true);
  const [staffOptionsError, setStaffOptionsError] = useState('');

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    setSettingsError('');

    try {
      const res = await fetch('/api/cai-dat');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải cài đặt từ Supabase.');
      }

      setSettings(normalizeSettings(data));
    } catch (error: any) {
      setSettings([]);
      setSettingsError(error.message || 'Không thể tải cài đặt từ Supabase.');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const loadStaffGroups = async () => {
      setIsLoadingStaffOptions(true);
      setStaffOptionsError('');
      try {
        const res = await fetch('/api/nhan-su?format=groups&scope=all');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải phòng ban / vị trí từ nhan_su.');
        }
        setBranches(normalizeHrBranches(data));
      } catch (error: any) {
        setBranches([]);
        setStaffOptionsError(error.message || 'Không thể tải phòng ban / vị trí từ nhan_su.');
      } finally {
        setIsLoadingStaffOptions(false);
      }
    };

    void loadStaffGroups();
  }, []);

  const openAddForm = () => {
    setFormError('');
    setActionMessage('');
    setEditingId(null);
    setSettingForm(emptySettingForm());
    setFormMode('add');
  };

  const openEditForm = (setting: SettingRow) => {
    setFormError('');
    setActionMessage('');
    setViewingSetting(null);
    setEditingId(setting.id);
    setSettingForm(settingToForm(setting));
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError('');
  };

  const validateSettingForm = () => {
    if (!settingForm.code.trim()) {
      setFormError('Vui lòng nhập mã cài đặt.');
      return false;
    }
    if (!settingForm.name.trim()) {
      setFormError('Vui lòng nhập hạng mục / tên cài đặt.');
      return false;
    }
    if (!settingForm.loaiCaiDat.trim()) {
      setFormError('Vui lòng chọn loại cài đặt (loai_cai_dat).');
      return false;
    }
    if (!isValid24HourTime(settingForm.startTime)) {
      setFormError('Giờ bắt đầu phải đúng định dạng 24 giờ HH:mm (00:00–23:59).');
      return false;
    }
    if (!isValid24HourTime(settingForm.endTime)) {
      setFormError('Giờ kết thúc phải đúng định dạng 24 giờ HH:mm (00:00–23:59).');
      return false;
    }
    return true;
  };

  const handleSaveSetting = async () => {
    if (!validateSettingForm()) return;

    setIsSavingSetting(true);
    setFormError('');

    try {
      const payload = {
        ...settingForm,
        khungGio: `${settingForm.startTime} - ${settingForm.endTime}`
      };
      const isEdit = formMode === 'edit' && editingId;
      const res = await fetch(isEdit ? `/api/cai-dat/${editingId}` : '/api/cai-dat', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (isEdit ? 'Không thể cập nhật cài đặt.' : 'Không thể thêm cài đặt mới.'));
      }

      closeForm();
      setActionMessage(isEdit ? 'Đã cập nhật cài đặt.' : 'Đã thêm cài đặt mới.');
      await loadSettings();
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu cài đặt.');
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleDeleteSetting = async (setting: SettingRow) => {
    if (!setting.id) {
      setActionMessage('Không tìm thấy ID để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa cài đặt "${setting.name || setting.code}"?`)) return;

    setDeletingSettingId(setting.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/cai-dat/${setting.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa cài đặt.');
      }

      if (viewingSetting?.id === setting.id) setViewingSetting(null);
      setActionMessage('Đã xóa cài đặt.');
      await loadSettings();
    } catch (error: any) {
      setActionMessage(error.message || 'Không thể xóa cài đặt.');
    } finally {
      setDeletingSettingId(null);
    }
  };

  const settingGroups = useMemo(() => {
    const groups = settings
      .map(setting => setting.group)
      .filter((group): group is string => group !== '-' && group.length > 0);
    return ['all', ...[...new Set(groups)].sort((a, b) => String(a).localeCompare(String(b), 'vi'))];
  }, [settings]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredSettings = useMemo(() => {
    return settings.filter(setting => {
      const permissionText = `${setting.group} ${setting.loaiCaiDat}`.toLowerCase();
      const isPermissionSetting = permissionText.includes('phân quyền') || permissionText.includes('phan quyen');
      if (isPermissionSetting) return false;
      const matchesGroup = selectedGroup === 'all' || setting.group === selectedGroup;
      const matchesSearch =
        !normalizedSearch ||
        `${setting.code} ${setting.name} ${setting.loaiCaiDat} ${setting.timeFrame} ${setting.startTime} ${setting.endTime} ${setting.group} ${setting.note}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesGroup && matchesSearch;
    });
  }, [normalizedSearch, selectedGroup, settings]);

  const permissionSettings = useMemo(
    () =>
      parsePermissionSettings(
        settings.map(setting => ({
          id: setting.id,
          code: setting.code,
          name: setting.name,
          loaiCaiDat: setting.loaiCaiDat,
          group: setting.group,
          note: setting.note
        }))
      ),
    [settings]
  );

  // Phòng ban = distinct phong_ban từ bảng nhan_su
  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    branches.forEach(branch =>
      branch.departments.forEach(department => {
        const name = department.name.trim();
        if (name && name !== 'Chưa phân phòng ban') names.add(name);
      })
    );
    return [...names].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [branches]);

  // Vị trí = distinct cong_viec (role) từ nhan_su, theo phòng ban đang chọn
  const positionOptions = useMemo(() => {
    const names = new Set<string>();
    branches.forEach(branch =>
      branch.departments.forEach(department => {
        if (permissionForm.department && department.name !== permissionForm.department) return;
        department.members.forEach(member => {
          const position = (member.role || member.position || '').trim();
          if (position) names.add(position);
        });
      })
    );
    if (names.size === 0) {
      branches.forEach(branch =>
        branch.departments.forEach(department => {
          department.members.forEach(member => {
            const position = (member.role || member.position || '').trim();
            if (position) names.add(position);
          });
        })
      );
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [branches, permissionForm.department]);

  useEffect(() => {
    if (!permissionForm.department && departmentOptions[0]) {
      setPermissionForm(prev => ({ ...prev, department: departmentOptions[0] }));
    }
  }, [departmentOptions, permissionForm.department]);

  useEffect(() => {
    if (!permissionForm.position) {
      if (positionOptions[0]) {
        setPermissionForm(prev => ({ ...prev, position: positionOptions[0] }));
      }
      return;
    }
    if (positionOptions.length > 0 && !positionOptions.includes(permissionForm.position)) {
      setPermissionForm(prev => ({ ...prev, position: positionOptions[0] || '' }));
    }
  }, [positionOptions, permissionForm.position]);

  const currentPermissionKey = buildPermissionKey(permissionForm.department, permissionForm.position);

  const handleSelectPermission = (permissionId: string) => {
    const selected = permissionSettings.find(item => item.id === permissionId);
    if (!selected) return;
    setPermissionForm({
      id: selected.id,
      department: selected.department,
      position: selected.position,
      viewPermissions: selected.viewPermissions
    });
    setPermissionError('');
    setPermissionMessage('');
  };

  const resetPermissionForm = () => {
    setPermissionForm({
      id: '',
      department: departmentOptions[0] || '',
      position: '',
      viewPermissions: []
    });
    setPermissionError('');
    setPermissionMessage('');
  };

  const handleSavePermission = async () => {
    if (!permissionForm.department.trim()) {
      setPermissionError('Vui lòng chọn phòng ban.');
      return;
    }
    if (!permissionForm.position.trim()) {
      setPermissionError('Vui lòng chọn vị trí.');
      return;
    }

    setIsSavingPermission(true);
    setPermissionError('');
    setPermissionMessage('');

    try {
      const existed = permissionSettings.find(
        item =>
          item.permissionKey === currentPermissionKey &&
          (!permissionForm.id || permissionForm.id !== item.id)
      );
      const targetId = permissionForm.id || existed?.id || '';
      const payload = {
        code: `PERM_KEY_${currentPermissionKey}`,
        name: `${permissionForm.department} - ${permissionForm.position}`,
        loaiCaiDat: 'Phân quyền',
        startTime: '00:00',
        endTime: '00:00',
        group: 'Phân quyền',
        note: JSON.stringify({
          department: permissionForm.department,
          position: permissionForm.position,
          permissionKey: currentPermissionKey,
          viewPermissions: permissionForm.viewPermissions
        })
      };
      const res = await fetch(targetId ? `/api/cai-dat/${targetId}` : '/api/cai-dat', {
        method: targetId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu key phân quyền.');
      }
      setPermissionMessage(targetId ? 'Đã cập nhật key phân quyền.' : 'Đã tạo key phân quyền.');
      await loadSettings();
      if (!targetId) {
        setPermissionForm(prev => ({ ...prev, id: '' }));
      }
    } catch (error: any) {
      setPermissionError(error.message || 'Không thể lưu key phân quyền.');
    } finally {
      setIsSavingPermission(false);
    }
  };

  const handleDeletePermission = async (permissionId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa key phân quyền này?')) return;
    setDeletingPermissionId(permissionId);
    setPermissionError('');
    setPermissionMessage('');
    try {
      const res = await fetch(`/api/cai-dat/${permissionId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa key phân quyền.');
      }
      if (permissionForm.id === permissionId) resetPermissionForm();
      setPermissionMessage('Đã xóa key phân quyền.');
      await loadSettings();
    } catch (error: any) {
      setPermissionError(error.message || 'Không thể xóa key phân quyền.');
    } finally {
      setDeletingPermissionId('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa cài đặt' : 'Thêm cài đặt mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            {formError && (
              <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 p-4">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã cài đặt *</span>
                <input
                  value={settingForm.code}
                  onChange={e => setSettingForm(prev => ({ ...prev, code: e.target.value }))}
                  className={orderFieldClass}
                  placeholder="VD: TG_CA_SANG"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Hạng mục *</span>
                <input
                  value={settingForm.name}
                  onChange={e => setSettingForm(prev => ({ ...prev, name: e.target.value }))}
                  className={orderFieldClass}
                  placeholder="VD: Ca sáng"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Loại cài đặt *</span>
                <SearchableSelect
                  value={settingForm.loaiCaiDat}
                  onChange={loaiCaiDat => setSettingForm(prev => ({ ...prev, loaiCaiDat }))}
                  options={[...SETTING_TYPE_OPTIONS]}
                  placeholder="Gõ để tìm loại cài đặt"
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  allowEmpty={false}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Giờ bắt đầu *</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={settingForm.startTime}
                  onChange={e =>
                    setSettingForm(prev => ({ ...prev, startTime: sanitize24HourTimeInput(e.target.value) }))
                  }
                  className={orderFieldClass}
                  placeholder="00:00"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Giờ kết thúc *</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={settingForm.endTime}
                  onChange={e =>
                    setSettingForm(prev => ({ ...prev, endTime: sanitize24HourTimeInput(e.target.value) }))
                  }
                  className={orderFieldClass}
                  placeholder="23:59"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nhóm</span>
                <input
                  value={settingForm.group}
                  onChange={e => setSettingForm(prev => ({ ...prev, group: e.target.value }))}
                  className={orderFieldClass}
                  placeholder="VD: Thời gian"
                />
              </label>
              <label className="col-span-2 space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
                <input
                  value={settingForm.note}
                  onChange={e => setSettingForm(prev => ({ ...prev, note: e.target.value }))}
                  className={orderFieldClass}
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveSetting}
                disabled={isSavingSetting}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingSetting ? 'Đang lưu...' : formMode === 'edit' ? 'Cập nhật' : 'Lưu cài đặt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingSetting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết cài đặt</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">{viewingSetting.code || viewingSetting.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingSetting(null)}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              {[
                ['Mã cài đặt', viewingSetting.code],
                ['Hạng mục', viewingSetting.name],
                ['Loại cài đặt', viewingSetting.loaiCaiDat],
                ['Khung giờ', viewingSetting.timeFrame !== '-' ? viewingSetting.timeFrame : `${viewingSetting.startTime} - ${viewingSetting.endTime}`],
                ['Giờ bắt đầu', viewingSetting.startTime],
                ['Giờ kết thúc', viewingSetting.endTime],
                ['Nhóm', viewingSetting.group],
                ['Ghi chú', viewingSetting.note || '-']
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 font-bold text-zinc-900">{value || '-'}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={() => openEditForm(viewingSetting)}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100"
              >
                <Pencil className="h-4 w-4" />
                Sửa
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSetting(viewingSetting)}
                disabled={deletingSettingId === viewingSetting.id}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingSettingId === viewingSetting.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveSection('settings')}
          aria-pressed={activeSection === 'settings'}
          className={`group flex min-h-28 items-center gap-4 rounded-2xl border-2 p-4 text-left shadow-sm transition ${
            activeSection === 'settings'
              ? 'border-[#ef1b2d] bg-red-50 shadow-red-100'
              : 'border-zinc-900/10 bg-white hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md'
          }`}
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            activeSection === 'settings' ? 'bg-[#ef1b2d] text-white' : 'bg-zinc-100 text-zinc-700'
          }`}>
            <Clock3 className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black text-zinc-950">Cài đặt hệ thống</span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-zinc-500">
              Quản lý ca máy, thời gian và các tham số vận hành.
            </span>
          </span>
          <ChevronRight className={`h-5 w-5 shrink-0 transition ${
            activeSection === 'settings' ? 'text-[#ef1b2d]' : 'text-zinc-300 group-hover:text-zinc-600'
          }`} />
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('permissions')}
          aria-pressed={activeSection === 'permissions'}
          className={`group flex min-h-28 items-center gap-4 rounded-2xl border-2 p-4 text-left shadow-sm transition ${
            activeSection === 'permissions'
              ? 'border-[#ef1b2d] bg-red-50 shadow-red-100'
              : 'border-zinc-900/10 bg-white hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md'
          }`}
        >
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            activeSection === 'permissions' ? 'bg-[#ef1b2d] text-white' : 'bg-zinc-100 text-zinc-700'
          }`}>
            <ShieldCheck className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black text-zinc-950">Phân quyền</span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-zinc-500">
              Tạo key và cấp quyền truy cập menu theo phòng ban, vị trí.
            </span>
          </span>
          <ChevronRight className={`h-5 w-5 shrink-0 transition ${
            activeSection === 'permissions' ? 'text-[#ef1b2d]' : 'text-zinc-300 group-hover:text-zinc-600'
          }`} />
        </button>
      </section>

      {activeSection === 'settings' ? (
        <>
      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {settingGroups.map(group => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedGroup === group
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {group === 'all' ? 'Tất cả' : group}
            </button>
          ))}
          {isLoadingSettings && (
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500">
              Đang tải Supabase...
            </div>
          )}
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:mt-0 lg:w-[420px]">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm mã, tên, giá trị cài đặt..."
            disabled={isLoadingSettings}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={openAddForm}
          className="mt-3 flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] lg:mt-0"
        >
          <Plus className="h-4 w-4" />
          Thêm mới
        </button>

        {settingsError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {settingsError}
          </p>
        )}

        {actionMessage && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 lg:mt-0">
            {actionMessage}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã</th>
                <th className="px-4 py-3 font-black">Tên cài đặt</th>
                <th className="px-4 py-3 font-black">Loại</th>
                <th className="px-4 py-3 font-black">Giờ bắt đầu</th>
                <th className="px-4 py-3 font-black">Giờ kết thúc</th>
                <th className="px-4 py-3 font-black">Nhóm</th>
                <th className="px-4 py-3 font-black">Ghi chú</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredSettings.map(setting => (
                <tr key={setting.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{setting.code || '-'}</td>
                  <td className="px-4 py-3 font-black text-zinc-950">{setting.name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-black text-zinc-800">
                      {setting.loaiCaiDat}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {setting.startTime}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-black text-zinc-800">
                      {setting.endTime}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{setting.group}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-500">{setting.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingSetting(setting)}
                        title="Xem"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(setting)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSetting(setting)}
                        disabled={deletingSettingId === setting.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingSettingId === setting.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoadingSettings && filteredSettings.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng cai_dat_thoi_gian chưa có dữ liệu hoặc không có mục phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
        </>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPermissionSection('keys')}
                aria-pressed={permissionSection === 'keys'}
                className={`flex min-h-20 items-center gap-3 rounded-2xl border-2 p-4 text-left shadow-sm transition ${
                  permissionSection === 'keys'
                    ? 'border-[#ef1b2d] bg-red-50'
                    : 'border-zinc-900/10 bg-white hover:border-zinc-300 hover:shadow-md'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  permissionSection === 'keys' ? 'bg-[#ef1b2d] text-white' : 'bg-zinc-100 text-zinc-700'
                }`}>
                  <KeyRound className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-black text-zinc-950">Key phân quyền</span>
                  <span className="mt-0.5 block text-xs font-semibold text-zinc-500">Tạo và quản lý key truy cập.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPermissionSection('menus')}
                aria-pressed={permissionSection === 'menus'}
                className={`flex min-h-20 items-center gap-3 rounded-2xl border-2 p-4 text-left shadow-sm transition ${
                  permissionSection === 'menus'
                    ? 'border-[#ef1b2d] bg-red-50'
                    : 'border-zinc-900/10 bg-white hover:border-zinc-300 hover:shadow-md'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  permissionSection === 'menus' ? 'bg-[#ef1b2d] text-white' : 'bg-zinc-100 text-zinc-700'
                }`}>
                  <LayoutGrid className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-black text-zinc-950">Menu được truy cập</span>
                  <span className="mt-0.5 block text-xs font-semibold text-zinc-500">Chọn các khu vực key được phép xem.</span>
                </span>
              </button>
          </section>

          <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Key phân quyền</h3>
                  <p className="mt-1 text-xs font-semibold text-zinc-500">Ghép `Phòng ban + Vị trí` thành 1 key.</p>
                </div>
                <button
                  type="button"
                  onClick={resetPermissionForm}
                  className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Tạo mới
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Phòng ban</span>
                  <select
                    value={permissionForm.department}
                    onChange={event =>
                      setPermissionForm(prev => ({
                        ...prev,
                        id: '',
                        department: event.target.value,
                        position: '',
                        viewPermissions: prev.id ? [] : prev.viewPermissions
                      }))
                    }
                    disabled={isLoadingStaffOptions || departmentOptions.length === 0}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10 disabled:bg-zinc-50 disabled:text-zinc-400"
                  >
                    {departmentOptions.length === 0 ? (
                      <option value="">
                        {isLoadingStaffOptions ? 'Đang tải từ nhan_su...' : 'Chưa có phòng ban'}
                      </option>
                    ) : (
                      departmentOptions.map(department => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Vị trí</span>
                  <select
                    value={permissionForm.position}
                    onChange={event =>
                      setPermissionForm(prev => ({ ...prev, id: '', position: event.target.value }))
                    }
                    disabled={isLoadingStaffOptions || positionOptions.length === 0}
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-[#ef1b2d]/10 disabled:bg-zinc-50 disabled:text-zinc-400"
                  >
                    {positionOptions.length === 0 ? (
                      <option value="">
                        {isLoadingStaffOptions ? 'Đang tải từ nhan_su...' : 'Chưa có vị trí / chức vụ'}
                      </option>
                    ) : (
                      positionOptions.map(position => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {staffOptionsError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    {staffOptionsError}
                  </p>
                )}
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Key tạo ra</p>
                  <p className="mt-1 break-all text-sm font-black text-[#ef1b2d]">{currentPermissionKey || '-'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-zinc-500">
                    Nguồn: `phong_ban` + `cong_viec` từ bảng nhan_su
                  </p>
                </div>
                {permissionError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    {permissionError}
                  </p>
                )}
                {permissionMessage && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    {permissionMessage}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSavePermission}
                  disabled={isSavingPermission}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
                >
                  {isSavingPermission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSavingPermission ? 'Đang lưu...' : permissionForm.id ? 'Cập nhật key' : 'Lưu key'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full text-left text-sm">
                    <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
                      <tr>
                        <th className="px-4 py-3 font-black">Phòng ban</th>
                        <th className="px-4 py-3 font-black">Vị trí</th>
                        <th className="px-4 py-3 font-black">Key</th>
                        <th className="px-4 py-3 font-black">Menu đã cấp</th>
                        <th className="px-4 py-3 text-center font-black">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {permissionSettings.map(item => (
                        <tr
                          key={item.id}
                          className={`transition ${permissionForm.id === item.id ? 'bg-red-50/70' : 'hover:bg-red-50/40'}`}
                        >
                          <td className="px-4 py-3 font-semibold text-zinc-900">{item.department}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-700">{item.position}</td>
                          <td className="px-4 py-3 font-black text-[#ef1b2d]">{item.permissionKey}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-zinc-600">
                            {summarizeStaffViewPermissions(item.viewPermissions)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSelectPermission(item.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                                title="Chọn"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePermission(item.id)}
                                disabled={deletingPermissionId === item.id}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                title="Xóa"
                              >
                                {deletingPermissionId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!isLoadingSettings && permissionSettings.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center font-bold text-zinc-500">
                            Chưa có key phân quyền nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {permissionSection === 'menus' && (
                <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-4 shadow-sm">
                  <div className="mb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Menu được truy cập</h3>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      Chọn menu cha và menu con được phép xem cho key hiện tại.
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-700">
                    Đang cấu hình: <span className="font-black text-zinc-950">{permissionForm.department || '-'}</span>
                    {' / '}
                    <span className="font-black text-zinc-950">{permissionForm.position || '-'}</span>
                    {' / '}
                    <span className="font-black text-[#ef1b2d]">{currentPermissionKey || '-'}</span>
                  </div>
                  <StaffViewPermissionsPicker
                    value={permissionForm.viewPermissions}
                    onChange={viewPermissions => setPermissionForm(prev => ({ ...prev, viewPermissions }))}
                  />
                </section>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function flattenHrMembers(branches: HrBranch[]): HrMember[] {
  return branches.flatMap(branch => branch.departments.flatMap(department => department.members));
}

export function getHrDepartmentMembers(branches: HrBranch[], departmentName: string): HrMember[] {
  const needle = departmentName.trim().toLowerCase();
  if (!needle) return [];

  const members: HrMember[] = [];
  const seen = new Set<string>();

  branches.forEach(branch => {
    branch.departments.forEach(department => {
      if (!department.name.toLowerCase().includes(needle)) return;
      department.members.forEach(member => {
        const key = member.name.trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        members.push(member);
      });
    });
  });

  return members.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function parseProductionOrderFilterDate(value: string): string {
  const raw = String(value || '').trim();
  if (!raw || raw === '-') return '';
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function splitProductionOrderStaffNames(value: string): string[] {
  return String(value || '')
    .split(/[,;+]/)
    .map(name => name.trim())
    .filter(name => name && name !== '-');
}

