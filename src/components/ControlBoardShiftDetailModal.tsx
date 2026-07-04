import React, { useMemo, useState } from 'react';
import { Loader2, Pencil, Trash2, X } from 'lucide-react';
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
  onClose,
  onEditWeighingRecord,
  onDeleteWeighingRecord
}: {
  ngay: string;
  ca: string;
  metric: ShiftSummaryMetric;
  sources: DetailSources;
  onClose: () => void;
  onEditWeighingRecord?: (recordId: string | number) => void;
  onDeleteWeighingRecord?: (recordId: string | number) => Promise<void>;
}) {
  const meta = SHIFT_SUMMARY_METRIC_META[metric];
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

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

  const showWeighingActions =
    metric === 'khoiLuongHangThucTe' && detail.showActions && Boolean(onEditWeighingRecord || onDeleteWeighingRecord);

  const handleDelete = async (recordId: string | number) => {
    if (!onDeleteWeighingRecord) return;
    if (!window.confirm('Bạn có chắc muốn xóa dòng cân này?')) return;

    setDeletingId(recordId);
    try {
      await onDeleteWeighingRecord(recordId);
    } finally {
      setDeletingId(null);
    }
  };

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
                    {showWeighingActions ? (
                      <th className="px-3 py-2 text-center font-black">Thao tác</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {detail.rows.map((row, index) => {
                    const recordId = row.recordId;
                    const hasRecordId = recordId !== null && recordId !== undefined && recordId !== '';

                    return (
                      <tr key={hasRecordId ? String(recordId) : index} className="hover:bg-indigo-50/40">
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
                        {showWeighingActions ? (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={!hasRecordId}
                                onClick={() => {
                                  if (!hasRecordId || !onEditWeighingRecord) return;
                                  onClose();
                                  onEditWeighingRecord(recordId as string | number);
                                }}
                                className="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Sửa dòng cân"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Pencil className="h-3.5 w-3.5" />
                                  Sửa
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={!hasRecordId || deletingId === recordId}
                                onClick={() => {
                                  if (!hasRecordId) return;
                                  void handleDelete(recordId as string | number);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Xóa dòng cân"
                              >
                                {deletingId === recordId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-zinc-200 bg-zinc-50">
                  <tr>
                    <td
                      colSpan={Math.max(1, detail.columns.length - 1 + (showWeighingActions ? 1 : 0))}
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
