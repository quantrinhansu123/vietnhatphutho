import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { pickText } from '../_shared/recordHelpers';
import { normalizeHrBranches } from '../_shared/hr';

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

export function CustomersPanel({ onBack }: { onBack: () => void }) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex items-start justify-end gap-3">
            <div className="hidden">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Kinh doanh</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Khách hàng</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Danh sách khách hàng dùng cho đơn hàng và tra cứu kinh doanh.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
            {[
              ['Khách hàng', customers.length],
              ['Đang hiển thị', filteredCustomers.length]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="block font-bold text-zinc-400">{label}</span>
                <span className="mt-1 block text-xl font-black text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

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
        <button
          type="button"
          onClick={loadCustomers}
          disabled={isLoading}
          className="mt-3 h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 lg:mt-0"
        >
          {isLoading ? 'Đang tải...' : 'Tải lại'}
        </button>
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
    </div>
  );
}

