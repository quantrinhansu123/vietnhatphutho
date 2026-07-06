import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage } from '../_shared/recordHelpers';
import type { HrBranch } from '../_shared/hr';
import { normalizeHrBranches } from '../_shared/hr';
import { STANDARD_SHIFTS } from '../../types';
import {
  BriefcaseBusiness,
  Building2,
  Loader2,
  MoreVertical,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserPlus
} from 'lucide-react';

export function HumanResourcesPanel({ onBack }: { onBack: () => void }) {
  const [branches, setBranches] = useState<HrBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [addStaffDefaults, setAddStaffDefaults] = useState<{ branchId: string; department: string }>({
    branchId: '',
    department: ''
  });

  const loadStaffGroups = async () => {
    setIsLoadingStaff(true);
    setStaffError('');

    try {
      const res = await fetch('/api/nhan-su?format=groups&scope=all');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải nhân sự từ Supabase.');
      }

      const nextBranches = normalizeHrBranches(data);
      setBranches(nextBranches);
      setSelectedBranchId(prev => prev || nextBranches[0]?.id || '');
    } catch (error: any) {
      setBranches([]);
      setStaffError(error.message || 'Không thể tải nhân sự từ Supabase.');
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    void loadStaffGroups();
  }, []);

  const openAddStaffForm = (defaults?: { branchId?: string; department?: string }) => {
    setAddStaffDefaults({
      branchId: defaults?.branchId || selectedBranchId || branches[0]?.id || '',
      department: defaults?.department || ''
    });
    setShowAddStaffForm(true);
  };

  const selectedBranch = branches.find(branch => branch.id === selectedBranchId) ?? branches[0];
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredDepartments = useMemo(() => {
    if (!selectedBranch) return [];
    if (!normalizedSearch) return selectedBranch.departments;

    return selectedBranch.departments
      .map(department => ({
        ...department,
        members: department.members.filter(member =>
          `${member.name} ${member.role} ${member.shift} ${member.username ?? ''}`.toLowerCase().includes(normalizedSearch)
        )
      }))
      .filter(department =>
        department.name.toLowerCase().includes(normalizedSearch) ||
        department.lead.toLowerCase().includes(normalizedSearch) ||
        department.members.length > 0
      );
  }, [normalizedSearch, selectedBranch]);

  const totalDepartments = selectedBranch?.departments.length ?? 0;
  const totalMembers = selectedBranch?.departments.reduce((sum, department) => sum + department.members.length, 0) ?? 0;
  const activeMembers = selectedBranch?.departments.reduce(
    (sum, department) => sum + department.members.filter(member => member.status === 'Đang làm').length,
    0
  ) ?? 0;
  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    branches.forEach(branch => branch.departments.forEach(department => names.add(department.name)));
    if (names.size === 0) names.add('Sản xuất');
    return [...names].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [branches]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex items-start justify-end gap-3">
            <div className="hidden">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Quản lý nhân sự</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Chi nhánh & Phòng ban</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Phòng ban Sản xuất · Chi nhánh Đà Nẵng.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => openAddStaffForm()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>

            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
            {[
              ['Phòng ban', totalDepartments],
              ['Nhân sự', totalMembers],
              ['Đang làm', activeMembers]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <span className="block font-bold text-zinc-500">{label}</span>
                <span className="mt-1 block text-xl font-black text-zinc-950">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {branches.map(branch => (
            <button
              key={branch.id}
              type="button"
              onClick={() => setSelectedBranchId(branch.id)}
              className={`h-11 shrink-0 rounded-xl border px-4 text-sm font-black transition ${
                selectedBranchId === branch.id
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-950'
              }`}
            >
              {branch.shortName}
            </button>
          ))}
          {isLoadingStaff && (
            <div className="flex h-11 shrink-0 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-500">
              Đang tải Supabase...
            </div>
          )}
        </div>

        <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 lg:mt-0 lg:w-[360px]">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm tên, chức vụ, ca làm..."
            disabled={isLoadingStaff || branches.length === 0}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {staffError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {staffError}
          </p>
        )}
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {!isLoadingStaff && !staffError && branches.length === 0 && (
          <div className="rounded-2xl border-2 border-zinc-900/10 bg-white px-4 py-8 text-center text-sm font-bold text-zinc-500">
            Supabase chưa có dữ liệu nhân sự để hiển thị.
          </div>
        )}

        {filteredDepartments.map(department => (
          <article
            key={department.id}
            className="min-w-0 overflow-hidden rounded-xl border-2 border-zinc-900/10 bg-white shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
              <div className="flex min-w-0 gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-[#ef1b2d]">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black leading-tight text-zinc-950">{department.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#ef1b2d]" />
                    <span className="truncate">Trưởng nhóm: {department.lead}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Thêm nhân sự vào ${department.name}`}
                onClick={() => openAddStaffForm({ branchId: selectedBranchId, department: department.name })}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ef1b2d] text-white transition hover:bg-[#b30d1c]"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-zinc-100">
              {department.members.map(member => (
                <div
                  key={`${department.id}-${member.name}`}
                  className="flex items-start gap-2 px-3 py-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xs font-black text-white">
                    {member.name.split(' ').slice(-1)[0].charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black leading-tight text-zinc-950">{member.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <BriefcaseBusiness className="h-3 w-3" />
                        {member.role}
                      </span>
                      <span className="rounded-full border border-zinc-200 px-1.5 py-0.5">{member.shift}</span>
                    </p>
                    {(member.code || member.username || member.password) && (
                      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-semibold text-zinc-500">
                        {member.code && (
                          <span className="font-mono text-zinc-600">{member.code}</span>
                        )}
                        {member.username && (
                          <span className="truncate font-mono text-zinc-600" title={member.username}>
                            {member.username}
                          </span>
                        )}
                        {member.password && (
                          <span className="truncate font-mono text-zinc-600" title={member.password}>
                            {member.password}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-black ${
                    member.status === 'Đang làm'
                      ? 'border-[#ef1b2d]/20 bg-red-50 text-[#ef1b2d]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  }`}>
                    {member.status}
                  </span>
                  <button type="button" className="h-7 w-7 shrink-0 rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-950">
                    <MoreVertical className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {department.members.length === 0 && (
                <div className="px-4 py-5 text-center text-sm font-semibold text-zinc-500">
                  Không có nhân sự phù hợp bộ lọc.
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      <AddStaffModal
        open={showAddStaffForm}
        branches={branches}
        departmentOptions={departmentOptions}
        defaultBranchId={addStaffDefaults.branchId}
        defaultDepartment={addStaffDefaults.department}
        onClose={() => setShowAddStaffForm(false)}
        onCreated={loadStaffGroups}
      />
    </div>
  );
}

export function generateNextStaffCode(existingCodes: Iterable<string>) {
  let max = 0;
  for (const raw of existingCodes) {
    const code = String(raw || '').trim().toUpperCase();
    const match = code.match(/^NV(\d+)$/);
    if (!match) continue;
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > max) max = num;
  }
  const next = max + 1;
  const width = Math.max(3, String(next).length);
  return `NV${String(next).padStart(width, '0')}`;
}

export function collectStaffCodes(branches: HrBranch[]): string[] {
  return branches.flatMap(branch =>
    branch.departments.flatMap(department =>
      department.members.map(member => member.code).filter((code): code is string => Boolean(code))
    )
  );
}

export type StaffFormState = {
  name: string;
  code: string;
  branch: string;
  department: string;
  role: string;
  shift: string;
  status: string;
  username: string;
  password: string;
};

export function emptyStaffForm(defaults?: { branch?: string; department?: string }): StaffFormState {
  return {
    name: '',
    code: '',
    branch: defaults?.branch || 'Đà Nẵng',
    department: defaults?.department || 'Sản xuất',
    role: 'Nhân sự',
    shift: STANDARD_SHIFTS[0] || 'Ca 1',
    status: 'Đang làm',
    username: '',
    password: ''
  };
}

export function AddStaffModal({
  open,
  onClose,
  onCreated,
  branches,
  departmentOptions,
  defaultBranchId,
  defaultDepartment
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  branches: HrBranch[];
  departmentOptions: string[];
  defaultBranchId: string;
  defaultDepartment: string;
}) {
  const [form, setForm] = useState<StaffFormState>(emptyStaffForm());
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const branchOptions = useMemo(() => {
    const names = branches.map(branch => branch.name).filter(Boolean);
    return names.length > 0 ? names : ['Đà Nẵng'];
  }, [branches]);

  useEffect(() => {
    if (!open) return;
    const branchName = branches.find(branch => branch.id === defaultBranchId)?.name || branchOptions[0] || 'Đà Nẵng';
    const nextCode = generateNextStaffCode(collectStaffCodes(branches));
    setForm({
      ...emptyStaffForm({ branch: branchName, department: defaultDepartment || departmentOptions[0] || 'Sản xuất' }),
      code: nextCode
    });
    setFormError('');
  }, [open, defaultBranchId, defaultDepartment, branches, branchOptions, departmentOptions]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError('Vui lòng nhập tên nhân sự.');
      return;
    }
    if (!form.department.trim()) {
      setFormError('Vui lòng chọn phòng ban.');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const res = await fetch('/api/nhan-su', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nhan_su: form.name.trim(),
          ma_nhan_su: form.code.trim(),
          chi_nhanh: form.branch.trim(),
          phong_ban: form.department.trim(),
          cong_viec: form.role.trim(),
          ca_lam: form.shift.trim(),
          trang_thai: form.status.trim(),
          ten_dang_nhap: form.username.trim(),
          mat_khau: form.password.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể thêm nhân sự.');
      }

      await onCreated();
      onClose();
    } catch (error: any) {
      setFormError(error.message || 'Không thể thêm nhân sự.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Thêm nhân sự mới</h3>
            <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng nhan_su trên Supabase</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
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
          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Họ và tên *</span>
            <input
              value={form.name}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Nhập tên nhân sự"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã NV</span>
            <input
              value={form.code}
              readOnly
              className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 font-mono text-sm font-semibold text-zinc-800 outline-none"
              placeholder="Tự sinh"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Chi nhánh</span>
            <select
              value={form.branch}
              onChange={event => setForm(prev => ({ ...prev, branch: event.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {branchOptions.map(branch => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Phòng ban *</span>
            <select
              value={form.department}
              onChange={event => setForm(prev => ({ ...prev, department: event.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {departmentOptions.map(department => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Chức vụ</span>
            <input
              value={form.role}
              onChange={event => setForm(prev => ({ ...prev, role: event.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ca làm</span>
            <select
              value={form.shift}
              onChange={event => setForm(prev => ({ ...prev, shift: event.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {STANDARD_SHIFTS.map(shift => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Tên đăng nhập</span>
            <input
              value={form.username}
              onChange={event => setForm(prev => ({ ...prev, username: event.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Tài khoản đăng nhập"
              autoComplete="username"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Password</span>
            <input
              type="text"
              value={form.password}
              onChange={event => setForm(prev => ({ ...prev, password: event.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 px-3 font-mono text-sm font-semibold text-zinc-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Mật khẩu"
              autoComplete="new-password"
            />
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Trạng thái</span>
            <select
              value={form.status}
              onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {['Đang làm', 'Nghỉ phép', 'Nghỉ việc'].map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-sm font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu nhân sự'}
          </button>
        </div>
      </div>
    </div>
  );
}

