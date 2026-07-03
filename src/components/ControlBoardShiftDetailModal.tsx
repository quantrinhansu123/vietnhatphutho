import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import type { AcceptanceReport } from './AcceptanceReportForm';
import type { MixingReport } from './MixingReportForm';
import type { WeighingRecord } from './WeighingShiftSummary';
import type { ShiftSetting } from '../utils/shiftSettings';
import {
  getShiftSummaryDetail,
  SHIFT_SUMMARY_METRIC_META,
  type ShiftSummaryDetailColumn,
  type ShiftSummaryDetailRow,
  type ShiftSummaryMetric
} from '../utils/controlBoardShiftSummaryDetails';
import { formatNumber } from '../utils';

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

function formatCellValue(
  column: ShiftSummaryDetailColumn,
  row: ShiftSummaryDetailRow
) {
  const value = row[column.key];
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    return formatNumber(value, column.key === 'soLuong' ? 2 : 0);
  }
  return String(value);
}

export default function ControlBoardShiftDetailModal({
  ngay,
  ca,
  metric,
  sources,
  onClose
}: {
  ngay: string;
  ca: string;
  metric: ShiftSummaryMetric;
  sources: DetailSources;
  onClose: () => void;
}) {
  const meta = SHIFT_SUMMARY_METRIC_META[metric];

  const detail = useMemo(
    () =>
      getShiftSummaryDetail({
        metric,
        ngay,
        ca,
        ...sources
      }),
    [metric, ngay, ca, sources]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative flex max-h-[96vh] w-full max-w-[min(96vw,1100px)] flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{meta.source}</p>
            <h3 className="text-lg font-black text-zinc-950">Chi tiết {meta.label}</h3>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              {ngay} · Ca {ca} · {detail.rows.length} dòng
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {detail.rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm font-bold text-zinc-400">
              Không có dòng chi tiết cho ô này.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    {detail.columns.map(column => (
                      <th
                        key={column.key}
                        className={`px-3 py-2 font-black ${column.align === 'right' ? 'text-right' : ''}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {detail.rows.map((row, index) => (
                    <tr key={index} className="hover:bg-indigo-50/40">
                      {detail.columns.map(column => (
                        <td
                          key={column.key}
                          className={`px-3 py-2 ${
                            column.align === 'right' ? 'text-right' : ''
                          } ${column.mono ? 'font-mono' : ''} ${
                            column.accent ? 'font-bold text-[#ef1b2d]' : 'text-zinc-700'
                          }`}
                        >
                          {formatCellValue(column, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-zinc-200 bg-zinc-50">
                  <tr>
                    <td
                      colSpan={Math.max(1, detail.columns.length - 1)}
                      className="px-3 py-2.5 text-right text-xs font-black uppercase tracking-wider text-zinc-600"
                    >
                      {detail.totalLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm font-black text-zinc-900">
                      {detail.totalValue}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
