import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, ChevronLeft, Loader2, PackageX, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { formatNumber } from '../utils';
import {
  buildMachineNvlReportGroups,
  normalizeMachineNvlReports,
  sumMachineNvlCuoiCaReportTotal,
  sumMachineNvlDauCaReportTotal,
  type MachineNvlReportDateGroup,
  type MachineNvlReportKind,
  type MachineNvlSavedReport
} from '../utils/machineNvlReports';
import {
  MachineNvlPrintBatch,
  savedReportToMachineNvlPrintReport,
  type MachineNvlPrintReport
} from './MachineNvlPrintSheet';
import {
  getProductionShiftOptions,
  normalizeShiftSettings,
  shiftNamesMatch,
  type ShiftSetting
} from '../utils/shiftSettings';
import {
  getWeighingDataRows,
  normalizeWeighingRecords,
  formatWeighingWeightField,
  sumDamagedGoodsRowWeight,
  type WeighingRecord
} from '../utils/weighingRecords';

const MACHINE_NVL_SECTIONS: { id: MachineNvlReportKind; title: string; emptyLabel: string }[] = [
  { id: 'dau_ca', title: 'Báo cáo tồn đầu ca', emptyLabel: 'báo cáo tồn đầu ca' },
  { id: 'cuoi_ca', title: 'Báo cáo tồn cuối ca', emptyLabel: 'báo cáo tồn cuối ca' }
];

const inputClass =
  'h-8 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10 sm:h-9 sm:text-xs';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function reportTotal(report: MachineNvlSavedReport) {
  return report.reportKind === 'dau_ca'
    ? sumMachineNvlDauCaReportTotal(report)
    : sumMachineNvlCuoiCaReportTotal(report);
}

function formatReportLineSummary(report: MachineNvlSavedReport, isDauCaTab: boolean) {
  return report.lines
    .map(line => {
      const label = line.maNvl || line.tenNvl || '-';
      const qty =
        isDauCaTab && line.soLuongTonCaTruoc !== null
          ? `${formatNumber(line.soLuongTonCaTruoc)}→${formatNumber(line.soLuongTon)}`
          : !isDauCaTab && line.soLuongTonDinhMuc !== null
            ? `${formatNumber(line.soLuongTonDinhMuc)}/${formatNumber(line.soLuongTon)}`
            : formatNumber(line.soLuongTon);
      return `${label} ${qty}`;
    })
    .join(' · ');
}

type DamagedDateGroup = { ngay: string; rows: WeighingRecord[]; total: number };

function groupDamagedRecordsByDate(records: WeighingRecord[]): DamagedDateGroup[] {
  const byDate = new Map<string, WeighingRecord[]>();
  for (const record of getWeighingDataRows(records)) {
    const ngay = record.productionDate || record.reportDate || '-';
    const list = byDate.get(ngay) ?? [];
    list.push(record);
    byDate.set(ngay, list);
  }

  return [...byDate.entries()]
    .map(([ngay, rows]) => ({
      ngay,
      rows: [...rows].sort((a, b) => (b.weighTime || '').localeCompare(a.weighTime || '')),
      total: rows.reduce((sum, row) => sum + sumDamagedGoodsRowWeight(row), 0)
    }))
    .sort((a, b) => b.ngay.localeCompare(a.ngay));
}

function MachineNvlSection({
  kind,
  title,
  emptyLabel,
  groups,
  isLoading,
  onEdit,
  onPrint,
  onDelete,
  deletingId,
  selectedIds,
  onToggleSelected,
  onToggleSelectAll,
  onBulkDelete,
  onClearSelection,
  bulkDeleting
}: {
  kind: MachineNvlReportKind;
  title: string;
  emptyLabel: string;
  groups: MachineNvlReportDateGroup[];
  isLoading: boolean;
  onEdit: (report: MachineNvlSavedReport) => void;
  onPrint: (report: MachineNvlSavedReport) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
  onClearSelection: () => void;
  bulkDeleting: boolean;
}) {
  const isDauCaTab = kind === 'dau_ca';
  const reportIds = useMemo(
    () =>
      groups.flatMap(dateGroup =>
        dateGroup.shifts.flatMap(shiftGroup =>
          shiftGroup.machines.flatMap(machineGroup => machineGroup.reports.map(report => report.id).filter(Boolean))
        )
      ),
    [groups]
  );
  const allSelected = reportIds.length > 0 && selectedIds.size === reportIds.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b-4 border-[#ef1b2d] bg-white px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#ef1b2d]">{title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onBulkDelete([...selectedIds])}
              disabled={selectedIds.size === 0 || bulkDeleting || isLoading}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Xoá đã chọn ({selectedIds.size})
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={selectedIds.size === 0 || bulkDeleting || isLoading}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[11px] font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      </div>
      <div className="p-2 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#ef1b2d]" />
            Đang tải danh sách {emptyLabel}...
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center">
            <Boxes className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-2 text-sm font-black text-zinc-700">Chưa có {emptyLabel}</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">Chọn khoảng ngày khác hoặc tạo báo cáo mới.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(dateGroup => {
              const dateRows = dateGroup.shifts.flatMap(shiftGroup =>
                shiftGroup.machines.flatMap(machineGroup =>
                  machineGroup.reports.map(report => ({ shiftGroup, machineGroup, report }))
                )
              );
              const dateTotal = dateRows.reduce((sum, { report }) => sum + reportTotal(report), 0);

              return (
                <div key={dateGroup.ngay} className="overflow-hidden rounded-xl border border-zinc-200">
                  <div className="flex items-baseline justify-between gap-1.5 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Ngày</span>
                      <span className="font-mono text-xs font-black text-zinc-900">{dateGroup.ngay}</span>
                    </div>
                    <span className="font-mono text-[11px] font-black text-emerald-800">
                      {formatNumber(dateTotal)} kg
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left text-[11px] sm:text-xs">
                      <thead className="bg-zinc-50 text-[9px] uppercase tracking-wider text-zinc-500 sm:text-[10px]">
                        <tr>
                          <th className="w-10 px-2 py-1.5 text-center font-black">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => onToggleSelectAll(reportIds)}
                              aria-label="Chọn tất cả"
                              className="h-4 w-4 accent-[#ef1b2d]"
                            />
                          </th>
                          <th className="px-2 py-1.5 font-black">Ca</th>
                          <th className="px-2 py-1.5 font-black">Máy</th>
                          <th className="px-2 py-1.5 font-black">Nhân sự</th>
                          <th className="px-2 py-1.5 font-black">Giờ</th>
                          <th className="px-2 py-1.5 text-right font-black">Số NVL</th>
                          <th className="px-2 py-1.5 text-right font-black">Tổng (kg)</th>
                          <th className="px-2 py-1.5 font-black">Chi tiết NVL</th>
                          <th className="px-2 py-1.5 text-center font-black">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {dateRows.map(({ shiftGroup, machineGroup, report }) => (
                          <tr
                            key={report.id || `${report.ngay}-${report.maMay}-${report.ca}`}
                            className="align-top transition hover:bg-zinc-50"
                          >
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(report.id)}
                                onChange={() => onToggleSelected(report.id)}
                                aria-label="Chọn dòng"
                                className="h-4 w-4 accent-[#ef1b2d]"
                              />
                            </td>
                            <td className="px-2 py-1.5 font-bold text-zinc-800">{shiftGroup.ca || '-'}</td>
                            <td className="px-2 py-1.5 font-semibold text-zinc-700">
                              {machineGroup.tenMay || machineGroup.maMay || '-'}
                            </td>
                            <td className="px-2 py-1.5 text-zinc-600">{report.nhanSu || '-'}</td>
                            <td className="px-2 py-1.5 font-mono text-zinc-500">{report.gio || '-'}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-zinc-700">{report.lines.length}</td>
                            <td className="px-2 py-1.5 text-right font-mono font-black text-emerald-800">
                              {formatNumber(reportTotal(report))}
                            </td>
                            <td className="max-w-[260px] px-2 py-1.5">
                              <span
                                className="block truncate font-mono text-[10px] text-zinc-500"
                                title={formatReportLineSummary(report, isDauCaTab)}
                              >
                                {report.lines.length > 0 ? formatReportLineSummary(report, isDauCaTab) : '-'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => onEdit(report)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                  title="Sửa báo cáo"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onPrint(report)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                  title="In phiếu"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDelete(report.id)}
                                  disabled={deletingId === report.id}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-[#ef1b2d] hover:bg-red-50 disabled:opacity-50"
                                  title="Xóa báo cáo"
                                >
                                  {deletingId === report.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function DamagedGoodsSection({ groups, isLoading }: { groups: DamagedDateGroup[]; isLoading: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-1.5 border-b-4 border-[#ef1b2d] bg-white px-3 py-2.5">
        <PackageX className="h-3.5 w-3.5 shrink-0 text-[#ef1b2d]" />
        <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#ef1b2d]">
          Báo cáo hàng hỏng
        </p>
      </div>
      <div className="p-2 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#ef1b2d]" />
            Đang tải báo cáo hàng hỏng...
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center">
            <PackageX className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-2 text-sm font-black text-zinc-700">Chưa có báo cáo hàng hỏng</p>
            <p className="mt-1 text-xs font-semibold text-zinc-500">Chọn khoảng ngày khác để xem báo cáo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(dateGroup => (
              <div key={dateGroup.ngay} className="overflow-hidden rounded-xl border border-zinc-200">
                <div className="flex items-baseline justify-between gap-1.5 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Ngày</span>
                    <span className="font-mono text-xs font-black text-zinc-900">{dateGroup.ngay}</span>
                  </div>
                  <span className="font-mono text-[11px] font-black text-[#b30d1c]">
                    {formatNumber(dateGroup.total, 3)} kg
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-[11px] sm:text-xs">
                    <thead className="bg-zinc-50 text-[9px] uppercase tracking-wider text-zinc-500 sm:text-[10px]">
                      <tr>
                        <th className="px-2 py-1.5 font-black">Số phiếu</th>
                        <th className="px-2 py-1.5 font-black">Ca</th>
                        <th className="px-2 py-1.5 font-black">Máy</th>
                        <th className="px-2 py-1.5 font-black">Giờ</th>
                        <th className="px-2 py-1.5 text-right font-black">KL nhựa</th>
                        <th className="px-2 py-1.5 text-right font-black">KL màng</th>
                        <th className="px-2 py-1.5 text-right font-black">Tổng KL</th>
                        <th className="px-2 py-1.5 font-black">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {dateGroup.rows.map(record => (
                        <tr
                          key={String(record.id ?? `${record.documentNo}|${record.weighNo}|${record.weighTime}`)}
                          className="align-top transition hover:bg-zinc-50"
                        >
                          <td className="px-2 py-1.5 font-semibold text-zinc-700">{record.documentNo || '-'}</td>
                          <td className="px-2 py-1.5 font-bold text-zinc-800">{record.shiftName || '-'}</td>
                          <td className="px-2 py-1.5 font-semibold text-zinc-700">{record.machineName || '-'}</td>
                          <td className="px-2 py-1.5 font-mono text-zinc-500">{record.weighTime || '-'}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-zinc-700">
                            {formatWeighingWeightField(record.weight)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-zinc-700">
                            {formatWeighingWeightField(record.shellWeight)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono font-black text-[#b30d1c]">
                            {formatNumber(sumDamagedGoodsRowWeight(record), 3)}
                          </td>
                          <td className="max-w-[220px] px-2 py-1.5">
                            <span className="block truncate text-zinc-500" title={record.note || undefined}>
                              {record.note || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function MachineNvlReportListView({
  onBack,
  onCreate,
  onEdit
}: {
  onBack: () => void;
  onCreate: () => void;
  onEdit: (report: MachineNvlSavedReport) => void;
}) {
  const [filterFromDate, setFilterFromDate] = useState(todayIso());
  const [filterToDate, setFilterToDate] = useState(todayIso());
  const [filterCa, setFilterCa] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [dauCaReports, setDauCaReports] = useState<MachineNvlSavedReport[]>([]);
  const [cuoiCaReports, setCuoiCaReports] = useState<MachineNvlSavedReport[]>([]);
  const [damagedRecords, setDamagedRecords] = useState<WeighingRecord[]>([]);
  const [shiftSettings, setShiftSettings] = useState<ShiftSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedDauCaIds, setSelectedDauCaIds] = useState<Set<string>>(() => new Set());
  const [selectedCuoiCaIds, setSelectedCuoiCaIds] = useState<Set<string>>(() => new Set());
  const [printReport, setPrintReport] = useState<MachineNvlPrintReport | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);

  const shiftOptions = useMemo(() => getProductionShiftOptions(shiftSettings), [shiftSettings]);

  const shiftOrder = (ca: string) => {
    const index = shiftOptions.findIndex(
      option => option.value === ca || shiftNamesMatch(option.value, ca) || shiftNamesMatch(option.label, ca)
    );
    return index >= 0 ? index : 999;
  };

  const filterMachineNvlReports = (reports: MachineNvlSavedReport[]) =>
    reports.filter(report => {
      if (filterCa && !shiftNamesMatch(filterCa, report.ca)) return false;
      if (filterMachine) {
        const key = filterMachine.trim().toLowerCase();
        const maMay = report.maMay.trim().toLowerCase();
        const tenMay = report.tenMay.trim().toLowerCase();
        if (maMay !== key && tenMay !== key && !tenMay.includes(key) && !maMay.includes(key)) return false;
      }
      return true;
    });

  const filteredDauCaReports = useMemo(
    () => filterMachineNvlReports(dauCaReports),
    [dauCaReports, filterCa, filterMachine]
  );
  const filteredCuoiCaReports = useMemo(
    () => filterMachineNvlReports(cuoiCaReports),
    [cuoiCaReports, filterCa, filterMachine]
  );

  const dauCaGroups = useMemo(
    () => buildMachineNvlReportGroups(filteredDauCaReports, shiftOrder),
    [filteredDauCaReports, shiftOptions]
  );
  const cuoiCaGroups = useMemo(
    () => buildMachineNvlReportGroups(filteredCuoiCaReports, shiftOrder),
    [filteredCuoiCaReports, shiftOptions]
  );

  const filteredDamagedRecords = useMemo(
    () =>
      damagedRecords.filter(record => {
        if (filterCa && !shiftNamesMatch(filterCa, record.shiftName)) return false;
        if (filterMachine) {
          const key = filterMachine.trim().toLowerCase();
          const may = record.machineName.trim().toLowerCase();
          if (may !== key && !may.includes(key)) return false;
        }
        return true;
      }),
    [damagedRecords, filterCa, filterMachine]
  );

  const damagedGroups = useMemo(() => groupDamagedRecordsByDate(filteredDamagedRecords), [filteredDamagedRecords]);

  const machineOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const report of [...dauCaReports, ...cuoiCaReports]) {
      const key = report.maMay.trim() || report.tenMay.trim();
      if (!key) continue;
      map.set(key, report.tenMay || report.maMay);
    }
    return [...map.entries()].sort((left, right) => left[1].localeCompare(right[1], 'vi'));
  }, [dauCaReports, cuoiCaReports]);

  const loadReports = async (tuNgay = filterFromDate, denNgay = filterToDate) => {
    const params = new URLSearchParams();
    params.set('limit', '300');
    if (tuNgay) params.set('tu_ngay', tuNgay);
    if (denNgay) params.set('den_ngay', denNgay);

    const damagedParams = new URLSearchParams();
    if (tuNgay) damagedParams.set('tu_ngay', tuNgay);
    if (denNgay) damagedParams.set('den_ngay', denNgay);

    const [dauCaRes, cuoiCaRes, damagedRes] = await Promise.all([
      fetch(`/api/bao-cao-may-nvl-ton?${params.toString()}&loai_bao_cao=dau_ca`),
      fetch(`/api/bao-cao-may-nvl-ton?${params.toString()}&loai_bao_cao=cuoi_ca`),
      fetch(`/api/bao-cao-hang-hong?${damagedParams.toString()}`)
    ]);
    const [dauCaData, cuoiCaData, damagedData] = await Promise.all([
      dauCaRes.json().catch(() => ({})),
      cuoiCaRes.json().catch(() => ({})),
      damagedRes.json().catch(() => [])
    ]);

    if (!dauCaRes.ok || !cuoiCaRes.ok) {
      throw new Error(
        (dauCaData as { error?: string }).error ||
          (cuoiCaData as { error?: string }).error ||
          'Không thể tải danh sách báo cáo NVL tồn.'
      );
    }

    setDauCaReports(normalizeMachineNvlReports(dauCaData));
    setCuoiCaReports(normalizeMachineNvlReports(cuoiCaData));
    if (damagedRes.ok) setDamagedRecords(normalizeWeighingRecords(damagedData));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [settingsRes] = await Promise.all([fetch('/api/cai-dat')]);
        const settingsData = await settingsRes.json().catch(() => ({}));
        if (!cancelled && settingsRes.ok) {
          setShiftSettings(normalizeShiftSettings(settingsData));
        }
        await loadReports(filterFromDate, filterToDate);
        setSelectedDauCaIds(new Set());
        setSelectedCuoiCaIds(new Set());
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Không thể tải danh sách báo cáo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filterFromDate, filterToDate]);

  useEffect(() => {
    if (!pendingPrint || !printReport) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pendingPrint, printReport]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintReport(null);
      setPendingPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa báo cáo NVL tồn này?')) return;
    setError('');
    setMessage('');
    setDeletingId(id);
    try {
      const res = await fetch(`/api/bao-cao-may-nvl-ton/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa báo cáo.');
      setMessage('Đã xóa báo cáo NVL tồn.');
      await loadReports();
      setSelectedDauCaIds(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSelectedCuoiCaIds(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Không thể xóa báo cáo.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelected = (kind: MachineNvlReportKind, id: string) => {
    const setter = kind === 'dau_ca' ? setSelectedDauCaIds : setSelectedCuoiCaIds;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (kind: MachineNvlReportKind, ids: string[]) => {
    const setter = kind === 'dau_ca' ? setSelectedDauCaIds : setSelectedCuoiCaIds;
    setter(prev => (prev.size === ids.length ? new Set() : new Set(ids)));
  };

  const clearSelection = (kind: MachineNvlReportKind) => {
    (kind === 'dau_ca' ? setSelectedDauCaIds : setSelectedCuoiCaIds)(new Set());
  };

  const handleBulkDelete = async (kind: MachineNvlReportKind, ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Xóa ${ids.length} báo cáo NVL tồn đã chọn?`)) return;
    setError('');
    setMessage('');
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/bao-cao-may-nvl-ton/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa nhiều báo cáo.');
      const deleted = Number(data.deleted ?? ids.length);
      setMessage(deleted > 0 ? `Đã xóa ${deleted} báo cáo NVL tồn.` : 'Không có báo cáo nào được xóa.');
      clearSelection(kind);
      await loadReports();
    } catch (err: any) {
      setError(err.message || 'Không thể xóa nhiều báo cáo.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handlePrint = (report: MachineNvlSavedReport) => {
    setPrintReport(savedReportToMachineNvlPrintReport(report));
    setPendingPrint(true);
  };

  return (
    <div className="space-y-4 pb-24">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b-4 border-[#ef1b2d] bg-white px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#ef1b2d]">
                Báo cáo tồn máy
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#ef1b2d] px-2.5 text-[11px] font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-bold text-zinc-700 transition hover:bg-zinc-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Quay lại
              </button>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-4">
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:text-[10px]">
              Từ ngày
              <input
                type="date"
                value={filterFromDate}
                max={filterToDate || undefined}
                onChange={event => setFilterFromDate(event.target.value)}
                className={`${inputClass} mt-0.5`}
              />
            </label>
            <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:text-[10px]">
              Đến ngày
              <input
                type="date"
                value={filterToDate}
                min={filterFromDate || undefined}
                onChange={event => setFilterToDate(event.target.value)}
                className={`${inputClass} mt-0.5`}
              />
            </label>
            <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:text-[10px]">
              Ca
              <select value={filterCa} onChange={event => setFilterCa(event.target.value)} className={`${inputClass} mt-0.5`}>
                <option value="">Tất cả ca</option>
                {shiftOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:text-[10px]">
              Máy
              <select
                value={filterMachine}
                onChange={event => setFilterMachine(event.target.value)}
                className={`${inputClass} mt-0.5`}
              >
                <option value="">Tất cả máy</option>
                {machineOptions.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {message}
            </p>
          ) : null}
        </div>
      </section>

      <MachineNvlSection
        kind="dau_ca"
        title={MACHINE_NVL_SECTIONS[0].title}
        emptyLabel={MACHINE_NVL_SECTIONS[0].emptyLabel}
        groups={dauCaGroups}
        isLoading={isLoading}
        onEdit={onEdit}
        onPrint={handlePrint}
        onDelete={handleDelete}
        deletingId={deletingId}
        selectedIds={selectedDauCaIds}
        onToggleSelected={id => toggleSelected('dau_ca', id)}
        onToggleSelectAll={ids => toggleSelectAll('dau_ca', ids)}
        onBulkDelete={ids => void handleBulkDelete('dau_ca', ids)}
        onClearSelection={() => clearSelection('dau_ca')}
        bulkDeleting={bulkDeleting}
      />

      <MachineNvlSection
        kind="cuoi_ca"
        title={MACHINE_NVL_SECTIONS[1].title}
        emptyLabel={MACHINE_NVL_SECTIONS[1].emptyLabel}
        groups={cuoiCaGroups}
        isLoading={isLoading}
        onEdit={onEdit}
        onPrint={handlePrint}
        onDelete={handleDelete}
        deletingId={deletingId}
        selectedIds={selectedCuoiCaIds}
        onToggleSelected={id => toggleSelected('cuoi_ca', id)}
        onToggleSelectAll={ids => toggleSelectAll('cuoi_ca', ids)}
        onBulkDelete={ids => void handleBulkDelete('cuoi_ca', ids)}
        onClearSelection={() => clearSelection('cuoi_ca')}
        bulkDeleting={bulkDeleting}
      />

      <DamagedGoodsSection groups={damagedGroups} isLoading={isLoading} />

      {printReport ? (
        <div className="production-order-print-root hidden print:block">
          <MachineNvlPrintBatch reports={[printReport]} />
        </div>
      ) : null}
    </div>
  );
}
