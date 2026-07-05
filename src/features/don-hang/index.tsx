import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { pickText, fileToDataUrl, uploadImage, formatCell } from '../_shared/recordHelpers';
import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import {
  ORDER_TYPE_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_DEFAULT,
  orderFieldClass,
  normalizeOrderProducts,
  findOrderProductByCode,
  readUnitSuggestions,
  saveUnitSuggestion
} from '../_shared/orderHelpers';
import {
  expandMergedProductionProducts,
  expandProductionOrderProductLines,
  type OrderProductLine
} from '../_shared/productionProductHelpers';
import { normalizeDaNangBusinessStaffOptions, normalizeCustomerOptions } from '../khach-hang';

export type { OrderProductLine };

export function parseOrderProductsFromRecord(record: Record<string, unknown>): OrderProductLine[] {
  let raw = record.san_pham ?? record.products;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed) {
      try {
        raw = JSON.parse(trimmed);
      } catch {
        raw = trimmed;
      }
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const nested =
      (raw as { items?: unknown }).items ??
      (raw as { products?: unknown }).products ??
      (raw as { san_pham?: unknown }).san_pham;
    if (Array.isArray(nested)) {
      raw = nested;
    }
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return expandProductionOrderProductLines(
      raw
        .map((item): OrderProductLine | null => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const productCode = pickText(row, ['ma_sp', 'ma_hang', 'productCode', 'code'], '');
          const productName = pickText(row, ['ten_sp', 'ten_hang', 'productName', 'name'], '');
          const unit = formatCell(row.don_vi ?? row.unit);
          const quantity = formatCell(row.so_luong ?? row.quantity);
          if (!productCode && !productName) return null;
          return {
            productCode,
            productName,
            unit,
            quantity,
            orderRef: pickText(row, ['ma_don_hang', 'orderRef', 'order_code'], '')
          };
        })
        .filter((line): line is OrderProductLine => Boolean(line))
    );
  }

  const productCode = pickText(record, ['ma_hang', 'ma_sp', 'product_code'], '');
  const productName = pickText(record, ['ten_hang', 'ten_sp', 'product_name'], '');
  if (!productCode && !productName) return [];

  return expandMergedProductionProducts(
    productCode,
    productName,
    formatCell(record.don_vi),
    formatCell(record.so_luong ?? record.sl ?? record.quantity),
    pickText(record, ['ma_don_hang', 'orderRef', 'order_code'], '')
  );
}

export function summarizeOrderProducts(products: OrderProductLine[]) {
  const productCode = products.map(item => item.productCode).filter(Boolean).join(', ') || '-';
  const productName = products.map(item => item.productName).filter(Boolean).join(', ') || '-';
  const unit =
    products.length === 1
      ? products[0].unit
      : products
          .map(item => item.unit)
          .filter(unit => unit && unit !== '-')
          .join(', ') || '-';
  const total = products.reduce((sum, item) => sum + parsePercentInput(item.quantity), 0);

  return {
    productCode,
    productName,
    unit,
    quantity: total > 0 ? String(total) : '-'
  };
}

export function getOrderProductLines(order: OrderRow): OrderProductLine[] {
  if (order.products.length > 0) return order.products;
  if (!order.productCode && !order.productName) return [];
  return [
    {
      productCode: order.productCode,
      productName: order.productName,
      unit: order.unit,
      quantity: order.quantity
    }
  ];
}

export function formatOrderProductsSummary(products: OrderProductLine[]) {
  if (products.length === 0) return '-';
  return products
    .map(line => {
      const qty = line.quantity && line.quantity !== '-' ? line.quantity : '';
      const unit = line.unit && line.unit !== '-' ? line.unit : '';
      const label = line.productCode || line.productName || '-';
      return `${label}${qty ? ` × ${qty}` : ''}${unit ? ` ${unit}` : ''}`;
    })
    .join(' · ');
}

export interface OrderRow {
  id: string;
  orderCode: string;
  orderType: string;
  status: string;
  staffName: string;
  customer: string;
  products: OrderProductLine[];
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
  note: string;
}

export function generateNextOrderCode(existingCodes: Iterable<string>) {
  let max = 0;
  for (const raw of existingCodes) {
    const code = String(raw || '').trim().toUpperCase();
    const match = code.match(/^DH(\d+)$/);
    if (!match) continue;
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > max) max = num;
  }
  const next = max + 1;
  const width = Math.max(3, String(next).length);
  return `DH${String(next).padStart(width, '0')}`;
}

export function normalizeOrders(data: unknown): OrderRow[] {
  if (!data || typeof data !== 'object') return [];
  const orders = (data as { orders?: unknown }).orders;
  if (!Array.isArray(orders)) return [];

  return orders
    .map((item): OrderRow | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const orderCode = pickText(record, ['ma_don_hang', 'order_code', 'code'], '');
      const products = parseOrderProductsFromRecord(record);
      const summary = summarizeOrderProducts(products);
      if (!orderCode && products.length === 0) return null;

      return {
        id: String(record.id ?? '').trim() || orderCode || summary.productCode || summary.productName,
        orderCode,
        orderType: pickText(record, ['loai_don_hang', 'order_type', 'type'], '-'),
        status: pickText(record, ['trang_thai', 'status', 'trang_thai_don'], ORDER_STATUS_DEFAULT),
        staffName: pickText(record, ['nhan_vien', 'staff', 'nv'], '-'),
        customer: pickText(record, ['khach_hang', 'customer'], '-'),
        products,
        productCode: summary.productCode,
        productName: summary.productName,
        unit: summary.unit,
        quantity: summary.quantity,
        note: pickText(record, ['ghi_chu', 'note'], '')
      };
    })
    .filter((order): order is OrderRow => Boolean(order));
}

export type OrderProductFormLine = {
  key: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: string;
};

export function newOrderProductFormLine(): OrderProductFormLine {
  return {
    key: `order-product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productCode: '',
    productName: '',
    unit: '',
    quantity: ''
  };
}

export type OrderFormState = {
  orderCode: string;
  orderType: string;
  staffName: string;
  customer: string;
  productLines: OrderProductFormLine[];
  note: string;
  status: string;
};

const emptyOrderForm = (): OrderFormState => ({
  orderCode: '',
  orderType: ORDER_TYPE_OPTIONS[0],
  staffName: '',
  customer: '',
  productLines: [newOrderProductFormLine()],
  note: '',
  status: ORDER_STATUS_DEFAULT
});

export function orderProductLinesToPayload(lines: OrderProductFormLine[], productOptions: OrderProductOption[]) {
  return lines
    .filter(line => line.productCode.trim() || line.productName.trim())
    .map(line => {
      const resolved = resolveOrderProductFields(productOptions, line.productCode, {
        productName: line.productName,
        unit: line.unit
      });
      const productCode = line.productCode.trim();
      const productName = resolved.productName || line.productName.trim();
      const unit = line.unit.trim() || resolved.unit;
      const quantity = parsePercentInput(line.quantity);

      return {
        ma_sp: productCode,
        ten_sp: productName,
        don_vi: unit,
        so_luong: Number.isFinite(quantity) && quantity > 0 ? quantity : null
      };
    })
    .filter(item => item.ma_sp || item.ten_sp);
}

export function orderCellToInput(value: string) {
  return value === '-' ? '' : value;
}

export function orderHasProductionOrder(order: OrderRow) {
  return Boolean(order.productionOrder && order.productionOrder !== '-');
}

export function orderToForm(order: OrderRow): OrderFormState {
  const orderType = (ORDER_TYPE_OPTIONS as readonly string[]).includes(order.orderType)
    ? order.orderType
    : ORDER_TYPE_OPTIONS[0];

  const productLines = getOrderProductLines(order).map(line => ({
    key: `order-product-${line.productCode}-${Math.random().toString(36).slice(2, 7)}`,
    productCode: orderCellToInput(line.productCode),
    productName: orderCellToInput(line.productName),
    unit: orderCellToInput(line.unit),
    quantity: orderCellToInput(line.quantity)
  }));

  return {
    orderCode: orderCellToInput(order.orderCode),
    orderType,
    staffName: orderCellToInput(order.staffName),
    customer: orderCellToInput(order.customer),
    productLines: productLines.length > 0 ? productLines : [newOrderProductFormLine()],
    note: orderCellToInput(order.note),
    status: (ORDER_STATUS_OPTIONS as readonly string[]).includes(order.status)
      ? order.status
      : order.status && order.status !== '-'
        ? order.status
        : ORDER_STATUS_DEFAULT
  };
}

export function OrdersPanel({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingOrder, setViewingOrder] = useState<OrderRow | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [productOptions, setProductOptions] = useState<OrderProductOption[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [orderForm, setOrderForm] = useState<OrderFormState>(emptyOrderForm);

  const loadOrders = async () => {
    setIsLoadingOrders(true);
    setOrdersError('');

    try {
      const res = await fetch('/api/don-hang');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải đơn hàng từ Supabase.');
      }

      setOrders(normalizeOrders(data));
    } catch (error: any) {
      setOrders([]);
      setOrdersError(error.message || 'Không thể tải đơn hàng từ Supabase.');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (!formMode) return;

    let cancelled = false;

    const loadLookups = async () => {
      setIsLoadingLookups(true);
      setLookupError('');

      try {
        const [staffRes, customerRes, productRes] = await Promise.all([
          fetch('/api/nhan-su?format=groups&scope=all'),
          fetch('/api/khach-hang'),
          fetch('/api/san-pham?format=table')
        ]);

        const staffData = await staffRes.json().catch(() => ({}));
        const customerData = await customerRes.json().catch(() => ({}));
        const productData = await productRes.json().catch(() => ({}));

        if (!staffRes.ok) {
          throw new Error(staffData.error || 'Không thể tải nhân sự.');
        }
        if (!customerRes.ok) {
          throw new Error(customerData.error || 'Không thể tải khách hàng.');
        }
        if (!productRes.ok) {
          throw new Error(productData.error || 'Không thể tải hàng hóa.');
        }

        if (!cancelled) {
          setStaffOptions(normalizeDaNangBusinessStaffOptions(staffData));
          setCustomerOptions(normalizeCustomerOptions(customerData));
          setProductOptions(normalizeOrderProducts(productData));
        }
      } catch (error: any) {
        if (!cancelled) {
          setStaffOptions([]);
          setCustomerOptions([]);
          setProductOptions([]);
          setLookupError(error.message || 'Không thể tải dữ liệu tham chiếu.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLookups(false);
        }
      }
    };

    loadLookups();

    return () => {
      cancelled = true;
    };
  }, [formMode]);

  const openAddForm = () => {
    setFormError('');
    setActionMessage('');
    setEditingId(null);
    setOrderForm({
      ...emptyOrderForm(),
      orderCode: generateNextOrderCode(orders.map(order => order.orderCode))
    });
    setFormMode('add');
  };

  const openEditForm = (order: OrderRow) => {
    setFormError('');
    setActionMessage('');
    setViewingOrder(null);
    setEditingId(order.id);
    setOrderForm(orderToForm(order));
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError('');
  };

  const unitSuggestions = useMemo(() => {
    const fromProducts = productOptions.map(product => product.unit).filter(Boolean);
    const fromOrders = orders
      .flatMap(order => getOrderProductLines(order).map(line => line.unit))
      .filter(unit => unit && unit !== '-');
    return [...new Set([...fromProducts, ...fromOrders, ...readUnitSuggestions()])].sort((a, b) =>
      a.localeCompare(b, 'vi')
    );
  }, [orders, productOptions]);

  const updateProductLine = (key: string, patch: Partial<OrderProductFormLine>) => {
    setOrderForm(prev => ({
      ...prev,
      productLines: prev.productLines.map(line => (line.key === key ? { ...line, ...patch } : line))
    }));
  };

  const pickOrderProduct = (key: string, productCode: string) => {
    const resolved = resolveOrderProductFields(productOptions, productCode, {});
    const match = findOrderProductByCode(productOptions, productCode);
    updateProductLine(key, {
      productCode,
      productName: resolved.productName,
      unit: resolved.unit || match?.unit || ''
    });
  };

  const handleSaveOrder = async () => {
    if (!orderForm.orderCode.trim()) {
      setFormError('Vui lòng nhập mã đơn hàng.');
      return;
    }

    const products = orderProductLinesToPayload(orderForm.productLines, productOptions);
    if (products.length === 0) {
      setFormError('Vui lòng thêm ít nhất một sản phẩm.');
      return;
    }

    for (const product of products) {
      if (!product.ma_sp && !product.ten_sp) {
        setFormError('Mỗi dòng sản phẩm cần có mã SP hoặc tên SP.');
        return;
      }
      if (!product.so_luong || product.so_luong <= 0) {
        setFormError(`Số lượng phải lớn hơn 0 cho sản phẩm ${product.ma_sp || product.ten_sp}.`);
        return;
      }
    }

    const payload = {
      orderCode: orderForm.orderCode.trim(),
      orderType: orderForm.orderType,
      staffName: orderForm.staffName,
      customer: orderForm.customer,
      products,
      note: orderForm.note,
      status: orderForm.status
    };

    setIsSavingOrder(true);
    setFormError('');

    try {
      const isEdit = formMode === 'edit' && editingId;
      const res = await fetch(isEdit ? `/api/don-hang/${editingId}` : '/api/don-hang', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (isEdit ? 'Không thể cập nhật đơn hàng.' : 'Không thể thêm đơn hàng mới.'));
      }

      orderForm.productLines.forEach(line => {
        if (line.unit.trim()) saveUnitSuggestion(line.unit.trim());
      });

      closeForm();
      setActionMessage(isEdit ? 'Đã cập nhật đơn hàng.' : 'Đã thêm đơn hàng mới.');
      await loadOrders();
    } catch (error: any) {
      setFormError(error.message || 'Không thể lưu đơn hàng.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDeleteOrder = async (order: OrderRow) => {
    if (!order.id) {
      setOrdersError('Không tìm thấy ID để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa đơn "${order.orderCode || order.productCode}"?`)) return;

    setDeletingOrderId(order.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/don-hang/${order.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa đơn hàng.');
      }

      if (viewingOrder?.id === order.id) setViewingOrder(null);
      setActionMessage('Đã xóa đơn hàng.');
      await loadOrders();
    } catch (error: any) {
      setOrdersError(error.message || 'Không thể xóa đơn hàng.');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const orderTypes = useMemo(() => {
    const types = orders
      .map(order => order.orderType)
      .filter((type): type is string => type !== '-' && type.length > 0);
    return ['all', ...[...new Set(types)].sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [orders]);
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesType = selectedType === 'all' || order.orderType === selectedType;
      const matchesSearch =
        !normalizedSearch ||
        `${order.orderCode} ${order.orderType} ${order.status} ${order.staffName} ${order.customer} ${formatOrderProductsSummary(getOrderProductLines(order))} ${order.note}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [orders, normalizedSearch, selectedType]);

  const customerCount = new Set(orders.map(order => order.customer).filter(customer => customer && customer !== '-')).size;
  const totalQuantity = orders.reduce((sum, order) => {
    const value = Number(order.quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return (
    <div className="mx-auto w-full max-w-[1680px] space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="bg-white p-3 text-slate-700 border-b border-slate-200">
          <div className="flex items-start justify-end gap-3">
            <div className="hidden">
              <p className="text-xs font-black uppercase tracking-wider text-red-300">Kế hoạch sản xuất</p>
              <h2 className="mt-1 text-2xl font-black leading-tight">Đơn hàng</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                Dữ liệu được tải trực tiếp từ bảng Supabase don_hang.
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
              ['Đơn hàng', orders.length],
              ['Khách hàng', customerCount],
              ['Tổng SL', formatNumber(totalQuantity)]
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
          <div className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa đơn hàng' : 'Thêm đơn hàng mới'}
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi vào bảng don_hang trên Supabase</p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            {(formError || lookupError) && (
              <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
                {formError || lookupError}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 p-4">
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Mã đơn *</span>
                <input
                  value={orderForm.orderCode}
                  onChange={e => setOrderForm(prev => ({ ...prev, orderCode: e.target.value }))}
                  readOnly={formMode === 'add'}
                  className={`${orderFieldClass} ${formMode === 'add' ? 'bg-zinc-50 font-black text-zinc-900' : ''}`}
                  placeholder="DH001"
                />
                {formMode === 'add' ? (
                  <p className="text-[11px] font-semibold text-zinc-400">Mã tự tăng theo thứ tự DH001, DH002, DH003...</p>
                ) : null}
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Loại đơn</span>
                <SearchableSelect
                  value={orderForm.orderType}
                  onChange={orderType => setOrderForm(prev => ({ ...prev, orderType }))}
                  options={[...ORDER_TYPE_OPTIONS]}
                  placeholder="Gõ để tìm loại đơn"
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  allowEmpty={false}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Trạng thái</span>
                {formMode === 'add' ? (
                  <input
                    value={ORDER_STATUS_DEFAULT}
                    readOnly
                    className={`${orderFieldClass} bg-amber-50 font-black text-amber-800`}
                  />
                ) : (
                  <SearchableSelect
                    value={orderForm.status}
                    onChange={status => setOrderForm(prev => ({ ...prev, status }))}
                    options={[...ORDER_STATUS_OPTIONS]}
                    placeholder="Gõ để tìm trạng thái"
                    getLabel={item => String(item)}
                    getValue={item => String(item)}
                    allowEmpty={false}
                  />
                )}
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nhân viên</span>
                <SimpleSelect
                  value={orderForm.staffName}
                  onChange={staffName => setOrderForm(prev => ({ ...prev, staffName }))}
                  options={staffOptions}
                  placeholder="Chọn nhân viên KD Đà Nẵng"
                  isLoading={isLoadingLookups}
                  getValue={item => (item as StaffOption).name}
                  getLabel={item => (item as StaffOption).name}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Khách hàng</span>
                <SimpleSelect
                  value={orderForm.customer}
                  onChange={customer => setOrderForm(prev => ({ ...prev, customer }))}
                  options={customerOptions}
                  placeholder="Chọn khách hàng"
                  isLoading={isLoadingLookups}
                  getValue={item => (item as CustomerOption).name}
                  getLabel={item => {
                    const customer = item as CustomerOption;
                    return customer.code ? `${customer.code} · ${customer.name}` : customer.name;
                  }}
                />
              </label>

              <RepeatableLinesBlock
                className="col-span-2"
                title="Sản phẩm"
                required
                onAdd={() =>
                  setOrderForm(prev => ({
                    ...prev,
                    productLines: [...prev.productLines, newOrderProductFormLine()]
                  }))
                }
                addButtonClassName="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                columns={[
                  { key: 'code', label: 'Mã SP', className: 'min-w-0 flex-[1.35]', required: true },
                  { key: 'name', label: 'Tên SP', className: 'min-w-0 flex-[1.5]' },
                  { key: 'unit', label: 'ĐVT', className: 'w-24 shrink-0' },
                  { key: 'qty', label: 'SL', className: 'w-24 shrink-0', required: true },
                  { key: 'actions', label: '', className: 'w-10 shrink-0' }
                ]}
              >
                {orderForm.productLines.map(line => {
                  const matchedLineProduct = findOrderProductByCode(productOptions, line.productCode);
                  return (
                    <RepeatableLineRow key={line.key}>
                      <div className="col-span-2 md:min-w-0 md:flex-[1.35]">
                        <SearchableSelect
                          value={line.productCode}
                          onChange={productCode => pickOrderProduct(line.key, productCode)}
                          options={productOptions}
                          placeholder="Gõ để tìm mã SP"
                          isLoading={isLoadingLookups}
                          inputClassName={orderFieldClass}
                          getValue={item => (item as OrderProductOption).code}
                          getLabel={item => {
                            const product = item as OrderProductOption;
                            return product.newCode ? `${product.code} · ${product.name}` : `${product.code} · ${product.name}`;
                          }}
                        />
                      </div>
                      <div className="col-span-2 md:min-w-0 md:flex-[1.5]">
                        <input
                          value={matchedLineProduct ? matchedLineProduct.name : line.productName}
                          readOnly={Boolean(matchedLineProduct)}
                          onChange={e => updateProductLine(line.key, { productName: e.target.value })}
                          className={`${orderFieldClass} ${matchedLineProduct ? 'bg-white text-zinc-800' : 'bg-white'}`}
                          placeholder={matchedLineProduct ? '' : 'Tự động theo mã SP'}
                        />
                      </div>
                      <div className="col-span-1 md:w-24 md:shrink-0">
                        <input
                          list="order-unit-suggestions"
                          value={line.unit}
                          onChange={e => updateProductLine(line.key, { unit: e.target.value })}
                          onBlur={e => {
                            const trimmed = e.target.value.trim();
                            if (trimmed) saveUnitSuggestion(trimmed);
                          }}
                          className={`${orderFieldClass} bg-white`}
                          placeholder="ĐVT"
                        />
                      </div>
                      <div className="col-span-1 md:w-24 md:shrink-0">
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={e => updateProductLine(line.key, { quantity: e.target.value })}
                          className={`${orderFieldClass} bg-white`}
                          placeholder="0"
                        />
                      </div>
                      {orderForm.productLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setOrderForm(prev => ({
                              ...prev,
                              productLines: prev.productLines.filter(item => item.key !== line.key)
                            }))
                          }
                          title="Xóa dòng"
                          className="col-span-2 md:col-span-1 md:mb-0.5 flex h-10 w-full md:h-10 md:w-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 font-bold text-xs"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="md:hidden">Xóa dòng này</span>
                        </button>
                      )}
                    </RepeatableLineRow>
                  );
                })}
              </RepeatableLinesBlock>

              <datalist id="order-unit-suggestions">
                {unitSuggestions.map(unit => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSavingOrder ? 'Đang lưu...' : formMode === 'edit' ? 'Cập nhật' : 'Lưu đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết đơn hàng</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">{viewingOrder.orderCode}</p>
              </div>
              <button type="button" onClick={() => setViewingOrder(null)} className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50">
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              {[
                ['Mã đơn', viewingOrder.orderCode],
                ['Loại đơn', viewingOrder.orderType],
                ['Trạng thái', viewingOrder.status],
                ['Nhân viên', viewingOrder.staffName],
                ['Khách hàng', viewingOrder.customer],
                ['Ghi chú', viewingOrder.note || '-']
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</p>
                  <p className="mt-1 font-bold text-zinc-900">{value || '-'}</p>
                </div>
              ))}
              <div className="col-span-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Sản phẩm</p>
                <div className="mt-2 space-y-2">
                  {getOrderProductLines(viewingOrder).map(line => (
                    <div key={`${line.productCode}-${line.quantity}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                      <p className="font-bold text-zinc-900">{line.productCode || '-'} · {line.productName || '-'}</p>
                      <p className="mt-0.5 text-zinc-600">
                        SL: {line.quantity || '-'}
                        {line.unit && line.unit !== '-' ? ` ${line.unit}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button type="button" onClick={() => openEditForm(viewingOrder)} className="flex h-10 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
                <Pencil className="h-4 w-4" />
                Sửa
              </button>
              <button
                type="button"
                onClick={() => handleDeleteOrder(viewingOrder)}
                disabled={deletingOrderId === viewingOrder.id}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingOrderId === viewingOrder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border-2 border-zinc-900/10 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {orderTypes.map(type => (
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
          {isLoadingOrders && (
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
            placeholder="Tìm mã đơn, khách hàng, mã hàng..."
            disabled={isLoadingOrders}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        {ordersError && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 lg:mt-0">
            {ordersError}
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
          <table className="min-w-[1320px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-3 font-black">Mã đơn</th>
                <th className="px-4 py-3 font-black">Loại đơn</th>
                <th className="px-4 py-3 font-black">Trạng thái</th>
                <th className="px-4 py-3 font-black">Nhân viên</th>
                <th className="px-4 py-3 font-black">Khách hàng</th>
                <th className="w-[560px] px-4 py-3 font-black">Sản phẩm</th>
                <th className="px-4 py-3 font-black">Ghi chú</th>
                <th className="px-4 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.map(order => (
                <tr key={order.id} className="transition hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-zinc-950">{order.orderCode || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2.5 py-1 text-xs font-black text-[#ef1b2d]">
                      {order.orderType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-800">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-700">{order.staffName}</td>
                  <td className="px-4 py-3 font-bold text-zinc-800">{order.customer}</td>
                  <td className="w-[560px] px-4 py-3">
                    <div className="min-w-[520px] overflow-hidden rounded-lg border border-zinc-300 bg-white">
                      <div className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.8fr] divide-x divide-zinc-300 border-b border-zinc-300 bg-zinc-100 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                        <span className="px-3 py-2">Mã SP</span>
                        <span className="px-3 py-2">Tên SP</span>
                        <span className="px-3 py-2 text-right">Số lượng</span>
                        <span className="px-3 py-2">Đơn vị</span>
                      </div>
                      {getOrderProductLines(order).map((line, index) => (
                        <div
                          key={`${order.id}-${line.productCode}-${line.productName}-${index}`}
                          className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.8fr] divide-x divide-zinc-200 border-b border-zinc-200 text-xs font-semibold text-zinc-700 last:border-b-0"
                        >
                          <span className="px-3 py-2 font-black text-zinc-950">{line.productCode || '-'}</span>
                          <span className="px-3 py-2 text-zinc-800">{line.productName || '-'}</span>
                          <span className="px-3 py-2 text-right font-mono font-bold text-zinc-900">{line.quantity || '-'}</span>
                          <span className="px-3 py-2 font-bold text-zinc-700">{line.unit || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-500">{order.note || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingOrder(order)}
                        title="Xem"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(order)}
                        title="Sửa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(order)}
                        disabled={deletingOrderId === order.id}
                        title="Xóa"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingOrderId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoadingOrders && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center font-bold text-zinc-500">
                    Bảng don_hang chưa có dữ liệu hoặc không có đơn phù hợp bộ lọc.
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

export function formatTimeCell(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  const text = String(value).trim();
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return text;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

