import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowDown, ArrowUp, Archive, Eye, GripVertical, Loader2, Pencil, Plus, Printer, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useTabAccess } from '../../app/useTabAccess';
import { formatNumber, formatMoney, formatPercent, parseMoneyInput, parsePercentInput, sanitizeMoneyInput } from '../../utils';
import { convertProductQuantity } from '../../utils/productUnitConversion';
import { waitForPrintImagesReady } from '../../utils/printReady';
import { BackButton } from '../../components/layout/NavButtons';
import { RepeatableLineRow, RepeatableLinesBlock } from '../../components/RepeatableLinesBlock';
import { pickText, fileToDataUrl, uploadImage, formatCell } from '../_shared/recordHelpers';
import { SearchableSelect, SimpleSelect } from '../../components/shared/SearchableSelect';
import { Select2 } from '../../components/shared/Select2';
import {
  ORDER_TYPE_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_DEFAULT,
  isCutOrderType,
  SOUTH_ORDER_TYPE,
  SOUTH_TEM_OPTIONS,
  SOUTH_TEM_COLOR_OPTIONS,
  SOUTH_TEM_COLOR_DEFAULT,
  southTemColorLabel,
  appendSouthTemToTenGhep,
  buildSouthTemSuffix,
  parseSouthTemFromTenGhep,
  orderFieldClass,
  normalizeOrderProducts,
  findOrderProductById,
  resolveOrderProductFields,
  readUnitSuggestions,
  saveUnitSuggestion,
  calculateOrderConversion,
  calculateCutOrderWeight,
  extractProductWidth,
  conversionSupportsUnit,
  allowedOrderUnits,
  resolveCutOrderLineUnit,
  isCuonProduct,
  isTamProduct,
  listProductionNamesByCode,
  matchOrderProductByCodeAndProductionName,
  buildAllocatedQtyMap,
  getAllocatedQtyFromMap,
  duplicateLineStt,
  type OrderProductOption,
  type OrderProductConversion,
  type StaffOption,
  type CustomerOption
} from '../_shared/orderHelpers';
import { doLiDmWeightScale, extractDoLiDm, extractDoLiDmNumber, extractMang, buildCutAmisCodeFull, buildMaAmisMoi, buildOrderTenGhep, classifyProductPxGroup, normalizeDoLiToken, replaceCutLengthMeters, replaceCutWidthMeters, replaceDoLiDmInTenGhep, replaceMangInName, normalizeDoLiDm, seedProductionSpecs, setDinhMucKgInTenGhep } from '../../utils/productProductionName';
import {
  orderDuplicateDecimalText,
  parseSouthDinhMucKg,
  roundTotalKgInt,
  southDinhMucKgTotal,
  southOrderKgPerMeter,
  southScaledTlAndTotal
} from './southWeight';
export {
  orderDuplicateDecimalText,
  parseSouthDinhMucKg,
  roundTotalKgInt,
  southDinhMucKgTotal,
  southKgPerStandardMeter,
  southLengthScaledTotalKg,
  southOrderKgPerMeter,
  southScaledTlAndTotal
} from './southWeight';
import {
  parseOrderProductsFromRecord,
  summarizeOrderProducts,
  getOrderProductLines,
  formatOrderProductsSummary,
  withNormalizedProductStt,
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
import { showAppToast } from '../../lib/appToast';

export type { OrderProductLine, OrderRow };

interface OrderRowExt extends OrderRow {
  khu_vuc?: string;
}

const ORDER_PRODUCT_TABLE_MIN_WIDTH = 'min-w-[1420px]';
const ORDER_PRODUCTION_TABLE_MIN_WIDTH = 'min-w-[1660px]';
const ORDER_SOUTH_TABLE_MIN_WIDTH = 'min-w-[2440px]';
const ORDER_MIEN_NAM_TABLE_MIN_WIDTH = 'min-w-[2740px]';
export const PRODUCTION_ORDER_TYPE = 'Đơn sản xuất';
const orderProductGridClass =
  'grid-cols-[7rem_minmax(9.5rem,1.05fr)_minmax(12rem,1.35fr)_minmax(12rem,1.35fr)_6rem_minmax(7rem,0.9fr)_5rem_5.5rem_4.75rem_5.25rem_5.25rem_5.25rem_6.5rem]';
const orderProductionProductGridClass =
  'grid-cols-[7rem_minmax(9rem,1fr)_minmax(11rem,1.25fr)_minmax(11rem,1.25fr)_6rem_minmax(6.5rem,0.85fr)_5rem_5rem_4.5rem_4.5rem_4.5rem_5rem_5rem_5rem_5rem_6.5rem]';
const orderSouthProductGridClass =
  'grid-cols-[7rem_minmax(9rem,1fr)_minmax(11rem,1.25fr)_4.5rem_5rem_6rem_8.5rem_6rem_4.5rem_4.5rem_4.5rem_5rem_6rem_6rem_6.5rem_6.5rem_5rem_minmax(8rem,1fr)_5rem_6.5rem]';
const orderMienNamProductGridClass =
  'grid-cols-[7rem_minmax(9rem,1fr)_minmax(11rem,1.25fr)_4.5rem_5rem_6rem_8.5rem_6.5rem_7rem_5.5rem_4.5rem_5rem_6rem_6rem_6.5rem_6.5rem_5rem_minmax(8rem,1fr)_5rem_6.5rem]';
const ORDER_CONVERSION_PAGE_SIZE = 1000;
const CUSTOMER_ENTERED_KG_SOURCE = 'khach_hang_nhap_kg';
/** Tổng KG tự tính từ Định mức (cắt lẻ / miền nam) — server giữ số nhưng FE không coi là nhập tay. */
const DINH_MUC_KG_SOURCE = 'dinh_muc';
/** Ô Tìm Mã AMIS: hiện tối đa 400 kết quả đã lọc. Các Select khác vẫn mặc định 50. */
const ORDER_AMIS_SEARCH_MAX_RESULTS = 400;
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
      const deletedRaw = record.deleted_at ?? record.deletedAt;
      const deletedAt = deletedRaw ? formatCell(deletedRaw) : null;
      const products = parseOrderProductsFromRecord(record, { includeSourceProduct: true });
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
        updatedAt: updatedRaw ? formatCell(updatedRaw) : '',
        deletedAt,
        isDeleted: Boolean(deletedAt)
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
  /** JSON sản phẩm gốc của đơn hàng khi mở form sửa. */
  sourceProduct?: Record<string, unknown>;
  /** Chỉ bật sau khi người dùng thay đổi dữ liệu có ảnh hưởng tới quy đổi. */
  shouldRecalculateConversion?: boolean;
  productId: string;
  productCode: string;
  productName: string;
  productionName: string;
  /** Tên ghép đã lưu trên dòng đơn — SL lệnh SX khớp theo id + tên ghép. */
  tenGhep?: string;
  unit: string;
  quantity: string;
  /** SL theo miền — dùng cho "Đơn sản xuất", "Đơn theo quy cách của khách đặt" và "Đơn miền nam". SL tổng = Bắc + Trung + Nam. */
  slBac?: string;
  slTrung?: string;
  slNam?: string;
  /** Chỉ dùng cho đơn "Đơn theo quy cách của khách đặt" và "Đơn miền nam" (đơn cắt lẻ). */
  doLi?: string;
  /** Đơn cắt lẻ + miền nam: định mức thực tế `do_li_dm`, dạng `(đm n li)` / `(đm n kg)`. */
  doLiDm?: string;
  kho?: string;
  daiM: string;
  /** Màng (vd SUN PC): đơn miền nam mặc định SUN PC; các loại đơn khác để trống nếu không có. Sửa ô này tự đổi màng trong tên sản xuất. */
  mang?: string;
  /** Đơn cắt lẻ + miền nam: loại tem + màu tem + 2 Đầu. */
  tem?: string;
  mauTem?: string;
  danTem2Dau?: boolean;
  kg1Sp?: string;
  tongKg?: string;
  /** Đơn cắt lẻ + miền nam: định mức KG/tấm nhập tay — có giá trị thì Tổng KG = Định mức × SL. */
  dinhMucKg?: string;
  /** Đơn miền nam: độ dài tấm tiêu chuẩn (m). */
  doDaiTamTieuChuan?: string;
  /** Đơn miền nam: định mức tiêu chuẩn (kg). */
  dinhMucTieuChuanKg?: string;
  /** Tổng KG do khách hàng/người lập đơn nhập trực tiếp, được ưu tiên hơn định mức quy đổi. */
  manualTongKg?: boolean;
  /** Cờ nhập tay đọc từ dữ liệu đã lưu (không phải gõ trong phiên này) — đổi SL/Dài/ĐM thì tính lại thay vì giữ số cũ. */
  manualFromSaved?: boolean;
  /** STT dòng khi đơn được lưu (1-based). Dòng thêm/nhân bản trong form không có → chưa có SL lệnh SX. */
  savedStt?: number;
  conversionSource?: string;
  note: string;
  quyCach?: string;
  quyCachMDai?: number | string;
  tlCuon?: string;
  tlTam?: string;
  m2?: string;
  mDai?: string;
  conversionResults?: Array<{ unit: string; value: number }>;
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
    slBac: '',
    slTrung: '',
    slNam: '',
    daiM: '',
    mang: 'SUN PC',
    manualTongKg: false,
    shouldRecalculateConversion: false,
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

function reorderList<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Ô số trên đơn hàng: phần nghìn `,`, thập phân `.`. Rời ô thì số cũ kiểu `5,7` về `5.7`. */
function OrderNumberInput({ className, onWheel, onChange, onBlur, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      onChange={onChange}
      onBlur={event => {
        const next = orderDuplicateDecimalText(event.currentTarget.value);
        if (next !== event.currentTarget.value) {
          event.currentTarget.value = next;
          onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>);
        }
        onBlur?.(event);
      }}
      onWheel={event => {
        event.currentTarget.blur();
        onWheel?.(event);
      }}
      className={className}
    />
  );
}

const orderProductActionBtnClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white transition disabled:pointer-events-none disabled:opacity-35';

function OrderProductActions({
  index,
  total,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  moveButtonsInStt = false
}: {
  index: number;
  total: number;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate?: () => void;
  moveButtonsInStt?: boolean;
}) {
  const canDelete = total > 1;
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;
  return (
    <div className="flex h-11 w-[6.5rem] shrink-0 items-center justify-end gap-1">
      <button
        type="button"
        title="Xóa"
        disabled={!canDelete}
        className={`${orderProductActionBtnClass} border-rose-200 text-rose-600 hover:bg-rose-50`}
        onClick={event => {
          event.stopPropagation();
          if (canDelete) onDelete();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="sr-only">Xóa</span>
      </button>
      {moveButtonsInStt ? null : (
        <>
          <button
            type="button"
            title="Lên"
            disabled={!canMoveUp}
            className={`${orderProductActionBtnClass} border-zinc-200 text-zinc-700 hover:bg-zinc-100`}
            onClick={event => {
              event.stopPropagation();
              if (canMoveUp) onMoveUp();
            }}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span className="sr-only">Lên</span>
          </button>
          <button
            type="button"
            title="Xuống"
            disabled={!canMoveDown}
            className={`${orderProductActionBtnClass} border-zinc-200 text-zinc-700 hover:bg-zinc-100`}
            onClick={event => {
              event.stopPropagation();
              if (canMoveDown) onMoveDown();
            }}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span className="sr-only">Xuống</span>
          </button>
        </>
      )}
    </div>
  );
}

function OrderProductLineShell({
  index,
  total,
  selected,
  dragging,
  gridTemplateClass,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  moveButtonsInStt = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children
}: {
  index: number;
  total: number;
  selected: boolean;
  dragging: boolean;
  gridTemplateClass: string;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate?: () => void;
  moveButtonsInStt?: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={event => {
        event.preventDefault();
        onDrop();
      }}
      onClick={onSelect}
      className={`group rounded-lg ${selected ? 'bg-red-50/70' : ''} ${dragging ? 'opacity-70' : ''}`}
    >
      <RepeatableLineRow gridTemplateClass={gridTemplateClass} className="!py-2 first:!pt-2 last:!pb-2">
        <div
          draggable={total > 1}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={event => event.stopPropagation()}
          title="Kéo để đổi thứ tự"
          className="flex h-11 cursor-grab items-center gap-1 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="text-xs font-black tabular-nums text-zinc-500">{index + 1}</span>
          {moveButtonsInStt ? (
            <span className="ml-auto flex flex-col gap-0.5">
              <button
                type="button"
                title="Chuyển lên"
                disabled={index === 0}
                className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-30"
                onClick={event => {
                  event.stopPropagation();
                  onMoveUp();
                }}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="Chuyển xuống"
                disabled={index === total - 1}
                className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-30"
                onClick={event => {
                  event.stopPropagation();
                  onMoveDown();
                }}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </span>
          ) : null}
          {moveButtonsInStt && onDuplicate ? (
            <button
              type="button"
              title="Thêm dòng giống sản phẩm này ở bên dưới"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
              onClick={event => {
                event.stopPropagation();
                onDuplicate();
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="sr-only">Nhân bản dòng bên dưới</span>
            </button>
          ) : null}
        </div>
        {children}
        <div className="flex justify-end self-center">
          <OrderProductActions
            index={index}
            total={total}
            onDelete={onDelete}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDuplicate={onDuplicate}
            moveButtonsInStt={moveButtonsInStt}
          />
        </div>
      </RepeatableLineRow>
    </div>
  );
}

function orderCreatedAtToInput(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return new Date().toISOString().slice(0, 10);
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function readStoredOrderConversion(
  line: Pick<OrderProductFormLine, 'tongKg' | 'm2' | 'mDai' | 'conversionResults'>,
  targetUnit: 'kg' | 'm2' | 'm dài'
): number | null {
  const directValue = targetUnit === 'kg' ? line.tongKg : targetUnit === 'm2' ? line.m2 : line.mDai;
  if (String(directValue || '').trim()) {
    const parsed = parsePercentInput(String(directValue));
    if (Number.isFinite(parsed)) return parsed;
  }

  const normalizeUnit = (value: string) => value
    .trim()
    .toLocaleLowerCase('vi')
    .replace(/mét/g, 'm')
    .replace(/²/g, '2')
    .replace(/\s+/g, ' ');
  const normalizedTarget = normalizeUnit(targetUnit);
  const result = line.conversionResults?.find(item => {
    const unit = normalizeUnit(item.unit);
    if (normalizedTarget === 'm dài') return unit === 'm dài' || unit === 'm';
    return unit === normalizedTarget;
  });
  return result && Number.isFinite(result.value) ? result.value : null;
}

/** Số miền đã nhập. Ô trống không tính. `0` vẫn là giá trị đã gõ. */
function readOptionalRegionQty(raw: unknown): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const parsed = parsePercentInput(text);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

/**
 * SL tổng = Bắc + Trung + Nam chỉ khi có ít nhất một miền > 0.
 * Ba ô trống hoặc toàn 0 (dữ liệu cũ lưu nhầm) không được ghi đè SL tổng.
 */
function positiveRegionTotal(bac: unknown, trung: unknown, nam: unknown): number | null {
  const parts = [readOptionalRegionQty(bac), readOptionalRegionQty(trung), readOptionalRegionQty(nam)];
  if (!parts.some(value => value !== null && value > 0)) return null;
  return parts.reduce((sum, value) => sum + (value ?? 0), 0);
}

export function orderProductLinesToPayload(
  lines: OrderProductFormLine[],
  productOptions: OrderProductOption[],
  orderType?: string,
  productConversions: OrderProductConversion[] = [],
  ngayCat?: string
) {
  const isCutLikeOrder = isCutOrderType(orderType) || orderType === SOUTH_ORDER_TYPE;
  const isProductionOrder = orderType === PRODUCTION_ORDER_TYPE;
  return lines
    .filter(line => line.productCode.trim() || line.productName.trim())
    .map((line, index) => {
      const selectedProduct = resolveOrderLineProduct(productOptions, line);
      const resolved = resolveOrderProductFields(productOptions, line.productCode, {
        productName: line.productName,
        unit: line.unit
      });
      const productCode = line.productCode.trim();
      const productName = selectedProduct?.name || resolved.productName || line.productName.trim();
      const allowedUnits = selectedProduct ? allowedOrderUnits(selectedProduct) : [];
      // Đơn cắt/miền nam: mặc định Tấm; SP Đặc/Sóng giữ lựa chọn Tấm/Cuộn trên form.
      const unit = isCutLikeOrder
        ? resolveCutOrderLineUnit(selectedProduct, line.unit)
        : selectedProduct
          ? (allowedUnits.includes(line.unit.trim()) ? line.unit.trim() : allowedUnits[0] || 'kg')
          : line.unit.trim() || resolved.unit;
      const bacVal = readOptionalRegionQty(line.slBac);
      const trungVal = readOptionalRegionQty(line.slTrung);
      const namVal = readOptionalRegionQty(line.slNam);
      const isSouthOrder = orderType === SOUTH_ORDER_TYPE;
      const isRegionOrder = isProductionOrder || isCutLikeOrder;
      const regionTotal = isSouthOrder
        ? (namVal !== null && namVal > 0 ? namVal : null)
        : isRegionOrder
          ? positiveRegionTotal(line.slBac, line.slTrung, line.slNam)
          : null;
      const typedQuantity = parsePercentInput(line.quantity);
      // Đơn có Bắc/Trung/Nam: SL tổng chỉ lấy từ ba ô miền, không nhận số gõ tay.
      const quantity = isRegionOrder ? (regionTotal ?? Number.NaN) : typedQuantity;
      const daiM = parsePercentInput(line.daiM);
      const note = line.note.trim();
      const temValue = String(line.tem || '').trim();
      // Tem / Màu tem / 2 Đầu độc lập: lưu đúng như màn hình, không tự điền, không tự xóa hộ.
      // Riêng hậu tố tên chỉ ghép khi có tem (buildSouthTemSuffix).
      const mauTemValue = String(line.mauTem || '').trim();
      const danTem2DauValue = Boolean(line.danTem2Dau);
      // Form chỉ nhập số; khi lưu/ghép tên luôn hiểu là (đm n li).
      const doLiDmValue = isCutLikeOrder ? normalizeDoLiDm(line.doLiDm, 'li') : '';
      // Ghi đè stale trong sourceProduct khi user xóa tem/màu/bỏ tick 2 Đầu (undefined bị JSON.stringify loại bỏ).
      const moTaTem = isCutLikeOrder
        ? buildSouthTemSuffix(temValue, mauTemValue, danTem2DauValue).trim()
        : '';
      // Màng: miền nam luôn lưu (mặc định SUN PC); các loại đơn khác chỉ lưu khi người dùng nhập.
      const trimmedMang = String(line.mang ?? '').trim();
      const specExtraFields = isCutLikeOrder
        ? {
            tem: temValue || undefined,
            mau_tem: mauTemValue || undefined,
            dan_tem_2_dau: danTem2DauValue ? 1 : undefined,
            do_li_dm: doLiDmValue || undefined,
            mo_ta_tem: moTaTem || undefined,
            ...(isSouthOrder
              ? {
                  mang: line.mang !== undefined ? line.mang.trim() : 'SUN PC',
                  do_dai_tam_tieu_chuan: parsePercentInput(String(line.doDaiTamTieuChuan ?? '')) || undefined,
                  dinh_muc_tieu_chuan_kg: parsePercentInput(String(line.dinhMucTieuChuanKg ?? '')) || undefined
                }
              : trimmedMang ? { mang: trimmedMang } : {})
          }
        : trimmedMang ? { mang: trimmedMang } : {};
      const shouldRecalculateConversion = line.shouldRecalculateConversion !== false;
      const regionFields = isSouthOrder
        ? { so_luong_nam: namVal === null ? undefined : namVal }
        : isRegionOrder
          ? {
              so_luong_bac: bacVal === null ? undefined : bacVal,
              so_luong_trung: trungVal === null ? undefined : trungVal,
              so_luong_nam: namVal === null ? undefined : namVal
            }
          : {};

      const catalogTenGhep = String(selectedProduct?.tenGhep || '').trim();
      const catalogProductionName = String(selectedProduct?.productionName || '').trim();
      const catalogMainLength = Number(String(selectedProduct?.doDaiM ?? '').replace(/m\s*$/iu, '').replace(',', '.'));
      const catalogWidth = Number(String(selectedProduct?.doDayM ?? '').replace(/m\s*$/iu, '').replace(',', '.'));
      const enteredWidth = parsePercentInput(line.kho || '');
      const widthDiffersForCode =
        Number.isFinite(enteredWidth) &&
        enteredWidth > 0 &&
        (!Number.isFinite(catalogWidth) || catalogWidth <= 0 || Math.abs(enteredWidth - catalogWidth) > 1e-9);
      // Chỉ nhóm Đặc/Sóng mới thay đúng token m dài chính (kể cả khi không đứng cuối);
      // các nhóm VTHH khác giữ luật cũ (thay mét cuối / thêm - Nm).
      const pxGroup = classifyProductPxGroup(selectedProduct?.group || '');
      const mainForCut =
        (pxGroup === 'dac' || pxGroup === 'song') &&
        Number.isFinite(catalogMainLength) &&
        catalogMainLength > 0
          ? catalogMainLength
          : undefined;
      // Mã AMIS mới: miền nam dùng buildMaAmisMoi. Cắt lẻ dùng buildCutAmisCodeFull
      // (viết tắt từ tên sản xuất + khổ + mét cắt + đm + màng + tem). ma_amis_cu = mã gốc.
      const cutLengthForCode = Number.isFinite(daiM) && daiM > 0 ? daiM : undefined;
      const cutDiffersForCode =
        cutLengthForCode != null &&
        (!Number.isFinite(catalogMainLength) ||
          catalogMainLength <= 0 ||
          Math.abs(cutLengthForCode - catalogMainLength) > 1e-9);
      const variantSpecs =
        isCutLikeOrder && (productCode || selectedProduct)
          ? seedProductionSpecs({
              tenSanXuat: line.productionName.trim() || catalogProductionName,
              maAmis: selectedProduct?.code || productCode,
              nhomVthh: selectedProduct?.group || ''
            })
          : null;
      const doLiLine = String(line.doLi || '').trim();
      const doLiDiffersForCode =
        Boolean(doLiLine && variantSpecs?.doLi) &&
        normalizeDoLiToken(doLiLine) !== normalizeDoLiToken(variantSpecs?.doLi || '');
      const lineMang = isSouthOrder
        ? (line.mang !== undefined ? line.mang.trim() : 'SUN PC')
        : (line.mang?.trim() || variantSpecs?.mang || undefined);
      const maAmisMoiValue =
        isCutLikeOrder &&
        (selectedProduct?.code || productCode) &&
        (cutDiffersForCode ||
          widthDiffersForCode ||
          doLiDiffersForCode ||
          doLiDmValue ||
          variantSpecs?.hangPhe ||
          temValue ||
          mauTemValue ||
          danTem2DauValue ||
          lineMang ||
          variantSpecs?.mang)
          ? (isSouthOrder ? buildMaAmisMoi : buildCutAmisCodeFull)({
              baseMaAmis: selectedProduct?.code || productCode,
              nhomVthh: selectedProduct?.group,
              cutLengthM: cutDiffersForCode ? cutLengthForCode : undefined,
              cutWidthM: widthDiffersForCode ? enteredWidth : undefined,
              doLi: doLiDiffersForCode ? doLiLine : undefined,
              doLiDm: doLiDmValue || undefined,
              hangPhe: variantSpecs?.hangPhe || undefined,
              mang: lineMang || variantSpecs?.mang || undefined,
              tem: temValue || undefined,
              mauTem: mauTemValue || undefined,
              danTem2Dau: danTem2DauValue || undefined,
              tenSanXuat: isSouthOrder ? undefined : line.productionName.trim() || catalogProductionName,
              ngayCat: ngayCat || undefined
            })
          : '';
      const variantExtraFields = maAmisMoiValue
        ? {
            ma_amis: maAmisMoiValue,
            ...(selectedProduct?.code || productCode ? { ma_amis_cu: selectedProduct?.code || productCode } : {})
          }
        : {};
      const resolveTenGhep = (tenSanXuat: string, cutLength?: number) => {
        // Ưu tiên tên ghép đã lưu trên danh mục SP (đúng tuyệt đối).
        // Đơn cắt lẻ / miền nam: thay đúng token m dài chính thành mét cắt
        // (tránh "...6m - 8m" khi m dài không đứng cuối).
        // Đơn cắt lẻ / miền nam: thay segment (đm n li|kg) theo định mức thực tế, giữ nguyên token do_li.
        const isMatchingCatalog = catalogTenGhep && (
          !tenSanXuat ||
          tenSanXuat === catalogProductionName ||
          replaceMangInName(tenSanXuat, '') === replaceMangInName(catalogProductionName, '')
        );
        if (isMatchingCatalog) {
          let base = cutLength != null
            ? replaceCutLengthMeters(catalogTenGhep, cutLength, mainForCut)
            : catalogTenGhep;
          if (widthDiffersForCode) {
            base = replaceCutWidthMeters(
              base,
              enteredWidth,
              Number.isFinite(catalogWidth) && catalogWidth > 0 ? catalogWidth : undefined,
              cutLength
            );
          }
          if (doLiDmValue) {
            base = replaceDoLiDmInTenGhep(base, doLiDmValue, 'li');
          }
          if (isSouthOrder ? lineMang !== undefined : Boolean(lineMang)) {
            base = replaceMangInName(base, String(lineMang), variantSpecs?.mang);
          }
          // Đơn miền nam: đưa Định mức tiêu chuẩn của khách vào tên, vd (đm 4.8 kg).
          if (isSouthOrder) base = setDinhMucKgInTenGhep(base, line.dinhMucTieuChuanKg);
          return isCutLikeOrder ? appendSouthTemToTenGhep(base, temValue, mauTemValue, danTem2DauValue) : base;
        };
        let tenGhep = buildOrderTenGhep(tenSanXuat, {
          nhomVthh: selectedProduct?.group,
          maAmis: selectedProduct?.newCode,
          cutLengthM: cutLength,
          doLiDm: doLiDmValue || undefined,
          mang: lineMang || undefined
        });
        if (tenGhep && widthDiffersForCode) {
          tenGhep = replaceCutWidthMeters(
            tenGhep,
            enteredWidth,
            Number.isFinite(catalogWidth) && catalogWidth > 0 ? catalogWidth : undefined,
            cutLength
          );
        }
        if (!tenGhep) return undefined;
        if (isSouthOrder) tenGhep = setDinhMucKgInTenGhep(tenGhep, line.dinhMucTieuChuanKg);
        return isCutLikeOrder ? appendSouthTemToTenGhep(tenGhep, temValue, mauTemValue, danTem2DauValue) : tenGhep;
      };

      if (!shouldRecalculateConversion) {
        const storedConversionResults = line.conversionResults
          ?.filter(result => result.unit && Number.isFinite(result.value))
          .map(result => ({ don_vi: result.unit, gia_tri: result.value }));
        const rawTenSanXuat = line.productionName.trim() || '';
        const shouldReplaceMang = isSouthOrder ? lineMang !== undefined : Boolean(lineMang);
        const tenSanXuat = shouldReplaceMang && lineMang !== undefined
          ? replaceMangInName(rawTenSanXuat, lineMang, variantSpecs?.mang)
          : rawTenSanXuat;
        const quyCachMDaiStored = Number.isFinite(daiM) && daiM > 0
          ? daiM
          : Number.isFinite(Number(line.quyCachMDai)) && Number(line.quyCachMDai) > 0
            ? Number(line.quyCachMDai)
            : undefined;
        const tenGhep = resolveTenGhep(tenSanXuat, quyCachMDaiStored);

        return {
          ...(line.sourceProduct || {}),
          san_pham_id: line.productId.trim() || selectedProduct?.id || undefined,
          ma_sp: productCode,
          ten_sp: line.productName.trim(),
          ten_san_xuat: tenSanXuat,
          ...(tenGhep ? { ten_ghep: tenGhep } : {}),
          don_vi: line.unit.trim() || resolved.unit,
          so_luong: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
          ghi_chu: note || undefined,
          stt: index + 1,
          recalculate_conversion: false,
          ...regionFields,
          ...specExtraFields,
          ...variantExtraFields,
          ...(!line.sourceProduct && line.kg1Sp ? { kg_1_sp: parsePercentInput(line.kg1Sp) } : {}),
          ...(!line.sourceProduct && line.tongKg ? { tong_kg: parsePercentInput(line.tongKg) } : {}),
          ...(!line.sourceProduct && line.m2 ? { m2: parsePercentInput(line.m2) } : {}),
          ...(!line.sourceProduct && line.mDai ? { m_dai: parsePercentInput(line.mDai) } : {}),
          ...(!line.sourceProduct && line.tlCuon ? { tl_cuon: parsePercentInput(line.tlCuon) } : {}),
          ...(!line.sourceProduct && line.tlTam ? { tl_tam: parsePercentInput(line.tlTam) } : {}),
          ...(!line.sourceProduct && line.conversionSource ? { nguon_quy_doi: line.conversionSource } : {}),
          ...(!line.sourceProduct && storedConversionResults?.length
            ? { ket_qua_quy_doi: storedConversionResults }
            : {}),
          ...(isCutLikeOrder && Number.isFinite(daiM) && daiM > 0 ? { dai_m: daiM } : {}),
          ...(isCutLikeOrder && Number.isFinite(enteredWidth) && enteredWidth > 0 ? { kho: enteredWidth } : {}),
          ...(isCutLikeOrder && line.quyCachMDai ? { quy_cach_m_dai: parsePercentInput(String(line.quyCachMDai)) } : {})
        };
      }

      const sanPhamId = selectedProduct?.id || (line.productId?.trim() ? line.productId.trim() : undefined);
      const conversion = sanPhamId ? productConversions.find(item => item.sanPhamId === sanPhamId) : undefined;
      const roundConversionValue = (value: number) => Math.round(value * 100) / 100;
      const parsedManualKg = line.manualTongKg ? parsePercentInput(String(line.tongKg ?? '')) : Number.NaN;
      // Tổng KG luôn lưu số nguyên (làm tròn).
      const manualTotalKg = Number.isFinite(parsedManualKg) && parsedManualKg > 0
        ? Math.round(parsedManualKg)
        : null;
      // Đơn cắt lẻ: số nhập tay ưu tiên — Tổng KG = số đã nhập.
      // Đơn miền nam: KG/1m = định mức tiêu chuẩn (kg) / độ dài tấm tiêu chuẩn (m).
      const dinhMucKgPerUnit = isCutLikeOrder && !isSouthOrder ? parseSouthDinhMucKg(line.dinhMucKg) : null;
      const southKgPerMeter = isSouthOrder
        ? southOrderKgPerMeter(
            line.dinhMucTieuChuanKg,
            null,
            null,
            line.doDaiTamTieuChuan
          )
        : null;
      // Có độ dài tấm tiêu chuẩn: Tổng = kg/1m × Dài × SL. Thiếu thì Tổng = Định mức tiêu chuẩn (kg) × SL (tổng).
      const southScaledTotalKg = isSouthOrder && Number.isFinite(quantity) && quantity > 0
        ? (southKgPerMeter !== null && Number.isFinite(daiM) && daiM > 0
            ? southScaledTlAndTotal(southKgPerMeter, daiM, quantity).total
            : southDinhMucKgTotal(line.dinhMucTieuChuanKg, quantity))
        : null;
      const dinhMucTotalKg = southScaledTotalKg ?? (
        dinhMucKgPerUnit !== null && Number.isFinite(quantity) && quantity > 0
          ? Math.round(dinhMucKgPerUnit * quantity * 100) / 100
          : null
      );
      // Số nhập tay luôn ưu tiên hơn số tự tính (kể cả đơn miền nam đã cho sửa Tổng KG).
      const effectiveManualTotalKg = manualTotalKg ?? dinhMucTotalKg;
      const cutWeight = isCutLikeOrder
        ? calculateCutOrderWeight(line.daiM, String(quantity), conversion, unit, productCode, productName, line.kho || '', doLiDmWeightScale(line.doLiDm, selectedProduct?.doLiDm))
        : null;

      let cutQuyCach: string | undefined;
      let cutM2: number | undefined;
      let cutMDai: number | undefined;
      let cutTlCuon: number | undefined;
      let cutTlTam: number | undefined;

      if (isCutLikeOrder) {
        if (Number.isFinite(daiM) && daiM > 0 && Number.isFinite(quantity) && quantity > 0) {
          cutMDai = roundConversionValue(daiM * quantity);
          const width = Number.isFinite(enteredWidth) && enteredWidth > 0
            ? enteredWidth
            : extractProductWidth(productCode, productName, conversion);
          if (width && width > 0) {
            cutM2 = roundConversionValue(daiM * width * quantity);
          }
        }

        const manualKgPerUnit = effectiveManualTotalKg !== null && Number.isFinite(quantity) && quantity > 0
          ? roundConversionValue(effectiveManualTotalKg / quantity)
          : null;
        if (manualKgPerUnit !== null && isCuonProduct(unit)) {
          cutTlCuon = manualKgPerUnit;
        } else if (isCuonProduct(unit) && cutWeight?.kg1Sp) {
          // ĐVT Cuộn: TL/cuộn = TL tính theo Dài (m) đặt, không dùng số cố định của danh mục.
          cutTlCuon = roundConversionValue(cutWeight.kg1Sp);
        } else if (conversion?.trongLuongKgCuon) {
          cutTlCuon = roundConversionValue(conversion.trongLuongKgCuon);
        }
        if (manualKgPerUnit !== null && isTamProduct(unit)) {
          cutTlTam = manualKgPerUnit;
        } else if (cutWeight?.kg1Sp && !isCuonProduct(unit)) {
          cutTlTam = roundConversionValue(cutWeight.kg1Sp);
        } else if (conversion?.trongLuongKgTam) {
          cutTlTam = roundConversionValue(conversion.trongLuongKgTam);
        }
        // Định mức KG chính là TL/tấm, ghi đúng giá trị đã nhập.
        // Miền nam có độ dài tiêu chuẩn: TL/tấm = kg/1m × m dài đặt.
        // Số nhập tay đã ưu tiên ở trên (manualKgPerUnit) nên chỉ suy từ định mức khi không nhập tay.
        if (effectiveManualTotalKg === null && southScaledTotalKg !== null && isTamProduct(unit) && Number.isFinite(quantity) && quantity > 0) {
          cutTlTam = roundConversionValue(southScaledTotalKg / quantity);
        } else if (effectiveManualTotalKg === null && dinhMucKgPerUnit !== null && isTamProduct(unit)) {
          cutTlTam = dinhMucKgPerUnit;
        }
      }

      const quyCachMDai = Number.isFinite(daiM) && daiM > 0
        ? Number(daiM)
        : Number.isFinite(Number(line.quyCachMDai)) && Number(line.quyCachMDai) > 0
          ? Number(line.quyCachMDai)
          : undefined;

      const cutResults: Array<{ don_vi: string; gia_tri: number }> = [];
      // Tổng KG luôn lưu số nguyên (làm tròn).
      // Số nhập tay lưu số nguyên; số tự tính = TL đã làm tròn × SL (2 số lẻ) để tích luôn khớp.
      const finalCutTotalKg = manualTotalKg !== null
        ? roundTotalKgInt(manualTotalKg)
        : (dinhMucTotalKg !== null && dinhMucTotalKg > 0 ? dinhMucTotalKg : (cutWeight?.tongKg && cutWeight.tongKg > 0 ? cutWeight.tongKg : null));
      if (finalCutTotalKg !== null && finalCutTotalKg > 0) {
        cutResults.push({ don_vi: 'kg', gia_tri: finalCutTotalKg });
      }
      if (cutM2 !== undefined && cutM2 > 0) {
        cutResults.push({ don_vi: 'm2', gia_tri: cutM2 });
      }
      if (cutMDai !== undefined && cutMDai > 0) {
        cutResults.push({ don_vi: 'm dài', gia_tri: cutMDai });
      }

      const rawTenSanXuat =
        line.productionName.trim() || selectedProduct?.productionName || resolved.productionName || '';
      const shouldReplaceMangName = isSouthOrder ? lineMang !== undefined : Boolean(lineMang);
      const tenSanXuat = shouldReplaceMangName && lineMang !== undefined
        ? replaceMangInName(rawTenSanXuat, lineMang, variantSpecs?.mang)
        : rawTenSanXuat;
      const tenGhep = resolveTenGhep(tenSanXuat, quyCachMDai);

      return {
        san_pham_id: selectedProduct?.id || line.productId.trim() || undefined,
        ma_sp: productCode,
        ten_sp: productName,
        ten_san_xuat: tenSanXuat,
        ...(tenGhep ? { ten_ghep: tenGhep } : {}),
        don_vi: unit,
        so_luong: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
        ghi_chu: note || undefined,
        stt: index + 1,
        recalculate_conversion: true,
        ...regionFields,
        ...specExtraFields,
        ...variantExtraFields,
        ...(isCutLikeOrder
          ? {
              ...(quyCachMDai !== undefined ? { quy_cach_m_dai: quyCachMDai } : {}),
              dai_m: Number.isFinite(daiM) && daiM > 0 ? daiM : undefined,
              ...(Number.isFinite(enteredWidth) && enteredWidth > 0 ? { kho: enteredWidth } : {}),
              ...(cutM2 !== undefined && cutM2 > 0 ? { m2: cutM2 } : {}),
              ...(cutMDai !== undefined && cutMDai > 0 ? { m_dai: cutMDai } : {}),
              ...(cutTlCuon !== undefined && cutTlCuon > 0 ? { tl_cuon: cutTlCuon } : {}),
              ...(cutTlTam !== undefined && cutTlTam > 0 ? { tl_tam: cutTlTam } : {})
            }
          : {}),
        ...(finalCutTotalKg !== null
          ? {
              ...(effectiveManualTotalKg === null && cutWeight?.kg1Sp && cutWeight.kg1Sp > 0 && cutWeight.kg1Sp !== cutTlTam && cutWeight.kg1Sp !== cutTlCuon
                ? { kg_1_sp: roundConversionValue(cutWeight.kg1Sp) }
                : {}),
              tong_kg: finalCutTotalKg,
              // Lưu luôn Định mức KG tự tính (TL/Tấm hoặc TL/Cuộn theo ĐVT) để DB có sẵn giá trị.
              ...((): { dinh_muc_kg?: number } => {
                const perUnit = dinhMucKgPerUnit ?? (isCuonProduct(unit) ? cutTlCuon : cutTlTam);
                return perUnit !== undefined && perUnit !== null && perUnit > 0 ? { dinh_muc_kg: perUnit } : {};
              })(),
              // Chỉ số người dùng gõ mới là "khách nhập"; tổng tự tính từ định mức gắn nhãn riêng (server vẫn giữ số).
              nguon_quy_doi: manualTotalKg !== null
                ? CUSTOMER_ENTERED_KG_SOURCE
                : dinhMucTotalKg !== null
                  ? DINH_MUC_KG_SOURCE
                  : cutWeight?.source,
              ket_qua_quy_doi: cutResults
            }
          : cutResults.length > 0
            ? { ket_qua_quy_doi: cutResults }
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

  const productLines = getOrderProductLines(order).map((line, lineIndex) => {
    const fallbackTem = line.tem || line.mauTem || line.danTem2Dau ? null : parseSouthTemFromTenGhep(line.tenGhep);
    const keepRegionQty = positiveRegionTotal(line.soLuongBac, line.soLuongTrung, line.soLuongNam) !== null;
    return {
    key: `order-product-${line.productCode}-${Math.random().toString(36).slice(2, 7)}`,
    sourceProduct: line.sourceProduct ? { ...line.sourceProduct } : undefined,
    savedStt: lineIndex + 1,
    // Đơn miền nam: Tổng KG đã lưu lệch công thức (ĐM tiêu chuẩn × SL / KG/1m × Dài × SL) thì tính lại khi mở để không hiện số cũ.
    shouldRecalculateConversion: (() => {
      if (orderType !== SOUTH_ORDER_TYPE) return false;
      const qty = parsePercentInput(String(line.soLuongNam || line.quantity || ''));
      const stored = parsePercentInput(String(line.tongKg || ''));
      if (!(qty > 0) || parseSouthDinhMucKg(line.dinhMucTieuChuanKg) === null) return false;
      const perMeter = southOrderKgPerMeter(line.dinhMucTieuChuanKg, null, null, line.doDaiTamTieuChuan);
      const daiM = parsePercentInput(String(line.daiM || ''));
      const expected = perMeter !== null && daiM > 0
        ? southScaledTlAndTotal(perMeter, daiM, qty).total
        : southDinhMucKgTotal(line.dinhMucTieuChuanKg, qty);
      return expected !== null && !(Math.abs(stored - expected) <= 0.5);
    })(),
    productId: line.productId || '',
    productCode: orderCellToInput(line.productCode),
    productName: orderCellToInput(line.productName),
    productionName: orderCellToInput(line.productionName || ''),
    tenGhep: line.tenGhep || '',
    unit: orderCellToInput(line.unit),
    quantity: orderDuplicateDecimalText(orderCellToInput(line.quantity)),
    slBac: keepRegionQty ? orderDuplicateDecimalText(line.soLuongBac || '') : '',
    slTrung: keepRegionQty ? orderDuplicateDecimalText(line.soLuongTrung || '') : '',
    slNam: keepRegionQty ? orderDuplicateDecimalText(line.soLuongNam || '') : '',
    daiM: orderDuplicateDecimalText(line.daiM || ''),
    kho: orderDuplicateDecimalText(line.kho || ''),
    mang: line.mang !== undefined ? orderCellToInput(line.mang) : (orderType === SOUTH_ORDER_TYPE ? 'SUN PC' : ''),
    doDaiTamTieuChuan: orderDuplicateDecimalText(line.doDaiTamTieuChuan || ''),
    dinhMucTieuChuanKg: orderDuplicateDecimalText(line.dinhMucTieuChuanKg || ''),
    doLi: orderDuplicateDecimalText(line.doLi || ''),
    doLiDm: orderDuplicateDecimalText(extractDoLiDmNumber(line.doLiDm || '')),
    tem: orderCellToInput(line.tem || fallbackTem?.tem || ''),
    mauTem: orderCellToInput(line.mauTem || fallbackTem?.mauTem || ''),
    danTem2Dau: Boolean(line.danTem2Dau ?? fallbackTem?.danTem2Dau ?? false),
    kg1Sp: orderDuplicateDecimalText(line.kg1Sp || ''),
    tongKg: orderDuplicateDecimalText(line.tongKg || ''),
    dinhMucKg: orderDuplicateDecimalText(line.dinhMucKg || ''),
    // Đơn miền nam có Định mức tiêu chuẩn: Tổng KG = ĐM × SL tự tính, không đóng băng số cũ.
    manualTongKg:
      line.conversionSource === CUSTOMER_ENTERED_KG_SOURCE &&
      !(orderType === SOUTH_ORDER_TYPE && parseSouthDinhMucKg(line.dinhMucTieuChuanKg) !== null),
    manualFromSaved: line.conversionSource === CUSTOMER_ENTERED_KG_SOURCE,
    conversionSource: line.conversionSource || '',
    note: line.note || '',
    quyCach: line.quyCach || (line.quyCachMDai ? `Dài ${line.quyCachMDai}m` : ''),
    quyCachMDai: line.quyCachMDai || (line.daiM ? line.daiM : ''),
    tlCuon: line.tlCuon || '',
    tlTam: line.tlTam || '',
    m2: line.m2 || '',
    mDai: line.mDai || '',
    conversionResults: line.conversionResults?.map(result => ({ ...result }))
    };
  });

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
  const [restoringOrderId, setRestoringOrderId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [productOptions, setProductOptions] = useState<OrderProductOption[]>([]);
  const [productConversions, setProductConversions] = useState<OrderProductConversion[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [productSyncMessage, setProductSyncMessage] = useState('');
  const [orderForm, setOrderForm] = useState<OrderFormState>(emptyOrderForm);
  const [orderFormOverlayEl, setOrderFormOverlayEl] = useState<HTMLDivElement | null>(null);
  const [selectedProductLineKey, setSelectedProductLineKey] = useState<string | null>(null);
  const [dragProductIndex, setDragProductIndex] = useState<number | null>(null);
  /** Danh sách lệnh SX thô (API) — nguồn tính cột "SL lệnh SX" theo từng dòng đơn. */
  const [lenhSxRows, setLenhSxRows] = useState<unknown[]>([]);

  const loadLenhSxRows = async () => {
    try {
      const res = await fetch('/api/lenh-sx');
      const data = await res.json().catch(() => ({}));
      const rows = (data as { productionOrders?: unknown }).productionOrders;
      setLenhSxRows(Array.isArray(rows) ? rows : []);
    } catch {
      setLenhSxRows([]);
    }
  };

  /** Map tổng SL đã lập lệnh theo (mã đơn, SP) — tra O(1)/dòng, memo theo danh sách lệnh. */
  const allocatedQtyMap = useMemo(() => buildAllocatedQtyMap(lenhSxRows), [lenhSxRows]);

  const loadOrders = async (includeDeleted = showDeleted) => {
    setIsLoadingOrders(true);
    setOrdersError('');

    try {
      const res = await fetch(`/api/don-hang${includeDeleted ? '?includeDeleted=1' : ''}`);
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

  const toggleShowDeleted = () => {
    const next = !showDeleted;
    setShowDeleted(next);
    setSearchText('');
    setSelectedType('all');
    void loadOrders(next);
  };

  /** Danh sách theo chế độ xem: mặc định ẩn đơn đã xóa mềm; thùng rác chỉ hiện đơn đã xóa. */
  const visibleOrders = useMemo(
    () => (showDeleted ? orders.filter(order => order.isDeleted) : orders.filter(order => !order.isDeleted)),
    [orders, showDeleted]
  );

  useEffect(() => {
    loadOrders();
    void loadLenhSxRows();
  }, []);

  useEffect(() => {
    if (formMode) void loadLenhSxRows();
  }, [formMode]);

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

  /** Đồng bộ lại danh mục SP + bảng quy đổi ngay trong form thêm/sửa.
   * Chỉ setProductOptions/setProductConversions — KHÔNG đụng orderForm nên
   * các dòng đã chọn giữ nguyên định mức (shouldRecalculateConversion=false
   * vẫn hiện số đã lưu). Chọn lại SP ở dòng đó sẽ tính theo quy đổi mới. */
  const reloadProductLookups = async () => {
    if (isSyncingProducts) return;
    setIsSyncingProducts(true);
    setProductSyncMessage('');
    try {
      const [productRes, conversionRes] = await Promise.all([
        fetch('/api/san-pham?format=table'),
        fetch(`/api/bang-quy-doi-san-pham?page=1&pageSize=${ORDER_CONVERSION_PAGE_SIZE}`)
      ]);
      const productData = await productRes.json().catch(() => ({}));
      const conversionData = await conversionRes.json().catch(() => ({}));
      if (!productRes.ok) {
        throw new Error((productData as any).error || 'Không thể tải hàng hóa.');
      }
      if (!conversionRes.ok) {
        throw new Error((conversionData as any).error || 'Không thể tải bảng quy đổi sản phẩm.');
      }
      const conversions = Array.isArray((conversionData as any).items)
        ? (conversionData as any).items as OrderProductConversion[]
        : [];
      const conversionTotal = Number((conversionData as any).total) || conversions.length;
      for (let page = 2; conversions.length < conversionTotal; page += 1) {
        const res = await fetch(`/api/bang-quy-doi-san-pham?page=${page}&pageSize=${ORDER_CONVERSION_PAGE_SIZE}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as any).error || 'Không thể tải đầy đủ bảng quy đổi sản phẩm.');
        conversions.push(...(Array.isArray((data as any).items) ? (data as any).items as OrderProductConversion[] : []));
      }
      const nextOptions = normalizeOrderProducts(productData);
      setProductOptions(nextOptions);
      setProductConversions(conversions);
      setProductSyncMessage(`Đã đồng bộ ${nextOptions.length} sản phẩm.`);
    } catch (error: any) {
      setLookupError(error.message || 'Không thể đồng bộ sản phẩm.');
    } finally {
      setIsSyncingProducts(false);
    }
  };

  useEffect(() => {
    if (!formMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [formMode]);

  const openAddForm = () => {
    if (!canCreate) return;
    setFormError('');
    setActionMessage('');
    setProductSyncMessage('');
    setEditingId(null);
    setOrderForm({
      ...emptyOrderForm(),
      orderCode: generateNextOrderCode(orders.map(order => order.orderCode))
    });
    setFormMode('add');
    setSelectedProductLineKey(null);
    setDragProductIndex(null);
  };

  const openEditForm = (order: OrderRow) => {
    if (!canEdit) return;
    setFormError('');
    setActionMessage('');
    setProductSyncMessage('');
    setViewingOrder(null);
    setEditingId(order.id);
    setOrderForm(orderToForm(order));
    setFormMode('edit');
    setSelectedProductLineKey(null);
    setDragProductIndex(null);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError('');
    setProductSyncMessage('');
    setSelectedProductLineKey(null);
    setDragProductIndex(null);
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

  /** Mọi tên sản xuất của đúng mã AMIS (không lọc thêm theo Tên SP để không sót variant). */
  const getProductionNameOptions = (productCode: string, productionName = '') => {
    const list = listProductionNamesByCode(productOptions, productCode, productionName);
    const trimmed = productionName.trim();
    if (trimmed && !list.includes(trimmed)) {
      return [trimmed, ...list];
    }
    return list;
  };

  const pickProductionName = (key: string, productionName: string) => {
    setOrderForm(prev => {
      const isSouthOrder = prev.orderType === SOUTH_ORDER_TYPE;
      return {
        ...prev,
        productLines: prev.productLines.map(line => {
          if (line.key !== key) return line;
          const nextLine = { ...line, productionName, shouldRecalculateConversion: true };
          const picked = productionName.trim();
          if (!picked) {
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
                  productionName: ''
                }
              : { ...nextLine, productId: '' };
          }
          // Tìm đúng dòng danh mục theo (mã + tên sản xuất) để lưu đúng sản phẩm,
          // kể cả khi tên SX thuộc variant Tên SP khác với dòng đang hiển thị.
          const match: OrderProductOption | null = matchOrderProductByCodeAndProductionName(
            productOptions,
            line.productCode,
            productionName,
            line.productId,
            line.productName
          );
          if (!match) {
            return { ...nextLine, productId: '' };
          }

          const baseUpdated: OrderProductFormLine = {
            ...nextLine,
            productId: match.id,
            // Lấy mã chuẩn của đúng dòng danh mục (chữa luôn mã cũ đã đổi trên dòng đơn).
            productCode: match.code || nextLine.productCode,
            productName: match.name || nextLine.productName,
            productionName: match.productionName
          };

          if (!isSouthOrder) {
            // SP có màng thì tự fill; không có thì để trống để tự nhập.
            // Dài m chuẩn của SP (danh mục, fallback bảng quy đổi); không có thì giữ số đang nhập.
            const conversion = productConversions.find(item => item.sanPhamId === match.id);
            const rawDaiM = match.doDaiM ? String(match.doDaiM).replace(/m\s*$/iu, '').trim() : '';
            const autoDaiM = rawDaiM || (conversion?.khoTamDaiM ? String(conversion.khoTamDaiM) : '') || line.daiM;
            const rawKho = match.doDayM ? String(match.doDayM).replace(/m\s*$/iu, '').trim() : '';
            const autoKho = rawKho || (conversion?.khoTamRongM ? String(conversion.khoTamRongM) : '') || line.kho;
            const rawDoLiDm = extractDoLiDmNumber(match.doLiDm || '') || extractDoLiDmNumber(extractDoLiDm(match.productionName) || '');
            return {
              ...baseUpdated,
              mang: match.mang || extractMang(match.productionName) || '',
              daiM: orderDuplicateDecimalText(autoDaiM || ''),
              kho: orderDuplicateDecimalText(autoKho || ''),
              doLiDm: orderDuplicateDecimalText(rawDoLiDm || line.doLiDm || ''),
              // Đổi SP/Dài tự fill → tính lại Tổng KG, không giữ số cũ.
              tongKg: '',
              dinhMucKg: '',
              manualTongKg: false
            };
          }

          // Đối với đơn hàng miền nam, tự động fill các cột phía sau nếu có:
          const conversion = productConversions.find(item => item.sanPhamId === match.id);
          // Ưu tiên field tem/mauTem riêng trên danh mục SP; fallback parse từ tenGhep (dữ liệu cũ)
          const catalogTemVal = match.tem || '';
          const catalogMauTemVal = match.mauTem || '';
          const parsedTem = !catalogTemVal
            ? parseSouthTemFromTenGhep(match.tenGhep || match.productionName)
            : { tem: '', mauTem: '', danTem2Dau: false };
          const autoTemVal = catalogTemVal || parsedTem.tem || line.tem || '';
          const autoMauTemVal = catalogMauTemVal || parsedTem.mauTem || line.mauTem || SOUTH_TEM_COLOR_DEFAULT;
          const extractedMang = match.mang || extractMang(match.productionName);

          const autoMang = extractedMang || line.mang || 'SUN PC';
          const autoUnit = match.unit || line.unit || 'Tấm';

          const rawDaiM = match.doDaiM ? String(match.doDaiM).replace(/m\s*$/iu, '').trim() : '';
          const autoDaiM = rawDaiM || (conversion?.khoTamDaiM ? String(conversion.khoTamDaiM) : '') || line.daiM;

          const rawKho = match.doDayM ? String(match.doDayM).replace(/m\s*$/iu, '').trim() : '';
          const autoKho = rawKho || (conversion?.khoTamRongM ? String(conversion.khoTamRongM) : '') || line.kho;

          const rawDoLiDm = extractDoLiDmNumber(match.doLiDm || '') || extractDoLiDmNumber(extractDoLiDm(match.productionName) || '');
          const autoDoLiDm = rawDoLiDm || line.doLiDm;

          const autoDoDaiTamTieuChuan = (conversion?.khoTamDaiM ? String(conversion.khoTamDaiM) : '')
            || rawDaiM
            || line.doDaiTamTieuChuan;

          const autoDinhMucTieuChuanKg = (conversion?.trongLuongKgTam ? String(conversion.trongLuongKgTam) : '')
            || (match.totalWeight ? String(match.totalWeight) : '')
            || line.dinhMucTieuChuanKg;

          return {
            ...baseUpdated,
            mang: autoMang,
            unit: autoUnit,
            daiM: orderDuplicateDecimalText(autoDaiM || ''),
            kho: orderDuplicateDecimalText(autoKho || ''),
            doLiDm: orderDuplicateDecimalText(autoDoLiDm || ''),
            doDaiTamTieuChuan: orderDuplicateDecimalText(autoDoDaiTamTieuChuan || ''),
            dinhMucTieuChuanKg: orderDuplicateDecimalText(autoDinhMucTieuChuanKg || ''),
            tongKg: '',
            dinhMucKg: '',
            manualTongKg: false,
            tem: autoTemVal,
            mauTem: autoMauTemVal,
            danTem2Dau: (catalogTemVal || parsedTem.tem) ? parsedTem.danTem2Dau : (line.danTem2Dau ?? false)
          };
        })
      };
    });
  };

  /** Ô Tên sản xuất: dropdown mở ngược lên trên, mục đang chọn viền vàng/chữ vàng đậm trên nền vàng. */
  const renderProductionNameSelect = (line: OrderProductFormLine) => (
    <SearchableSelect
      value={line.productionName}
      onChange={productionName => pickProductionName(line.key, productionName)}
      options={getProductionNameOptions(line.productCode, line.productionName)}
      placeholder={line.productCode.trim() ? 'Chọn tên sản xuất' : 'Chọn mã AMIS trước'}
      isLoading={isLoadingLookups}
      disabled={!line.productCode.trim()}
      skipUnchangedBlurCommit
      openUpward
      showAllWhenQueryMatchesSelection
      maxResults={ORDER_AMIS_SEARCH_MAX_RESULTS}
      selectedOptionClassName="bg-yellow-50 font-black text-yellow-800 ring-2 ring-inset ring-yellow-400"
      inputClassName={orderFieldClass}
      getLabel={item => String(item)}
      getValue={item => String(item)}
      allowEmpty
    />
  );

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

  const updateConversionProductLine = (key: string, patch: Partial<OrderProductFormLine>) => {
    const weightKeys: Array<keyof OrderProductFormLine> = [
      'slBac', 'slTrung', 'slNam', 'quantity', 'daiM', 'kho', 'doLiDm', 'unit',
      'dinhMucKg', 'doDaiTamTieuChuan', 'dinhMucTieuChuanKg'
    ];
    setOrderForm(prev => ({
      ...prev,
      productLines: prev.productLines.map(line => {
        if (line.key !== key) return line;
        // Số "nhập tay" chỉ đọc từ dữ liệu đã lưu (chưa gõ trong phiên này) thì tính lại khi đổi SL/Dài/ĐM...
        const resetSavedManual = Boolean(line.manualFromSaved) &&
          patch.manualTongKg === undefined &&
          weightKeys.some(weightKey => weightKey in patch);
        return {
          ...line,
          ...patch,
          ...(resetSavedManual ? { manualTongKg: false, tongKg: '', manualFromSaved: false } : {}),
          shouldRecalculateConversion: true
        };
      })
    }));
  };

  const changeOrderType = (orderType: string) => {
    setOrderForm(prev => ({
      ...prev,
      orderType,
      productLines: prev.orderType === orderType
        ? prev.productLines
        : prev.productLines.map(line => ({ ...line, shouldRecalculateConversion: true }))
    }));
  };

  const moveProductLine = (from: number, to: number) => {
    setOrderForm(prev => ({
      ...prev,
      productLines: reorderList(prev.productLines, from, to)
    }));
  };

  const duplicateProductLineBelow = (index: number) => {
    const source = orderForm.productLines[index];
    if (!source) return;
    const comma = (value: string | number | undefined) => orderDuplicateDecimalText(String(value ?? ''));
    const duplicated: OrderProductFormLine = {
      ...source,
      key: `order-product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      // Sản phẩm mới: không copy ghi chú và SL lệnh SX (chưa sản xuất, ghi chú khác).
      sourceProduct: source.sourceProduct
        ? { ...source.sourceProduct, ghi_chu: undefined, note: undefined, sl_sx: undefined }
        : undefined,
      savedStt: undefined,
      note: '',
      conversionResults: source.conversionResults?.map(result => ({ ...result })),
      quantity: comma(source.quantity),
      slBac: comma(source.slBac),
      slTrung: comma(source.slTrung),
      slNam: comma(source.slNam),
      daiM: comma(source.daiM),
      mang: source.mang !== undefined ? String(source.mang) : 'SUN PC',
      doLi: comma(source.doLi),
      doLiDm: comma(source.doLiDm),
      dinhMucKg: comma(source.dinhMucKg),
      doDaiTamTieuChuan: comma(source.doDaiTamTieuChuan),
      dinhMucTieuChuanKg: comma(source.dinhMucTieuChuanKg),
      tongKg: comma(source.tongKg),
      kg1Sp: comma(source.kg1Sp),
      m2: comma(source.m2),
      mDai: comma(source.mDai),
      tlCuon: comma(source.tlCuon),
      tlTam: comma(source.tlTam),
      quyCachMDai: comma(source.quyCachMDai)
    };
    setOrderForm(prev => {
      const next = [...prev.productLines];
      next.splice(index + 1, 0, duplicated);
      return { ...prev, productLines: next };
    });
    setSelectedProductLineKey(duplicated.key);
  };

  const removeProductLine = (key: string) => {
    setOrderForm(prev => ({
      ...prev,
      productLines: prev.productLines.filter(item => item.key !== key)
    }));
    setSelectedProductLineKey(current => (current === key ? null : current));
  };

  const handleProductDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDragProductIndex(index);
  };

  const handleProductDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleProductDrop = (index: number) => {
    if (dragProductIndex === null) return;
    moveProductLine(dragProductIndex, index);
    setDragProductIndex(null);
  };

  const pickOrderProduct = (key: string, productId: string) => {
    const match = findOrderProductById(productOptions, productId);
    const productCode = match?.code || '';
    updateConversionProductLine(key, {
      productId,
      productCode,
      productName: match?.name || '',
      productionName: match?.productionName || '',
      // SP có màng (field riêng hoặc trong tên) thì tự fill; không có thì để trống để tự nhập.
      mang: match ? (match.mang || extractMang(match.productionName) || '') : '',
      unit: allowedOrderUnits(match)[0] || match?.unit || '',
      tongKg: '',
      manualTongKg: false
    });
  };

  const pickCutOrderProduct = (key: string, productId: string) => {
    const match = findOrderProductById(productOptions, productId);
    const isSouthOrder = orderForm.orderType === SOUTH_ORDER_TYPE;
    const conversion = productId ? productConversions.find(item => item.sanPhamId === productId) : undefined;
    // Ưu tiên field tem/mauTem riêng trên danh mục SP; fallback parse từ tenGhep (dữ liệu cũ)
    const catalogTem = match?.tem || '';
    const catalogMauTem = match?.mauTem || '';
    const parsedTem = isSouthOrder && match && !catalogTem
      ? parseSouthTemFromTenGhep(match.tenGhep || match.productionName)
      : null;
    const autoTem = catalogTem || parsedTem?.tem || '';
    const autoMauTem = catalogMauTem || parsedTem?.mauTem || '';
    // SP có màng (field riêng hoặc trong tên) thì tự fill; miền nam không có thì mặc định SUN PC,
    // các loại đơn khác để trống để tự nhập.
    const extractedMang = match ? (match.mang || extractMang(match.productionName)) : '';

    const rawDaiM = match?.doDaiM ? String(match.doDaiM).replace(/m\s*$/iu, '').trim() : '';
    const autoDaiM = rawDaiM || (conversion?.khoTamDaiM ? String(conversion.khoTamDaiM) : '');

    const rawKho = String(match?.doDayM || '').replace(/m\s*$/iu, '').trim();
    const autoKho = rawKho || (conversion?.khoTamRongM ? String(conversion.khoTamRongM) : '');

    const rawDoLiDm = extractDoLiDmNumber(match?.doLiDm || '') || (match?.productionName ? extractDoLiDmNumber(extractDoLiDm(match.productionName) || '') : '');

    const autoDoDaiTamTieuChuan = (conversion?.khoTamDaiM ? String(conversion.khoTamDaiM) : '') || rawDaiM;
    const autoDinhMucTieuChuanKg = (conversion?.trongLuongKgTam ? String(conversion.trongLuongKgTam) : '') || (match?.totalWeight ? String(match.totalWeight) : '');

    updateConversionProductLine(key, {
      productId,
      productCode: match?.code || '',
      productName: match?.name || '',
      productionName: match?.productionName || '',
      unit: 'Tấm',
      mang: extractedMang,
      // Dài m chuẩn của SP (danh mục, fallback bảng quy đổi) — tự fill cho cả
      // đơn theo quy cách / cắt lẻ / miền nam, người dùng sửa lại mét cắt khi cần.
      daiM: orderDuplicateDecimalText(autoDaiM || ''),
      kho: orderDuplicateDecimalText(autoKho || ''),
      doLiDm: orderDuplicateDecimalText(rawDoLiDm || ''),
      tongKg: '',
      dinhMucKg: '',
      manualTongKg: false,
      ...(isSouthOrder ? {
        mang: extractedMang || 'SUN PC',
        doDaiTamTieuChuan: orderDuplicateDecimalText(autoDoDaiTamTieuChuan || ''),
        dinhMucTieuChuanKg: orderDuplicateDecimalText(autoDinhMucTieuChuanKg || ''),
        tem: autoTem,
        mauTem: autoMauTem || (autoTem ? SOUTH_TEM_COLOR_DEFAULT : ''),
        danTem2Dau: Boolean(parsedTem?.danTem2Dau)
      } : {})
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

    const isSouthOrder = orderForm.orderType === SOUTH_ORDER_TYPE;
    const isCutLikeOrder = isCutOrderType(orderForm.orderType) || isSouthOrder;
    const isRegionOrder = isCutLikeOrder || orderForm.orderType === PRODUCTION_ORDER_TYPE;
    const activeProductLines = orderForm.productLines.filter(line => line.productCode.trim() || line.productName.trim());
    if (isSouthOrder) {
      for (const line of activeProductLines) {
        const nam = readOptionalRegionQty(line.slNam);
        if (nam === null || nam <= 0) {
          setFormError(`Nhập số lượng Nam cho sản phẩm ${line.productCode || line.productName}.`);
          return;
        }
      }
    } else if (isRegionOrder) {
      for (const line of activeProductLines) {
        if (positiveRegionTotal(line.slBac, line.slTrung, line.slNam) === null) {
          setFormError(`Nhập số lượng Bắc, Trung hoặc Nam cho sản phẩm ${line.productCode || line.productName}. Ít nhất một ô phải có số lượng.`);
          return;
        }
      }
    }
    for (const line of activeProductLines) {
      if (!line.manualTongKg) continue;
      const enteredKg = parsePercentInput(String(line.tongKg ?? ''));
      if (!Number.isFinite(enteredKg) || enteredKg <= 0) {
        setFormError(`KG khách hàng nhập phải lớn hơn 0 cho sản phẩm ${line.productCode || line.productName}.`);
        return;
      }
    }
    if (isCutLikeOrder && !isSouthOrder) {
      for (const line of activeProductLines) {
        if (String(line.dinhMucKg ?? '').trim() === '') continue;
        if (parseSouthDinhMucKg(line.dinhMucKg) === null) {
          setFormError(`Định mức KG phải lớn hơn 0 cho sản phẩm ${line.productCode || line.productName}.`);
          return;
        }
      }
    }
    const products = orderProductLinesToPayload(activeProductLines, productOptions, orderForm.orderType, productConversions, orderForm.createdAt);
    if (products.length === 0) {
      setFormError('Vui lòng thêm ít nhất một sản phẩm.');
      return;
    }
    for (const product of products) {
      if (!product.ma_sp && !product.ten_sp) {
        setFormError('Mỗi dòng sản phẩm cần có mã SP hoặc tên SP.');
        return;
      }
      if (isCutLikeOrder && (!product.dai_m || product.dai_m <= 0)) {
        setFormError(`Dài (m) phải lớn hơn 0 cho sản phẩm ${product.ma_sp || product.ten_sp}.`);
        return;
      }
      if (!product.so_luong || product.so_luong <= 0) {
        setFormError(`Số lượng phải lớn hơn 0 cho sản phẩm ${product.ma_sp || product.ten_sp}.`);
        return;
      }
    }

    const productsWithConversion: any[] = [];
    if (isCutLikeOrder) {
      productsWithConversion.push(...products);
    } else {
      for (const [productIndex, product] of products.entries()) {
        if (activeProductLines[productIndex]?.shouldRecalculateConversion === false) {
          productsWithConversion.push(product);
          continue;
        }

        const option = findOrderProductById(productOptions, product.san_pham_id || '');
        const targetSpId = String(product.san_pham_id || option?.id || '').trim();
        const conversion = targetSpId ? productConversions.find(item => item.sanPhamId === targetSpId) : undefined;
        const qty = product.so_luong ?? 0;
        const sourceLine = activeProductLines[productIndex];
        const parsedManualKg = sourceLine?.manualTongKg
          ? parsePercentInput(String(sourceLine.tongKg ?? ''))
          : Number.NaN;
        // Tổng KG luôn lưu số nguyên (làm tròn).
        const manualTotalKg = Number.isFinite(parsedManualKg) && parsedManualKg > 0 ? Math.round(parsedManualKg) : null;

        let kgVal: number | null = null;
        let m2Val: number | null = null;
        let mDaiVal: number | null = null;

        if (conversion && qty > 0) {
          if (manualTotalKg !== null) {
            kgVal = manualTotalKg;
            m2Val = convertProductQuantity(manualTotalKg, 'kg', 'm2', conversion);
            mDaiVal = convertProductQuantity(manualTotalKg, 'kg', 'm', conversion);
          } else {
            kgVal = convertProductQuantity(qty, product.don_vi, 'kg', conversion);
            m2Val = convertProductQuantity(qty, product.don_vi, 'm2', conversion);
            mDaiVal = convertProductQuantity(qty, product.don_vi, 'm', conversion);
          }
        }

        if (manualTotalKg !== null) kgVal = manualTotalKg;

        // Tổng KG luôn lưu số nguyên (làm tròn).
        if (kgVal !== null && Number.isFinite(kgVal)) kgVal = Math.round(kgVal);

        const normUnit = product.don_vi.trim().toLowerCase();
        if (kgVal === null && (normUnit === 'kg' || normUnit === 'kilogram')) kgVal = qty;
        if (m2Val === null && (normUnit === 'm2' || normUnit === 'm 2' || normUnit === 'mét vuông')) m2Val = qty;
        if (mDaiVal === null && (normUnit === 'm' || normUnit === 'm dài' || normUnit === 'mét')) mDaiVal = qty;

        const roundVal = (v: number | null) => (v !== null && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);
        const rKg = roundVal(kgVal);
        const rM2 = roundVal(m2Val);
        const rMDai = roundVal(mDaiVal);
        const manualKgPerUnit = manualTotalKg !== null && qty > 0 ? roundVal(manualTotalKg / qty) : null;
        const rTlCuon = manualKgPerUnit !== null && isCuonProduct(product.don_vi)
          ? manualKgPerUnit
          : conversion?.trongLuongKgCuon
            ? roundVal(conversion.trongLuongKgCuon)
            : null;
        const rTlTam = manualKgPerUnit !== null && isTamProduct(product.don_vi)
          ? manualKgPerUnit
          : conversion?.trongLuongKgTam
            ? roundVal(conversion.trongLuongKgTam)
            : null;

        const results: Array<{ don_vi: string; gia_tri: number }> = [];
        if (rKg !== null && rKg > 0) results.push({ don_vi: 'kg', gia_tri: rKg });
        if (rM2 !== null && rM2 > 0) results.push({ don_vi: 'm2', gia_tri: rM2 });
        if (rMDai !== null && rMDai > 0) results.push({ don_vi: 'm dài', gia_tri: rMDai });

        const {
          dien_tich_m2,
          chieu_dai_m,
          trong_luong,
          trong_luong_kg,
          trong_luong_kg_tam,
          trong_luong_kg_cuon,
          kg_cuon,
          quy_cach,
          ...cleanProduct
        } = product as any;

        let quyCachMDai = cleanProduct.quy_cach_m_dai;
        if (quyCachMDai === undefined) {
          const d = Number(cleanProduct.dai_m);
          if (Number.isFinite(d) && d > 0) {
            quyCachMDai = d;
          } else if (typeof quy_cach === 'string') {
            const m = quy_cach.match(/(\d+(?:[.,]\d+)?)/);
            if (m) quyCachMDai = Number(m[1].replace(',', '.'));
          }
        }
        if (quyCachMDai !== undefined && Number.isFinite(quyCachMDai) && quyCachMDai > 0) {
          cleanProduct.quy_cach_m_dai = quyCachMDai;
        }

        let finalTlCuon = rTlCuon ?? cleanProduct.tl_cuon;
        const spId = String(cleanProduct.san_pham_id || '').trim();
        if (!finalTlCuon && spId) {
          const matchedConv = productConversions.find(item => item.sanPhamId === spId);
          if (matchedConv?.trongLuongKgCuon) {
            finalTlCuon = roundVal(matchedConv.trongLuongKgCuon);
          }
        }

        const finalTlTam = rTlTam ?? cleanProduct.tl_tam;
        if (cleanProduct.kg_1_sp && (cleanProduct.kg_1_sp === finalTlTam || cleanProduct.kg_1_sp === finalTlCuon)) {
          delete cleanProduct.kg_1_sp;
        }

        productsWithConversion.push({
          ...cleanProduct,
          ...(rM2 !== null && rM2 > 0 ? { m2: rM2 } : {}),
          ...(rMDai !== null && rMDai > 0 ? { m_dai: rMDai } : {}),
          ...(rKg !== null && rKg > 0 ? { tong_kg: rKg } : {}),
          ...(finalTlCuon !== null && finalTlCuon > 0 ? { tl_cuon: finalTlCuon } : {}),
          ...(finalTlTam !== null && finalTlTam > 0 ? { tl_tam: finalTlTam } : {}),
          ...(manualTotalKg !== null ? { nguon_quy_doi: CUSTOMER_ENTERED_KG_SOURCE } : {}),
          ...(results.length > 0 ? { ket_qua_quy_doi: results } : {})
        });
      }
    }

    // Tổng KG bắt buộc cho mọi dòng, mọi loại đơn: không cho tạo/cập nhật đơn khi để trống Tổng KG.
    // (Tổng KG nhập tay / Định mức / TL danh mục tự tính ra Tổng KG đều được.)
    // Kiểm tra trên dữ liệu cuối (bao cả dòng cũ mở sửa mà không chạm tới).
    const missingTotalKg = productsWithConversion.find((item: any) => {
      if (Number(item?.tong_kg) > 0) return false;
      const results = Array.isArray(item?.ket_qua_quy_doi) ? item.ket_qua_quy_doi : [];
      return !results.some((result: any) => result && String(result.don_vi || '') === 'kg' && Number(result.gia_tri) > 0);
    });
    if (missingTotalKg) {
      setFormError(`Nhập Tổng KG cho sản phẩm ${missingTotalKg.ma_sp || missingTotalKg.ten_sp} (hoặc bổ sung TL/tấm – TL/cuộn trong danh mục).`);
      return;
    }

    const payload = {
      orderCode: orderForm.orderCode.trim(),
      orderType: orderForm.orderType,
      staffName: orderForm.staffName,
      customer: orderForm.customer,
      products: withNormalizedProductStt(productsWithConversion),
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

      const requestedOrderCode = String(data.requestedOrderCode || payload.orderCode || '').trim();
      const savedOrderCode = String(data.savedOrderCode || data.order?.ma_don_hang || '').trim();
      if (!isEdit && requestedOrderCode && savedOrderCode && requestedOrderCode !== savedOrderCode) {
        showAppToast(`Mã đơn hàng ${requestedOrderCode} đã tồn tại. Đã tạo thành công mã ${savedOrderCode}. Với mã ${savedOrderCode} là đơn hàng mới.`);
      } else {
        showAppToast(isEdit ? 'Đã cập nhật đơn hàng.' : 'Đã thêm đơn hàng mới.');
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

  const handleDeleteOrder = async (order: OrderRow, hard = false) => {
    if (!order.id) {
      setOrdersError('Không tìm thấy ID để xóa.');
      return;
    }

    if (hard) {
      if (!window.confirm(`Xóa VĨNH VIỄN đơn "${order.orderCode || order.productCode}"? Dữ liệu sẽ mất hoàn toàn, không thể khôi phục.`)) return;
    } else if (!window.confirm(`Bạn có chắc muốn xóa đơn "${order.orderCode || order.productCode}"?\n\nDữ liệu được giữ lại (xóa mềm) và có thể khôi phục từ mục "Đơn đã xóa".`)) return;

    setDeletingOrderId(order.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/don-hang/${order.id}${hard ? '?hard=1' : ''}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (hard ? 'Không thể xóa vĩnh viễn đơn hàng.' : 'Không thể xóa đơn hàng.'));
      }

      if (viewingOrder?.id === order.id) setViewingOrder(null);
      setActionMessage(hard ? 'Đã xóa vĩnh viễn đơn hàng.' : 'Đã xóa đơn hàng (có thể khôi phục).');
      showAppToast(hard ? 'Đã xóa vĩnh viễn đơn hàng.' : 'Đã xóa đơn hàng (có thể khôi phục).');
      await loadOrders();
    } catch (error: any) {
      setOrdersError(error.message || 'Không thể xóa đơn hàng.');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleRestoreOrder = async (order: OrderRow) => {
    if (!order.id) {
      setOrdersError('Không tìm thấy ID để khôi phục.');
      return;
    }

    setRestoringOrderId(order.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/don-hang/${order.id}/restore`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể khôi phục đơn hàng.');
      }

      setActionMessage(`Đã khôi phục đơn ${order.orderCode || order.productCode}.`);
      showAppToast(`Đã khôi phục đơn ${order.orderCode || order.productCode}.`);
      await loadOrders();
    } catch (error: any) {
      setOrdersError(error.message || 'Không thể khôi phục đơn hàng.');
    } finally {
      setRestoringOrderId(null);
    }
  };

  const orderTypeOptions = useMemo(() => {
    const types = visibleOrders
      .map(order => order.orderType)
      .filter((type): type is string => type !== '-' && type.length > 0);
    return [...new Set(types)].sort((a, b) => String(a).localeCompare(String(b), 'vi'));
  }, [visibleOrders]);
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    return visibleOrders.filter(order => {
      const matchesType = selectedType === 'all' || order.orderType === selectedType;
      const matchesSearch =
        !normalizedSearch ||
        `${order.orderCode} ${order.orderType} ${order.status} ${order.staffName} ${order.customer} ${formatOrderProductsSummary(getOrderProductLines(order))} ${order.note}`
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [visibleOrders, normalizedSearch, selectedType]);

  const hasActiveFilters = selectedType !== 'all' || Boolean(searchText);

  const resetFilters = () => {
    setSelectedType('all');
    setSearchText('');
  };

  const customerCount = new Set(visibleOrders.map(order => order.customer).filter(customer => customer && customer !== '-')).size;
  const totalQuantity = visibleOrders.reduce((sum, order) => {
    const value = Number(order.quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const isFormSouthOrder = orderForm.orderType === SOUTH_ORDER_TYPE;
  const isFormCutLikeOrder = isCutOrderType(orderForm.orderType) || isFormSouthOrder;
  const isFormProductionOrder = orderForm.orderType === PRODUCTION_ORDER_TYPE;
  const productGridClass = isFormSouthOrder
    ? orderMienNamProductGridClass
    : isFormCutLikeOrder
    ? orderSouthProductGridClass
    : isFormProductionOrder
      ? orderProductionProductGridClass
      : orderProductGridClass;
  const customerSelect2Options = useMemo(
    () => ({
      allowClear: true,
      minimumResultsForSearch: 0,
      placeholder: isLoadingLookups ? 'Đang tải khách hàng...' : 'Gõ để tìm khách hàng',
      language: {
        noResults: () => 'Không tìm thấy khách hàng phù hợp.',
        searching: () => 'Đang tìm...'
      }
    }),
    [isLoadingLookups]
  );
  const customerSelect2RefreshKey = `${formMode || ''}::${customerOptions
    .map(customer => customer.id || customer.code || customer.name)
    .join('|')}`;

  /** Ô readonly "SL lệnh SX": tổng SL đã lập lệnh SX cho dòng đơn (tra map memo). */
  const renderAllocatedQtyCell = (value: number) => (
    <div className="col-span-1 min-w-0">
      <input
        value={formatNumber(value, 3)}
        readOnly
        title="Tổng số lượng đã lập lệnh sản xuất cho dòng này"
        className={`${orderFieldClass} bg-yellow-50 text-right font-black text-yellow-800 ring-2 ring-inset ring-yellow-400`}
        placeholder="0"
      />
    </div>
  );

  const renderProductLineShell = (
    line: OrderProductFormLine,
    index: number,
    gridTemplateClass: string,
    children: React.ReactNode
  ) => (
    <OrderProductLineShell
      key={line.key}
      index={index}
      total={orderForm.productLines.length}
      selected={selectedProductLineKey === line.key}
      dragging={dragProductIndex === index}
      gridTemplateClass={gridTemplateClass}
      onSelect={() => setSelectedProductLineKey(line.key)}
      onDelete={() => removeProductLine(line.key)}
      onMoveUp={() => moveProductLine(index, index - 1)}
      onMoveDown={() => moveProductLine(index, index + 1)}
      onDuplicate={() => duplicateProductLineBelow(index)}
      moveButtonsInStt
      onDragStart={event => handleProductDragStart(event, index)}
      onDragOver={handleProductDragOver}
      onDrop={() => handleProductDrop(index)}
      onDragEnd={() => setDragProductIndex(null)}
    >
      {children}
    </OrderProductLineShell>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      {formMode && createPortal(
        <div
          ref={setOrderFormOverlayEl}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/50 p-3 backdrop-blur-sm"
        >
          <div className="flex h-[90dvh] max-h-[90dvh] w-[90vw] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {formMode === 'edit' ? 'Sửa đơn hàng' : 'Thêm đơn hàng mới'}
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold text-rose-600">
                  Lưu ý: bấm Đồng bộ sản phẩm chỉ thêm sản phẩm mới để chọn, không tính lại định mức các sản phẩm đã chọn. Muốn áp dụng định mức mới, chọn lại sản phẩm ở dòng đó.
                </p>
                {productSyncMessage ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">{productSyncMessage}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void reloadProductLookups()}
                  disabled={isSyncingProducts || isLoadingLookups}
                  title="Tải lại danh mục sản phẩm vừa thêm ở /san-pham mà không mất dòng đang nhập"
                  className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSyncingProducts ? 'Đang đồng bộ…' : `↻ Đồng bộ SP (${productOptions.length})`}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
                >
                  Đóng
                </button>
              </div>
            </div>
            {(formError || lookupError) && (
              <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-700">
                {formError || lookupError}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
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
                  onChange={changeOrderType}
                  options={[...ORDER_TYPE_OPTIONS]}
                  placeholder="Chọn loại đơn"
                  getLabel={item => String(item)}
                  getValue={item => String(item)}
                  allowEmpty={false}
                  comboboxMode
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
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Khách hàng *</span>
                <Select2
                  value={orderForm.customer}
                  disabled={isLoadingLookups}
                  onValueChange={customer => setOrderForm(prev => ({ ...prev, customer }))}
                  select2Options={customerSelect2Options}
                  refreshKey={customerSelect2RefreshKey}
                  dropdownParent={orderFormOverlayEl}
                  className={orderFieldClass}
                >
                  <option value="">
                    {isLoadingLookups ? 'Đang tải khách hàng...' : 'Gõ để tìm khách hàng'}
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
                </Select2>
                {!isLoadingLookups && customerOptions.length === 0 ? (
                  <span className="block text-[11px] font-semibold text-amber-700">
                    Chưa có khách hàng trong danh mục /khach-hang.
                  </span>
                ) : null}
              </label>

              <label className="col-span-1 space-y-1.5 sm:col-span-2 xl:col-span-4">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú đơn hàng</span>
                <textarea value={orderForm.note} onChange={e => setOrderForm(prev => ({ ...prev, note: e.target.value }))} className={`${orderFieldClass} min-h-20 py-2`} placeholder="Nhập ghi chú đơn hàng" />
              </label>

              <div className="col-span-1 min-w-0 sm:col-span-2 xl:col-span-4">
              <div className="max-h-[65vh] overflow-auto">
              <div className={isFormProductionOrder ? ORDER_PRODUCTION_TABLE_MIN_WIDTH : isFormSouthOrder ? ORDER_MIEN_NAM_TABLE_MIN_WIDTH : isFormCutLikeOrder ? ORDER_SOUTH_TABLE_MIN_WIDTH : ORDER_PRODUCT_TABLE_MIN_WIDTH}>
              <RepeatableLinesBlock
                title="Sản phẩm"
                required
                showColumnHeaders
                alwaysShowColumnHeaders
                stickyColumnHeaders
                linesClassName="flex flex-col gap-2"
                gridTemplateClass={productGridClass}
                onAdd={() =>
                  setOrderForm(prev => ({
                    ...prev,
                    productLines: [...prev.productLines, newOrderProductFormLine()]
                  }))
                }
                addButtonClassName="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                columns={
                  isFormSouthOrder
                    ? [
                        { key: 'stt', label: 'STT' },
                        { key: 'code', label: 'Mã AMIS', required: true },
                        { key: 'productionName', label: 'Tên sản xuất' },
                        { key: 'unit', label: 'ĐVT' },
                        { key: 'daiM', label: 'Dài (m)', required: true },
                        { key: 'khoRong', label: 'Khổ rộng (m)' },
                        { key: 'doLi', label: 'Độ li ĐM' },
                        { key: 'daiTc', label: 'Độ dài tấm tiêu chuẩn' },
                        { key: 'daiDm', label: 'Định mức tiêu chuẩn (kg)' },
                        { key: 'kgM', label: 'KG/1m' },
                        { key: 'nam', label: 'Nam' },
                        { key: 'qty', label: 'SL (tổng)', required: true },
                        { key: 'tongKg', label: 'Tổng KG' },
                        { key: 'mang', label: 'Màng' },
                        { key: 'tem', label: 'Tem' },
                        { key: 'mauTem', label: 'Màu tem' },
                        { key: 'haiDau', label: '2 Đầu' },
                        { key: 'note', label: 'Ghi chú' },
                        { key: 'lsxQty', label: 'SL lệnh SX' },
                        { key: 'actions', label: '' }
                      ]
                    : isFormCutLikeOrder
                    ? [
                        { key: 'stt', label: 'STT' },
                        { key: 'code', label: 'Mã AMIS', required: true },
                        { key: 'productionName', label: 'Tên sản xuất' },
                        { key: 'unit', label: 'ĐVT' },
                        { key: 'daiM', label: 'Dài (m)', required: true },
                        { key: 'khoRong', label: 'Hạ khổ rộng (m)' },
                        { key: 'doLi', label: 'Độ li ĐM' },
                        { key: 'dinhMucKg', label: 'Định mức KG' },
                        { key: 'bac', label: 'Bắc' },
                        { key: 'trung', label: 'Trung' },
                        { key: 'nam', label: 'Nam' },
                        { key: 'qty', label: 'SL (tổng)', required: true },
                        { key: 'tongKg', label: 'Tổng KG (nhập)' },
                        { key: 'mang', label: 'Màng' },
                        { key: 'tem', label: 'Tem' },
                        { key: 'mauTem', label: 'Màu tem' },
                        { key: 'haiDau', label: '2 Đầu' },
                        { key: 'note', label: 'Ghi chú' },
                        { key: 'lsxQty', label: 'SL lệnh SX' },
                        { key: 'actions', label: '' }
                      ]
                    : isFormProductionOrder
                      ? [
                          { key: 'stt', label: 'STT' },
                          { key: 'code', label: 'Mã AMIS', required: true },
                          { key: 'name', label: 'Tên sản phẩm' },
                          { key: 'productionName', label: 'Tên sản xuất' },
                          { key: 'mang', label: 'Màng' },
                          { key: 'note', label: 'Ghi chú' },
                          { key: 'lsxQty', label: 'SL lệnh SX' },
                          { key: 'unit', label: 'ĐVT' },
                          { key: 'bac', label: 'Bắc' },
                          { key: 'trung', label: 'Trung' },
                          { key: 'nam', label: 'Nam' },
                          { key: 'qty', label: 'SL (tổng)', required: true },
                          { key: 'kg', label: 'KG (nhập)' },
                          { key: 'm2', label: 'M2' },
                          { key: 'mdai', label: 'M dài' },
                          { key: 'actions', label: '' }
                        ]
                      : [
                        { key: 'stt', label: 'STT' },
                        { key: 'code', label: 'Mã AMIS', required: true },
                        { key: 'name', label: 'Tên sản phẩm' },
                        { key: 'productionName', label: 'Tên sản xuất' },
                        { key: 'mang', label: 'Màng' },
                        { key: 'note', label: 'Ghi chú' },
                        { key: 'lsxQty', label: 'SL lệnh SX' },
                        { key: 'unit', label: 'ĐVT' },
                        { key: 'qty', label: 'SL', required: true },
                        { key: 'kg', label: 'KG (nhập)' },
                        { key: 'm2', label: 'M2' },
                        { key: 'mdai', label: 'M dài' },
                        { key: 'actions', label: '' }
                      ]
                }
              >
                {isFormCutLikeOrder
                  ? orderForm.productLines.map((line, index) => {
                      const matchedLineProduct = resolveOrderLineProduct(productOptions, line);
                      const lineSanPhamId = String(matchedLineProduct?.id || line.productId || '').trim();
                      const matchedConversion = lineSanPhamId ? productConversions.find(item => item.sanPhamId === lineSanPhamId) : undefined;
                      // Cắt lẻ: SL tổng = Bắc + Trung + Nam. Miền nam chỉ còn Nam.
                      const namQty = readOptionalRegionQty(line.slNam);
                      const cutRegionTotal = isFormSouthOrder
                        ? (namQty !== null && namQty > 0 ? namQty : null)
                        : positiveRegionTotal(line.slBac, line.slTrung, line.slNam);
                      const cutEffectiveQty = cutRegionTotal !== null ? String(cutRegionTotal) : '0';
                      const cutAllowedUnits = allowedOrderUnits(matchedLineProduct);
                      const cutEffectiveUnit = resolveCutOrderLineUnit(matchedLineProduct, line.unit);
                      const cutWeight = line.shouldRecalculateConversion
                        ? calculateCutOrderWeight(line.daiM, cutEffectiveQty, matchedConversion, cutEffectiveUnit, line.productCode, matchedLineProduct?.name || line.productName, line.kho || '', doLiDmWeightScale(line.doLiDm, matchedLineProduct?.doLiDm))
                        : null;
                      const kgPerStandardMeter = isFormSouthOrder
                        ? southOrderKgPerMeter(
                            line.dinhMucTieuChuanKg,
                            null,
                            null,
                            line.doDaiTamTieuChuan
                          )
                        : null;
                      const southLengthM = parsePercentInput(line.daiM);
                      const southQty = parsePercentInput(cutEffectiveQty);
                      const southScaledTotal = isFormSouthOrder && southQty > 0
                        ? (kgPerStandardMeter !== null && southLengthM > 0
                            ? southScaledTlAndTotal(kgPerStandardMeter, southLengthM, southQty).total
                            : southDinhMucKgTotal(line.dinhMucTieuChuanKg, southQty))
                        : null;
                      const southDinhMucTotal = isFormSouthOrder
                        ? southScaledTotal
                        : southDinhMucKgTotal(line.dinhMucKg, cutEffectiveQty);
                      // Số nhập tay luôn ưu tiên hiển thị (kể cả đơn miền nam đã cho sửa Tổng KG).
                      // Dòng cũ chưa chạm (shouldRecalculateConversion=false) vẫn hiện số đã lưu.
                      const displayedCutWeight = !line.shouldRecalculateConversion
                        ? readStoredOrderConversion(line, 'kg')
                        : (line.manualTongKg
                            ? parsePercentInput(String(line.tongKg ?? ''))
                            : (southDinhMucTotal
                                ?? cutWeight?.tongKg ?? null));
                      // Định mức KG/đơn vị tự tính (TL/tấm hoặc TL/cuộn) — tính lại khi đổi Dài/Khổ/Độ li ĐM/ĐVT/SL.
                      const autoDinhMucKg = (() => {
                        const qtyNum = parsePercentInput(cutEffectiveQty);
                        const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : null);
                        if (line.manualTongKg) {
                          const manualTotal = positive(parsePercentInput(String(line.tongKg ?? '')));
                          return manualTotal !== null && qtyNum > 0 ? Math.round((manualTotal / qtyNum) * 100) / 100 : null;
                        }
                        if (line.shouldRecalculateConversion) {
                          // TL/đơn vị không phụ thuộc SL → tính với SL = 1 để dòng mới (chưa nhập SL) vẫn tự fill.
                          const perUnit = calculateCutOrderWeight(line.daiM, '1', matchedConversion, cutEffectiveUnit, line.productCode, matchedLineProduct?.name || line.productName, line.kho || '', doLiDmWeightScale(line.doLiDm, matchedLineProduct?.doLiDm));
                          return positive(perUnit?.kg1Sp ?? Number.NaN);
                        }
                        return positive(parsePercentInput(String(cutEffectiveUnit === 'Cuộn' ? line.tlCuon || '' : line.tlTam || '')));
                      })();
                      return renderProductLineShell(
                        line,
                        index,
                        isFormSouthOrder ? orderMienNamProductGridClass : orderSouthProductGridClass,
                        <>
                        <div className="min-w-0">
                          <SearchableSelect
                            value={line.shouldRecalculateConversion ? (line.productId || line.productCode) : line.productCode}
                            onChange={productId => pickCutOrderProduct(line.key, productId)}
                            options={productOptions}
                            placeholder="Tìm Mã AMIS"
                            isLoading={isLoadingLookups}
                            skipUnchangedBlurCommit
                            maxResults={ORDER_AMIS_SEARCH_MAX_RESULTS}
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
                        <div className="min-w-0">
                          {renderProductionNameSelect(line)}
                        </div>
                        <div className="col-span-1 min-w-0">
                          {matchedLineProduct && cutAllowedUnits.length > 1 ? (
                            <select
                              value={cutEffectiveUnit}
                              onChange={e => updateConversionProductLine(line.key, { unit: e.target.value, manualTongKg: false, tongKg: '', dinhMucKg: '' })}
                              className={orderFieldClass}
                              title="ĐVT — SP Đặc/Sóng chọn được Tấm hoặc Cuộn"
                            >
                              {cutAllowedUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                            </select>
                          ) : (
                            <input
                              value="Tấm"
                              readOnly
                              className={`${orderFieldClass} bg-zinc-100 text-center font-bold text-zinc-600`}
                            />
                          )}
                        </div>
                        <div className="col-span-1 min-w-0">
                          <OrderNumberInput
                            value={line.daiM}
                            onChange={e => updateConversionProductLine(line.key, { daiM: e.target.value, manualTongKg: false, tongKg: '', dinhMucKg: '' })}
                            className={orderFieldClass}
                            placeholder="2.8"
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <OrderNumberInput
                            value={line.kho || ''}
                            onChange={e => updateConversionProductLine(line.key, { kho: e.target.value, manualTongKg: false, tongKg: '', dinhMucKg: '' })}
                            className={orderFieldClass}
                            placeholder="1.22"
                            title={isFormSouthOrder ? 'Khổ rộng (m) — ghi vào mã AMIS mới khi khác khổ danh mục' : 'Hạ khổ rộng (m) — ghi vào mã AMIS mới khi khác khổ tấm chính'}
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <OrderNumberInput
                            value={line.doLiDm || ''}
                            onChange={e => updateConversionProductLine(line.key, { doLiDm: e.target.value, manualTongKg: false, tongKg: '', dinhMucKg: '' })}
                            className={orderFieldClass}
                            placeholder="0.75"
                            title="Độ li định mức thực tế — chỉ nhập số, tự hiểu là (đm n li)"
                          />
                        </div>
                        {!isFormSouthOrder ? (
                          <div className="col-span-1 min-w-0">
                            <OrderNumberInput
                              // Tự fill TL/Tấm hoặc TL/Cuộn theo ĐVT đã chọn; nhập số để ghi đè (Tổng KG = số nhập × SL).
                              // " " (1 dấu cách) = người dùng vừa xóa trống để gõ số mới; lưu đơn vẫn tính như tự tính.
                              value={String(line.dinhMucKg ?? '') === '' && autoDinhMucKg !== null
                                ? formatNumber(autoDinhMucKg, 2)
                                : String(line.dinhMucKg ?? '').trim()}
                              onChange={e => updateConversionProductLine(line.key, { dinhMucKg: e.target.value === '' ? ' ' : e.target.value })}
                              title={`Định mức KG/${cutEffectiveUnit === 'Cuộn' ? 'cuộn' : 'tấm'} (= ${cutEffectiveUnit === 'Cuộn' ? 'TL/Cuộn' : 'TL/Tấm'} theo ĐVT đã chọn)${autoDinhMucKg !== null ? ` — tự tính ${formatNumber(autoDinhMucKg, 2)}, đổi theo Dài, Khổ, Độ li ĐM` : ''}. Nhập số để ghi đè: Tổng KG = số này × SL tổng`}
                              className={`${orderFieldClass} bg-white text-right ${String(line.dinhMucKg ?? '').trim() === '' ? 'font-bold text-zinc-600' : ''}`}
                              placeholder="ĐM KG"
                            />
                          </div>
                        ) : null}
                        {isFormSouthOrder ? (
                          <>
                            <div className="col-span-1 min-w-0">
                              <OrderNumberInput
                                value={line.doDaiTamTieuChuan ?? ''}
                                onChange={e => updateConversionProductLine(line.key, { doDaiTamTieuChuan: e.target.value })}
                                title="Độ dài tấm tiêu chuẩn (m). Nhập tay."
                                className={`${orderFieldClass} bg-white text-right`}
                                placeholder="m"
                              />
                            </div>
                            <div className="col-span-1 min-w-0">
                              <OrderNumberInput
                                value={line.dinhMucTieuChuanKg ?? ''}
                                onChange={e => updateConversionProductLine(line.key, { dinhMucTieuChuanKg: e.target.value })}
                                title="Định mức tiêu chuẩn (kg). KG/1m = số kg này / độ dài tấm tiêu chuẩn."
                                className={`${orderFieldClass} bg-white text-right`}
                                placeholder="kg"
                              />
                            </div>
                            <div className="col-span-1 min-w-0">
                              <input
                                value={kgPerStandardMeter !== null ? orderDuplicateDecimalText(formatNumber(kgPerStandardMeter, 3)) : ''}
                                readOnly
                                title="KG/1m = định mức tiêu chuẩn (kg) / độ dài tấm tiêu chuẩn (m)"
                                className={`${orderFieldClass} bg-zinc-50 text-right font-black`}
                                placeholder="—"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="col-span-1 min-w-0">
                              <OrderNumberInput
                                value={line.slBac ?? ''}
                                onChange={e => updateConversionProductLine(line.key, { slBac: e.target.value })}
                                className={`${orderFieldClass} bg-white text-right`}
                                placeholder="0"
                                title="SL Bắc"
                              />
                            </div>
                            <div className="col-span-1 min-w-0">
                              <OrderNumberInput
                                value={line.slTrung ?? ''}
                                onChange={e => updateConversionProductLine(line.key, { slTrung: e.target.value })}
                                className={`${orderFieldClass} bg-white text-right`}
                                placeholder="0"
                                title="SL Trung"
                              />
                            </div>
                          </>
                        )}
                        <div className="col-span-1 min-w-0">
                          <OrderNumberInput
                            value={line.slNam ?? ''}
                            onChange={e => updateConversionProductLine(line.key, { slNam: e.target.value })}
                            className={`${orderFieldClass} bg-white text-right`}
                            placeholder="0"
                            title="SL Nam"
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <input
                            type="text"
                            value={cutRegionTotal !== null ? formatNumber(cutRegionTotal, 3) : ''}
                            readOnly
                            title={isFormSouthOrder
                              ? 'SL tổng = Nam. Tổng KG = SL (tổng) × KG/1m × Dài (m).'
                              : 'SL tổng = Bắc + Trung + Nam. Nhập ít nhất một ô Bắc, Trung hoặc Nam.'}
                            className={`${orderFieldClass} bg-zinc-50 text-right font-black`}
                            placeholder="Tự tính"
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.manualTongKg
                              ? String(line.tongKg ?? '')
                              : isFormSouthOrder
                              ? (southScaledTotal !== null ? orderDuplicateDecimalText(formatNumber(southScaledTotal, 2)) : '')
                              : displayedCutWeight !== null && Number.isFinite(displayedCutWeight)
                                ? formatNumber(displayedCutWeight, 2)
                                : ''}
                            onChange={e => {
                              updateProductLine(line.key, {
                              tongKg: e.target.value,
                              manualTongKg: e.target.value.trim() !== '',
                              manualFromSaved: false,
                              shouldRecalculateConversion: true
                            });
                            }}
                            onBlur={e => {
                              const next = orderDuplicateDecimalText(e.target.value);
                              if (next === e.target.value) return;
                              updateProductLine(line.key, {
                                tongKg: next,
                                manualTongKg: next.trim() !== '',
                                manualFromSaved: false,
                                shouldRecalculateConversion: true
                              });
                            }}
                            title={line.manualTongKg
                              ? 'Tổng KG nhập tay (lưu số nguyên); TL/tấm = Tổng KG / SL'
                              : southScaledTotal !== null
                              ? 'Tổng KG = SL (tổng) × KG/1m × Dài (m) — có thể sửa trực tiếp'
                              : southDinhMucTotal !== null
                              ? 'Tổng KG = Định mức KG × SL tổng — có thể sửa trực tiếp'
                              : 'Có thể nhập Tổng KG của khách hàng để tính lại TL/tấm'}
                            className={`${orderFieldClass} bg-white text-right`}
                            placeholder="Nhập KG"
                          />
                        </div>
                        <div className="col-span-1 min-w-0">
                          <input
                            type="text"
                            value={line.mang ?? (isFormSouthOrder ? 'SUN PC' : '')}
                            onChange={e => {
                              const nextMang = e.target.value;
                              const currentMang = line.mang ?? (isFormSouthOrder ? 'SUN PC' : '');
                              const nextProductionName = line.productionName
                                ? replaceMangInName(line.productionName, nextMang, currentMang)
                                : line.productionName;
                              updateConversionProductLine(line.key, {
                                mang: nextMang,
                                productionName: nextProductionName
                              });
                            }}
                            className={orderFieldClass}
                            placeholder="SUN PC"
                            title={isFormSouthOrder ? 'Màng (mặc định SUN PC, có thể xóa hoặc sửa)' : 'Màng (để trống nếu không có, tự đổi trong tên sản xuất)'}
                          />
                        </div>
                        <div className="min-w-0">
                          <SearchableSelect
                            value={line.tem || ''}
                            onChange={tem => updateConversionProductLine(line.key, { tem })}
                            options={[...SOUTH_TEM_OPTIONS]}
                            placeholder="Chọn/nhập tem"
                            getLabel={item => String(item)}
                            getValue={item => String(item)}
                            allowEmpty
                            allowCustomValue
                            inputClassName={orderFieldClass}
                          />
                        </div>
                        <div className="min-w-0">
                          <SearchableSelect
                            value={line.mauTem || ''}
                            onChange={mauTem => updateConversionProductLine(line.key, { mauTem })}
                            options={[...SOUTH_TEM_COLOR_OPTIONS]}
                            placeholder={`Màu (${SOUTH_TEM_COLOR_DEFAULT})`}
                            getLabel={item => String(item)}
                            getValue={item => String(item)}
                            getOptionLabel={item => southTemColorLabel(String(item)) || String(item)}
                            getSearchText={item => `${item} ${southTemColorLabel(String(item))}`}
                            allowEmpty
                            allowCustomValue
                            inputClassName={orderFieldClass}
                          />
                        </div>
                        <div className="flex min-w-0 items-center justify-center">
                          <label className="flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50" title="Dán Tem 2 Đầu">
                            <input
                              type="checkbox"
                              checked={Boolean(line.danTem2Dau)}
                              onChange={e => updateConversionProductLine(line.key, { danTem2Dau: e.target.checked })}
                              className="h-4 w-4 accent-emerald-600"
                            />
                            2 Đầu
                          </label>
                        </div>
                        <div className="min-w-0">
                          <input
                            value={line.note}
                            onChange={e => updateProductLine(line.key, { note: e.target.value })}
                            className={orderFieldClass}
                            placeholder="Ghi chú"
                          />
                        </div>
                        {renderAllocatedQtyCell(line.savedStt ? getAllocatedQtyFromMap(allocatedQtyMap, orderForm.orderCode, {
                          productId: line.productId || matchedLineProduct?.id,
                          productCode: line.productCode,
                          productionName: line.productionName,
                          tenGhep: line.tenGhep,
                          stt: duplicateLineStt(orderForm.productLines, index) ? line.savedStt : undefined
                        }) : 0)}
                        </>
                      );
                    })
                  : orderForm.productLines.map((line, index) => {
                  const matchedLineProduct = resolveOrderLineProduct(productOptions, line);
                  const lineSanPhamId = String(matchedLineProduct?.id || line.productId || '').trim();
                  const productConversionOptions = lineSanPhamId ? productConversions.filter(item => item.sanPhamId === lineSanPhamId) : [];
                  const matchedConversion = productConversionOptions.find(item => conversionSupportsUnit(item, line.unit)) || productConversionOptions[0];
                  const catalogAllowedUnits = allowedOrderUnits(matchedLineProduct);
                  const allowedUnits = !line.shouldRecalculateConversion && line.unit.trim() && !catalogAllowedUnits.includes(line.unit.trim())
                    ? [line.unit.trim(), ...catalogAllowedUnits]
                    : catalogAllowedUnits;
                  const effectiveUnit = matchedLineProduct && line.shouldRecalculateConversion
                    ? (allowedUnits.includes(line.unit.trim()) ? line.unit.trim() : allowedUnits[0] || 'kg')
                    : line.unit;
                  // Có miền > 0 thì SL tổng = Bắc + Trung + Nam. Không nhập miền thì giữ SL tổng và quy đổi theo số đó.
                  const regionQtyTotal = isFormProductionOrder
                    ? positiveRegionTotal(line.slBac, line.slTrung, line.slNam)
                    : null;
                  const effectiveQtyText = isFormProductionOrder
                    ? (regionQtyTotal !== null ? String(regionQtyTotal) : '0')
                    : line.quantity;
                  const calculatedConversion = line.shouldRecalculateConversion && matchedConversion
                    ? calculateOrderConversion(
                        line.manualTongKg ? String(line.tongKg ?? '') : effectiveQtyText,
                        line.manualTongKg ? 'kg' : effectiveUnit,
                        matchedConversion,
                        matchedLineProduct?.group
                      )
                    : [];

                  const kgValue = line.shouldRecalculateConversion
                    ? (line.manualTongKg
                        ? parsePercentInput(String(line.tongKg ?? ''))
                        : calculatedConversion.find(([, , unit]) => unit === 'kg')?.[1] ?? null)
                    : readStoredOrderConversion(line, 'kg');
                  const m2Value = line.shouldRecalculateConversion
                    ? calculatedConversion.find(([, , unit]) => unit === 'm2')?.[1] ?? null
                    : readStoredOrderConversion(line, 'm2');
                  const mdaiValue = line.shouldRecalculateConversion
                    ? calculatedConversion.find(([, , unit]) => unit === 'm dài')?.[1] ?? null
                    : readStoredOrderConversion(line, 'm dài');

                  return renderProductLineShell(
                    line,
                    index,
                    productGridClass,
                    <>
                    <div className="min-w-0">
                        <SearchableSelect
                          value={line.shouldRecalculateConversion
                            ? (matchedLineProduct?.id || line.productId || line.productCode)
                            : line.productCode}
                          onChange={productId => pickOrderProduct(line.key, productId)}
                          options={productOptions}
                          placeholder="Tìm Mã AMIS"
                          isLoading={isLoadingLookups}
                          skipUnchangedBlurCommit
                          maxResults={ORDER_AMIS_SEARCH_MAX_RESULTS}
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
                      <div className="min-w-0">
                        <input
                          value={line.productName}
                          readOnly={Boolean(matchedLineProduct)}
                          onChange={e => updateConversionProductLine(line.key, { productName: e.target.value })}
                          className={`${orderFieldClass} ${matchedLineProduct ? 'bg-zinc-50 text-zinc-800' : 'bg-white'}`}
                          placeholder={matchedLineProduct ? '' : 'Tự động theo mã SP'}
                        />
                      </div>
                      <div className="min-w-0">
                        {renderProductionNameSelect(line)}
                      </div>
                      <div className="col-span-1 min-w-0">
                        <input
                          type="text"
                          value={line.mang ?? ''}
                          onChange={e => {
                            const nextMang = e.target.value;
                            const currentMang = line.mang ?? '';
                            const nextProductionName = line.productionName
                              ? replaceMangInName(line.productionName, nextMang, currentMang)
                              : line.productionName;
                            updateConversionProductLine(line.key, {
                              mang: nextMang,
                              productionName: nextProductionName
                            });
                          }}
                          className={orderFieldClass}
                          placeholder="Màng"
                          title="Màng (để trống nếu không có, tự đổi trong tên sản xuất)"
                        />
                      </div>
                      <div className="min-w-0">
                        <input
                          value={line.note}
                          onChange={e => updateProductLine(line.key, { note: e.target.value })}
                          className={orderFieldClass}
                          placeholder="Ghi chú"
                        />
                      </div>
                      {renderAllocatedQtyCell(line.savedStt ? getAllocatedQtyFromMap(allocatedQtyMap, orderForm.orderCode, {
                        productId: line.productId || matchedLineProduct?.id,
                        productCode: line.productCode,
                        productionName: line.productionName,
                        tenGhep: line.tenGhep,
                        stt: duplicateLineStt(orderForm.productLines, index) ? line.savedStt : undefined
                      }) : 0)}
                      <div className="col-span-1 min-w-0">
                        {matchedLineProduct ? <select value={effectiveUnit} onChange={e => updateConversionProductLine(line.key, { unit: e.target.value })} className={orderFieldClass}>{allowedUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select> : <input value={line.unit} onChange={e => updateConversionProductLine(line.key, { unit: e.target.value })} className={orderFieldClass} placeholder="ĐVT" />}
                      </div>
                      {isFormProductionOrder ? (
                        <>
                          <div className="col-span-1 min-w-0">
                            <OrderNumberInput
                              value={line.slBac ?? ''}
                              onChange={e => updateConversionProductLine(line.key, { slBac: e.target.value })}
                              className={`${orderFieldClass} bg-white text-right`}
                              placeholder="0"
                              title="SL Bắc"
                            />
                          </div>
                          <div className="col-span-1 min-w-0">
                            <OrderNumberInput
                              value={line.slTrung ?? ''}
                              onChange={e => updateConversionProductLine(line.key, { slTrung: e.target.value })}
                              className={`${orderFieldClass} bg-white text-right`}
                              placeholder="0"
                              title="SL Trung"
                            />
                          </div>
                          <div className="col-span-1 min-w-0">
                            <OrderNumberInput
                              value={line.slNam ?? ''}
                              onChange={e => updateConversionProductLine(line.key, { slNam: e.target.value })}
                              className={`${orderFieldClass} bg-white text-right`}
                              placeholder="0"
                              title="SL Nam"
                            />
                          </div>
                          <div className="col-span-1 min-w-0">
                            <input
                              type="text"
                              value={regionQtyTotal !== null ? formatNumber(regionQtyTotal, 3) : ''}
                              readOnly
                              title="SL tổng = Bắc + Trung + Nam. Nhập ít nhất một ô Bắc, Trung hoặc Nam."
                              className={`${orderFieldClass} bg-zinc-50 text-right font-black`}
                              placeholder="Tự tính"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="col-span-1 min-w-0">
                          <OrderNumberInput
                            value={line.quantity}
                            onChange={e => updateConversionProductLine(line.key, { quantity: e.target.value })}
                            className={`${orderFieldClass} bg-white`}
                            placeholder="0"
                          />
                        </div>
                      )}
                      <div className="col-span-1 min-w-0">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.manualTongKg
                            ? String(line.tongKg ?? '')
                            : kgValue !== null && Number.isFinite(kgValue)
                              ? formatNumber(Math.round(kgValue), 0)
                              : ''}
                          onChange={e => updateProductLine(line.key, {
                            tongKg: e.target.value,
                            manualTongKg: e.target.value.trim() !== '',
                              manualFromSaved: false,
                            shouldRecalculateConversion: true
                          })}
                          onBlur={e => {
                            const next = orderDuplicateDecimalText(e.target.value);
                            if (next === e.target.value) return;
                            updateProductLine(line.key, {
                              tongKg: next,
                              manualTongKg: next.trim() !== '',
                                manualFromSaved: false,
                              shouldRecalculateConversion: true
                            });
                          }}
                          title={line.manualTongKg
                            ? `KG do khách hàng nhập${isCuonProduct(effectiveUnit) ? '; dùng để tính TL/cuộn' : isTamProduct(effectiveUnit) ? '; dùng để tính TL/tấm' : ''}`
                            : 'Có thể nhập KG của khách hàng để ưu tiên giá trị thực tế'}
                          placeholder="Nhập KG"
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
                    </>
                  );
                })}
              </RepeatableLinesBlock>
              </div>
              </div>
              </div>

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
        </div>,
        document.body
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
                  {getOrderProductLines(viewingOrder).map((line, index) => {
                    const isCuon = isCuonProduct(line.unit);
                    const isTam = isTamProduct(line.unit);
                    const showTlCuon = isCuon && Boolean(line.tlCuon);
                    const showTlTam = isTam && Boolean(line.tlTam);
                    return (
                    <div key={`${line.productCode}-${line.quantity}-${index}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                      <p className="font-bold text-zinc-900">
                        <span className="mr-2 font-black tabular-nums text-zinc-400">{line.stt || index + 1}.</span>
                        {line.productCode || '-'} · {line.productName || '-'}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-zinc-500">Tên sản xuất: {line.tenGhep || '-'}</p>
                      {line.mang ? (
                        <p className="mt-0.5 text-xs font-semibold text-zinc-500">Màng: {line.mang}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs font-semibold text-zinc-500">Ghi chú: {line.note || '-'}</p>
                      <p className="mt-0.5 text-xs font-bold text-amber-700">
                        SL lệnh SX: {formatNumber(getAllocatedQtyFromMap(allocatedQtyMap, viewingOrder.orderCode, {
                          productId: line.productId,
                          productCode: line.productCode,
                          productionName: line.productionName,
                          tenGhep: line.tenGhep,
                          stt: duplicateLineStt(getOrderProductLines(viewingOrder), index)
                        }), 3)}
                      </p>
                      <p className="mt-0.5 text-zinc-600">
                        SL: {line.quantity || '-'}
                        {line.unit && line.unit !== '-' ? ` ${line.unit}` : ''}
                        {positiveRegionTotal(line.soLuongBac, line.soLuongTrung, line.soLuongNam) !== null ? (
                          <span className="ml-2 text-xs font-bold text-sky-700">
                            (Bắc {line.soLuongBac || 0} · Trung {line.soLuongTrung || 0} · Nam {line.soLuongNam || 0})
                          </span>
                        ) : null}
                      </p>
                      {line.quyCach || line.daiM || line.doLi || line.kho ? (
                        <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                          Quy cách: {line.quyCach || (line.daiM ? `Dài ${line.daiM}m` : [line.doLi, line.kho ? `Khổ ${line.kho}` : ''].filter(Boolean).join(' · '))}
                        </p>
                      ) : null}
                      {(line.conversionResults?.some(result => result.unit !== 'kg/1 SP') || showTlCuon || showTlTam) ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {line.conversionResults?.filter(result => result.unit !== 'kg/1 SP').map(result => (
                            <span key={result.unit} className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                              {formatNumber(result.value, 3)} {result.unit}
                            </span>
                          ))}
                          {showTlCuon ? (
                            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
                              TL/cuộn: {line.tlCuon} kg
                            </span>
                          ) : null}
                          {showTlTam ? (
                            <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
                              TL/tấm: {line.tlTam} kg
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
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
              {canEdit && !viewingOrder.isDeleted ? (
                <button type="button" onClick={() => openEditForm(viewingOrder)} className="flex h-10 items-center gap-1.5 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-4 text-xs font-extrabold text-[#ef1b2d] transition hover:bg-red-100">
                  <Pencil className="h-4 w-4" />
                  Sửa
                </button>
              ) : null}
              {canEdit && viewingOrder.isDeleted ? (
                <button
                  type="button"
                  onClick={() => handleRestoreOrder(viewingOrder)}
                  disabled={restoringOrderId === viewingOrder.id}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoringOrderId === viewingOrder.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Khôi phục
                </button>
              ) : null}
              {canDelete && !viewingOrder.isDeleted ? (
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
        ? createPortal(<OrderPrintSheet order={printOrder} allocatedQtyMap={allocatedQtyMap} />, document.body)
        : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[11px] font-bold text-zinc-500">
            <span>{visibleOrders.length} đơn{showDeleted ? ' đã xóa' : ''}</span>
            <span>{customerCount} KH</span>
            <span>SL {formatNumber(totalQuantity)}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleShowDeleted}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-extrabold transition ${showDeleted ? 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
            title={showDeleted ? 'Về danh sách đơn hàng' : 'Xem đơn đã xóa (thùng rác)'}
          >
            <Archive className="h-4 w-4" />
            {showDeleted ? 'Về danh sách' : 'Đơn đã xóa'}
          </button>
          {canCreate && !showDeleted ? (
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
            <TableHeadCell className="min-w-[520px]">
              <div className="grid grid-cols-[2rem_minmax(72px,0.9fr)_minmax(120px,1.6fr)_72px_56px_64px] gap-2">
                <span>STT</span>
                <span>Mã SP</span>
                <span>Tên SP / Tên ghép</span>
                <span className="text-right">SL</span>
                <span>ĐVT</span>
                <span className="text-right">SL LSX</span>
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
                        const specText = line.quyCach
                          ? line.quyCach
                          : line.daiM
                            ? `Dài ${line.daiM}m`
                            : [line.doLi, sizeText].filter(Boolean).join(' · ');
                        return (
                          <div key={`${order.id}-${line.productCode}-${line.productName}-${index}`} className="py-1.5 first:pt-0 last:pb-0">
                            <div className="grid grid-cols-[2rem_minmax(72px,0.9fr)_minmax(120px,1.6fr)_72px_56px_64px] gap-2 text-xs font-semibold text-zinc-700">
                              <span className="font-black tabular-nums text-zinc-500">{line.stt || index + 1}</span>
                              <span className="font-black text-zinc-950">{line.productCode || '-'}</span>
                              <span className="text-zinc-800">{line.tenGhep || '-'}</span>
                              <span className="text-right font-mono font-bold text-zinc-900">{line.quantity || '-'}</span>
                              <span className="font-bold text-zinc-600">{line.unit || '-'}</span>
                              <span className="text-right font-mono font-bold text-amber-700" title="Tổng SL đã lập lệnh sản xuất cho dòng này">
                                {formatNumber(getAllocatedQtyFromMap(allocatedQtyMap, order.orderCode, {
                                  productId: line.productId,
                                  productCode: line.productCode,
                                  productionName: line.productionName,
                                  tenGhep: line.tenGhep,
                                  stt: duplicateLineStt(getOrderProductLines(order), index)
                                }), 3)}
                              </span>
                            </div>
                            {specText ? <div className="mt-0.5 text-[11px] font-semibold text-zinc-400">{specText}</div> : null}
                            {positiveRegionTotal(line.soLuongBac, line.soLuongTrung, line.soLuongNam) !== null ? (
                              <div className="mt-0.5 text-[11px] font-bold text-sky-700">
                                Bắc {line.soLuongBac || 0} · Trung {line.soLuongTrung || 0} · Nam {line.soLuongNam || 0}
                              </div>
                            ) : null}
                            {line.conversionResults && line.conversionResults.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {line.conversionResults.filter(r => r.unit !== 'kg/1 SP').map(r => (
                                  <span key={r.unit} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                    {formatNumber(r.value, 2)} {r.unit}
                                  </span>
                                ))}
                              </div>
                            ) : null}
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
                      {canEdit && !showDeleted ? (
                        <button
                          type="button"
                          onClick={() => openEditForm(order)}
                          title="Sửa"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDelete && !showDeleted ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                          disabled={deletingOrderId === order.id}
                          title="Xóa (giữ lại, có thể khôi phục)"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingOrderId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                      {showDeleted && canEdit ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreOrder(order)}
                          disabled={restoringOrderId === order.id}
                          title="Khôi phục đơn hàng"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {restoringOrderId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                      {showDeleted && canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order, true)}
                          disabled={deletingOrderId === order.id}
                          title="Xóa vĩnh viễn (không thể khôi phục)"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                {showDeleted
                  ? 'Không có đơn hàng đã xóa.'
                  : 'Bảng don_hang chưa có dữ liệu hoặc không có đơn phù hợp bộ lọc.'}
              </TableEmptyRow>
            )}
          </TableBody>
        </TableShell>
      </div>
    </div>
  );
}

export { formatTimeCell } from '../_shared/recordHelpers';
