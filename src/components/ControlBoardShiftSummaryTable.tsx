import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Loader2, Printer } from 'lucide-react';
import type { AcceptanceReport } from './AcceptanceReportForm';
import type { MixingReport } from './MixingReportForm';
import type { WeighingRecord } from './WeighingShiftSummary';
import ControlBoardShiftDetailModal from './ControlBoardShiftDetailModal';
import {
  ControlBoardShiftSummaryPrintBatch,
  type ShiftSummaryPrintFilters
} from './ControlBoardShiftSummaryPrintSheet';
import {
  filterControlBoardShiftSummaryRows,
  formatShiftSummaryNumber,
  sumShiftSummaryColumn,
  type ControlBoardShiftSummaryRow,
  type ShiftSummaryFilterSources
} from '../utils/controlBoardShiftSummary';
import {
  isShiftSummaryMetricClickable,
  type ShiftSummaryMetric
} from '../utils/controlBoardShiftSummaryDetails';
import type { ShiftSetting } from '../utils/shiftSettings';

const inputClass =
  'h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

type DetailSources = {
  shiftSettings: ShiftSetting[];
  productionOrders: Array<{
    code: string;
    startDate: string;
    shift: string;
    productCode: string;
    productName: string;
    quantity: string;
    unit: string;
    products: Array<{ productCode: string; productName: string; quantity: string; unit: string }>;
  }>;
  products: Array<{ code: string; totalWeight: string }>;
  acceptanceReports: AcceptanceReport[];
  mixingReports: MixingReport[];
  warehouseMovements?: import('../utils/controlBoardShiftSummary').ShiftSummaryWarehouseMovement[];
  weighingRecords: WeighingRecord[];
  machineNvlReports?: import('../utils/machineNvlReports').MachineNvlSavedReport[];
};

function SummaryValueCell({
  row,
  metric,
  formatted,
  className,
  onOpen
}: {
  row: ControlBoardShiftSummaryRow;
  metric: ShiftSummaryMetric;
  formatted: string;
  className: string;
  onOpen: (row: ControlBoardShiftSummaryRow, metric: ShiftSummaryMetric) => void;
}) {
  const clickable = isShiftSummaryMetricClickable(row, metric);

  if (!clickable) {
    return <td className={className}>{formatted}</td>;
  }

  return (
    <td className={className}>
      <button
        type="button"
        onClick={() => onOpen(row, metric)}
        className="rounded px-1 py-0.5 font-inherit underline decoration-dotted underline-offset-2 transition hover:bg-white/80 hover:decoration-solid"
        title="Xem chi tiết dòng số liệu"
      >
        {formatted}
      </button>
    </td>
  );
}

export default function ControlBoardShiftSummaryTable({
  rows,
  isLoading,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  detailSources,
  filterSources,
  shiftOptions,
  staffOptions,
  onEditWeighingRecord,
  onDeleteWeighingRecord,
  onDeleteWeighingRecords,
  onDeleteWarehouseSlip,
  onDeleteWarehouseSlips,
  onDeleteMachineNvlReport,
  onDeleteMachineNvlReports
}: {
  rows: ControlBoardShiftSummaryRow[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  detailSources: DetailSources;
  filterSources: ShiftSummaryFilterSources;
  shiftOptions: string[];
  staffOptions: string[];
  onEditWeighingRecord?: (recordId: string | number) => void;
  onDeleteWeighingRecord?: (recordId: string | number) => Promise<void>;
  onDeleteWeighingRecords?: (recordIds: Array<string | number>) => Promise<void>;
  onDeleteWarehouseSlip?: (slipCode: string) => Promise<void>;
  onDeleteWarehouseSlips?: (slipCodes: string[]) => Promise<void>;
  onDeleteMachineNvlReport?: (reportId: string) => Promise<void>;
  onDeleteMachineNvlReports?: (reportIds: string[]) => Promise<void>;
}) {
  const [detailContext, setDetailContext] = useState<{
    ngay: string;
    ca: string;
    metric: ShiftSummaryMetric;
  } | null>(null);
  const [shiftFilter, setShiftFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [printPayload, setPrintPayload] = useState<{
    rows: ControlBoardShiftSummaryRow[];
    filters: ShiftSummaryPrintFilters;
  } | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);

  const filteredRows = useMemo(
    () =>
      filterControlBoardShiftSummaryRows(
        rows,
        {
          shiftFilter,
          staffFilter
        },
        filterSources
      ),
    [rows, shiftFilter, staffFilter, filterSources]
  );

  const totals = {
    slHang: sumShiftSummaryColumn(filteredRows, 'slHang'),
    khoiLuongHang: sumShiftSummaryColumn(filteredRows, 'khoiLuongHang'),
    khoiLuongHangThucTe: sumShiftSummaryColumn(filteredRows, 'khoiLuongHangThucTe'),
    khoiLuongNpl: sumShiftSummaryColumn(filteredRows, 'khoiLuongNpl'),
    tonDauCa: sumShiftSummaryColumn(filteredRows, 'tonDauCa'),
    tonCuoiCa: sumShiftSummaryColumn(filteredRows, 'tonCuoiCa'),
    tongVatLieu: sumShiftSummaryColumn(filteredRows, 'tongVatLieu')
  };

  const shiftFilterLabel = shiftFilter === 'all' ? 'Tất cả ca' : shiftFilter;
  const staffFilterLabel = staffFilter === 'all' ? 'Tất cả nhân viên' : staffFilter;

  const openDetail = (row: ControlBoardShiftSummaryRow, metric: ShiftSummaryMetric) => {
    setDetailContext({ ngay: row.ngay, ca: row.ca, metric });
  };

  const handlePrint = () => {
    setPrintPayload({
      rows: filteredRows,
      filters: {
        dateFrom,
        dateTo,
        shiftLabel: shiftFilterLabel,
        staffLabel: staffFilterLabel
      }
    });
    setPendingPrint(true);
  };

  useEffect(() => {
    if (!pendingPrint || !printPayload) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pendingPrint, printPayload]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintPayload(null);
      setPendingPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const detailModal = detailContext ? (
    <ControlBoardShiftDetailModal
      ngay={detailContext.ngay}
      ca={detailContext.ca}
      metric={detailContext.metric}
      sources={detailSources}
      onClose={() => setDetailContext(null)}
      onEditWeighingRecord={onEditWeighingRecord}
      onDeleteWeighingRecord={onDeleteWeighingRecord}
      onDeleteWeighingRecords={onDeleteWeighingRecords}
      onDeleteWarehouseSlip={onDeleteWarehouseSlip}
      onDeleteWarehouseSlips={onDeleteWarehouseSlips}
      onDeleteMachineNvlReport={onDeleteMachineNvlReport}
      onDeleteMachineNvlReports={onDeleteMachineNvlReports}
    />
  ) : null;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-gradient-to-r from-brand-950 to-brand-800 px-4 py-3 text-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-brand-200">Tổng hợp sản xuất</p>
              <h3 className="text-lg font-black">Bảng tổng hợp theo ca</h3>
              <p className="mt-1 text-xs font-medium text-brand-100/90">
                SL/KL hàng kế hoạch từ lệnh SX · Khối lượng hàng TT từ báo cáo cân ca · Khối lượng NPL từ lịch sử xuất nhập kho · Tồn đầu/cuối ca từ bảng tồn NVL · Tổng vật liệu = KL NPL + Tồn đầu ca − Tồn cuối ca
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="hidden h-4 w-4 text-brand-200 sm:block" />
              <label className="flex items-center gap-1.5 text-xs font-bold text-brand-100">
                Từ
                <input
                  type="date"
                  value={dateFrom}
                  onChange={event => onDateFromChange(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-brand-100">
                Đến
                <input
                  type="date"
                  value={dateTo}
                  onChange={event => onDateToChange(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-brand-100">
                Ca
                <select
                  value={shiftFilter}
                  onChange={event => setShiftFilter(event.target.value)}
                  className={inputClass}
                >
                  <option value="all">Tất cả ca</option>
                  {shiftOptions.map(shift => (
                    <option key={shift} value={shift}>
                      {shift}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-brand-100">
                Nhân viên
                <select
                  value={staffFilter}
                  onChange={event => setStaffFilter(event.target.value)}
                  className={`${inputClass} max-w-[180px]`}
                >
                  <option value="all">Tất cả</option>
                  {staffOptions.map(staff => (
                    <option key={staff} value={staff}>
                      {staff}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handlePrint}
                disabled={isLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                In
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 text-right font-black">SL hàng</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng hàng</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng hàng TT</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng NPL</th>
                <th className="px-3 py-2.5 text-right font-black">Tồn đầu ca</th>
                <th className="px-3 py-2.5 text-right font-black">Tồn cuối ca</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng vật liệu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải dữ liệu tổng hợp...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có dữ liệu theo bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr key={row.key} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 font-mono font-bold text-zinc-700">{row.ngay}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-800">{row.ca}</td>
                    <SummaryValueCell
                      row={row}
                      metric="slHang"
                      formatted={formatShiftSummaryNumber(row.slHang, 0)}
                      className="px-3 py-2 text-right font-mono font-bold text-zinc-800"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="khoiLuongHang"
                      formatted={formatShiftSummaryNumber(row.khoiLuongHang, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-success-700"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="khoiLuongHangThucTe"
                      formatted={formatShiftSummaryNumber(row.khoiLuongHangThucTe, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-[#ef1b2d]"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="khoiLuongNpl"
                      formatted={formatShiftSummaryNumber(row.khoiLuongNpl, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-warning-700"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="tonDauCa"
                      formatted={formatShiftSummaryNumber(row.tonDauCa, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-brand-700"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="tonCuoiCa"
                      formatted={formatShiftSummaryNumber(row.tonCuoiCa, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-violet-700"
                      onOpen={openDetail}
                    />
                    <td className="px-3 py-2 text-right font-mono font-bold text-teal-800">
                      {formatShiftSummaryNumber(row.tongVatLieu, 3)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && filteredRows.length > 0 && (
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={2} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng cộng
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatShiftSummaryNumber(totals.slHang, 0)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-success-700">
                    {formatShiftSummaryNumber(totals.khoiLuongHang, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#ef1b2d]">
                    {formatShiftSummaryNumber(totals.khoiLuongHangThucTe, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-warning-700">
                    {formatShiftSummaryNumber(totals.khoiLuongNpl, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-brand-700">
                    {formatShiftSummaryNumber(totals.tonDauCa, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-violet-700">
                    {formatShiftSummaryNumber(totals.tonCuoiCa, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-teal-800">
                    {formatShiftSummaryNumber(totals.tongVatLieu, 3)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {detailModal}
      {printPayload
        ? createPortal(
            <ControlBoardShiftSummaryPrintBatch rows={printPayload.rows} filters={printPayload.filters} />,
            document.body
          )
        : null}
    </>
  );
}
