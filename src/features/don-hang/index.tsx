import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Loader2, Pencil, Plus, Printer, Save, Search, Trash2 } from 'lucide-react';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { BackButton } from '../../components/layout/NavButtons';
import { RepeatableLineRow, RepeatableLinesBlock } from '../../components/RepeatableLinesBlock';
import { pickText, fileToDataUrl, uploadImage, formatCell } from '../_shared/recordHelpers';
import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import {
  ORDER_TYPE_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_DEFAULT,
  orderFieldClass,
  normalizeOrderProducts,
  findOrderProductByCode,
  resolveOrderProductFields,
  readUnitSuggestions,
  saveUnitSuggestion
} from '../_shared/orderHelpers';
import {
  parseOrderProductsFromRecord,
  summarizeOrderProducts,
  getOrderProductLines,
  formatOrderProductsSummary,
  type OrderRow,
  type OrderProductLine
} from '../_shared/orderRecordHelpers';
import { normalizeDaNangBusinessStaffOptions, normalizeCustomerOptions } from '../khach-hang';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from '../../components/layout/constants';

export type { OrderProductLine, OrderRow };

const orderProductGridClass =
  'grid-cols-2 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.5fr)_6rem_6rem_2.5rem]';
export {
  parseOrderProductsFromRecord,
  summarizeOrderProducts,
  getOrderProductLines,
  formatOrderProductsSummary
};

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

function formatOrderCreatedAt(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '—';
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
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
        note: pickText(record, ['ghi_chu', 'note'], ''),
        orderDate: (() => {
          const raw =
            pickText(record, ['ngay_don_hang', 'ngay_dat_hang', 'order_date', 'ngay'], '') ||
            formatCell(record.created_at);
          const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
          if (direct) return direct[1];
          const parsed = new Date(raw);
          if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
          return '';
        })(),
        createdAt: formatCell(record.created_at)
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
  createdAt: string;
};

const emptyOrderForm = (): OrderFormState => ({
  orderCode: '',
  orderType: ORDER_TYPE_OPTIONS[0],
  staffName: '',
  customer: '',
  productLines: [newOrderProductFormLine()],
  note: '',
  status: ORDER_STATUS_DEFAULT,
  createdAt: new Date().toISOString().slice(0, 10)
});

function orderCreatedAtToInput(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return new Date().toISOString().slice(0, 10);
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

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
        : ORDER_STATUS_DEFAULT,
    createdAt: orderCreatedAtToInput(order.createdAt || order.orderDate)
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
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
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

  const handlePrintOrder = async (order: OrderRow) => {
    setPendingPrint(false);
    setPrintOrder(order);
    setPendingPrint(true);
  };

  useEffect(() => {
    if (!pendingPrint || !printOrder) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pendingPrint, printOrder]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPendingPrint(false);
      setPrintOrder(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

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
    if (!orderForm.createdAt.trim()) {
      setFormError('Vui lòng chọn ngày tạo.');
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
      status: orderForm.status,
      createdAt: orderForm.createdAt
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
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
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
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày tạo *</span>
                <input
                  type="date"
                  value={orderForm.createdAt}
                  onChange={e => setOrderForm(prev => ({ ...prev, createdAt: e.target.value }))}
                  className={orderFieldClass}
                />
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
                showColumnHeaders
                gridTemplateClass={orderProductGridClass}
                onAdd={() =>
                  setOrderForm(prev => ({
                    ...prev,
                    productLines: [...prev.productLines, newOrderProductFormLine()]
                  }))
                }
                addButtonClassName="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                columns={[
                  { key: 'code', label: 'Mã SP', required: true },
                  { key: 'name', label: 'Tên SP' },
                  { key: 'unit', label: 'ĐVT' },
                  { key: 'qty', label: 'SL', required: true },
                  { key: 'actions', label: '' }
                ]}
              >
                {orderForm.productLines.map(line => {
                  const matchedLineProduct = findOrderProductByCode(productOptions, line.productCode);
                  return (
                    <RepeatableLineRow key={line.key} gridTemplateClass={orderProductGridClass}>
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <SearchableSelect
                          value={line.productCode}
                          onChange={productCode => pickOrderProduct(line.key, productCode)}
                          options={productOptions}
                          placeholder="Gõ để tìm mã SP"
                          isLoading={isLoadingLookups}
                          inputClassName={orderFieldClass}
                          getValue={item => (item as OrderProductOption).code}
                          getSearchText={item => {
                            const product = item as OrderProductOption;
                            return `${product.code} ${product.newCode} ${product.name}`;
                          }}
                          getLabel={item => {
                            const product = item as OrderProductOption;
                            return `${product.code} · ${product.name}`;
                          }}
                          resolveSelectedItem={(options, value) =>
                            findOrderProductByCode(options as OrderProductOption[], value)
                          }
                        />
                      </div>
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <input
                          value={matchedLineProduct ? matchedLineProduct.name : line.productName}
                          readOnly={Boolean(matchedLineProduct)}
                          onChange={e => updateProductLine(line.key, { productName: e.target.value })}
                          className={`${orderFieldClass} ${matchedLineProduct ? 'bg-zinc-50 text-zinc-800' : 'bg-white'}`}
                          placeholder={matchedLineProduct ? '' : 'Tự động theo mã SP'}
                        />
                      </div>
                      <div className="col-span-1 min-w-0">
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
                      <div className="col-span-1 min-w-0">
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={e => updateProductLine(line.key, { quantity: e.target.value })}
                          className={`${orderFieldClass} bg-white`}
                          placeholder="0"
                        />
                      </div>
                      {orderForm.productLines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOrderForm(prev => ({
                              ...prev,
                              productLines: prev.productLines.filter(item => item.key !== line.key)
                            }))
                          }
                          title="Xóa dòng"
                          className="col-span-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 md:col-span-1 md:h-10 md:w-10"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="text-xs font-bold md:hidden">Xóa dòng này</span>
                        </button>
                      ) : null}
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
                ['Ngày tạo', formatOrderCreatedAt(viewingOrder.createdAt)],
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
              <button
                type="button"
                onClick={() => handlePrintOrder(viewingOrder)}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
              >
                <Printer className="h-4 w-4" />
                In phiếu
              </button>
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

      {printOrder
        ? createPortal(
            <div className="order-print-sheet">
              <div className="order-print-page">
                <div className="order-print-header">
                  <div className="order-print-brand">
                    <img src={vietNhatLogoUrl} alt={PRINT_COMPANY_NAME} className="order-print-logo" />
                    <div>
                      <div className="order-print-company">{PRINT_COMPANY_NAME}</div>
                      <div className="order-print-subtitle">Dự án Chuyển đổi số sản xuất</div>
                    </div>
                  </div>
                  <div className="order-print-form-meta">
                    <div className="order-print-form-code">BM-SX-01</div>
                    <div className="order-print-form-version">Phiên bản 1.0</div>
                  </div>
                </div>

                <div className="order-print-title">ĐƠN ĐẶT HÀNG SẢN XUẤT</div>

                <div className="order-print-info-grid">
                  <div className="order-print-info-row">
                    <div className="order-print-info-label">Số đơn hàng:</div>
                    <div className="order-print-info-value">{printOrder.orderCode || '-'}</div>
                  </div>
                  <div className="order-print-info-row">
                    <div className="order-print-info-label">Ngày lập:</div>
                    <div className="order-print-info-value">{formatOrderCreatedAt(printOrder.orderDate || printOrder.createdAt)}</div>
                  </div>
                  <div className="order-print-info-row">
                    <div className="order-print-info-label">Khách hàng:</div>
                    <div className="order-print-info-value">{printOrder.customer || '-'}</div>
                  </div>
                  <div className="order-print-info-row">
                    <div className="order-print-info-label">Bộ phận lập:</div>
                    <div className="order-print-info-value">{printOrder.staffName || '-'}</div>
                  </div>
                  <div className="order-print-info-row order-print-info-row--full">
                    <div className="order-print-info-label">Địa chỉ khách hàng</div>
                    <div className="order-print-info-value"> </div>
                  </div>
                  <div className="order-print-info-row">
                    <div className="order-print-info-label">Thời hạn giao hàng:</div>
                    <div className="order-print-info-value"> </div>
                  </div>
                </div>

                <table className="order-print-table">
                  <colgroup>
                    <col style={{ width: '8mm' }} />
                    <col style={{ width: '32mm' }} />
                    <col style={{ width: '86mm' }} />
                    <col style={{ width: '26mm' }} />
                    <col style={{ width: '14mm' }} />
                    <col style={{ width: '18mm' }} />
                    <col style={{ width: '22mm' }} />
                    <col style={{ width: '65mm' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Mã sản phẩm</th>
                      <th>Tên sản phẩm</th>
                      <th>Quy cách</th>
                      <th>ĐVT</th>
                      <th>Số lượng</th>
                      <th>Hạn giao</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getOrderProductLines(printOrder).map((line, idx) => (
                      <tr key={`${line.productCode}-${idx}`}>
                        <td className="center">{idx + 1}</td>
                        <td>{line.productCode || ''}</td>
                        <td>
                          <div className="order-print-product-name">{line.productName || ''}</div>
                        </td>
                        <td>{''}</td>
                        <td className="center">{line.unit && line.unit !== '-' ? line.unit : ''}</td>
                        <td className="center">{line.quantity && line.quantity !== '-' ? line.quantity : ''}</td>
                        <td className="center">{''}</td>
                        <td>{printOrder.note || ''}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={5} className="order-print-total-label">TỔNG CỘNG</td>
                      <td className="center order-print-total-value">
                        {formatNumber(
                          getOrderProductLines(printOrder).reduce((sum, item) => sum + parsePercentInput(item.quantity), 0)
                        )}
                      </td>
                      <td />
                      <td />
                    </tr>
                  </tbody>
                </table>

                <div className="order-print-signatures">
                  <div className="order-print-signature">
                    <div className="order-print-signature-title">Người lập</div>
                    <div className="order-print-signature-hint">(Ký, ghi rõ họ tên)</div>
                  </div>
                  <div className="order-print-signature">
                    <div className="order-print-signature-title">Phụ trách bộ phận</div>
                    <div className="order-print-signature-hint">(Ký, ghi rõ họ tên)</div>
                  </div>
                  <div className="order-print-signature">
                    <div className="order-print-signature-title">Bộ phận kế hoạch (tiếp nhận)</div>
                    <div className="order-print-signature-hint">(Ký, ghi rõ họ tên)</div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
          {orderTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-black transition ${
                selectedType === type
                  ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
              }`}
            >
              {type === 'all' ? 'Tất cả' : type}
            </button>
          ))}
          {isLoadingOrders && (
            <div className="flex h-9 shrink-0 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-500">
              Đang tải...
            </div>
          )}
        </div>

        <label className="flex h-9 w-full min-w-[200px] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10 sm:w-[280px] lg:w-[360px]">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Tìm mã đơn, khách hàng, mã hàng..."
            disabled={isLoadingOrders}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>

        <div className="hidden items-center gap-3 text-[11px] font-bold text-zinc-500 sm:flex">
          <span>{orders.length} đơn</span>
          <span>{customerCount} KH</span>
          <span>SL {formatNumber(totalQuantity)}</span>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
        >
          <Plus className="h-4 w-4" />
          Thêm mới
        </button>
      </div>

      {(ordersError || actionMessage) && (
        <div className="space-y-1 border-b border-zinc-100 px-3 py-2">
          {ordersError && (
            <p className="text-xs font-bold text-rose-700">{ordersError}</p>
          )}
          {actionMessage && (
            <p className="text-xs font-bold text-emerald-700">{actionMessage}</p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-950 text-xs uppercase tracking-wider text-white">
            <tr>
              <th className="px-3 py-2.5 font-black">Mã đơn</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-black">Ngày tạo</th>
              <th className="px-3 py-2.5 font-black">Loại đơn</th>
              <th className="px-3 py-2.5 font-black">Trạng thái</th>
              <th className="px-3 py-2.5 font-black">Nhân viên</th>
              <th className="px-3 py-2.5 font-black">Khách hàng</th>
              <th className="min-w-[420px] px-3 py-2.5 font-black">
                <div className="grid grid-cols-[minmax(72px,0.9fr)_minmax(120px,1.6fr)_72px_56px] gap-2">
                  <span>Mã SP</span>
                  <span>Tên sản phẩm</span>
                  <span className="text-right">SL</span>
                  <span>ĐVT</span>
                </div>
              </th>
              <th className="px-3 py-2.5 font-black">Ghi chú</th>
              <th className="w-28 px-3 py-2.5 text-center font-black">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {filteredOrders.map(order => (
              <tr key={order.id} className="align-top transition hover:bg-red-50/30">
                <td className="px-3 py-2.5 font-black text-zinc-950">{order.orderCode || '-'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-zinc-600">
                  {formatOrderCreatedAt(order.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full border border-[#ef1b2d]/20 bg-red-50 px-2 py-0.5 text-[11px] font-black text-[#ef1b2d]">
                    {order.orderType}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-800">
                    {order.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-semibold text-zinc-700">{order.staffName}</td>
                <td className="px-3 py-2.5 font-bold text-zinc-800">{order.customer}</td>
                <td className="px-3 py-2.5">
                  <div className="divide-y divide-zinc-100">
                    {getOrderProductLines(order).map((line, index) => (
                      <div
                        key={`${order.id}-${line.productCode}-${line.productName}-${index}`}
                        className="grid grid-cols-[minmax(72px,0.9fr)_minmax(120px,1.6fr)_72px_56px] gap-2 py-1.5 text-xs font-semibold text-zinc-700 first:pt-0 last:pb-0"
                      >
                        <span className="font-black text-zinc-950">{line.productCode || '-'}</span>
                        <span className="text-zinc-800">{line.productName || '-'}</span>
                        <span className="text-right font-mono font-bold text-zinc-900">{line.quantity || '-'}</span>
                        <span className="font-bold text-zinc-600">{line.unit || '-'}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-semibold text-zinc-500">{order.note || '-'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePrintOrder(order)}
                      title="In phiếu"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-emerald-700 transition hover:bg-emerald-50"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
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
                <td colSpan={9} className="px-4 py-10 text-center font-bold text-zinc-500">
                  Bảng don_hang chưa có dữ liệu hoặc không có đơn phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { formatTimeCell } from '../_shared/recordHelpers';
