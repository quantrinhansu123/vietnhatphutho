import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, ChevronLeft, Loader2, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
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
  'h-9 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function reportTotal(report: MachineNvlSavedReport) {
  return report.reportKind === 'dau_ca'
    ? sumMachineNvlDauCaReportTotal(report)
    : sumMachineNvlCuoiCaReportTotal(report);
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
        <div className="border-b-4 border-[#ef1b2d] bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <img src={vietNhatLogoUrl} alt="Viet Nhat IPT" className="h-14 w-auto max-w-[190px] object-contain" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#ef1b2d]">Báo cáo NVL tồn theo máy</p>
                <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950">Danh sách báo cáo</h2>
                <p className="mt-1 text-xs font-semibold text-zinc-500">Nhóm theo ngày, ca và máy · sửa, in hoặc xóa phiếu đã lưu</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Thêm mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Quay lại
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-zinc-100 p-4">
          <div className="flex flex-wrap gap-2">
            {REPORT_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveKind(tab.id)}
                className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-black transition ${
                  activeKind === tab.id
                    ? 'bg-[#ef1b2d] text-white'
                    : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-[#ef1b2d]/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Ngày
              <input
                type="date"
                value={filterDate}
                onChange={event => setFilterDate(event.target.value)}
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Ca
              <select value={filterCa} onChange={event => setFilterCa(event.target.value)} className={`${inputClass} mt-1`}>
                <option value="">Tất cả ca</option>
                {shiftOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Máy
              <select
                value={filterMachine}
                onChange={event => setFilterMachine(event.target.value)}
                className={`${inputClass} mt-1`}
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

        <div className="p-4">
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
            <div className="space-y-3">
              {historyGroups.map(dateGroup => (
                <div key={dateGroup.ngay} className="overflow-hidden rounded-xl border border-zinc-200">
                  <div className="border-b border-zinc-200 bg-zinc-100 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ngày</p>
                    <p className="font-mono text-sm font-black text-zinc-900">{dateGroup.ngay}</p>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {dateGroup.shifts.map(shiftGroup => (
                      <div key={`${dateGroup.ngay}-${shiftGroup.ca}`} className="p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                          Ca <span className="text-sm normal-case text-zinc-800">{shiftGroup.ca || '-'}</span>
                        </p>
                        <div className="mt-2 space-y-2 border-l-2 border-zinc-200 pl-2">
                          {shiftGroup.machines.map(machineGroup => (
                            <div key={machineGroup.key} className="space-y-2">
                              <p className="text-xs font-black text-zinc-700">
                                Máy {machineGroup.tenMay || machineGroup.maMay || '-'}
                              </p>
                              {machineGroup.reports.map(report => (
                                <div
                                  key={report.id || `${report.ngay}-${report.maMay}-${report.ca}`}
                                  className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold text-zinc-500">{report.lines.length} NVL</p>
                                      {report.nhanSu ? (
                                        <p className="mt-0.5 text-xs font-semibold text-zinc-500">NS: {report.nhanSu}</p>
                                      ) : null}
                                      {report.gio ? (
                                        <p className="mt-0.5 text-[10px] font-semibold text-zinc-400">Ghi lúc {report.gio}</p>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => onEdit(report)}
                                        className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50"
                                        title="Sửa báo cáo"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePrint(report)}
                                        className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50"
                                        title="In phiếu"
                                      >
                                        <Printer className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(report.id)}
                                        disabled={deletingId === report.id}
                                        className="rounded-lg border border-zinc-200 bg-white p-2 text-[#ef1b2d] hover:bg-red-50 disabled:opacity-50"
                                        title="Xóa báo cáo"
                                      >
                                        {deletingId === report.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  <p className="mt-2 text-sm font-black text-emerald-800">{formatNumber(reportTotal(report))} kg</p>
                                  <div className="mt-2 max-h-28 overflow-y-auto rounded-lg bg-white p-2 text-xs font-semibold text-zinc-600">
                                    {report.lines.slice(0, 6).map(line => (
                                      <div key={`${report.id}-${line.stt}`} className="flex justify-between gap-2">
                                        <span className="truncate">{line.maNvl || line.tenNvl}</span>
                                        <span className="shrink-0 font-mono font-black">
                                          {isDauCaTab && line.soLuongTonCaTruoc !== null ? (
                                            <>
                                              <span className="text-zinc-500">{formatNumber(line.soLuongTonCaTruoc)} → </span>
                                              {formatNumber(line.soLuongTon)} {line.donVi}
                                            </>
                                          ) : !isDauCaTab && line.soLuongTonDinhMuc !== null ? (
                                            <>
                                              <span className="text-zinc-500">{formatNumber(line.soLuongTonDinhMuc)} / </span>
                                              {formatNumber(line.soLuongTon)} {line.donVi}
                                            </>
                                          ) : (
                                            <>
                                              {formatNumber(line.soLuongTon)} {line.donVi}
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
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
