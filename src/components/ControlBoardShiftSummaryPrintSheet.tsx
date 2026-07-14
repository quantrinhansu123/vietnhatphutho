import React from 'react';
import { PRINT_COMPANY_NAME, vietNhatLogoUrl } from './layout/constants';
import {
  computeShiftSummarySanLuongMetrics,
  computeSoTienLoLaiNhua,
  formatShiftSummaryNumber,
  formatShiftSummaryKg,
  formatShiftSummaryPercent,
  resolveShiftSummaryGiaNhuaFromWarehouse,
  resolveShiftSummaryTlDinhMucKgCuon,
  sumShiftSummaryColumn,
  TI_LE_LOI_HONG_DINH_MUC_PERCENT,
  type ControlBoardShiftSummaryRow,
  type ShiftSummaryWarehouseMovement
} from '../utils/controlBoardShiftSummary';
import { formatMoney } from '../utils';
import type { ShiftSetting } from '../utils/shiftSettings';

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

function EmptyRows({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="shift-summary-print-center">
        Không có dữ liệu theo bộ lọc đã chọn.
      </td>
    </tr>
  );
}

function ControlBoardShiftSummaryPrintSheet({
  rows,
  filters,
  phanTichDanhGiaMap = {},
  warehouseMovements,
  shiftSettings = []
}: {
  rows: ControlBoardShiftSummaryRow[];
  filters: ShiftSummaryPrintFilters;
  phanTichDanhGiaMap?: Record<string, string>;
  warehouseMovements?: ShiftSummaryWarehouseMovement[];
  shiftSettings?: ShiftSetting[];
}) {
  const totals = {
    slHang: sumShiftSummaryColumn(rows, 'slHang'),
    khoiLuongHang: sumShiftSummaryColumn(rows, 'khoiLuongHang'),
    khoiLuongNpl: sumShiftSummaryColumn(rows, 'khoiLuongNpl'),
    khoiLuongMangXuat: sumShiftSummaryColumn(rows, 'khoiLuongMangXuat'),
    khoiLuongLoiXuatKho: sumShiftSummaryColumn(rows, 'khoiLuongLoiXuatKho'),
    khoiLuongTuiXuatKho: sumShiftSummaryColumn(rows, 'khoiLuongTuiXuatKho'),
    tongTrongLuongXuatKho: sumShiftSummaryColumn(rows, 'tongTrongLuongXuatKho'),
    tonDauCaNhua: sumShiftSummaryColumn(rows, 'tonDauCaNhua'),
    tonDauCaMang: sumShiftSummaryColumn(rows, 'tonDauCaMang'),
    tonDauCaLoi: sumShiftSummaryColumn(rows, 'tonDauCaLoi'),
    tonDauCaTui: sumShiftSummaryColumn(rows, 'tonDauCaTui'),
    tongTrongLuongTonDauCa: sumShiftSummaryColumn(rows, 'tongTrongLuongTonDauCa'),
    tonCuoiCaNhua: sumShiftSummaryColumn(rows, 'tonCuoiCaNhua'),
    tonCuoiCaMang: sumShiftSummaryColumn(rows, 'tonCuoiCaMang'),
    tonCuoiCaLoi: sumShiftSummaryColumn(rows, 'tonCuoiCaLoi'),
    tonCuoiCaTui: sumShiftSummaryColumn(rows, 'tonCuoiCaTui'),
    tongTrongLuongTonCuoiCa: sumShiftSummaryColumn(rows, 'tongTrongLuongTonCuoiCa'),
    slDatThucTeNhapKho: sumShiftSummaryColumn(rows, 'slDatThucTeNhapKho'),
    tlNhuaTpNhapKho: sumShiftSummaryColumn(rows, 'tlNhuaTpNhapKho'),
    tlMangTpNhapKho: sumShiftSummaryColumn(rows, 'tlMangTpNhapKho'),
    tlTuiBaoBiNhapKho: sumShiftSummaryColumn(rows, 'tlTuiBaoBiNhapKho'),
    tlLoiTpNhapKho: sumShiftSummaryColumn(rows, 'tlLoiTpNhapKho'),
    tongTpNhapKho: sumShiftSummaryColumn(rows, 'tongTpNhapKho'),
    tlNhuaKhongMangLoiHong: sumShiftSummaryColumn(rows, 'tlNhuaKhongMangLoiHong'),
    tlNhuaCucDauNongLoiHong: sumShiftSummaryColumn(rows, 'tlNhuaCucDauNongLoiHong'),
    tlNhuaDinhMangLoiHong: sumShiftSummaryColumn(rows, 'tlNhuaDinhMangLoiHong'),
    tlMangLoiHong: sumShiftSummaryColumn(rows, 'tlMangLoiHong'),
    soCuonLoiDinhHangHong: sumShiftSummaryColumn(rows, 'soCuonLoiDinhHangHong'),
    tongTrongLuongLoiHong: sumShiftSummaryColumn(rows, 'tongTrongLuongLoiHong'),
    tongNhuaThucDung: sumShiftSummaryColumn(rows, 'tongNhuaThucDung'),
    tongMangThucDung: sumShiftSummaryColumn(rows, 'tongMangThucDung'),
    loiThucDung: sumShiftSummaryColumn(rows, 'loiThucDung'),
    tuiThucDung: sumShiftSummaryColumn(rows, 'tuiThucDung'),
    tongThucDung: sumShiftSummaryColumn(rows, 'tongThucDung'),
    chenhLech: sumShiftSummaryColumn(rows, 'chenhLech'),
    hangHongMang: sumShiftSummaryColumn(rows, 'hangHongMang')
  };

  const sanLuongTotals = computeShiftSummarySanLuongMetrics({
    tongTpNhapKho: totals.tongTpNhapKho,
    tongTrongLuongLoiHong: totals.tongTrongLuongLoiHong,
    tongThucDung: totals.tongThucDung,
    chenhLechNhua: totals.chenhLech,
    tongMangThucDung: totals.tongMangThucDung,
    tlMangTpNhapKho: totals.tlMangTpNhapKho,
    hangHongMang: totals.hangHongMang,
    tiLeLoiHongDinhMuc: TI_LE_LOI_HONG_DINH_MUC_PERCENT
  });

  const hasRows = rows.length > 0;

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
              <th>Máy</th>
              <th>Nhân viên</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{formatPrintRange(filters.dateFrom, filters.dateTo)}</td>
              <td className="production-order-print-center">{filters.shiftLabel}</td>
              <td>{filters.machineLabel || 'Tất cả máy'}</td>
              <td>{filters.staffLabel}</td>
            </tr>
          </tbody>
        </table>

        <div className="shift-summary-print-page">
        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">Sản lượng &amp; chênh lệch</h2>
          <table className="shift-summary-print-table shift-summary-print-table-wide">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ca</th>
                <th className="shift-summary-print-num">Tổng TL nhập kho</th>
                <th className="shift-summary-print-num">CL TL nhập − xuất</th>
                <th className="shift-summary-print-num">Tỉ lệ CL TL</th>
                <th className="shift-summary-print-num">Tỉ lệ LH định mức</th>
                <th className="shift-summary-print-num">Tỉ lệ LH</th>
                <th className="shift-summary-print-num">Lệch LH vs ĐM</th>
                <th className="shift-summary-print-num">Lỗ/lãi nhựa</th>
                <th className="shift-summary-print-num">Giá (phiếu kho)</th>
                <th className="shift-summary-print-num">Số tiền lỗ lãi nhựa</th>
                <th className="shift-summary-print-num">Lỗ/lãi màng</th>
                <th>Phân tích đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <EmptyRows colSpan={13} />
              ) : (
                rows.map(row => {
                  const giaNhua = resolveShiftSummaryGiaNhuaFromWarehouse(
                    row.ngay,
                    row.ca,
                    warehouseMovements,
                    shiftSettings
                  );
                  const soTienLoLaiNhua = computeSoTienLoLaiNhua(row.giaTriLoLaiNhua, giaNhua);
                  return (
                  <tr key={`san-luong-${row.key}`}>
                    <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                    <td className="shift-summary-print-center">{row.ca}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tongTrongLuongNhapKho, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.chenhLechTrongLuongNhapXuat, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryPercent(row.tiLeChenhLechTrongLuong)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryPercent(row.tiLeLoiHongDinhMuc)}
                    </td>
                    <td className="shift-summary-print-num">{formatShiftSummaryPercent(row.tiLeLoiHong)}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryPercent(row.lechLoiHongVsDinhMuc)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.giaTriLoLaiNhua, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {giaNhua > 0 ? formatMoney(giaNhua, 0) : ''}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatMoney(soTienLoLaiNhua, 0)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.giaTriLoLaiMang, 3)}
                    </td>
                    <td>{phanTichDanhGiaMap[row.key] || ''}</td>
                  </tr>
                  );
                })
              )}
              {hasRows ? (
                <tr className="shift-summary-print-total-row">
                  <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                    Tổng cộng
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(sanLuongTotals.tongTrongLuongNhapKho, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(sanLuongTotals.chenhLechTrongLuongNhapXuat, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryPercent(sanLuongTotals.tiLeChenhLechTrongLuong)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryPercent(sanLuongTotals.tiLeLoiHongDinhMuc)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryPercent(sanLuongTotals.tiLeLoiHong)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryPercent(sanLuongTotals.lechLoiHongVsDinhMuc)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(sanLuongTotals.giaTriLoLaiNhua, 3)}
                  </td>
                  <td className="shift-summary-print-num" />
                  <td className="shift-summary-print-num">
                    {formatMoney(
                      rows.reduce(
                        (sum, row) =>
                          sum +
                          computeSoTienLoLaiNhua(
                            row.giaTriLoLaiNhua,
                            resolveShiftSummaryGiaNhuaFromWarehouse(
                              row.ngay,
                              row.ca,
                              warehouseMovements,
                              shiftSettings
                            )
                          ),
                        0
                      ),
                      0
                    )}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(sanLuongTotals.giaTriLoLaiMang, 3)}
                  </td>
                  <td />
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">Dữ liệu trong lệnh sản xuất</h2>
          <table className="shift-summary-print-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ca</th>
                <th className="shift-summary-print-num">SL đặt SX</th>
                <th className="shift-summary-print-num">TL định mức kg/cuộn</th>
                <th className="shift-summary-print-num">Tổng TL đặt SX (kg)</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <EmptyRows colSpan={5} />
              ) : (
                rows.map(row => (
                  <tr key={`lenh-${row.key}`}>
                    <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                    <td className="shift-summary-print-center">{row.ca}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryNumber(row.slHang, 0)}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryNumber(resolveShiftSummaryTlDinhMucKgCuon(row), 3)}
                    </td>
                    <td className="shift-summary-print-num">{formatShiftSummaryNumber(row.khoiLuongHang, 3)}</td>
                  </tr>
                ))
              )}
              {hasRows ? (
                <tr className="shift-summary-print-total-row">
                  <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                    Tổng cộng
                  </td>
                  <td className="shift-summary-print-num">{formatShiftSummaryNumber(totals.slHang, 0)}</td>
                  <td className="shift-summary-print-num">
                    {totals.slHang > 0
                      ? formatShiftSummaryNumber(totals.khoiLuongHang / totals.slHang, 3)
                      : '-'}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryNumber(totals.khoiLuongHang, 3)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        </div>

        <div className="shift-summary-print-page">
        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">Dữ liệu trong phiếu xuất kho</h2>
          <table className="shift-summary-print-table shift-summary-print-table-wide">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ca</th>
                <th className="shift-summary-print-num">Nhựa TT xuất dùng (kg)</th>
                <th className="shift-summary-print-num">Màng TT xuất dùng (kg)</th>
                <th className="shift-summary-print-num">TL lõi xuất kho (kg)</th>
                <th className="shift-summary-print-num">TL túi xuất kho (kg)</th>
                <th className="shift-summary-print-num">Tổng TL xuất kho</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <EmptyRows colSpan={7} />
              ) : (
                rows.map(row => (
                  <tr key={`xuat-${row.key}`}>
                    <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                    <td className="shift-summary-print-center">{row.ca}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.khoiLuongNpl, 3)}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.khoiLuongMangXuat, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.khoiLuongLoiXuatKho, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.khoiLuongTuiXuatKho, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tongTrongLuongXuatKho, 3)}
                    </td>
                  </tr>
                ))
              )}
              {hasRows ? (
                <tr className="shift-summary-print-total-row">
                  <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                    Tổng cộng
                  </td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.khoiLuongNpl, 3)}</td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.khoiLuongMangXuat, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.khoiLuongLoiXuatKho, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.khoiLuongTuiXuatKho, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tongTrongLuongXuatKho, 3)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">Báo cáo dữ liệu tồn đầu ca</h2>
          <table className="shift-summary-print-table shift-summary-print-table-wide">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ca</th>
                <th className="shift-summary-print-num">Nhựa tồn đầu ca (kg)</th>
                <th className="shift-summary-print-num">Màng tồn đầu ca (kg)</th>
                <th className="shift-summary-print-num">TL lõi tồn đầu ca (kg)</th>
                <th className="shift-summary-print-num">TL túi tồn đầu ca (kg)</th>
                <th className="shift-summary-print-num">Tổng TL tồn đầu ca</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <EmptyRows colSpan={7} />
              ) : (
                rows.map(row => (
                  <tr key={`ton-dau-${row.key}`}>
                    <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                    <td className="shift-summary-print-center">{row.ca}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tonDauCaNhua, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tonDauCaMang, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tonDauCaLoi, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tonDauCaTui, 3)}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tongTrongLuongTonDauCa, 3)}
                    </td>
                  </tr>
                ))
              )}
              {hasRows ? (
                <tr className="shift-summary-print-total-row">
                  <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                    Tổng cộng
                  </td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tonDauCaNhua, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tonDauCaMang, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tonDauCaLoi, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tonDauCaTui, 3)}</td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tongTrongLuongTonDauCa, 3)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        </div>

        <div className="shift-summary-print-page">
        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">Dữ liệu trong báo cáo kiểm tồn cuối ca</h2>
          <table className="shift-summary-print-table shift-summary-print-table-wide">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ca</th>
                <th className="shift-summary-print-num">Nhựa tồn cuối ca (kg)</th>
                <th className="shift-summary-print-num">Màng tồn cuối ca (kg)</th>
                <th className="shift-summary-print-num">TL lõi tồn cuối ca (kg)</th>
                <th className="shift-summary-print-num">TL túi tồn cuối ca (kg)</th>
                <th className="shift-summary-print-num">Tổng TL tồn cuối ca</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <EmptyRows colSpan={7} />
              ) : (
                rows.map(row => (
                  <tr key={`ton-cuoi-${row.key}`}>
                    <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                    <td className="shift-summary-print-center">{row.ca}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tonCuoiCaNhua, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tonCuoiCaMang, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tonCuoiCaLoi, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tonCuoiCaTui, 3)}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tongTrongLuongTonCuoiCa, 3)}
                    </td>
                  </tr>
                ))
              )}
              {hasRows ? (
                <tr className="shift-summary-print-total-row">
                  <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                    Tổng cộng
                  </td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tonCuoiCaNhua, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tonCuoiCaMang, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tonCuoiCaLoi, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tonCuoiCaTui, 3)}</td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tongTrongLuongTonCuoiCa, 3)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">Phiếu nhập kho</h2>
          <table className="shift-summary-print-table shift-summary-print-table-wide">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ca</th>
                <th className="shift-summary-print-num">SL đạt thực tế</th>
                <th className="shift-summary-print-num">TL nhựa TP (kg)</th>
                <th className="shift-summary-print-num">TL màng TP (kg)</th>
                <th className="shift-summary-print-num">TL túi bao bì (kg)</th>
                <th className="shift-summary-print-num">TL lõi TP (kg)</th>
                <th className="shift-summary-print-num">Tổng TP nhập kho</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <EmptyRows colSpan={8} />
              ) : (
                rows.map(row => (
                  <tr key={`nhap-${row.key}`}>
                    <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                    <td className="shift-summary-print-center">{row.ca}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryNumber(row.slDatThucTeNhapKho, 0)}
                    </td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tlNhuaTpNhapKho, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tlMangTpNhapKho, 3)}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tlTuiBaoBiNhapKho, 3)}
                    </td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tlLoiTpNhapKho, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tongTpNhapKho, 3)}</td>
                  </tr>
                ))
              )}
              {hasRows ? (
                <tr className="shift-summary-print-total-row">
                  <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                    Tổng cộng
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryNumber(totals.slDatThucTeNhapKho, 0)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tlNhuaTpNhapKho, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tlMangTpNhapKho, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tlTuiBaoBiNhapKho, 3)}
                  </td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tlLoiTpNhapKho, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tongTpNhapKho, 3)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        </div>

        <div className="shift-summary-print-page">
        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">Báo cáo lỗi hỏng</h2>
          <table className="shift-summary-print-table shift-summary-print-table-wide">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ca</th>
                <th className="shift-summary-print-num">TL nhựa không màng LH (kg)</th>
                <th className="shift-summary-print-num">TL nhựa cục đầu nòng LH (kg)</th>
                <th className="shift-summary-print-num">TL nhựa dính màng LH (kg)</th>
                <th className="shift-summary-print-num">TL màng LH (kg)</th>
                <th className="shift-summary-print-num">Cuộn lõi dính HH (kg)</th>
                <th className="shift-summary-print-num">Tổng TL lỗi hỏng</th>
              </tr>
            </thead>
            <tbody>
              {!hasRows ? (
                <EmptyRows colSpan={8} />
              ) : (
                rows.map(row => (
                  <tr key={`loi-${row.key}`}>
                    <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                    <td className="shift-summary-print-center">{row.ca}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tlNhuaKhongMangLoiHong, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tlNhuaCucDauNongLoiHong, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tlNhuaDinhMangLoiHong, 3)}
                    </td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tlMangLoiHong, 3)}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.soCuonLoiDinhHangHong, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tongTrongLuongLoiHong, 3)}
                    </td>
                  </tr>
                ))
              )}
              {hasRows ? (
                <tr className="shift-summary-print-total-row">
                  <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                    Tổng cộng
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tlNhuaKhongMangLoiHong, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tlNhuaCucDauNongLoiHong, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tlNhuaDinhMangLoiHong, 3)}
                  </td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tlMangLoiHong, 3)}</td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.soCuonLoiDinhHangHong, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tongTrongLuongLoiHong, 3)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        <section className="shift-summary-print-section">
          <h2 className="production-order-print-section-title">Tổng vật tư thực xuất dùng</h2>
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
              {!hasRows ? (
                <EmptyRows colSpan={7} />
              ) : (
                rows.map(row => (
                  <tr key={`thuc-dung-${row.key}`}>
                    <td className="shift-summary-print-center">{formatPrintDate(row.ngay)}</td>
                    <td className="shift-summary-print-center">{row.ca}</td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tongNhuaThucDung, 3)}
                    </td>
                    <td className="shift-summary-print-num">
                      {formatShiftSummaryKg(row.tongMangThucDung, 3)}
                    </td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.loiThucDung, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tuiThucDung, 3)}</td>
                    <td className="shift-summary-print-num">{formatShiftSummaryKg(row.tongThucDung, 3)}</td>
                  </tr>
                ))
              )}
              {hasRows ? (
                <tr className="shift-summary-print-total-row">
                  <td colSpan={2} className="shift-summary-print-num shift-summary-print-total-label">
                    Tổng cộng
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tongNhuaThucDung, 3)}
                  </td>
                  <td className="shift-summary-print-num">
                    {formatShiftSummaryKg(totals.tongMangThucDung, 3)}
                  </td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.loiThucDung, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tuiThucDung, 3)}</td>
                  <td className="shift-summary-print-num">{formatShiftSummaryKg(totals.tongThucDung, 3)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        </div>


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
  filters,
  phanTichDanhGiaMap,
  warehouseMovements,
  shiftSettings
}: {
  rows: ControlBoardShiftSummaryRow[];
  filters: ShiftSummaryPrintFilters;
  phanTichDanhGiaMap?: Record<string, string>;
  warehouseMovements?: ShiftSummaryWarehouseMovement[];
  shiftSettings?: ShiftSetting[];
}) {
  return (
    <div className="production-order-print-batch shift-summary-print-batch">
      <ControlBoardShiftSummaryPrintSheet
        rows={rows}
        filters={filters}
        phanTichDanhGiaMap={phanTichDanhGiaMap}
        warehouseMovements={warehouseMovements}
        shiftSettings={shiftSettings}
      />
    </div>
  );
}
