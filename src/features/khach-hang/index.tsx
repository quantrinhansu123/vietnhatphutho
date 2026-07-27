import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Plus, Save, Search, X } from 'lucide-react';
import { pickText } from '../_shared/recordHelpers';
import { normalizeHrBranches } from '../_shared/hr';
import { orderFieldClass } from '../_shared/orderHelpers';
import { showAppToast, showSaveFailure, readApiErrorMessage } from '../../lib/appToast';

export interface StaffOption {
  name: string;
}

export interface CustomerOption {
  id: string;
  name: string;
  code: string;
}

export interface OrderProductOption {
  code: string;
  name: string;
  unit: string;
  newCode: string;
}

export function normalizeLookupText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function normalizeStaffOptions(data: unknown): StaffOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item): StaffOption | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name } : null;
      }
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = pickText(record, ['name', 'nhan_su', 'ho_ten', 'ten'], '');
      return name ? { name } : null;
    })
    .filter((item): item is StaffOption => Boolean(item));
}

export function normalizeDaNangBusinessStaffOptions(data: unknown): StaffOption[] {
  const branches = normalizeHrBranches(data);
  const staff = branches.flatMap(branch => {
    const branchText = normalizeLookupText(`${branch.name} ${branch.shortName}`);
    if (!branchText.includes('da nang')) return [];

    return branch.departments.flatMap(department => {
      const departmentText = normalizeLookupText(department.name);
      if (!departmentText.includes('kinh doanh')) return [];
      return department.members.map(member => ({ name: member.name }));
    });
  });

  const seen = new Set<string>();
  return staff
    .filter(item => {
      const key = normalizeLookupText(item.name.trim());
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function normalizeCustomerOptions(data: unknown): CustomerOption[] {
  if (!data || typeof data !== 'object') return [];
  const customers = (data as { customers?: unknown }).customers;
  if (!Array.isArray(customers)) return [];

  return customers
    .map((item): CustomerOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = pickText(record, ['ten_khach_hang', 'khach_hang', 'ten', 'name', 'ten_cong_ty'], '');
      const code = pickText(record, ['ma_khach_hang', 'ma_kh', 'code', 'id'], '');
      if (!name && !code) return null;
      return {
        id: code || name,
        name: name || code,
        code
      };
    })
    .filter((item): item is CustomerOption => Boolean(item));
}

function generateNextCustomerCode(existingCodes: Iterable<string>) {
  let max = 0;
  for (const raw of existingCodes) {
    const code = String(raw || '').trim().toUpperCase();
    const match = code.match(/^KH(\d+)$/);
    if (!match) continue;
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > max) max = num;
  }
  const next = max + 1;
  return `KH${String(next).padStart(Math.max(3, String(next).length), '0')}`;
}

type CustomerForm = {
  ma_khach_hang: string;
  ten_khach_hang: string;
  dia_chi: string;
  so_dien_thoai: string;
  ghi_chu: string;
};

function emptyForm(code = ''): CustomerForm {
  return {
    ma_khach_hang: code,
    ten_khach_hang: '',
    dia_chi: '',
    so_dien_thoai: '',
    ghi_chu: ''
  };
}

export function CustomersPanel({ onBack }: { onBack: () => void }) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm());

  const loadCustomers = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/khach-hang');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách khách hàng.');
      setCustomers(normalizeCustomerOptions(data));
    } catch (loadError: any) {
      setCustomers([]);
      setError(loadError.message || 'Không thể tải danh sách khách hàng.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredCustomers = useMemo(
    () =>
      customers.filter(customer =>
        !normalizedSearch || `${customer.code} ${customer.name}`.toLowerCase().includes(normalizedSearch)
      ),
    [customers, normalizedSearch]
  );

  const openCreate = () => {
    setForm(emptyForm(generateNextCustomerCode(customers.map(item => item.code))));
    setFormOpen(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.ten_khach_hang.trim()) {
      setError(showSaveFailure('Vui lòng nhập tên khách hàng.'));
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const res = await fetch('/api/khach-hang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ma_khach_hang: form.ma_khach_hang.trim(),
          ten_khach_hang: form.ten_khach_hang.trim(),
          dia_chi: form.dia_chi.trim(),
          so_dien_thoai: form.so_dien_thoai.trim(),
          ghi_chu: form.ghi_chu.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(readApiErrorMessage(res, data, 'Không thể thêm khách hàng.'));
      }
      showAppToast('Đã thêm khách hàng.');
      setFormOpen(false);
      await loadCustomers();
    } catch (saveError: unknown) {
      setError(showSaveFailure(saveError, 'Không thể thêm khách hàng.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4">
      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm mã hoặc tên khách hàng..."
            disabled={isLoading}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>
        <div className="mt-3 flex gap-2 lg:mt-0">
          <button
            type="button"
            onClick={loadCustomers}
            disabled={isLoading}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Đang tải...' : 'Tải lại'}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-sm font-extrabold text-white transition hover:bg-[#b30d1c]"
          >
            <Plus className="h-4 w-4" />
            Thêm khách hàng
          </button>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">STT</th>
                <th className="px-4 py-3 font-black">Mã khách hàng</th>
                <th className="px-4 py-3 font-black">Tên khách hàng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải khách hàng...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center font-bold text-zinc-500">
                    Chưa có khách hàng phù hợp.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer, index) => (
                  <tr key={customer.id} className="transition hover:bg-red-50/40">
                    <td className="px-4 py-3 font-black text-[#ef1b2d]">{index + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-zinc-900">{customer.code || '-'}</td>
                    <td className="px-4 py-3 font-black text-zinc-950">{customer.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Thêm khách hàng</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Nhập thông tin khách hàng mới</p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mã khách hàng</span>
                <input
                  value={form.ma_khach_hang}
                  onChange={event => setForm(prev => ({ ...prev, ma_khach_hang: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="KH001"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Tên khách hàng *
                </span>
                <input
                  value={form.ten_khach_hang}
                  onChange={event => setForm(prev => ({ ...prev, ten_khach_hang: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="Tên công ty / khách hàng"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Địa chỉ</span>
                <input
                  value={form.dia_chi}
                  onChange={event => setForm(prev => ({ ...prev, dia_chi: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="Địa chỉ giao / liên hệ"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Số điện thoại</span>
                <input
                  value={form.so_dien_thoai}
                  onChange={event => setForm(prev => ({ ...prev, so_dien_thoai: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="SĐT liên hệ"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ghi chú</span>
                <input
                  value={form.ghi_chu}
                  onChange={event => setForm(prev => ({ ...prev, ghi_chu: event.target.value }))}
                  className={orderFieldClass}
                  placeholder="Ghi chú thêm"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={isSaving}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
