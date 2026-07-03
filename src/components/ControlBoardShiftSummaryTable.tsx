import React, { useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import type { AcceptanceReport } from './AcceptanceReportForm';
import type { MixingReport } from './MixingReportForm';
import type { WeighingRecord } from './WeighingShiftSummary';
import ControlBoardShiftDetailModal from './ControlBoardShiftDetailModal';
import {
  formatShiftSummaryNumber,
  sumShiftSummaryColumn,
  type ControlBoardShiftSummaryRow
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
  weighingRecords: WeighingRecord[];
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
  detailSources
}: {
  rows: ControlBoardShiftSummaryRow[];
  isLoading: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  detailSources: DetailSources;
}) {
  const [detailContext, setDetailContext] = useState<{
    ngay: string;
    ca: string;
    metric: ShiftSummaryMetric;
  } | null>(null);

  const totals = {
    slHang: sumShiftSummaryColumn(rows, 'slHang'),
    khoiLuongHang: sumShiftSummaryColumn(rows, 'khoiLuongHang'),
    slHangThucTe: sumShiftSummaryColumn(rows, 'slHangThucTe'),
    khoiLuongHangThucTe: sumShiftSummaryColumn(rows, 'khoiLuongHangThucTe'),
    khoiLuongNpl: sumShiftSummaryColumn(rows, 'khoiLuongNpl')
  };

  const openDetail = (row: ControlBoardShiftSummaryRow, metric: ShiftSummaryMetric) => {
    setDetailContext({ ngay: row.ngay, ca: row.ca, metric });
  };

  const detailModal = detailContext ? (
    <ControlBoardShiftDetailModal
      ngay={detailContext.ngay}
      ca={detailContext.ca}
      metric={detailContext.metric}
      sources={detailSources}
      onClose={() => setDetailContext(null)}
    />
  ) : null;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-900/10 bg-white shadow-sm">
        <div className="border-b border-zinc-100 bg-gradient-to-r from-indigo-950 to-indigo-800 px-4 py-3 text-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-indigo-200">Tổng hợp sản xuất</p>
              <h3 className="text-lg font-black">Bảng tổng hợp theo ca</h3>
              <p className="mt-1 text-xs font-medium text-indigo-100/90">
                SL/KL hàng kế hoạch từ lệnh SX · Số lượng hàng TT từ báo cáo sản lượng · Khối lượng hàng TT từ báo cáo cân ca · NPL chỉ tính đơn vị kg · Bấm vào số để xem chi tiết
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="hidden h-4 w-4 text-indigo-200 sm:block" />
              <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-100">
                Từ
                <input
                  type="date"
                  value={dateFrom}
                  onChange={event => onDateFromChange(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-100">
                Đến
                <input
                  type="date"
                  value={dateTo}
                  onChange={event => onDateToChange(event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-black">Ngày</th>
                <th className="px-3 py-2.5 font-black">Ca</th>
                <th className="px-3 py-2.5 text-right font-black">SL hàng</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng hàng</th>
                <th className="px-3 py-2.5 text-right font-black">Số lượng hàng TT</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng hàng TT</th>
                <th className="px-3 py-2.5 text-right font-black">Khối lượng NPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải dữ liệu tổng hợp...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center font-bold text-zinc-400">
                    Chưa có dữ liệu trong khoảng ngày đã chọn.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
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
                      metric="khoiLuongHang"
                      formatted={formatShiftSummaryNumber(row.khoiLuongHang, 3)}
                      className="px-3 py-2 text-right font-mono font-bold text-emerald-700"
                      onOpen={openDetail}
                    />
                    <SummaryValueCell
                      row={row}
                      metric="slHangThucTe"
                      formatted={formatShiftSummaryNumber(row.slHangThucTe, 2)}
                      className="px-3 py-2 text-right font-mono font-bold text-sky-700"
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
                      className="px-3 py-2 text-right font-mono font-bold text-amber-700"
                      onOpen={openDetail}
                    />
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && rows.length > 0 && (
              <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-black text-zinc-800">
                <tr>
                  <td colSpan={2} className="px-3 py-2.5 text-right uppercase tracking-wider">
                    Tổng cộng
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatShiftSummaryNumber(totals.slHang, 0)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700">
                    {formatShiftSummaryNumber(totals.khoiLuongHang, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sky-700">
                    {formatShiftSummaryNumber(totals.slHangThucTe, 2)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#ef1b2d]">
                    {formatShiftSummaryNumber(totals.khoiLuongHangThucTe, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                    {formatShiftSummaryNumber(totals.khoiLuongNpl, 3)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {detailModal}
    </>
  );
}
