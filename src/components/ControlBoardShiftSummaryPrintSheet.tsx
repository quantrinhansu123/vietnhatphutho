import React from 'react';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from './layout/constants';
import {
  formatShiftSummaryNumber,
  formatShiftSummaryKg,
  sumShiftSummaryColumn,
  type ControlBoardShiftSummaryRow
} from '../utils/controlBoardShiftSummary';
export type ShiftSummaryPrintFilters = {
  dateFrom: string;
  dateTo: string;
  shiftLabel: string;
  staffLabel: string;
  machineLabel?: string;
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
  return formatShiftSummaryNumber(value, fractionDigits);
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
    slHangThucTe: sumShiftSummaryColumn(rows, 'slHangThucTe'),
    khoiLuongHang: sumShiftSummaryColumn(rows, 'khoiLuongHang'),
    khoiLuongHangThucTe: sumShiftSummaryColumn(rows, 'khoiLuongHangThucTe'),
    khoiLuongNhuaTp: sumShiftSummaryColumn(rows, 'khoiLuongNhuaTp'),
    hangHong: sumShiftSummaryColumn(rows, 'hangHong'),
    khoiLuongNpl: sumShiftSummaryColumn(rows, 'khoiLuongNpl'),
    khoiLuongMangXuat: sumShiftSummaryColumn(rows, 'khoiLuongMangXuat'),
    khoiLuongLoi: sumShiftSummaryColumn(rows, 'khoiLuongLoi'),
    khoiLuongMang: sumShiftSummaryColumn(rows, 'khoiLuongMang'),
    tonDauCa: sumShiftSummaryColumn(rows, 'tonDauCa'),
    tonCuoiCa: sumShiftSummaryColumn(rows, 'tonCuoiCa'),
    tongNhuaThucDung: sumShiftSummaryColumn(rows, 'tongNhuaThucDung'),
    tongMangThucDung: sumShiftSummaryColumn(rows, 'tongMangThucDung'),
    loiThucDung: sumShiftSummaryColumn(rows, 'loiThucDung'),
    tuiThucDung: sumShiftSummaryColumn(rows, 'tuiThucDung'),
    tongThucDung: sumShiftSummaryColumn(rows, 'tongThucDung'),
    tongVatLieu: sumShiftSummaryColumn(rows, 'tongVatLieu'),
    chenhLech: sumShiftSummaryColumn(rows, 'chenhLech')
  };

  return (
    <div className="production-order-print-sheet shift-summary-print-sheet">
      <div className="production-order-print-doc shift-summary-print-doc">
        <header className="production-order-print-letterhead">
          <img src={vietNhatLogoUrl} alt={PRINT_COMPANY_NAME} className="production-order-print-logo" />
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
              <th className="shift-summary-print-num">SL đặt SX</th>
              <th className="shift-summary-print-num">SL hàng TT</th>
              <th className="shift-summary-print-num">KL hàng</th>
              <th className="shift-summary-print-num">KL hàng TT</th>
              <th className="shift-summary-print-num">KL nhựa TP</th>
              <th className="shift-summary-print-num">Hàng hỏng</th>
              <th className="shift-summary-print-num">KL nhựa xuất</th>
              <th className="shift-summary-print-num">KL màng xuất (kg)</th>
              <th className="shift-summary-print-num">KL lõi</th>
              <th className="shift-summary-print-num">KL bì</th>
              <th className="shift-summary-print-num">Tồn đầu ca nhựa</th>
              <th className="shift-summary-print-num">Tồn cuối ca nhựa</th>
              <th className="shift-summary-print-num">Tổng nhựa sử dụng</th>
              <th className="shift-summary-print-num">Chênh lệch nhựa</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={16} className="shift-summary-print-center">
                  Không có dữ liệu theo bộ lọc đã chọn.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.key}>
                  <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                  <td className="shift-summary-print-center">{row.ca}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.slHang, 0)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.slHangThucTe, 0)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongHang, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongHangThucTe, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongNhuaTp, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.hangHong, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongNpl, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(row.khoiLuongMangXuat, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongLoi, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.khoiLuongMang, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.tonDauCa, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.tonCuoiCa, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.tongVatLieu, 3)}</td>
                  <td className="shift-summary-print-num">{formatPrintValue(row.chenhLech, 3)}</td>
                </tr>
              ))
            )}
            {rows.length > 0 ? (
              <tr className="shift-summary-print-total-row">
                <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                  Tổng cộng
                </td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.slHang, 0)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.slHangThucTe, 0)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.khoiLuongHang, 3)}</td>
                <td className="shift-summary-print-num">
                  {formatShiftSummaryNumber(totals.khoiLuongHangThucTe, 3)}
                </td>
                <td className="shift-summary-print-num">
                  {formatShiftSummaryNumber(totals.khoiLuongNhuaTp, 3)}
                </td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.hangHong, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.khoiLuongNpl, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.khoiLuongMangXuat, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.khoiLuongLoi, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.khoiLuongMang, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.tonDauCa, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.tonCuoiCa, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.tongVatLieu, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.chenhLech, 3)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <h2 className="production-order-print-section-title">Tổng vật tư thực dùng</h2>
        <table className="shift-summary-print-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Ca</th>
              <th className="shift-summary-print-num">Tổng Nhựa thực dùng</th>
              <th className="shift-summary-print-num">Tổng Màng thực dùng</th>
              <th className="shift-summary-print-num">Lõi thực dùng</th>
              <th className="shift-summary-print-num">Túi thực dùng</th>
              <th className="shift-summary-print-num">Tổng thực dùng</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="shift-summary-print-center">
                  Không có dữ liệu theo bộ lọc đã chọn.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={`usage-${row.key}`}>
                  <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                  <td className="shift-summary-print-center">{row.ca}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tongNhuaThucDung, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tongMangThucDung, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(row.loiThucDung, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tuiThucDung, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tongThucDung, 3)}</td>
                </tr>
              ))
            )}
            {rows.length > 0 ? (
              <tr className="shift-summary-print-total-row">
                <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                  Tổng cộng
                </td>
                <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tongNhuaThucDung, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tongMangThucDung, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.loiThucDung, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tuiThucDung, 3)}</td>
                <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tongThucDung, 3)}</td>
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
