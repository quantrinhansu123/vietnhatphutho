import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';
import { CAMERA_IMAGE_INPUT_PROPS } from '../../utils/cameraCapture';
import { SearchableSelect } from '../../components/shared/SearchableSelect';

export interface MachineRow {
  id: string;
  code: string;
  name: string;
  type: string;
  branch: string;
  location: string;
  status: string;
  note: string;
  imageUrl?: string;
  imagePublicId?: string;
}

export function normalizeMachines(data: unknown): MachineRow[] {
  if (!data || typeof data !== 'object') return [];
  const machines = (data as { machines?: unknown }).machines;
  if (!Array.isArray(machines)) return [];

  return machines
    .map((item): MachineRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = pickText(record, ['ma_may', 'ma_so_may', 'machine_code', 'code', 'id'], '');
      const name = pickText(record, ['ten_may', 'may', 'machine_name', 'name'], '');
      if (!code && !name) return null;

      return {
        id: pickText(record, ['id'], code || name),
        code,
        name,
        type: pickText(record, ['loai_may', 'nhom_may', 'type', 'category'], 'Chưa phân loại'),
        branch: pickText(record, ['chi_nhanh', 'co_so', 'branch'], '-'),
        location: pickText(record, ['vi_tri', 'khu_vuc', 'location', 'line'], '-'),
        status: pickText(record, ['trang_thai', 'status', 'tinh_trang'], 'Đang dùng'),
        note: pickText(record, ['ghi_chu', 'mo_ta', 'note', 'description'], ''),
        imageUrl: pickText(record, ['anh_url', 'hinh_anh_url', 'image_url', 'imageUrl'], ''),
        imagePublicId: pickText(record, ['anh_public_id', 'image_public_id', 'imagePublicId'], '')
      };
    })
    .filter((machine): machine is MachineRow => Boolean(machine));
}

export function findMachineByRef(machines: MachineRow[], ref: string): MachineRow | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  return (
    machines.find(machine => machine.code === trimmed) ??
    machines.find(machine => machine.name === trimmed) ??
    machines.find(machine => `${machine.code} · ${machine.name}` === trimmed) ??
    null
  );
}

export function machineSelectLabel(machine: MachineRow): string {
  const name = machine.name?.trim();
  if (name && name !== '-') return name;
  const code = machine.code?.trim();
  if (code && code !== '-') return code;
  return '';
}

export function machineSelectValue(machine: MachineRow): string {
  return machineSelectLabel(machine);
}

export function resolveMachineDisplayValue(machineRef: string, machines: MachineRow[] = []): string {
  const trimmed = machineRef.trim();
  if (!trimmed || trimmed === '-') return '';
  const match = findMachineByRef(machines, trimmed);
  return match ? machineSelectValue(match) : trimmed;
}

export function buildMachineSelectOptions(machines: MachineRow[], currentValue = ''): MachineRow[] {
  const normalized = resolveMachineDisplayValue(currentValue, machines) || currentValue.trim();
  if (!normalized) return machines;

  if (findMachineByRef(machines, normalized) || findMachineByRef(machines, currentValue)) {
    return machines;
  }

  return [
    {
      id: `custom-${normalized}`,
      code: normalized,
      name: normalized,
      type: '-',
      branch: '-',
      location: '-',
      status: '-',
      note: ''
    },
    ...machines
  ];
}

export function renderMachineSelect(
  value: string,
  onChange: (machine: string) => void,
  machines: MachineRow[],
  options?: { disabled?: boolean; placeholder?: string; isLoading?: boolean; inputClassName?: string }
) {
  const machineOptions = buildMachineSelectOptions(machines, value);
  const displayValue = resolveMachineDisplayValue(value, machines) || value;

  return (
    <SearchableSelect
      value={displayValue}
      onChange={onChange}
      options={machineOptions}
      placeholder={options?.placeholder ?? 'Gõ để tìm máy'}
      disabled={options?.disabled}
      isLoading={options?.isLoading}
      inputClassName={options?.inputClassName}
      getLabel={item => machineSelectLabel(item as MachineRow)}
      getValue={item => machineSelectValue(item as MachineRow)}
      resolveSelectedItem={(opts, val) => findMachineByRef(opts as MachineRow[], val)}
    />
  );
}

export type MachineFormState = {
  code: string;
  name: string;
  type: string;
  branch: string;
  location: string;
  status: string;
  note: string;
};

const emptyMachineForm = (): MachineFormState => ({
  code: '',
  name: '',
  type: '',
  branch: 'Đà Nẵng',
  location: '',
  status: 'Đang dùng',
  note: ''
});

export function machineCellToInput(value: string) {
  return value === '-' ? '' : value;
}

export function machineToForm(machine: MachineRow): MachineFormState {
  return {
    code: machineCellToInput(machine.code),
    name: machineCellToInput(machine.name),
    type: machineCellToInput(machine.type === 'Chưa phân loại' ? '' : machine.type),
    branch: machineCellToInput(machine.branch),
    location: machineCellToInput(machine.location),
    status: machineCellToInput(machine.status) || 'Đang dùng',
    note: machineCellToInput(machine.note)
  };
}

const machineFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

export function MachinesPanel({ onBack }: { onBack: () => void }) {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [isLoadingMachines, setIsLoadingMachines] = useState(true);
  const [machineError, setMachineError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingMachineId, setDeletingMachineId] = useState<string | null>(null);
  const [isSavingMachine, setIsSavingMachine] = useState(false);
  const [uploadingMachineIds, setUploadingMachineIds] = useState<Set<string>>(() => new Set());
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [machineForm, setMachineForm] = useState<MachineFormState>(emptyMachineForm);
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState('');
  const [isUploadingFormImage, setIsUploadingFormImage] = useState(false);

  const resetFormImage = () => {
    setFormImageFile(null);
    setFormImagePreview('');
  };

  const saveMachineImage = async (machineId: string, file: File) => {
    const uploaded = await uploadImage(await fileToDataUrl(file));
    const res = await fetch(`/api/danh-sach-may/${encodeURIComponent(machineId)}/image`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uploaded)
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Không thể lưu ảnh cho máy.');
    }

    return uploaded;
  };

  const loadMachines = async () => {
    setIsLoadingMachines(true);
    setMachineError('');

    try {
      const res = await fetch('/api/danh-sach-may');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải danh sách máy từ Supabase.');
      }

      setMachines(normalizeMachines(data));
    } catch (error: any) {
      setMachines([]);
      setMachineError(error.message || 'Không thể tải danh sách máy từ Supabase.');
    } finally {
      setIsLoadingMachines(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const openAddForm = () => {
    setFormError('');
    setActionMessage('');
    setEditingId(null);
    setMachineForm(emptyMachineForm());
    resetFormImage();
    setFormMode('add');
  };

  const openEditForm = (machine: MachineRow) => {
    setFormError('');
    setActionMessage('');
    setEditingId(machine.id);
    setMachineForm(machineToForm(machine));
    setFormImageFile(null);
    setFormImagePreview(machine.imageUrl || '');
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError('');
    resetFormImage();
  };

  const handleFormImageChange = (file?: File | null) => {
    if (!file) return;
    setFormImageFile(file);
    setFormImagePreview(URL.createObjectURL(file));
  };

  const handleSaveMachine = async () => {
    if (!machineForm.code.trim() || !machineForm.name.trim()) {
      setFormError('Vui lòng nhập mã máy và tên máy.');
      return;
    }

    setIsSavingMachine(true);
    setFormError('');

    try {
      const isEdit = formMode === 'edit' && editingId;
      const res = await fetch(isEdit ? `/api/danh-sach-may/${editingId}` : '/api/danh-sach-may', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(machineForm)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (isEdit ? 'Không thể cập nhật máy.' : 'Không thể thêm máy mới.'));
      }

      const savedId = isEdit
        ? String(editingId)
        : String((data.machine as { id?: string | number } | undefined)?.id ?? '');

      if (formImageFile && savedId) {
        setIsUploadingFormImage(true);
        try {
          await saveMachineImage(savedId, formImageFile);
        } catch (error: any) {
          closeForm();
          setMachineError(error.message || 'Đã lưu máy nhưng không thể tải ảnh.');
          await loadMachines();
          return;
        } finally {
          setIsUploadingFormImage(false);
        }
      }

      closeForm();
      setActionMessage(
        formImageFile
          ? isEdit
            ? 'Đã cập nhật máy và tải ảnh.'
            : 'Đã thêm máy mới và tải ảnh.'
          : isEdit
            ? 'Đã cập nhật máy.'
            : 'Đã thêm máy mới.'
      );
      await loadMachines();
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu máy.');
    } finally {
      setIsSavingMachine(false);
    }
  };

  const handleDeleteMachine = async (machine: MachineRow) => {
    if (!machine.id) {
      setMachineError('Không tìm thấy ID để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa máy "${machine.code || machine.name}"?`)) return;

    setDeletingMachineId(machine.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/danh-sach-may/${machine.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa máy.');
      }

      setActionMessage('Đã xóa máy.');
      await loadMachines();
    } catch (error: any) {
      setMachineError(error.message || 'Không thể xóa máy.');
    } finally {
      setDeletingMachineId(null);
    }
  };

  const handleMachineImageUpload = async (machine: MachineRow, file?: File | null) => {
    if (!file) return;

    setMachineError('');
    setUploadingMachineIds(prev => {
      const next = new Set(prev);
      next.add(machine.id);
      return next;
    });

    try {
      const uploaded = await saveMachineImage(machine.id, file);

      setMachines(prev =>
        prev.map(item =>
          item.id === machine.id
            ? {
                ...item,
                imageUrl: uploaded.imageUrl,
                imagePublicId: uploaded.imagePublicId
              }
            : item
        )
      );
      setActionMessage(`Đã tải ảnh cho máy ${machine.code || machine.name}.`);
    } catch (error: any) {
      setMachineError(error.message || 'Không thể upload ảnh cho máy.');
    } finally {
      setUploadingMachineIds(prev => {
        const next = new Set(prev);
        next.delete(machine.id);
        return next;
      });
    }
  };

  const machineTypes = useMemo(
    () => ['all', ...Array.from(new Set(machines.map(machine => machine.type))).sort((a, b) => a.localeCompare(b, 'vi'))],
    [machines]
  );
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredMachines = useMemo(() => {
    return machines.filter(machine => {
      const matchesType = selectedType === 'all' || machine.type === selectedType;
      const matchesSearch =
        !normalizedSearch ||
        `${machine.code} ${machine.name} ${machine.type} ${machine.branch} ${machine.location} ${machine.status}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [machines, normalizedSearch, selectedType]);

  const branchCount = new Set(machines.map(machine => machine.branch).filter(branch => branch && branch !== '-')).size;
  const activeCount = machines.filter(machine => /đang|hoạt|active|dung|dùng/i.test(machine.status)).length;

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex items-start justify-end gap-3">
            <div className="hidden">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Thiết bị sản xuất</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Danh sách máy</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase danh_sach_may.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={openAddForm}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>

            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Máy', machines.length],
              ['Đang dùng', activeCount],
              ['Chi nhánh', branchCount]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa máy' : 'Thêm máy mới'}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng danh_sach_may trên Supabase</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã máy *</span>
                <input
                  value={machineForm.code}
                  onChange={e => setMachineForm(prev => ({ ...prev, code: e.target.value }))}
                  className={machineFieldClass}
                  placeholder="VD: MAY-01"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên máy *</span>
                <input
                  value={machineForm.name}
                  onChange={e => setMachineForm(prev => ({ ...prev, name: e.target.value }))}
                  className={machineFieldClass}
                  placeholder="VD: Máy đùn PE 01"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Loại/Nhóm</span>
                <input
                  value={machineForm.type}
                  onChange={e => setMachineForm(prev => ({ ...prev, type: e.target.value }))}
                  className={machineFieldClass}
                  placeholder="VD: Đùn PE"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Chi nhánh</span>
                <input
                  value={machineForm.branch}
                  onChange={e => setMachineForm(prev => ({ ...prev, branch: e.target.value }))}
                  className={machineFieldClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Vị trí</span>
                <input
                  value={machineForm.location}
                  onChange={e => setMachineForm(prev => ({ ...prev, location: e.target.value }))}
                  className={machineFieldClass}
                  placeholder="VD: Khu A"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Trạng thái</span>
                <SearchableSelect
                  value={machineForm.status}
                  onChange={status => setMachineForm(prev => ({ ...prev, status }))}
                  options={['Đang dùng', 'Bảo trì', 'Ngừng']}
                  placeholder="Gõ để tìm trạng thái"
                  inputClassName={machineFieldClass}
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  allowEmpty={false}
                />
              </label>
              <label className="col-span-2 space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
                <input
                  value={machineForm.note}
                  onChange={e => setMachineForm(prev => ({ ...prev, note: e.target.value }))}
                  className={machineFieldClass}
                />
              </label>

              <div className="col-span-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Hình ảnh máy</p>
                <p className="mt-1 text-[11px] font-semibold text-zinc-500">
                  Chụp ảnh bằng camera để upload lên Cloudinary và lưu vào cột anh_url trên Supabase.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {formImagePreview ? (
                    <a
                      href={formImagePreview}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-24 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white"
                    >
                      <img
                        src={formImagePreview}
                        alt="Xem trước ảnh máy"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Chưa chụp ảnh
                    </div>
                  )}

                  <label className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-700 transition hover:border-[#ef1b2d] hover:text-[#ef1b2d]">
                    <ImagePlus className="h-4 w-4" />
                    {formImageFile ? 'Chụp lại' : formImagePreview ? 'Chụp lại' : 'Chụp ảnh'}
                    <input
                      {...CAMERA_IMAGE_INPUT_PROPS}
                      className="hidden"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        handleFormImageChange(file);
                      }}
                    />
                  </label>

                  {formImageFile && (
                    <p className="text-xs font-semibold text-zinc-600">{formImageFile.name}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              {formError && (
                <p className="mr-auto text-xs font-bold text-rose-600">{formError}</p>
              )}
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveMachine}
                disabled={isSavingMachine || isUploadingFormImage}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingMachine || isUploadingFormImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingMachine || isUploadingFormImage
                  ? isUploadingFormImage
                    ? 'Đang tải ảnh...'
                    : 'Đang lưu...'
                  : formMode === 'edit'
                    ? 'Cập nhật'
                    : 'Lưu máy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {machineTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedType === type
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type}
            </button>
          ))}
          {isLoadingMachines && (
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
            placeholder="Tìm mã máy, tên máy, vị trí..."
            disabled={isLoadingMachines}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {machineError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {machineError}
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
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã máy</th>
                <th className="px-4 py-3 font-black">Tên máy</th>
                <th className="px-4 py-3 font-black">Hình ảnh</th>
                <th className="px-4 py-3 font-black">Loại/Nhóm</th>
                <th className="px-4 py-3 font-black">Chi nhánh</th>
                <th className="px-4 py-3 font-black">Vị trí</th>
                <th className="px-4 py-3 font-black">Trạng thái</th>
                <th className="px-4 py-3 font-black">Ghi chú</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMachines.map(machine => (
                <tr key={machine.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{machine.code || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-black text-zinc-950">
                      <Cpu className="h-4 w-4 text-[#ef1b2d]" />
                      {machine.name || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[220px] flex-col gap-2">
                      <div className="flex items-center gap-3">
                        {machine.imageUrl ? (
                          <a
                            href={machine.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                          >
                            <img src={machine.imageUrl} alt={`Ảnh ${machine.name || machine.code}`} className="h-full w-full object-cover" />
                          </a>
                        ) : (
                          <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            Chưa có
                          </div>
                        )}

                        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-700 transition hover:border-[#ef1b2d] hover:text-[#ef1b2d]">
                          {uploadingMachineIds.has(machine.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImagePlus className="h-4 w-4" />
                          )}
                          {uploadingMachineIds.has(machine.id) ? 'Đang chụp...' : machine.imageUrl ? 'Chụp lại' : 'Chụp ảnh'}
                          <input
                            {...CAMERA_IMAGE_INPUT_PROPS}
                            className="hidden"
                            disabled={uploadingMachineIds.has(machine.id)}
                            onChange={event => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              handleMachineImageUpload(machine, file);
                            }}
                          />
                        </label>
                      </div>
                      <p className="text-[10px] font-semibold text-zinc-400">JPG, PNG · lưu Cloudinary</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-700">{machine.type}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{machine.branch}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-600">{machine.location}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {machine.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-500">{machine.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(machine)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMachine(machine)}
                        disabled={deletingMachineId === machine.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingMachineId === machine.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoadingMachines && filteredMachines.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng danh_sach_may chưa có dữ liệu hoặc không có máy phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

