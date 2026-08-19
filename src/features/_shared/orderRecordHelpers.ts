import { parsePercentInput } from '../../utils';
import { pickText, formatCell } from './recordHelpers';
import {
  expandMergedProductionProducts,
  expandProductionOrderProductLines,
  type OrderProductLine
} from './productionProductHelpers';

export type { OrderProductLine };

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
  deliveryDate: string;
  orderDate: string;
  createdAt: string;
  updatedAt?: string;
  productionOrder?: string;
}

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
          const productId = pickText(row, ['san_pham_id', 'productId', 'product_id'], '');
          const productCode = pickText(row, ['ma_sp', 'ma_hang', 'productCode', 'code'], '');
          const productName = pickText(row, ['ten_sp', 'ten_hang', 'productName', 'name'], '');
          const productionName = pickText(row, ['ten_san_xuat', 'productionName'], '');
          const unit = formatCell(row.don_vi ?? row.unit);
          const quantity = formatCell(row.so_luong ?? row.quantity);
          if (!productCode && !productName) return null;
          return {
            productId,
            productCode,
            productName,
            productionName,
            unit,
            quantity,
            conversionResults: Array.isArray(row.ket_qua_quy_doi)
              ? row.ket_qua_quy_doi.map(item => {
                  const result = item && typeof item === 'object' ? item as Record<string, unknown> : {};
                  return { unit: pickText(result, ['don_vi', 'unit'], ''), value: Number(result.gia_tri ?? result.value) };
                }).filter(item => item.unit && Number.isFinite(item.value))
              : undefined,
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
