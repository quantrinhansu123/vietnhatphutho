import React from 'react';
import { getOrderProductLines, type OrderRow } from '../features/_shared/orderRecordHelpers';

function displayCell(value: string | null | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed && trimmed !== '-' ? trimmed : '';
}

function splitDateParts(value: string): { day: number; month: number; year: number } | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return { day: parsed.getDate(), month: parsed.getMonth() + 1, year: parsed.getFullYear() };
}

function formatLongVietnameseDate(value: string): string {
  const parts = splitDateParts(value);
  if (!parts) return '';
  return `Ngày ${String(parts.day).padStart(2, '0')} tháng ${String(parts.month).padStart(2, '0')} năm ${parts.year}`;
}

function formatOrderNumberFromDate(value: string): string {
  const parts = splitDateParts(value);
  if (!parts) return '';
  return `T${parts.month}/${parts.year}`;
}

export default function OrderCutPrintSheet({ order }: { order: OrderRow }) {
  const productLines = getOrderProductLines(order);
  const printDate = formatLongVietnameseDate(order.createdAt || order.orderDate);
  const orderNumber =
    formatOrderNumberFromDate(order.deliveryDate) || formatOrderNumberFromDate(order.createdAt || order.orderDate);

  return (
    <div className="order-print-sheet order-cut-print-sheet">
      <div className="order-print-doc order-cut-print-doc">
        <p className="order-cut-print-date">{printDate ? `Phú Thọ, ${printDate}` : 'Phú Thọ'}</p>
        <h1 className="order-cut-print-title">ĐƠN ĐẶT CẮT LẺ</h1>
        {orderNumber ? <p className="order-cut-print-subline">Số đơn: {orderNumber}</p> : null}
        <p className="order-cut-print-subline">Loại đơn: {displayCell(order.orderType) || 'Đơn theo quy cách của khách đặt'}</p>
        <p className="order-cut-print-request">Đề nghị sản xuất hàng với thông tin chi tiết như sau:</p>
        <p className="order-cut-print-customer">KH: {displayCell(order.customer) || '—'}</p>

        <table className="order-cut-print-table">
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '23%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>STT</th>
              <th rowSpan={2}>Mã Amis</th>
              <th rowSpan={2}>Tên hàng</th>
              <th rowSpan={2}>ĐVT</th>
              <th colSpan={3}>Kích thước</th>
              <th rowSpan={2}>Số lượng</th>
              <th rowSpan={2}>Ghi chú</th>
            </tr>
            <tr>
              <th>Độ li</th>
              <th>Khổ</th>
              <th>Dài (m)</th>
            </tr>
          </thead>
          <tbody>
            {productLines.length === 0 ? (
              <tr>
                <td colSpan={9} className="order-cut-print-empty">
                  Chưa có dòng sản phẩm
                </td>
              </tr>
            ) : (
              productLines.map((line, idx) => (
                <tr key={`${line.productCode}-${idx}`}>
                  <td className="order-print-center">{idx + 1}</td>
                  <td className="order-print-center order-print-mono">{displayCell(line.productCode)}</td>
                  <td>{displayCell(line.productionName) || displayCell(line.productName)}</td>
                  <td className="order-print-center">{displayCell(line.unit) || 'Tấm'}</td>
                  <td className="order-print-center">{displayCell(line.doLi)}</td>
                  <td className="order-print-center">{displayCell(line.kho)}</td>
                  <td className="order-print-center">{displayCell(line.daiM)}</td>
                  <td className="order-print-center">{displayCell(line.quantity)}</td>
                  <td>{displayCell(line.note)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
