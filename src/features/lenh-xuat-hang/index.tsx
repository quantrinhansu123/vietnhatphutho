import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Save, Search, Trash2, Truck } from 'lucide-react';
import { formatNumber } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import { RepeatableLineRow, RepeatableLinesBlock } from '../../components/RepeatableLinesBlock';
import { pickText } from '../_shared/recordHelpers';
import {
  findOrderProductByCode,
  normalizeOrderProducts,
  orderFieldClass,
  type OrderProductOption
} from '../_shared/orderHelpers';
import { showAppToast, showSaveFailure, readApiErrorMessage } from '../../lib/appToast';

export type ShippingOrderLine = {
  id: string;
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  so_luong: number;
};

export type ShippingOrder = {
  id: string;
  ma_lenh: string;
  ngay_xuat: string;
  ma_khach_hang: string;
  ten_khach_hang: string;
  dia_chi_giao: string;
  so_dien_thoai: string;
  nhan_vien: string;
  trang_thai: string;
  ghi_chu: string;
  chi_tiet: ShippingOrderLine[];
};

type CustomerDetail = {
  id: string;
  name: string;
  code: string;
  dia_chi: string;
  so_dien_thoai: string;
};

const STATUS_OPTIONS = ['Chờ xuất', 'Đang giao', 'Đã giao', 'Hủy'] as const;

const lineGridClass =
  'grid-cols-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_5.5rem_6rem_2.5rem]';

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateVi(value: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value || '—';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function createLine(partial?: Partial<ShippingOrderLine>): ShippingOrderLine {
  return {
    id: partial?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ma_sp: partial?.ma_sp || '',
    ten_sp: partial?.ten_sp || '',
    don_vi: partial?.don_vi || '',
    so_luong: Number.isFinite(partial?.so_luong) ? Number(partial?.so_luong) : 0
  };
}

function parseLines(value: unknown): ShippingOrderLine[] {
  if (typeof value === 'string') {
    try {
      return parseLines(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map(row =>
      createLine({
        id: pickText(row, ['id'], '') || undefined,
        ma_sp: pickText(row, ['ma_sp', 'ma_san_pham', 'code'], ''),
        ten_sp: pickText(row, ['ten_sp', 'ten_san_pham', 'name'], ''),
        don_vi: pickText(row, ['don_vi', 'unit'], ''),
        so_luong: Number(row.so_luong ?? row.quantity ?? 0)
      })
    );
}

function normalizeShippingOrders(data: unknown): ShippingOrder[] {
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { orders?: unknown; rows?: unknown }).orders
    ?? (data as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map(row => ({
      id: String(row.id ?? '').trim(),
      ma_lenh: pickText(row, ['ma_lenh', 'code'], ''),
      ngay_xuat: pickText(row, ['ngay_xuat', 'ship_date'], todayIso()).slice(0, 10),
      ma_khach_hang: pickText(row, ['ma_khach_hang', 'customer_code'], ''),
      ten_khach_hang: pickText(row, ['ten_khach_hang', 'customer_name', 'khach_hang'], ''),
      dia_chi_giao: pickText(row, ['dia_chi_giao', 'dia_chi', 'address'], ''),
      so_dien_thoai: pickText(row, ['so_dien_thoai', 'dien_thoai', 'phone'], ''),
      nhan_vien: pickText(row, ['nhan_vien', 'staff'], ''),
      trang_thai: pickText(row, ['trang_thai', 'status'], 'Chờ xuất'),
      ghi_chu: pickText(row, ['ghi_chu', 'note'], ''),
      chi_tiet: parseLines(row.chi_tiet)
    }))
    .filter(row => row.id || row.ma_lenh);
}

function normalizeCustomerDetails(data: unknown): CustomerDetail[] {
  if (!data || typeof data !== 'object') return [];
  const customers = (data as { customers?: unknown }).customers;
  if (!Array.isArray(customers)) return [];
  return customers
    .map((item): CustomerDetail | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = pickText(record, ['ten_khach_hang', 'khach_hang', 'ten', 'name', 'ten_cong_ty'], '');
      const code = pickText(record, ['ma_khach_hang', 'ma_kh', 'code', 'id'], '');
      if (!name && !code) return null;
      return {
        id: code || name,
        name: name || code,
        code,
        dia_chi: pickText(record, ['dia_chi', 'dia_chi_giao', 'address', 'dia_chi_giao_hang'], ''),
        so_dien_thoai: pickText(record, ['so_dien_thoai', 'dien_thoai', 'phone', 'sdt'], '')
      };
    })
    .filter((item): item is CustomerDetail => Boolean(item));
}

function generateNextShippingCode(existingCodes: Iterable<string>) {
  let max = 0;
  for (const raw of existingCodes) {
    const code = String(raw || '').trim().toUpperCase();
    const match = code.match(/^LXH(\d+)$/);
    if (!match) continue;
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > max) max = num;
  }
  const next = max + 1;
  const width = Math.max(3, String(next).length);
  return `LXH${String(next).padStart(width, '0')}`;
}

function emptyForm(code = ''): Omit<ShippingOrder, 'id'> {
  return {
    ma_lenh: code,
    ngay_xuat: todayIso(),
    ma_khach_hang: '',
    ten_khach_hang: '',
    dia_chi_giao: '',
    so_dien_thoai: '',
    nhan_vien: '',
    trang_thai: 'Chờ xuất',
    ghi_chu: '',
    chi_tiet: [createLine()]
  };
}

function statusClass(status: string) {
  if (status === 'Đã giao') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'Đang giao') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'Hủy') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-amber-50 text-amber-800 ring-amber-200';
}

export function ShippingOrdersPanel({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<ShippingOrder[]>([]);
  const [customers, setCustomers] = useState<CustomerDetail[]>([]);
  const [products, setProducts] = useState<OrderProductOption[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Omit<ShippingOrder, 'id'>>(emptyForm());

  const loadAll = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [orderRes, customerRes, productRes] = await Promise.all([
        fetch('/api/lenh-xuat-hang'),
        fetch('/api/khach-hang'),
        fetch('/api/san-pham?format=table')
      ]);
      const orderData = await orderRes.json().catch(() => ({}));
      const customerData = await customerRes.json().catch(() => ({}));
      const productData = await productRes.json().catch(() => ({}));
      if (!orderRes.ok) throw new Error(orderData.error || 'Không thể tải lệnh xuất hàng.');
      if (!customerRes.ok) throw new Error(customerData.error || 'Không thể tải khách hàng.');
      setOrders(normalizeShippingOrders(orderData));
      setCustomers(normalizeCustomerDetails(customerData));
      setProducts(normalizeOrderProducts(productData));
    } catch (loadError: unknown) {
      setOrders([]);
      setError(showSaveFailure(loadError, 'Không thể tải dữ liệu lệnh xuất hàng.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(order =>
      `${order.ma_lenh} ${order.ten_khach_hang} ${order.ma_khach_hang} ${order.dia_chi_giao} ${order.trang_thai}`
        .toLowerCase()
        .includes(q)
    );
  }, [orders, searchText]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(generateNextShippingCode(orders.map(order => order.ma_lenh))));
    setFormOpen(true);
    setError('');
  };

  const openEdit = (order: ShippingOrder) => {
    setEditingId(order.id);
    setForm({
      ma_lenh: order.ma_lenh,
      ngay_xuat: order.ngay_xuat,
      ma_khach_hang: order.ma_khach_hang,
      ten_khach_hang: order.ten_khach_hang,
      dia_chi_giao: order.dia_chi_giao,
      so_dien_thoai: order.so_dien_thoai,
      nhan_vien: order.nhan_vien,
      trang_thai: order.trang_thai || 'Chờ xuất',
      ghi_chu: order.ghi_chu,
      chi_tiet: order.chi_tiet.length > 0 ? order.chi_tiet.map(line => createLine(line)) : [createLine()]
    });
    setFormOpen(true);
    setError('');
  };

  const selectCustomer = (customerName: string) => {
    const customer =
      customers.find(item => item.name === customerName || item.code === customerName || item.id === customerName) ||
      null;
    setForm(prev => ({
      ...prev,
      ma_khach_hang: customer?.code || '',
      ten_khach_hang: customer?.name || customerName,
      dia_chi_giao: customer?.dia_chi || prev.dia_chi_giao,
      so_dien_thoai: customer?.so_dien_thoai || prev.so_dien_thoai
    }));
  };

  const updateLine = (lineId: string, patch: Partial<ShippingOrderLine>) => {
    setForm(prev => ({
      ...prev,
      chi_tiet: prev.chi_tiet.map(line => (line.id === lineId ? { ...line, ...patch } : line))
    }));
  };

  const selectProduct = (lineId: string, code: string) => {
    const found = findOrderProductByCode(products, code);
    updateLine(lineId, {
      ma_sp: code,
      ten_sp: found?.name || '',
      don_vi: found?.unit || ''
    });
  };

  const handleSave = async () => {
    if (!form.ten_khach_hang.trim()) {
      setError(showSaveFailure('Vui lòng chọn khách hàng.'));
      return;
    }
    if (!form.ngay_xuat.trim()) {
      setError(showSaveFailure('Vui lòng chọn ngày xuất.'));
      return;
    }
    const lines = form.chi_tiet.filter(line => line.ma_sp.trim() || line.ten_sp.trim() || line.so_luong > 0);
    if (lines.length === 0) {
      setError(showSaveFailure('Vui lòng thêm ít nhất một dòng hàng xuất.'));
      return;
    }
    for (const line of lines) {
      if (!line.ma_sp.trim() && !line.ten_sp.trim()) {
        setError(showSaveFailure('Mỗi dòng cần có mã SP hoặc tên SP.'));
        return;
      }
      if (!(line.so_luong > 0)) {
        setError(showSaveFailure(`Số lượng phải lớn hơn 0 (${line.ma_sp || line.ten_sp}).`));
        return;
      }
    }

    setIsSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        ma_lenh: form.ma_lenh.trim() || generateNextShippingCode(orders.map(order => order.ma_lenh)),
        chi_tiet: lines.map(line => ({
          ma_sp: line.ma_sp.trim(),
          ten_sp: line.ten_sp.trim(),
          don_vi: line.don_vi.trim(),
          so_luong: line.so_luong
        }))
      };
      const res = await fetch(
        editingId ? `/api/lenh-xuat-hang/${encodeURIComponent(editingId)}` : '/api/lenh-xuat-hang',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(readApiErrorMessage(res, data, 'Không thể lưu lệnh xuất hàng.'));
      }
      showAppToast(editingId ? 'Đã cập nhật lệnh xuất hàng.' : 'Đã tạo lệnh xuất hàng.');
      setFormOpen(false);
      setEditingId(null);
      await loadAll();
    } catch (saveError: unknown) {
      setError(showSaveFailure(saveError, 'Không thể lưu lệnh xuất hàng.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (order: ShippingOrder) => {
    if (!order.id) return;
    if (!window.confirm(`Xóa lệnh xuất hàng ${order.ma_lenh}?`)) return;
    try {
      const res = await fetch(`/api/lenh-xuat-hang/${encodeURIComponent(order.id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không thể xóa lệnh xuất hàng.'));
      showAppToast(`Đã xóa ${order.ma_lenh}.`);
      await loadAll();
    } catch (deleteError: unknown) {
      setError(showSaveFailure(deleteError, 'Không thể xóa lệnh xuất hàng.'));
    }
  };

  return (
    <div className="space-y-3 pb-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton onClick={onBack} />
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Truck className="h-4 w-4 text-brand-500" />
              Lệnh xuất hàng
            </h2>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Xuất hàng cho khách hàng · {filteredOrders.length} phiếu
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-extrabold text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          Thêm lệnh xuất
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            className={`${orderFieldClass} pl-9`}
            placeholder="Tìm mã lệnh, khách hàng, địa chỉ..."
          />
        </label>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-black">Mã lệnh</th>
                <th className="px-3 py-2.5 font-black">Ngày xuất</th>
                <th className="px-3 py-2.5 font-black">Khách hàng</th>
                <th className="px-3 py-2.5 font-black">Địa chỉ giao</th>
                <th className="px-3 py-2.5 text-right font-black">SL SP</th>
                <th className="px-3 py-2.5 font-black">Trạng thái</th>
                <th className="px-3 py-2.5 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-slate-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải lệnh xuất hàng...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-slate-400">
                    Chưa có lệnh xuất hàng.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const qty = order.chi_tiet.reduce((sum, line) => sum + (line.so_luong || 0), 0);
                  return (
                    <tr key={order.id || order.ma_lenh} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 font-mono font-black text-sky-800">{order.ma_lenh || '—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">{formatDateVi(order.ngay_xuat)}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{order.ten_khach_hang || '—'}</div>
                        {order.ma_khach_hang ? (
                          <div className="text-[11px] font-semibold text-slate-500">{order.ma_khach_hang}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{order.dia_chi_giao || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                        {formatNumber(qty, 2)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 ${statusClass(order.trang_thai)}`}
                        >
                          {order.trang_thai || 'Chờ xuất'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(order)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                            title="Sửa"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(order)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
          <div className="flex h-[96dvh] max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                  {editingId ? 'Sửa lệnh xuất hàng' : 'Thêm lệnh xuất hàng'}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Khách hàng lấy từ danh mục /khach-hang
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
              >
                Đóng
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mã lệnh</span>
                  <input value={form.ma_lenh} readOnly className={`${orderFieldClass} bg-slate-50`} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ngày xuất *</span>
                  <input
                    type="date"
                    value={form.ngay_xuat}
                    onChange={event => setForm(prev => ({ ...prev, ngay_xuat: event.target.value }))}
                    className={orderFieldClass}
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Khách hàng *
                  </span>
                  <SimpleSelect
                    value={form.ten_khach_hang}
                    options={customers}
                    onChange={selectCustomer}
                    placeholder="Chọn khách hàng"
                    getValue={item => (item as CustomerDetail).name}
                    getLabel={item => {
                      const customer = item as CustomerDetail;
                      return customer.code ? `${customer.code} · ${customer.name}` : customer.name;
                    }}
                  />
                </label>
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Địa chỉ giao
                  </span>
                  <input
                    value={form.dia_chi_giao}
                    onChange={event => setForm(prev => ({ ...prev, dia_chi_giao: event.target.value }))}
                    className={orderFieldClass}
                    placeholder="Địa chỉ giao hàng"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Số điện thoại
                  </span>
                  <input
                    value={form.so_dien_thoai}
                    onChange={event => setForm(prev => ({ ...prev, so_dien_thoai: event.target.value }))}
                    className={orderFieldClass}
                    placeholder="SĐT liên hệ"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Trạng thái
                  </span>
                  <SimpleSelect
                    value={form.trang_thai}
                    options={[...STATUS_OPTIONS]}
                    onChange={status => setForm(prev => ({ ...prev, trang_thai: status }))}
                    placeholder="Chọn trạng thái"
                    getValue={item => String(item)}
                    getLabel={item => String(item)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Nhân viên
                  </span>
                  <input
                    value={form.nhan_vien}
                    onChange={event => setForm(prev => ({ ...prev, nhan_vien: event.target.value }))}
                    className={orderFieldClass}
                    placeholder="Người lập / phụ trách"
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

              <RepeatableLinesBlock
                title="Chi tiết hàng xuất"
                required
                showColumnHeaders
                gridTemplateClass={lineGridClass}
                onAdd={() => setForm(prev => ({ ...prev, chi_tiet: [...prev.chi_tiet, createLine()] }))}
                columns={[
                  { key: 'code', label: 'Mã SP', required: true },
                  { key: 'name', label: 'Tên SP' },
                  { key: 'unit', label: 'ĐVT' },
                  { key: 'qty', label: 'SL', required: true },
                  { key: 'actions', label: '' }
                ]}
              >
                {form.chi_tiet.map(line => {
                  const matched = findOrderProductByCode(products, line.ma_sp);
                  return (
                    <RepeatableLineRow key={line.id} gridTemplateClass={lineGridClass}>
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <SearchableSelect
                          value={line.ma_sp}
                          options={products}
                          onChange={value => selectProduct(line.id, value)}
                          placeholder="Gõ để tìm mã SP"
                          getValue={item => (item as OrderProductOption).code}
                          getLabel={item => {
                            const product = item as OrderProductOption;
                            return `${product.code} · ${product.name}`;
                          }}
                          getSearchText={item => {
                            const product = item as OrderProductOption;
                            return `${product.code} ${product.newCode} ${product.name}`;
                          }}
                          inputClassName={orderFieldClass}
                        />
                      </div>
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <input
                          value={line.ten_sp}
                          readOnly={Boolean(matched)}
                          onChange={event => updateLine(line.id, { ten_sp: event.target.value })}
                          className={`${orderFieldClass} ${matched ? 'bg-slate-50' : ''}`}
                          placeholder="Tên SP"
                        />
                      </div>
                      <div className="col-span-1 min-w-0">
                        <input
                          value={line.don_vi}
                          onChange={event => updateLine(line.id, { don_vi: event.target.value })}
                          className={orderFieldClass}
                          placeholder="ĐVT"
                        />
                      </div>
                      <div className="col-span-1 min-w-0">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={line.so_luong || ''}
                          onChange={event =>
                            updateLine(line.id, { so_luong: Number(event.target.value) || 0 })
                          }
                          className={`${orderFieldClass} text-right`}
                          placeholder="0"
                        />
                      </div>
                      {form.chi_tiet.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setForm(prev => ({
                              ...prev,
                              chi_tiet: prev.chi_tiet.filter(item => item.id !== line.id)
                            }))
                          }
                          title="Xóa dòng"
                          className="col-span-2 flex h-10 w-full items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 md:col-span-1 md:w-10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="hidden md:block" />
                      )}
                    </RepeatableLineRow>
                  );
                })}
              </RepeatableLinesBlock>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3">
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
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? 'Đang lưu...' : 'Lưu lệnh'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
