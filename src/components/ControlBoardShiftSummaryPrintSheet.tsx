import React from 'react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import {
  formatShiftSummaryNumber,
  sumShiftSummaryColumn,
  type ControlBoardShiftSummaryRow
} from '../utils/controlBoardShiftSummary';
import { formatNumber } from '../utils';

const PRINT_COMPANY_NAME = 'CÔNG TY TNHH VIỆT NHẬT IPT';

export type ShiftSummaryPrintFilters = {
  dateFrom: string;
  dateTo: string;
  shiftLabel: string;
  staffLabel: string;
};

function formatPrintDate(iso: string) {
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatPrintRange(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo && dateFrom !== dateTo) {
    return `${formatPrintDate(dateFrom)} – ${formatPrintDate(dateTo)}`;
  }
  if (dateFrom) return formatPrintDate(dateFrom);
  if (dateTo) return formatPrintDate(dateTo);
  return '-';
}

function formatPrintValue(value: number, fractionDigits: number) {
  if (!Number.isFinite(value) || value === 0) return '-';
  return formatNumber(value, fractionDigits);
}

function ControlBoardShiftSummaryPrintSheet({
  rows,
  filters
}: {
  rows: ControlBoardShiftSummaryRow[];
  filters: ShiftSummaryPrintFilters;
}) {
  const totals = {
    slHang: sumShiftSummaryColumn(rows, 'slHang'),
    khoiLuongHang: sumShiftSummaryColumn(rows, 'khoiLuongHang'),
    khoiLuongHangThucTe: sumShiftSummaryColumn(rows, 'khoiLuongHangThucTe'),
    khoiLuongNpl: sumShiftSummaryColumn(rows, 'khoiLuongNpl'),
    tonDauCa: sumShiftSummaryColumn(rows, 'tonDauCa'),
    tonCuoiCa: sumShiftSummaryColumn(rows, 'tonCuoiCa'),
    tongVatLieu: sumShiftSummaryColumn(rows, 'tongVatLieu')
  };

  return (
    <div className="production-order-print-sheet shift-summary-print-sheet">
      <div className="production-order-print-doc shift-summary-print-doc">
        <header className="production-order-print-letterhead">
          <img src={vietNhatLogoUrl} alt="Logo Viet Nhat IPT" className="production-order-print-logo" />
          <div className="production-order-print-company">
            <p className="production-order-print-company-name">{PRINT_COMPANY_NAME}</p>
          </div>
        </header>

        <h1 className="production-order-print-title">BẢNG TỔNG HỢP THEO CA</h1>

        <table className="production-order-print-grid-table production-order-print-params-table shift-summary-print-filter-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Ca</th>
              <th>Nhân viên</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{formatPrintRange(filters.dateFrom, filters.dateTo)}</td>
              <td className="production-order-print-center">{filters.shiftLabel}</td>
              <td>{filters.staffLabel}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="production-order-print-section-title">Chi tiết tổng hợp</h2>
        <table className="shift-summary-print-table">
          <colgroup>
            <col className="shift-summary-print-col-date" />
            <col className="shift-summary-print-col-shift" />
            <col className="shift-summary-print-col-num" />
            <col className="shift-summary-print-col-num" />
            <col className="shift-summary-print-col-num" />
            <col className="shift-summary-print-col-num" />
            <col className="shift-summary-print-col-num" />
            <col className="shift-summary-print-col-num" />
            <col className="shift-summary-print-col-num" />
          </colgroup>
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Ca</th>
              <th className="shift-summary-print-num">SL hàng</th>
              <th className="shift-summary-print-num">KL hàng</th>
              <th className="shift-summary-print-num">KL hàng TT</th>
              <th className="shift-summary-print-num">KL NPL</th>
              <th className="shift-summary-print-num">Tồn đầu ca</th>
              <th className="shift-summary-print-num">Tồn cuối ca</th>
              <th className="shift-summary-print-num">Tổng vật liệu</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="shift-summary-print-center">
                  Không có dữ liệu theo bộ lọc đã chọn.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.key}>
                  <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                  <td className="shift-summary-print-center">{row.ca}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.slHang, 0)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongHang, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongHangThucTe, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongNpl, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.tonDauCa, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.tonCuoiCa, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.tongVatLieu, 3)}</td>
                </tr>
              ))
            )}
            {rows.length > 0 ? (
              <tr className="shift-summary-print-total-row">
                <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                  Tổng cộng
                </td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.slHang, 0)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.khoiLuongHang, 3)}</td>
                <td className="shift-summary-print-num">
                  {formatShiftSummaryNumber(totals.khoiLuongHangThucTe, 3)}
                </td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.khoiLuongNpl, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.tonDauCa, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.tonCuoiCa, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.tongVatLieu, 3)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="shift-summary-print-signatures">
          <div>
            <p>Người lập</p>
            <span>(Ký, họ tên)</span>
          </div>
          <div>
            <p>Trưởng ca sản xuất</p>
            <span>(Ký, họ tên)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ControlBoardShiftSummaryPrintBatch({
  rows,
  filters
}: {
  rows: ControlBoardShiftSummaryRow[];
  filters: ShiftSummaryPrintFilters;
}) {
  return (
    <div className="production-order-print-batch shift-summary-print-batch">
      <ControlBoardShiftSummaryPrintSheet rows={rows} filters={filters} />
    </div>
  );
}
