import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer } from 'lucide-react';
import type { AcceptanceReport } from './AcceptanceReportForm';
import type { MixingReport } from './MixingReportForm';
import type { WeighingRecord } from '../utils/weighingRecords';
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
  shiftFilter,
  machineFilter,
  onStaffFilterChange,
  detailSources,
  filterSources,
  staffOptions,
  selectedMachine,
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
  shiftFilter: string;
  machineFilter: string;
  onStaffFilterChange?: (value: string) => void;
  detailSources: DetailSources;
  filterSources: ShiftSummaryFilterSources;
  staffOptions: string[];
  selectedMachine?: { code?: string; name?: string } | null;
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
          staffFilter,
          machineFilter
        },
        filterSources,
        selectedMachine
      ),
    [rows, shiftFilter, staffFilter, machineFilter, filterSources, selectedMachine]
  );

  const totals = {
    slHang: sumShiftSummaryColumn(filteredRows, 'slHang'),
    slHangThucTe: sumShiftSummaryColumn(filteredRows, 'slHangThucTe'),
    khoiLuongHang: sumShiftSummaryColumn(filteredRows, 'khoiLuongHang'),
    khoiLuongHangThucTe: sumShiftSummaryColumn(filteredRows, 'khoiLuongHangThucTe'),
    hangHong: sumShiftSummaryColumn(filteredRows, 'hangHong'),
    khoiLuongNpl: sumShiftSummaryColumn(filteredRows, 'khoiLuongNpl'),
    tonDauCa: sumShiftSummaryColumn(filteredRows, 'tonDauCa'),
    tonCuoiCa: sumShiftSummaryColumn(filteredRows, 'tonCuoiCa'),
    tongVatLieu: sumShiftSummaryColumn(filteredRows, 'tongVatLieu')
  };

  const shiftFilterLabel = shiftFilter === 'all' ? 'Tất cả ca' : shiftFilter;
  const machineFilterLabel = machineFilter === 'all' ? 'Tất cả máy' : machineFilter;
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
        staffLabel: staffFilterLabel,
        machineLabel: machineFilterLabel
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
      <section className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm sm:rounded-2xl sm:border-2 sm:border-zinc-900/10">
        <div className="border-b border-zinc-100 bg-gradient-to-r from-indigo-950 to-indigo-800 px-3 py-2.5 text-white sm:px-4 sm:py-3">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-200 sm:text-xs">Tổng hợp sản xuất</p>
              <h3 className="text-base font-black sm:text-lg">Bảng tổng hợp theo ca</h3>
              <p className="mt-1 hidden text-xs font-medium text-indigo-100/90 sm:block">
                SL hàng LT / KL hàng từ lệnh SX · SL hàng TT / KL hàng TT từ báo cáo sản lượng (SL × kg định mức) · Khối lượng NPL từ lịch sử xuất nhập kho · Tồn đầu/cuối ca từ bảng tồn NVL · Tổng vật liệu = KL NPL + Tồn đầu ca − Tồn cuối ca
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <label className="col-span-1 flex min-w-0 flex-col gap-1 text-[10px] font-bold text-indigo-100 sm:flex-row sm:items-center sm:gap-1.5 sm:text-xs">
                <span className="shrink-0">NV</span>
                <select
                  value={staffFilter}
                  onChange={event => {
                    setStaffFilter(event.target.value);
                    onStaffFilterChange?.(event.target.value);
                  }}
                  className={`${inputClass} w-full min-w-0 sm:max-w-[180px]`}
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
                className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1 sm:w-auto"
              >
                <Printer className="h-4 w-4" />
                In
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: thẻ gọn theo từng ca */}
        <div className="space-y-2 p-2 md:hidden">
          {isLoading ? (
            <div className="py-8 text-center text-xs font-bold text-zinc-400">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Đang tải dữ liệu tổng hợp...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-zinc-400">Chưa có dữ liệu theo bộ lọc đã chọn.</div>
          ) : (
            <>
              {filteredRows.map(row => (
                <article key={row.key} className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-zinc-200/80 pb-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold text-zinc-700">{row.ngay}</p>
                      <p className="truncate text-xs font-black text-zinc-900">{row.ca}</p>
                    </div>
                    <p className="shrink-0 text-right text-[10px] font-black uppercase tracking-wider text-teal-800">
                      TVL
                      <span className="mt-0.5 block font-mono text-sm">{formatShiftSummaryNumber(row.tongVatLieu, 3)}</span>
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px]">
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-400">SL hàng LT</dt>
                      <dd className="font-mono font-bold text-zinc-800">{formatShiftSummaryNumber(row.slHang, 0)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-400">SL hàng TT</dt>
                      <dd className="font-mono font-bold text-sky-700">{formatShiftSummaryNumber(row.slHangThucTe, 0)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-400">KL hàng</dt>
                      <dd className="font-mono font-bold text-emerald-700">{formatShiftSummaryNumber(row.khoiLuongHang, 3)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-400">KL TT</dt>
                      <dd className="font-mono font-bold text-[#ef1b2d]">{formatShiftSummaryNumber(row.khoiLuongHangThucTe, 3)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-400">Hàng hỏng</dt>
                      <dd className="font-mono font-bold text-rose-700">{formatShiftSummaryNumber(row.hangHong, 3)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-400">KL NPL</dt>
                      <dd className="font-mono font-bold text-amber-700">{formatShiftSummaryNumber(row.khoiLuongNpl, 3)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-400">Tồn đầu</dt>
                      <dd className="font-mono font-bold text-indigo-700">{formatShiftSummaryNumber(row.tonDauCa, 3)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold uppercase tracking-wider text-zinc-400">Tồn cuối</dt>
                      <dd className="font-mono font-bold text-violet-700">{formatShiftSummaryNumber(row.tonCuoiCa, 3)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
              <div className="rounded-lg border border-zinc-300 bg-zinc-100 px-2.5 py-2 text-[10px] font-black text-zinc-800">
                <p className="mb-1 uppercase tracking-wider text-zinc-500">Tổng cộng</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <span>SL LT: {formatShiftSummaryNumber(totals.slHang, 0)}</span>
                  <span className="text-sky-700">SL TT: {formatShiftSummaryNumber(totals.slHangThucTe, 0)}</span>
                  <span className="text-emerald-700">KL: {formatShiftSummaryNumber(totals.khoiLuongHang, 3)}</span>
                  <span className="text-[#ef1b2d]">KL TT: {formatShiftSummaryNumber(totals.khoiLuongHangThucTe, 3)}</span>
                  <span className="text-teal-800">TVL: {formatShiftSummaryNumber(totals.tongVatLieu, 3)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[1360px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 text-right font-black">SL hàng LT</th>
                <th className="px-3 py-2.5 text-right font-black">SL hàng TT</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng hàng</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng hàng TT</th>
                <th className="px-3 py-2.5 text-right font-black">Hàng hỏng</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng NPL</th>
                <th className="px-3 py-2.5 text-right font-black">Tồn đầu ca</th>
                <th className="px-3 py-2.5 text-right font-black">Tồn cuối ca</th>
                <th className="px-3 py-2.5 text-right font-black">Tổng vật liệu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải dữ liệu tổng hợp...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có dữ liệu theo bộ lọc đã chọn.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr key={row.key} className="hover:bg-indigo-50/40">
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
                      metric="slHangThucTe"
                      formatted={formatShiftSummaryNumber(row.slHangThucTe, 0)}
                      className="px-3 py-2 text-right font-mono font-bold text-sky-700"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="khoiLuongHang"
                      formatted={formatShiftSummaryNumber(row.khoiLuongHang, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-emerald-700"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="khoiLuongHangThucTe"
                      formatted={formatShiftSummaryNumber(row.khoiLuongHangThucTe, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-[#ef1b2d]"
                      onOpen={openDetail}
                    />
                    <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">
                      {formatShiftSummaryNumber(row.hangHong, 3)}
                    </td>
                    <SummaryValueCell
                      row={row}
                      metric="khoiLuongNpl"
                      formatted={formatShiftSummaryNumber(row.khoiLuongNpl, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-amber-700"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="tonDauCa"
                      formatted={formatShiftSummaryNumber(row.tonDauCa, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-indigo-700"
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
                  <td className="px-3 py-2.5 text-right font-mono text-sky-700">
                    {formatShiftSummaryNumber(totals.slHangThucTe, 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                    {formatShiftSummaryNumber(totals.khoiLuongHang, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#ef1b2d]">
                    {formatShiftSummaryNumber(totals.khoiLuongHangThucTe, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-rose-700">
                    {formatShiftSummaryNumber(totals.hangHong, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                    {formatShiftSummaryNumber(totals.khoiLuongNpl, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-indigo-700">
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
