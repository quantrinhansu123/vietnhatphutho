import React from 'react';
import { formatNumber, parsePercentInput } from '../utils';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from './layout/constants';
import { SOUTH_ORDER_TYPE, getAllocatedQtyFromMap, isRetailCutOrderType } from '../features/_shared/orderHelpers';
import { getOrderProductLines, type OrderRow } from '../features/_shared/orderRecordHelpers';
import { cutOrderPrintSize, cutOrderPrintTenHang, formatPhuThoDate } from './cutOrderPrint';

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

function displayCell(value: string | null | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed && trimmed !== '-' ? trimmed : '';
}

export default function OrderPrintSheet({ order, allocatedQtyMap }: { order: OrderRow; allocatedQtyMap?: Map<string, number> }) {
  const productLines = getOrderProductLines(order);
  const totalQuantity = productLines.reduce((sum, item) => sum + parsePercentInput(item.quantity), 0);
  const allocatedOf = (line: ReturnType<typeof getOrderProductLines>[number]) =>
    allocatedQtyMap
      ? getAllocatedQtyFromMap(allocatedQtyMap, order.orderCode, {
          productId: line.productId,
          productCode: line.productCode,
          productionName: line.productionName,
          tenGhep: line.tenGhep
        })
      : 0;
  const totalAllocated = productLines.reduce((sum, line) => sum + allocatedOf(line), 0);
  const orderNote = displayCell(order.note);
  const isRetailCutOrder = isRetailCutOrderType(order.orderType);
  const isSouthOrder = order.orderType === SOUTH_ORDER_TYPE;

  if (isRetailCutOrder) {
    const placeDate = formatPhuThoDate(order.orderDate || order.createdAt);
    return (
      <div className="order-print-sheet">
        <div className="order-print-doc order-print-cut">
          <p className="order-print-cut-place">{placeDate}</p>
          <h1 className="order-print-cut-title">ĐƠN ĐẶT CẮT LẺ</h1>
          <p className="order-print-cut-meta">Số đơn: {displayCell(order.orderCode) || '—'}</p>
          <p className="order-print-cut-meta">Loại đơn: {displayCell(order.orderType) || 'Đơn cắt lẻ'}</p>
          {orderNote ? <p className="order-print-cut-note">{orderNote}</p> : null}

          <table className="order-print-cut-table">
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '36%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2}>STT</th>
                <th rowSpan={2}>Tên hàng</th>
                <th rowSpan={2}>ĐVT</th>
                <th colSpan={2}>Kích thước</th>
                <th rowSpan={2}>Số lượng</th>
                <th rowSpan={2}>Ghi chú</th>
              </tr>
              <tr>
                <th>Khổ</th>
                <th>Dài (m)</th>
              </tr>
            </thead>
            <tbody>
              {productLines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="order-print-empty-row">Chưa có dòng sản phẩm</td>
                </tr>
              ) : (
                productLines.map((line, idx) => {
                  const size = cutOrderPrintSize(line);
                  const qty = parsePercentInput(line.quantity);
                  return (
                    <tr key={`${line.productCode}-${idx}`}>
                      <td className="order-print-center">{line.stt || idx + 1}</td>
                      <td className="order-print-cut-name">{cutOrderPrintTenHang(line)}</td>
                      <td className="order-print-center">{displayCell(line.unit)}</td>
                      <td className="order-print-center">{size.kho}</td>
                      <td className="order-print-center">{size.dai}</td>
                      <td className="order-print-center">{Number.isFinite(qty) && qty > 0 ? formatNumber(qty, 3) : ''}</td>
                      <td>{displayCell(line.note)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="order-print-cut-confirm">
            <p>Bộ phận sản xuất xác nhận đơn hàng :</p>
            <p>Ngày đặt: {order.orderDate || order.createdAt ? formatOrderCreatedAt(order.orderDate || order.createdAt) : ''}</p>
            <p>Ngày giao: {order.deliveryDate ? formatOrderCreatedAt(order.deliveryDate) : ''}</p>
          </div>
          <div className="order-print-cut-signs">
            <div>
              <p>Điều phối sản xuất.</p>
            </div>
            <div>
              <p>Người lập</p>
              <span>{displayCell(order.staffName)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatLineSpec = (line: ReturnType<typeof getOrderProductLines>[number]) => {
    if (line.quyCach) return line.quyCach;
    if (line.daiM && !line.doLi && !line.kho) return `Dài ${line.daiM}m`;
    const parts = [
      displayCell(line.doLi),
      displayCell(line.kho) ? `Khổ ${displayCell(line.kho)}` : '',
      displayCell(line.daiM) ? `Dài ${displayCell(line.daiM)}m` : ''
    ].filter(Boolean);
    return parts.join(' · ');
  };

  return (
    <div className="order-print-sheet">
      <div className="order-print-doc">
        <header className="order-print-letterhead">
          <div className="order-print-brand">
            <img src={vietNhatLogoUrl} alt={PRINT_COMPANY_NAME} className="order-print-logo" />
            <div className="order-print-company">
              <p className="order-print-company-name">{PRINT_COMPANY_NAME}</p>
              <p className="order-print-company-subtitle">Dự án Chuyển đổi số sản xuất</p>
            </div>
          </div>
          <div className="order-print-form-meta">
            <p className="order-print-form-code">BM-SX-01</p>
            <p className="order-print-form-version">Phiên bản 1.0</p>
          </div>
        </header>

        <h1 className="order-print-title">{isSouthOrder ? 'ĐƠN ĐẶT HÀNG MIỀN NAM' : isRetailCutOrder ? 'ĐƠN ĐẶT CẮT LẺ' : 'ĐƠN ĐẶT HÀNG SẢN XUẤT'}</h1>

        <table className="order-print-meta-table">
          <tbody>
            <tr>
              <th>Số đơn hàng</th>
              <td>{displayCell(order.orderCode) || '—'}</td>
              <th>Ngày lập</th>
              <td>{formatOrderCreatedAt(order.orderDate || order.createdAt)}</td>
            </tr>
            <tr>
              <th>Khách hàng</th>
              <td>{displayCell(order.customer) || '—'}</td>
              <th>Bộ phận lập</th>
              <td>{displayCell(order.staffName) || '—'}</td>
            </tr>
            <tr>
              <th>Địa chỉ khách hàng</th>
              <td colSpan={3} />
            </tr>
            <tr>
              <th>Thời hạn giao hàng</th>
              <td colSpan={3}>{order.deliveryDate ? formatOrderCreatedAt(order.deliveryDate) : '—'}</td>
            </tr>
          </tbody>
        </table>

        <table className="order-print-products-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã sản phẩm</th>
              <th>Tên sản xuất</th>
              <th>Quy cách</th>
              <th>ĐVT</th>
              <th>Số lượng</th>
              <th>Hạn giao</th>
              <th>Ghi chú</th>
              <th>SL lệnh SX</th>
            </tr>
          </thead>
          <tbody>
            {productLines.length === 0 ? (
              <tr>
                <td colSpan={9} className="order-print-empty-row">
                  Chưa có dòng sản phẩm
                </td>
              </tr>
            ) : (
              productLines.map((line, idx) => (
                <tr key={`${line.productCode}-${idx}`}>
                  <td className="order-print-center">{line.stt || idx + 1}</td>
                  <td className="order-print-mono">{displayCell(line.productCode)}</td>
                  <td className="order-print-product-name">
                    {displayCell(line.tenGhep)}
                  </td>
                  <td>{formatLineSpec(line)}</td>
                  <td className="order-print-center">{displayCell(line.unit)}</td>
                  <td className="order-print-center order-print-qty">
                    {displayCell(line.quantity) || '—'}
                  </td>
                  <td>{order.deliveryDate ? formatOrderCreatedAt(order.deliveryDate) : ''}</td>
                  <td>{displayCell(line.note) || (idx === 0 ? orderNote : '')}</td>
                  <td className="order-print-center order-print-qty">
                    {formatNumber(allocatedOf(line))}
                  </td>
                </tr>
              ))
            )}
            <tr className="order-print-total-row">
              <td colSpan={5} className="order-print-total-label">
                TỔNG CỘNG
              </td>
              <td className="order-print-center order-print-total-value">
                {formatNumber(totalQuantity)}
              </td>
              <td />
              <td />
              <td className="order-print-center order-print-total-value">
                {formatNumber(totalAllocated)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="order-print-signatures">
          <div>
            <p>Người lập</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Phụ trách bộ phận</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
          <div>
            <p>Bộ phận kế hoạch (tiếp nhận)</p>
            <span>(Ký, ghi rõ họ tên)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
