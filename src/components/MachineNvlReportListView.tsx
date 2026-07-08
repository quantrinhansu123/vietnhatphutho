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
  const [filterFromDate, setFilterFromDate] = useState(todayIso());
  const [filterToDate, setFilterToDate] = useState(todayIso());
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

  const loadReports = async (kind = activeKind, tuNgay = filterFromDate, denNgay = filterToDate) => {
    const params = new URLSearchParams();
    params.set('limit', '300');
    params.set('loai_bao_cao', kind);
    if (tuNgay) params.set('tu_ngay', tuNgay);
    if (denNgay) params.set('den_ngay', denNgay);
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
        await loadReports(activeKind, filterFromDate, filterToDate);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Không thể tải danh sách báo cáo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeKind, filterFromDate, filterToDate]);

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
                {filterFromDate || filterToDate
                  ? `Từ ${filterFromDate || '...'} đến ${filterToDate || '...'}`
                  : 'Chọn khoảng ngày khác hoặc tạo báo cáo mới.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyGroups.map(dateGroup => {
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
                                    onClick={() => handlePrint(report)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                    title="In phiếu"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(report.id)}
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

      {printReport ? (
        <div className="production-order-print-root hidden print:block">
          <MachineNvlPrintBatch reports={[printReport]} />
        </div>
      ) : null}
    </div>
  );
}
