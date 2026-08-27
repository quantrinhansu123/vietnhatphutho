import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Loader2, Pencil, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { useTabAccess } from '../../app/useTabAccess';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { waitForPrintImagesReady } from '../../utils/printReady';
import { BackButton } from '../../components/layout/NavButtons';
import { RepeatableLineRow, RepeatableLinesBlock } from '../../components/RepeatableLinesBlock';
import { pickText, fileToDataUrl, uploadImage, formatCell } from '../_shared/recordHelpers';
import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import {
  ORDER_TYPE_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_DEFAULT,
  CUT_ORDER_TYPE,
  orderFieldClass,
  normalizeOrderProducts,
  findOrderProductById,
  findOrderProductByCode,
  resolveOrderProductFields,
  readUnitSuggestions,
  saveUnitSuggestion,
  calculateOrderConversion,
  conversionSupportsUnit,
  allowedOrderUnits,
  type OrderProductOption,
  type OrderProductConversion,
  type StaffOption,
  type CustomerOption
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
import OrderPrintSheet from '../../components/OrderPrintSheet';
import {
  FilterCombobox,
  TableToolbar,
  TableSearchInput,
  TableShell,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableEmptyRow,
  StatusBadge,
  RowActionsMenu
} from '../../components/shared/table';

export type { OrderProductLine, OrderRow };

interface OrderRowExt extends OrderRow {
  khu_vuc?: string;
}

const orderProductGridClass =
  'grid-cols-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_5.5rem_5.5rem_4rem_4rem_4rem_2.5rem]';
const orderCutProductGridClass =
  'grid-cols-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_4rem_5rem_5rem_5rem_4.5rem_minmax(6rem,1fr)_2.5rem]';
const ORDER_CONVERSION_PAGE_SIZE = 1000;
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
      const updatedRaw = record.updated_at ?? record.updatedAt;
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
        deliveryDate: pickText(record, ['ngay_giao_hang', 'deliveryDate', 'delivery_date'], ''),
        productionOrder: pickText(record, ['lenh_sx', 'production_order', 'productionOrder'], '-'),
        khu_vuc: pickText(record, ['khu_vuc', 'khu_vuc_xuat'], ''),
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
        createdAt: formatCell(record.created_at),
        updatedAt: updatedRaw ? formatCell(updatedRaw) : ''
      };
    })
    .filter((order): order is OrderRow => Boolean(order))
    .sort((a, b) => {
      const timeOf = (order: OrderRow) => {
        const value = order.updatedAt || order.createdAt || order.orderDate;
        const time = new Date(value).getTime();
        return Number.isFinite(time) ? time : 0;
      };
      return timeOf(b) - timeOf(a);
    });
}

export type OrderProductFormLine = {
  key: string;
  productId: string;
  productCode: string;
  productName: string;
  productionName: string;
  unit: string;
  quantity: string;
  /** Chỉ dùng cho đơn "Đơn theo quy cách của khách đặt" (đơn cắt lẻ). */
  doLi: string;
  kho: string;
  daiM: string;
  note: string;
};


function resolveOrderLineProduct(products: OrderProductOption[], line: Pick<OrderProductFormLine, 'productId' | 'productCode' | 'productName' | 'productionName' | 'unit'>) {
  const normalizedCode = line.productCode.trim().toLocaleLowerCase('vi');
  const normalizedName = line.productName.trim();
  const normalizedProductionName = line.productionName.trim();
  const candidates = normalizedCode
    ? products.filter(product =>
        (product.code.trim().toLocaleLowerCase('vi') === normalizedCode ||
          product.newCode.trim().toLocaleLowerCase('vi') === normalizedCode) &&
        (!normalizedName || product.name.trim() === normalizedName) &&
        (!normalizedProductionName || product.productionName.trim() === normalizedProductionName)
      )
    : [];

  if (candidates.length === 1) return candidates[0];

  // Only use the stored ID when it is still compatible with the selected identity.
  const byId = findOrderProductById(products, line.productId);
  if (byId && (!normalizedCode || byId.code.toLocaleLowerCase('vi') === normalizedCode || byId.newCode.toLocaleLowerCase('vi') === normalizedCode) &&
      (!normalizedName || byId.name.trim() === normalizedName) &&
      (!normalizedProductionName || byId.productionName.trim() === normalizedProductionName)) {
    return byId;
  }
  return null;
}

export function newOrderProductFormLine(): OrderProductFormLine {
  return {
    key: `order-product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: '',
    productCode: '',
    productName: '',
    productionName: '',
    unit: '',
    quantity: '',
    doLi: '',
    kho: '',
    daiM: '',
    note: ''
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
  deliveryDate: string;
  khu_vuc: string;
};

const emptyOrderForm = (): OrderFormState => ({
  orderCode: '',
  orderType: ORDER_TYPE_OPTIONS[0],
  staffName: '',
  customer: '',
  productLines: [newOrderProductFormLine()],
  note: '',
  status: ORDER_STATUS_DEFAULT,
  createdAt: new Date().toISOString().slice(0, 10),
  deliveryDate: '',
  khu_vuc: ''
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

export function orderProductLinesToPayload(
  lines: OrderProductFormLine[],
  productOptions: OrderProductOption[],
  orderType?: string
) {
  const isCutOrder = orderType === CUT_ORDER_TYPE;
  return lines
    .filter(line => line.productCode.trim() || line.productName.trim())
    .map(line => {
      const selectedProduct = resolveOrderLineProduct(productOptions, line);
      const resolved = resolveOrderProductFields(productOptions, line.productCode, {
        productName: line.productName,
        unit: line.unit
      });
      const productCode = line.productCode.trim();
      const productName = selectedProduct?.name || resolved.productName || line.productName.trim();
      const allowedUnits = selectedProduct ? allowedOrderUnits(selectedProduct) : [];
      const unit = isCutOrder
        ? 'Tấm'
        : selectedProduct
          ? (allowedUnits.includes(line.unit.trim()) ? line.unit.trim() : allowedUnits[0] || 'kg')
          : line.unit.trim() || resolved.unit;
      const quantity = parsePercentInput(line.quantity);
      const doLi = line.doLi.trim();
      const kho = parsePercentInput(line.kho);
      const daiM = parsePercentInput(line.daiM);
      const note = line.note.trim();

      return {
        san_pham_id: selectedProduct?.id || line.productId.trim() || undefined,
        ma_sp: productCode,
        ten_sp: productName,
        ten_san_xuat: line.productionName.trim() || selectedProduct?.productionName || resolved.productionName || '',
        don_vi: unit,
        so_luong: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
        ghi_chu: note || undefined,
        ...(isCutOrder
          ? {
              do_li: doLi || undefined,
              kho: Number.isFinite(kho) && kho > 0 ? kho : undefined,
              dai_m: Number.isFinite(daiM) && daiM > 0 ? daiM : undefined
            }
          : {})
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
    productId: line.productId || '',
    productCode: orderCellToInput(line.productCode),
    productName: orderCellToInput(line.productName),
    productionName: orderCellToInput(line.productionName || ''),
    unit: orderCellToInput(line.unit),
    quantity: orderCellToInput(line.quantity),
    doLi: line.doLi || '',
    kho: line.kho || '',
    daiM: line.daiM || '',
    note: line.note || ''
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
    createdAt: orderCreatedAtToInput(order.createdAt || order.orderDate),
    deliveryDate: order.deliveryDate || '',
    khu_vuc: order.khu_vuc || ''
  };
}

export function OrdersPanel({ onBack }: { onBack: () => void }) {
  const { canCreate, canEdit, canDelete } = useTabAccess('orders');
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
  const [productConversions, setProductConversions] = useState<OrderProductConversion[]>([]);
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
        const [staffRes, customerRes, productRes, conversionRes] = await Promise.all([
          fetch('/api/nhan-su?format=groups&scope=all'),
          fetch('/api/khach-hang'),
          fetch('/api/san-pham?format=table'),
          fetch(`/api/bang-quy-doi-san-pham?page=1&pageSize=${ORDER_CONVERSION_PAGE_SIZE}`)
        ]);

        const staffData = await staffRes.json().catch(() => ({}));
        const customerData = await customerRes.json().catch(() => ({}));
        const productData = await productRes.json().catch(() => ({}));
        const conversionData = await conversionRes.json().catch(() => ({}));

        if (!staffRes.ok) {
          throw new Error(staffData.error || 'Không thể tải nhân sự.');
        }
        if (!customerRes.ok) {
          throw new Error(customerData.error || 'Không thể tải khách hàng.');
        }
        if (!productRes.ok) {
          throw new Error(productData.error || 'Không thể tải hàng hóa.');
        }
        if (!conversionRes.ok) {
          throw new Error(conversionData.error || 'Không thể tải bảng quy đổi sản phẩm.');
        }

        const conversions = Array.isArray(conversionData.items) ? conversionData.items as OrderProductConversion[] : [];
        const conversionTotal = Number(conversionData.total) || conversions.length;
        for (let page = 2; conversions.length < conversionTotal; page += 1) {
          const res = await fetch(`/api/bang-quy-doi-san-pham?page=${page}&pageSize=${ORDER_CONVERSION_PAGE_SIZE}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Không thể tải đầy đủ bảng quy đổi sản phẩm.');
          conversions.push(...(Array.isArray(data.items) ? data.items as OrderProductConversion[] : []));
        }

        if (!cancelled) {
          setStaffOptions(normalizeDaNangBusinessStaffOptions(staffData));
          setCustomerOptions(normalizeCustomerOptions(customerData));
          setProductOptions(normalizeOrderProducts(productData));
          setProductConversions(conversions);
        }
      } catch (error: any) {
        if (!cancelled) {
          setStaffOptions([]);
          setCustomerOptions([]);
          setProductOptions([]);
          setProductConversions([]);
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
    if (!canCreate) return;
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
    if (!canEdit) return;
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

  const getProductionNameOptions = (productCode: string, productName = '') => {
    const normalizedCode = productCode.trim();
    const normalizedName = productName.trim();
    const source = normalizedCode
      ? productOptions.filter(product =>
          (product.code.toLocaleLowerCase('vi') === normalizedCode.toLocaleLowerCase('vi') ||
            product.newCode.toLocaleLowerCase('vi') === normalizedCode.toLocaleLowerCase('vi')) &&
          (!normalizedName || product.name.trim() === normalizedName)
        )
      : productOptions;
    const names = source.map(product => product.productionName).filter(name => Boolean(name));
    return [...new Set([...names])].sort((a, b) => a.localeCompare(b, 'vi'));
  };

  const pickProductionName = (key: string, productionName: string) => {
    setOrderForm(prev => ({
      ...prev,
      productLines: prev.productLines.map(line => {
        if (line.key !== key) return line;
        const nextLine = { ...line, productionName };
        // Re-resolve from the visible identity. Do not fall back to the old ID:
        // clearing/changing the production name must also clear stale conversion data.
        const match = resolveOrderLineProduct(productOptions, { ...nextLine, productId: '' });
        return match
          ? {
              ...nextLine,
              productId: match.id,
              // Production name is optional. Clearing it must not replace the
              // AMIS code/name already visible on the order line.
              productCode: nextLine.productCode,
              productName: nextLine.productName || match.name,
              productionName: productionName.trim() ? match.productionName : ''
            }
          : { ...nextLine, productId: '' };
      })
    }));
  };

  const handlePrintOrder = async (order: OrderRow) => {
    setPendingPrint(false);
    setPrintOrder(order);
    setPendingPrint(true);
  };

  useEffect(() => {
    if (!pendingPrint || !printOrder) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      waitForPrintImagesReady().then(() => {
        if (cancelled) return;
        window.print();
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
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

  const pickOrderProduct = (key: string, productId: string) => {
    const match = findOrderProductById(productOptions, productId);
    const productCode = match?.code || '';
    updateProductLine(key, {
      productId,
      productCode,
      productName: match?.name || '',
      productionName: match?.productionName || '',
      unit: allowedOrderUnits(match)[0] || match?.unit || ''
    });
  };

  const pickCutOrderProduct = (key: string, productId: string) => {
    const match = findOrderProductById(productOptions, productId);
    updateProductLine(key, {
      productId,
      productCode: match?.code || '',
      productName: match?.name || '',
      productionName: match?.productionName || '',
      unit: 'Tấm'
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
    if (!orderForm.customer.trim()) {
      setFormError('Vui lòng chọn khách hàng từ danh mục.');
      return;
    }

    const isCutOrder = orderForm.orderType === CUT_ORDER_TYPE;
    const products = orderProductLinesToPayload(orderForm.productLines, productOptions, orderForm.orderType);
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

    const productsWithConversion: Array<(typeof products)[number] & { ket_qua_quy_doi?: Array<{ don_vi: string; gia_tri: number }> }> = [];
    if (isCutOrder) {
      productsWithConversion.push(...products);
    } else {
      for (const product of products) {
        const option = findOrderProductById(productOptions, product.san_pham_id || '');
        const conversion = productConversions.find(item => item.sanPhamId === option?.id && conversionSupportsUnit(item, product.don_vi));
        const result = conversion ? calculateOrderConversion(String(product.so_luong ?? ''), product.don_vi, conversion, option?.group) : [];
        if (result.length === 0) {
          productsWithConversion.push(product);
          continue;
        }
        productsWithConversion.push({
          ...product,
          ket_qua_quy_doi: result.map(([, value, unit]) => ({ don_vi: unit, gia_tri: Math.round(value * 1_000_000) / 1_000_000 }))
        });
      }
    }

    const payload = {
      orderCode: orderForm.orderCode.trim(),
      orderType: orderForm.orderType,
      staffName: orderForm.staffName,
      customer: orderForm.customer,
      products: productsWithConversion,
      note: orderForm.note,
      status: orderForm.status,
      createdAt: orderForm.createdAt,
      deliveryDate: orderForm.deliveryDate
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

  const orderTypeOptions = useMemo(() => {
    const types = orders
      .map(order => order.orderType)
      .filter((type): type is string => type !== '-' && type.length > 0);
    return [...new Set(types)].sort((a, b) => String(a).localeCompare(String(b), 'vi'));
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

  const hasActiveFilters = selectedType !== 'all' || Boolean(searchText);

  const resetFilters = () => {
    setSelectedType('all');
    setSearchText('');
  };

  const customerCount = new Set(orders.map(order => order.customer).filter(customer => customer && customer !== '-')).size;
  const totalQuantity = orders.reduce((sum, order) => {
    const value = Number(order.quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const isFormCutOrder = orderForm.orderType === CUT_ORDER_TYPE;

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
                  className={orderFieldClass}
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
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày giao hàng</span>
                <input type="date" value={orderForm.deliveryDate} onChange={e => setOrderForm(prev => ({ ...prev, deliveryDate: e.target.value }))} className={orderFieldClass} />
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
                <SearchableSelect
                  value={orderForm.status}
                  onChange={status => setOrderForm(prev => ({ ...prev, status }))}
                  options={[...ORDER_STATUS_OPTIONS]}
                  placeholder="Gõ để tìm trạng thái"
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  allowEmpty={false}
                />
                {formMode === 'add' ? (
                  <p className="text-[11px] font-semibold text-zinc-400">Mặc định: {ORDER_STATUS_DEFAULT}</p>
                ) : null}
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nhân viên</span>
                <SearchableSelect
                  value={orderForm.staffName}
                  onChange={staffName => setOrderForm(prev => ({ ...prev, staffName }))}
                  options={staffOptions}
                  placeholder="Tìm nhân viên Phòng Kinh Doanh"
                  isLoading={isLoadingLookups}
                  getValue={item => (item as StaffOption).name}
                  getLabel={item => (item as StaffOption).name}
                  getSearchText={item => {
                    const staff = item as StaffOption;
                    return `${staff.name}`;
                  }}
                  inputClassName={orderFieldClass}
                  allowCustomValue={false}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Khách hàng *</span>
                <select
                  value={orderForm.customer}
                  onChange={event => setOrderForm(prev => ({ ...prev, customer: event.target.value }))}
                  disabled={isLoadingLookups}
                  className={orderFieldClass}
                >
                  <option value="">
                    {isLoadingLookups ? 'Đang tải khách hàng...' : 'Chọn khách hàng'}
                  </option>
                  {orderForm.customer &&
                  !customerOptions.some(customer => customer.name === orderForm.customer) ? (
                    <option value={orderForm.customer}>{orderForm.customer}</option>
                  ) : null}
                  {customerOptions.map(customer => (
                    <option key={customer.id || customer.code || customer.name} value={customer.name}>
                      {customer.code ? `${customer.code} · ${customer.name}` : customer.name}
                    </option>
                  ))}
                </select>
                {!isLoadingLookups && customerOptions.length === 0 ? (
                  <span className="block text-[11px] font-semibold text-amber-700">
                    Chưa có khách hàng trong danh mục /khach-hang.
                  </span>
                ) : null}
              </label>

              <label className="col-span-2 space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú đơn hàng</span>
                <textarea value={orderForm.note} onChange={e => setOrderForm(prev => ({ ...prev, note: e.target.value }))} className={`${orderFieldClass} min-h-20 py-2`} placeholder="Nhập ghi chú đơn hàng" />
              </label>

              <RepeatableLinesBlock
                className="col-span-2"
                title="Sản phẩm"
                required
                showColumnHeaders
                gridTemplateClass={isFormCutOrder ? orderCutProductGridClass : orderProductGridClass}
                onAdd={() =>
                  setOrderForm(prev => ({
                    ...prev,
                    productLines: [...prev.productLines, newOrderProductFormLine()]
                  }))
                }
                addButtonClassName="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                columns={
                  isFormCutOrder
                    ? [
                        { key: 'code', label: 'Mã AMIS', required: true },
                        { key: 'productionName', label: 'Tên sản xuất' },
                        { key: 'unit', label: 'ĐVT' },
                        { key: 'doLi', label: 'Độ li' },
                        { key: 'kho', label: 'Khổ' },
                        { key: 'daiM', label: 'Dài (m)' },
                        { key: 'qty', label: 'SL', required: true },
                        { key: 'note', label: 'Ghi chú' },
                        { key: 'actions', label: '' }
                      ]
                    : [
                        { key: 'code', label: 'Mã AMIS', required: true },
                        { key: 'name', label: 'Tên sản phẩm' },
                        { key: 'productionName', label: 'Tên sản xuất' },
                        { key: 'note', label: 'Ghi chú' },
                        { key: 'unit', label: 'ĐVT' },
                        { key: 'qty', label: 'SL', required: true },
                        { key: 'kg', label: 'KG' },
                        { key: 'm2', label: 'M2' },
                        { key: 'mdai', label: 'M dài' },
                        { key: 'actions', label: '' }
                      ]
                }
              >
                {isFormCutOrder
                  ? orderForm.productLines.map(line => (
                      <RepeatableLineRow key={line.key} gridTemplateClass={orderCutProductGridClass}>
                        <div className="col-span-2 min-w-0 md:col-span-1">
                          <SearchableSelect
                            value={line.productId || line.productCode}
                            onChange={productId => pickCutOrderProduct(line.key, productId)}
                            options={productOptions}
                            placeholder="Tìm Mã AMIS"
                            isLoading={isLoadingLookups}
                            inputClassName={orderFieldClass}
                            getValue={item => (item as OrderProductOption).id}
                            getSearchText={item => {
                              const product = item as OrderProductOption;
                              return `${product.code} ${product.name} ${product.productionName}`;
                            }}
                            getLabel={item => {
                              const product = item as OrderProductOption;
                              return product.code;
                            }}
                            getOptionLabel={item => {
                              const product = item as OrderProductOption;
                              return `${product.code}${product.name ? ` - ${product.name}` : ''}`;
                            }}
                            resolveSelectedItem={(options, value) => findOrderProductById(options as OrderProductOption[], value)}
                          />
                        </div>
                        <div className="col-span-2 min-w-0 md:col-span-1">
                          <SearchableSelect
                            value={line.productionName}
                            onChange={productionName => pickProductionName(line.key, productionName)}
                            options={getProductionNameOptions(line.productCode, line.productName)}
                            placeholder="Chọn hoặc nhập tên sản xuất"
                            allowCustomValue
                            inputClassName={orderFieldClass}
                            getLabel={item => String(item)}
                            getValue={item => String(item)}
                            allowEmpty
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <input
                            value="Tấm"
                            readOnly
                            className={`${orderFieldClass} bg-zinc-100 text-center font-bold text-zinc-600`}
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <input
                            value={line.doLi}
                            onChange={e => updateProductLine(line.key, { doLi: e.target.value })}
                            className={orderFieldClass}
                            placeholder="8"
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <input
                            type="number"
                            step="0.01"
                            value={line.kho}
                            onChange={e => updateProductLine(line.key, { kho: e.target.value })}
                            className={orderFieldClass}
                            placeholder="1.22"
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <input
                            type="number"
                            step="0.01"
                            value={line.daiM}
                            onChange={e => updateProductLine(line.key, { daiM: e.target.value })}
                            className={orderFieldClass}
                            placeholder="2.8"
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
                        <div className="col-span-2 min-w-0 md:col-span-1">
                          <input
                            value={line.note}
                            onChange={e => updateProductLine(line.key, { note: e.target.value })}
                            className={orderFieldClass}
                            placeholder="Ghi chú"
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
                    ))
                  : orderForm.productLines.map(line => {
                  const matchedLineProduct = resolveOrderLineProduct(productOptions, line);
                  const productConversionOptions = productConversions.filter(item => item.sanPhamId === matchedLineProduct?.id);
                  const matchedConversion = productConversionOptions.find(item => conversionSupportsUnit(item, line.unit)) || productConversionOptions[0];
                  const allowedUnits = allowedOrderUnits(matchedLineProduct);
                  const effectiveUnit = matchedLineProduct
                    ? (allowedUnits.includes(line.unit.trim()) ? line.unit.trim() : allowedUnits[0] || 'kg')
                    : line.unit;
                  const calculatedConversion = matchedConversion ? calculateOrderConversion(line.quantity, effectiveUnit, matchedConversion, matchedLineProduct?.group) : [];

                  const kgValue = calculatedConversion.find(([, , unit]) => unit === 'kg')?.[1] ?? null;
                  const m2Value = calculatedConversion.find(([, , unit]) => unit === 'm2')?.[1] ?? null;
                  const mdaiValue = calculatedConversion.find(([, , unit]) => unit === 'm dài')?.[1] ?? null;

                  return (
                    <RepeatableLineRow key={line.key} gridTemplateClass={orderProductGridClass}>
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <SearchableSelect
                          value={matchedLineProduct?.id || line.productId || line.productCode}
                          onChange={productId => pickOrderProduct(line.key, productId)}
                          options={productOptions}
                          placeholder="Tìm Mã AMIS"
                          isLoading={isLoadingLookups}
                          inputClassName={orderFieldClass}
                          getValue={item => (item as OrderProductOption).id}
                          getSearchText={item => {
                            const product = item as OrderProductOption;
                            return `${product.code} ${product.name} ${product.productionName}`;
                          }}
                          getLabel={item => {
                            const product = item as OrderProductOption;
                            return product.code;
                          }}
                          getOptionLabel={item => {
                            const product = item as OrderProductOption;
                            return `${product.code}${product.name ? ` - ${product.name}` : ''}`;
                          }}
                          resolveSelectedItem={(options, value) => findOrderProductById(options as OrderProductOption[], value)}
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
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <SearchableSelect
                          value={line.productionName}
                          onChange={productionName => pickProductionName(line.key, productionName)}
                          options={getProductionNameOptions(line.productCode, line.productName)}
                          placeholder="Chọn hoặc nhập tên sản xuất"
                          allowCustomValue
                          inputClassName={orderFieldClass}
                          getLabel={item => String(item)}
                          getValue={item => String(item)}
                          allowEmpty
                        />
                      </div>
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <input
                          value={line.note}
                          onChange={e => updateProductLine(line.key, { note: e.target.value })}
                          className={orderFieldClass}
                          placeholder="Ghi chú"
                        />
                      </div>
                      <div className="col-span-1 min-w-0">
                        {matchedLineProduct ? <select value={effectiveUnit} onChange={e => updateProductLine(line.key, { unit: e.target.value })} className={orderFieldClass}>{allowedUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select> : <input value={line.unit} onChange={e => updateProductLine(line.key, { unit: e.target.value })} className={orderFieldClass} placeholder="ĐVT" />}
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
                      <div className="col-span-1 min-w-0">
                        <input
                          type="text"
                          value={kgValue !== null ? formatNumber(kgValue, 3) : ''}
                          readOnly
                          className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10 bg-white"
                        />
                      </div>
                      <div className="col-span-1 min-w-0">
                        <input
                          type="text"
                          value={m2Value !== null ? formatNumber(m2Value, 3) : ''}
                          readOnly
                          className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10 bg-white"
                        />
                      </div>
                      <div className="col-span-1 min-w-0">
                        <input
                          type="text"
                          value={mdaiValue !== null ? formatNumber(mdaiValue, 3) : ''}
                          readOnly
                          className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10 bg-white"
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
          <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết đơn hàng</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">{viewingOrder.orderCode}</p>
              </div>
              <button type="button" onClick={() => setViewingOrder(null)} className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50">
                Đóng
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-5 text-sm sm:grid-cols-3">
              {[
                ['Mã đơn', viewingOrder.orderCode],
                ['Ngày tạo', formatOrderCreatedAt(viewingOrder.createdAt)],
                ['Ngày giao hàng', viewingOrder.deliveryDate ? formatOrderCreatedAt(viewingOrder.deliveryDate) : '-'],
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
              <div className="col-span-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 sm:col-span-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Sản phẩm</p>
                <div className="mt-2 space-y-2">
                  {getOrderProductLines(viewingOrder).map(line => (
                    <div key={`${line.productCode}-${line.quantity}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                      <p className="font-bold text-zinc-900">{line.productCode || '-'} · {line.productName || '-'}</p>
                      <p className="mt-0.5 text-xs font-semibold text-zinc-500">Tên sản xuất: {line.productionName || findOrderProductByCode(productOptions, line.productCode)?.productionName || '-'}</p>
                      <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi chú: {line.note || '-'}</p>
                      <p className="mt-0.5 text-zinc-600">
                        SL: {line.quantity || '-'}
                        {line.unit && line.unit !== '-' ? ` ${line.unit}` : ''}
                      </p>
                      {line.doLi || line.kho || line.daiM ? (
                        <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                          Quy cách: {[line.doLi, line.kho ? `Khổ ${line.kho}` : '', line.daiM ? `Dài ${line.daiM}m` : ''].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                      {line.conversionResults?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {line.conversionResults.map(result => (
                            <span key={result.unit} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                              {formatNumber(result.value, 3)} {result.unit}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
              <button
                type="button"
                onClick={() => handlePrintOrder(viewingOrder)}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
              >
                <Printer className="h-4 w-4" />
                In phiếu
              </button>
              {canEdit ? (
                <button type="button" onClick={() => openEditForm(viewingOrder)} className="flex h-10 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
                  <Pencil className="h-4 w-4" />
                  Sửa
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => handleDeleteOrder(viewingOrder)}
                  disabled={deletingOrderId === viewingOrder.id}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingOrderId === viewingOrder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Xóa
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {printOrder
        ? createPortal(<OrderPrintSheet order={printOrder} />, document.body)
        : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[11px] font-bold text-zinc-500">
            <span>{orders.length} đơn</span>
            <span>{customerCount} KH</span>
            <span>SL {formatNumber(totalQuantity)}</span>
          </div>

          {canCreate ? (
            <button
              type="button"
              onClick={openAddForm}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
            >
              <Plus className="h-4 w-4" />
              Thêm mới
            </button>
          ) : null}
        </div>

        <TableToolbar
          isLoading={isLoadingOrders}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
          loadError={ordersError}
          actionMessage={actionMessage}
        >
          <TableSearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Tìm mã đơn, khách hàng, mã hàng..."
            disabled={isLoadingOrders}
          />

          <FilterCombobox
            label="Loại đơn"
            options={orderTypeOptions}
            value={selectedType}
            onChange={setSelectedType}
            compact
            searchable={false}
            dropdownWidth="w-full"
          />
        </TableToolbar>

        <TableShell
          minWidthClassName="min-w-[1200px]"
        >
          <TableHead>
            <TableHeadCell>Mã đơn</TableHeadCell>
            <TableHeadCell className="whitespace-nowrap">Ngày tạo</TableHeadCell>
            <TableHeadCell className="w-24 min-w-24 whitespace-nowrap">Loại đơn</TableHeadCell>
            <TableHeadCell>Trạng thái</TableHeadCell>
            <TableHeadCell>Nhân viên</TableHeadCell>
            <TableHeadCell>Khách hàng</TableHeadCell>
            <TableHeadCell className="min-w-[420px]">
              <div className="grid grid-cols-[minmax(72px,0.9fr)_minmax(120px,1.6fr)_72px_56px] gap-2">
                <span>Mã SP</span>
                <span>Tên sản xuất</span>
                <span className="text-right">SL</span>
                <span>ĐVT</span>
              </div>
            </TableHeadCell>
            <TableHeadCell>Ghi chú</TableHeadCell>
            <TableHeadCell className="w-28" align="center">Thao tác</TableHeadCell>
          </TableHead>
          <TableBody>
            {filteredOrders.map(order => (
              <React.Fragment key={order.id}>
                <TableRow>
                  <td className="px-3 py-2.5 align-top font-black text-zinc-950">{order.orderCode || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs font-semibold text-zinc-600">
                    {formatOrderCreatedAt(order.createdAt)}
                  </td>
                  <td className="w-24 min-w-24 whitespace-nowrap px-3 py-2.5 align-top">
                    <StatusBadge label={order.orderType} color="rose" />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <StatusBadge label={order.status} color="amber" />
                  </td>
                  <td className="px-3 py-2.5 align-top font-semibold text-zinc-700">{order.staffName}</td>
                  <td className="px-3 py-2.5 align-top font-bold text-zinc-800">{order.customer}</td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="divide-y divide-zinc-100">
                      {getOrderProductLines(order).map((line, index) => {
                        const sizeText = line.kho && line.daiM
                          ? `${line.kho} × ${line.daiM}m`
                          : line.kho || line.daiM
                            ? `${line.kho || line.daiM}m`
                            : '';
                        const specText = [line.doLi, sizeText].filter(Boolean).join(' · ');
                        return (
                          <div key={`${order.id}-${line.productCode}-${line.productName}-${index}`} className="py-1.5 first:pt-0 last:pb-0">
                            <div className="grid grid-cols-[minmax(72px,0.9fr)_minmax(120px,1.6fr)_72px_56px] gap-2 text-xs font-semibold text-zinc-700">
                              <span className="font-black text-zinc-950">{line.productCode || '-'}</span>
                              <span className="text-zinc-800">{line.productionName || line.productName || '-'}</span>
                              <span className="text-right font-mono font-bold text-zinc-900">{line.quantity || '-'}</span>
                              <span className="font-bold text-zinc-600">{line.unit || '-'}</span>
                            </div>
                            {specText ? <div className="mt-0.5 text-[11px] font-semibold text-zinc-400">{specText}</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top font-semibold text-zinc-500">{order.note || '-'}</td>
                  <td className="px-3 py-2.5 align-top">
                    <RowActionsMenu label={`Thao tác ${order.orderCode || 'đơn hàng'}`}>
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
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => openEditForm(order)}
                          title="Sửa"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDelete ? (
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
                      ) : null}
                    </div>
                    </RowActionsMenu>
                  </td>
                </TableRow>
              </React.Fragment>
            ))}

            {!isLoadingOrders && filteredOrders.length === 0 && (
              <TableEmptyRow colSpan={9}>
                Bảng don_hang chưa có dữ liệu hoặc không có đơn phù hợp bộ lọc.
              </TableEmptyRow>
            )}
          </TableBody>
        </TableShell>
      </div>
    </div>
  );
}

export { formatTimeCell } from '../_shared/recordHelpers';
