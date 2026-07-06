import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, ChevronLeft, Loader2, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { formatNumber } from '../utils';
import {
  buildMachineNvlReportGroups,
  normalizeMachineNvlReports,
  sumMachineNvlCuoiCaReportTotal,
  sumMachineNvlDauCaReportTotal,
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

const REPORT_TABS: { id: MachineNvlReportKind; label: string }[] = [
  { id: 'dau_ca', label: 'Đầu ca' },
  { id: 'cuoi_ca', label: 'Cuối ca' }
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

function formatReportLineSummary(
  report: MachineNvlSavedReport,
  isDauCaTab: boolean
) {
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

export default function MachineNvlReportListView({
  onBack,
  onCreate,
  onEdit
}: {
  onBack: () => void;
  onCreate: () => void;
  onEdit: (report: MachineNvlSavedReport) => void;
}) {
  const [activeKind, setActiveKind] = useState<MachineNvlReportKind>('dau_ca');
  const [filterDate, setFilterDate] = useState(todayIso());
  const [filterCa, setFilterCa] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [reports, setReports] = useState<MachineNvlSavedReport[]>([]);
  const [shiftSettings, setShiftSettings] = useState<ShiftSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [printReport, setPrintReport] = useState<MachineNvlPrintReport | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);

  const isDauCaTab = activeKind === 'dau_ca';
  const shiftOptions = useMemo(() => getProductionShiftOptions(shiftSettings), [shiftSettings]);

  const shiftOrder = (ca: string) => {
    const index = shiftOptions.findIndex(
      option => option.value === ca || shiftNamesMatch(option.value, ca) || shiftNamesMatch(option.label, ca)
    );
    return index >= 0 ? index : 999;
  };

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      if (filterCa && !shiftNamesMatch(filterCa, report.ca)) return false;
      if (filterMachine) {
        const key = filterMachine.trim().toLowerCase();
        const maMay = report.maMay.trim().toLowerCase();
        const tenMay = report.tenMay.trim().toLowerCase();
        if (maMay !== key && tenMay !== key && !tenMay.includes(key) && !maMay.includes(key)) return false;
      }
      return true;
    });
  }, [reports, filterCa, filterMachine]);

  const historyGroups = useMemo(
    () => buildMachineNvlReportGroups(filteredReports, shiftOrder),
    [filteredReports, shiftOptions]
  );

  const machineOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const report of reports) {
      const key = report.maMay.trim() || report.tenMay.trim();
      if (!key) continue;
      map.set(key, report.tenMay || report.maMay);
    }
    return [...map.entries()].sort((left, right) => left[1].localeCompare(right[1], 'vi'));
  }, [reports]);

  const loadReports = async (kind = activeKind, ngay = filterDate) => {
    const params = new URLSearchParams();
    params.set('limit', '300');
    params.set('loai_bao_cao', kind);
    if (ngay) params.set('ngay', ngay);
    const res = await fetch(`/api/bao-cao-may-nvl-ton?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách báo cáo NVL tồn.');
    setReports(normalizeMachineNvlReports(data));
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
        await loadReports(activeKind, filterDate);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Không thể tải danh sách báo cáo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeKind, filterDate]);

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
    } catch (err: any) {
      setError(err.message || 'Không thể xóa báo cáo.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrint = (report: MachineNvlSavedReport) => {
    setPrintReport(savedReportToMachineNvlPrintReport(report));
    setPendingPrint(true);
  };

  const activeTabLabel = REPORT_TABS.find(tab => tab.id === activeKind)?.label ?? 'Đầu ca';

  return (
    <div className="space-y-4 pb-24">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b-4 border-[#ef1b2d] bg-white px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#ef1b2d]">
                Báo cáo NVL tồn theo máy
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

        <div className="border-b border-zinc-100 p-2 sm:p-4">
          <div className="grid grid-cols-2 gap-1.5">
            {REPORT_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveKind(tab.id)}
                className={`inline-flex h-7 items-center justify-center rounded-lg px-2 text-[10px] font-extrabold transition sm:h-8 sm:text-xs ${
                  activeKind === tab.id
                    ? 'bg-[#ef1b2d] text-white'
                    : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-[#ef1b2d]/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:gap-2">
            <label className="col-span-2 text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:text-[10px]">
              Ngày
              <input
                type="date"
                value={filterDate}
                onChange={event => setFilterDate(event.target.value)}
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
        </div>

        <div className="p-2 sm:p-4">
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
          ) : null}
          {message ? (
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {message}
            </p>
          ) : null}

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-[#ef1b2d]" />
              Đang tải danh sách {activeTabLabel.toLowerCase()}...
            </div>
          ) : historyGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center">
              <Boxes className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-2 text-sm font-black text-zinc-700">Chưa có báo cáo {activeTabLabel.toLowerCase()}</p>
              <p className="mt-1 text-xs font-semibold text-zinc-500">
                {filterDate ? `Ngày ${filterDate}` : 'Chọn ngày khác hoặc tạo báo cáo mới.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyGroups.map(dateGroup => (
                <div key={dateGroup.ngay} className="overflow-hidden rounded-lg border border-zinc-200 sm:rounded-xl">
                  <div className="flex items-baseline gap-1.5 border-b border-zinc-200 bg-zinc-100 px-2 py-1 sm:px-3 sm:py-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Ngày</span>
                    <span className="font-mono text-[11px] font-black text-zinc-900 sm:text-xs">{dateGroup.ngay}</span>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {dateGroup.shifts.map(shiftGroup => (
                      <div key={`${dateGroup.ngay}-${shiftGroup.ca}`} className="px-2 py-1.5 sm:p-2">
                        <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                          Ca{' '}
                          <span className="text-[11px] normal-case text-zinc-800 sm:text-xs">
                            {shiftGroup.ca || '-'}
                          </span>
                        </p>
                        <div className="mt-1 space-y-1 border-l border-zinc-200 pl-1.5 sm:pl-2">
                          {shiftGroup.machines.map(machineGroup => (
                            <div key={machineGroup.key} className="space-y-0.5">
                              <p className="truncate text-[10px] font-bold text-zinc-700 sm:text-[11px]">
                                {machineGroup.tenMay || machineGroup.maMay || '-'}
                              </p>
                              {machineGroup.reports.map(report => (
                                <div
                                  key={report.id || `${report.ngay}-${report.maMay}-${report.ca}`}
                                  className="rounded-md border border-zinc-200 bg-zinc-50/60 px-1.5 py-1"
                                >
                                  <div className="flex items-center gap-1">
                                    <div className="min-w-0 flex-1 truncate text-[9px] font-bold leading-tight text-zinc-600 sm:text-[10px]">
                                      <span className="text-zinc-800">{report.lines.length} NVL</span>
                                      {report.nhanSu ? (
                                        <>
                                          <span className="text-zinc-300"> · </span>
                                          <span>{report.nhanSu}</span>
                                        </>
                                      ) : null}
                                      {report.gio ? (
                                        <>
                                          <span className="text-zinc-300"> · </span>
                                          <span className="font-semibold text-zinc-400">{report.gio}</span>
                                        </>
                                      ) : null}
                                    </div>
                                    <span className="shrink-0 font-mono text-[10px] font-black text-emerald-800 sm:text-[11px]">
                                      {formatNumber(reportTotal(report))} kg
                                    </span>
                                    <div className="flex shrink-0 items-center gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => onEdit(report)}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 sm:h-7 sm:w-7 sm:rounded-md"
                                        title="Sửa báo cáo"
                                      >
                                        <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePrint(report)}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 sm:h-7 sm:w-7 sm:rounded-md"
                                        title="In phiếu"
                                      >
                                        <Printer className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(report.id)}
                                        disabled={deletingId === report.id}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white text-[#ef1b2d] hover:bg-red-50 disabled:opacity-50 sm:h-7 sm:w-7 sm:rounded-md"
                                        title="Xóa báo cáo"
                                      >
                                        {deletingId === report.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                                        ) : (
                                          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  {report.lines.length > 0 ? (
                                    <p
                                      className="mt-0.5 truncate font-mono text-[9px] font-semibold leading-tight text-zinc-500 sm:text-[10px]"
                                      title={formatReportLineSummary(report, isDauCaTab)}
                                    >
                                      {formatReportLineSummary(report, isDauCaTab)}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {printReport ? (
        <div className="production-order-print-root hidden print:block">
          <MachineNvlPrintBatch reports={[printReport]} />
        </div>
      ) : null}
    </div>
  );
}
