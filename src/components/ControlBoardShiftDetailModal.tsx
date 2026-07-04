import React, { useEffect, useMemo, useState } from 'react';
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
  machineNvlReports?: import('../utils/machineNvlReports').MachineNvlSavedReport[];
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

function getRowSelectionKey(row: ShiftSummaryDetailRow) {
  const rowKey = row.rowKey;
  if (rowKey !== null && rowKey !== undefined && rowKey !== '') return String(rowKey);
  const recordId = row.recordId;
  if (recordId !== null && recordId !== undefined && recordId !== '') return String(recordId);
  return '';
}

function getRowDeleteTargetId(row: ShiftSummaryDetailRow) {
  const recordId = row.recordId;
  if (recordId === null || recordId === undefined || recordId === '') return null;
  return recordId;
}

export default function ControlBoardShiftDetailModal({
  ngay,
  ca,
  metric,
  sources,
  onClose,
  onEditWeighingRecord,
  onDeleteWeighingRecord,
  onDeleteWeighingRecords,
  onDeleteMixingReport,
  onDeleteMixingReports,
  onDeleteMachineNvlReport,
  onDeleteMachineNvlReports
}: {
  ngay: string;
  ca: string;
  metric: ShiftSummaryMetric;
  sources: DetailSources;
  onClose: () => void;
  onEditWeighingRecord?: (recordId: string | number) => void;
  onDeleteWeighingRecord?: (recordId: string | number) => Promise<void>;
  onDeleteWeighingRecords?: (recordIds: Array<string | number>) => Promise<void>;
  onDeleteMixingReport?: (reportId: string) => Promise<void>;
  onDeleteMixingReports?: (reportIds: string[]) => Promise<void>;
  onDeleteMachineNvlReport?: (reportId: string) => Promise<void>;
  onDeleteMachineNvlReports?: (reportIds: string[]) => Promise<void>;
}) {
  const meta = SHIFT_SUMMARY_METRIC_META[metric];
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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

  const isWeighingMetric = metric === 'khoiLuongHangThucTe';
  const isMixingMetric = metric === 'khoiLuongNpl';
  const isMachineNvlMetric = metric === 'tonDauCa';
  const canDeleteWeighing = Boolean(onDeleteWeighingRecord || onDeleteWeighingRecords);
  const canDeleteMixing = Boolean(onDeleteMixingReport || onDeleteMixingReports);
  const canDeleteMachineNvl = Boolean(onDeleteMachineNvlReport || onDeleteMachineNvlReports);
  const showWeighingActions =
    isWeighingMetric && detail.showActions && Boolean(onEditWeighingRecord || canDeleteWeighing);
  const showMixingDelete = isMixingMetric && detail.showActions && canDeleteMixing;
  const showMachineNvlDelete = isMachineNvlMetric && detail.showActions && canDeleteMachineNvl;
  const showActionColumn = showWeighingActions || showMixingDelete || showMachineNvlDelete;
  const showEditAction = showWeighingActions && Boolean(onEditWeighingRecord);
  const showDeleteAction =
    (showWeighingActions && canDeleteWeighing) || showMixingDelete || showMachineNvlDelete;
  const showBulkSelect = showDeleteAction;

  const selectableKeys = useMemo(
    () => detail.rows.map(getRowSelectionKey).filter(Boolean),
    [detail.rows]
  );

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [metric, ngay, ca, selectableKeys.join('|')]);

  const allSelected = selectableKeys.length > 0 && selectableKeys.every(key => selectedKeys.has(key));
  const selectedCount = selectedKeys.size;
  const extraColumnCount = (showBulkSelect ? 1 : 0) + (showActionColumn ? 1 : 0);

  const toggleRowSelection = (selectionKey: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(selectionKey)) next.delete(selectionKey);
      else next.add(selectionKey);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedKeys(allSelected ? new Set() : new Set(selectableKeys));
  };

  const resolveDeleteTargetIds = (keys: Iterable<string>) => {
    const targetIds = new Set<string>();
    for (const key of keys) {
      const row = detail.rows.find(item => getRowSelectionKey(item) === key);
      const targetId = row ? getRowDeleteTargetId(row) : null;
      if (targetId !== null && targetId !== undefined && targetId !== '') {
        targetIds.add(String(targetId));
      }
    }
    return Array.from(targetIds);
  };

  const deleteSingleTarget = async (targetId: string | number) => {
    if (isWeighingMetric && onDeleteWeighingRecord) {
      await onDeleteWeighingRecord(targetId);
      return;
    }
    if (isMixingMetric && onDeleteMixingReport) {
      await onDeleteMixingReport(String(targetId));
      return;
    }
    if (isMachineNvlMetric && onDeleteMachineNvlReport) {
      await onDeleteMachineNvlReport(String(targetId));
    }
  };

  const deleteMultipleTargets = async (targetIds: string[]) => {
    if (isWeighingMetric) {
      if (onDeleteWeighingRecords) {
        await onDeleteWeighingRecords(targetIds);
        return;
      }
      if (onDeleteWeighingRecord) {
        for (const targetId of targetIds) {
          await onDeleteWeighingRecord(targetId);
        }
      }
      return;
    }

    if (isMixingMetric) {
      if (onDeleteMixingReports) {
        await onDeleteMixingReports(targetIds);
        return;
      }
      if (onDeleteMixingReport) {
        for (const targetId of targetIds) {
          await onDeleteMixingReport(targetId);
        }
      }
      return;
    }

    if (isMachineNvlMetric) {
      if (onDeleteMachineNvlReports) {
        await onDeleteMachineNvlReports(targetIds);
        return;
      }
      if (onDeleteMachineNvlReport) {
        for (const targetId of targetIds) {
          await onDeleteMachineNvlReport(targetId);
        }
      }
    }
  };

  const buildSingleDeleteMessage = (row: ShiftSummaryDetailRow) => {
    if (isMixingMetric) {
      const soPhieu = row.soPhieu ? String(row.soPhieu) : '—';
      return `Bạn có chắc muốn xóa báo cáo phối trộn ${soPhieu}? Toàn bộ NVL trong phiếu sẽ bị xóa.`;
    }
    if (isMachineNvlMetric) {
      const may = row.may ? String(row.may) : '—';
      return `Bạn có chắc muốn xóa báo cáo tồn NVL đầu ca của máy ${may}? Toàn bộ NVL trong phiếu sẽ bị xóa.`;
    }
    return 'Bạn có chắc muốn xóa dòng cân này?';
  };

  const buildBulkDeleteMessage = (targetCount: number, selectedRowCount: number) => {
    if (isMixingMetric) {
      if (targetCount === selectedRowCount) {
        return `Bạn có chắc muốn xóa ${targetCount} báo cáo phối trộn đã chọn?`;
      }
      return `Bạn có chắc muốn xóa ${targetCount} báo cáo phối trộn (${selectedRowCount} dòng đã chọn)? Một phiếu có thể chứa nhiều dòng NVL.`;
    }
    if (isMachineNvlMetric) {
      if (targetCount === selectedRowCount) {
        return `Bạn có chắc muốn xóa ${targetCount} báo cáo tồn NVL đầu ca đã chọn?`;
      }
      return `Bạn có chắc muốn xóa ${targetCount} báo cáo tồn NVL đầu ca (${selectedRowCount} dòng NVL đã chọn)? Một phiếu có thể chứa nhiều dòng NVL.`;
    }
    return `Bạn có chắc muốn xóa ${selectedRowCount} dòng cân đã chọn?`;
  };

  const handleDelete = async (row: ShiftSummaryDetailRow) => {
    const targetId = getRowDeleteTargetId(row);
    if (!targetId || !showDeleteAction) return;
    if (!window.confirm(buildSingleDeleteMessage(row))) return;

    setDeletingId(targetId);
    try {
      await deleteSingleTarget(targetId);
      setSelectedKeys(prev => {
        const next = new Set(prev);
        next.delete(getRowSelectionKey(row));
        return next;
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : isMixingMetric
            ? 'Không thể xóa báo cáo phối trộn.'
            : isMachineNvlMetric
              ? 'Không thể xóa báo cáo tồn NVL đầu ca.'
              : 'Không thể xóa dòng cân.';
      window.alert(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!showDeleteAction || selectedCount === 0) return;

    const targetIds = resolveDeleteTargetIds(selectedKeys);
    if (targetIds.length === 0) return;
    if (!window.confirm(buildBulkDeleteMessage(targetIds.length, selectedCount))) return;

    setIsBulkDeleting(true);
    try {
      await deleteMultipleTargets(targetIds);
      setSelectedKeys(new Set());
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : isMixingMetric
            ? 'Không thể xóa các báo cáo phối trộn đã chọn.'
            : isMachineNvlMetric
              ? 'Không thể xóa các báo cáo tồn NVL đầu ca đã chọn.'
              : 'Không thể xóa các dòng cân đã chọn.';
      window.alert(message);
    } finally {
      setIsBulkDeleting(false);
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
            <>
              {showBulkSelect && selectableKeys.length > 0 ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-zinc-500">
                    {selectedCount > 0 ? `Đã chọn ${selectedCount} dòng` : 'Chọn dòng để xóa nhiều'}
                  </p>
                  <button
                    type="button"
                    disabled={selectedCount === 0 || isBulkDeleting || Boolean(deletingId)}
                    onClick={() => void handleBulkDelete()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Xóa đã chọn{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </button>
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      {showBulkSelect ? (
                        <th className="w-10 px-3 py-2 text-center font-black">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            disabled={selectableKeys.length === 0 || isBulkDeleting || Boolean(deletingId)}
                            className="h-3.5 w-3.5 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                            title="Chọn tất cả"
                          />
                        </th>
                      ) : null}
                      {detail.columns.map(column => (
                        <th
                          key={column.key}
                          className={`px-3 py-2 font-black ${column.align === 'right' ? 'text-right' : ''}`}
                        >
                          {column.label}
                        </th>
                      ))}
                      {showActionColumn ? (
                        <th className="px-3 py-2 text-center font-black">Thao tác</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {detail.rows.map((row, index) => {
                      const selectionKey = getRowSelectionKey(row);
                      const targetId = getRowDeleteTargetId(row);
                      const hasTargetId = targetId !== null;
                      const isSelected = Boolean(selectionKey) && selectedKeys.has(selectionKey);

                      return (
                        <tr key={selectionKey || index} className="hover:bg-indigo-50/40">
                          {showBulkSelect ? (
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!selectionKey || isBulkDeleting || deletingId === targetId}
                                onChange={() => {
                                  if (!selectionKey) return;
                                  toggleRowSelection(selectionKey);
                                }}
                                className="h-3.5 w-3.5 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Chọn dòng"
                              />
                            </td>
                          ) : null}
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
                          {showActionColumn ? (
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                {showEditAction ? (
                                  <button
                                    type="button"
                                    disabled={!hasTargetId}
                                    onClick={() => {
                                      if (!hasTargetId || !onEditWeighingRecord || targetId === null) return;
                                      onClose();
                                      onEditWeighingRecord(targetId);
                                    }}
                                    className="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    title="Sửa dòng cân"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      <Pencil className="h-3.5 w-3.5" />
                                      Sửa
                                    </span>
                                  </button>
                                ) : null}
                                {showDeleteAction ? (
                                  <button
                                    type="button"
                                    disabled={!hasTargetId || deletingId === targetId}
                                    onClick={() => {
                                      if (!hasTargetId) return;
                                      void handleDelete(row);
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    title={
                                      isMixingMetric
                                        ? 'Xóa báo cáo phối trộn'
                                        : isMachineNvlMetric
                                          ? 'Xóa báo cáo tồn NVL đầu ca'
                                          : 'Xóa dòng cân'
                                    }
                                  >
                                    {deletingId === targetId ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                ) : null}
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
                        colSpan={Math.max(1, detail.columns.length - 1 + extraColumnCount)}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
