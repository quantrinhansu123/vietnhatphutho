import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ClipboardList, Eye, Loader2, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import { MixingReportPrintBatch } from './MixingReportPrintSheet';
import {
  MIXING_ROUND_KEYS,
  compareMixingReportsBySession,
  deriveLineUnit,
  formatNormWeight,
  formatOptionalNumber,
  formatMixingReportSessionLabel,
  mixingSessionColumnLabel,
  resolveMixingReportRoundPhotos,
  resolveMixingReportRoundReasons,
  resolveMixingReportRoundExplanations,
  resolveLineKlThucTe,
  sumLineNormQuantity,
  sumLineRoundNormQuantity,
  sumMixingRounds,
  sumRoundActualQuantity,
  sumRoundQuantity,
  sumReportNormTotal,
  visibleRoundCount,
  normalizeMixingReport
} from '../lib/mixingReportModel';
import type { MixingRoundPhoto } from './MixingReportForm';
import type { MixingReport } from './MixingReportForm';
import MixingReportForm from './MixingReportForm';
import {
  getProductionShiftOptions,
  normalizeShiftSettings,
  shiftNamesMatch,
  type ShiftSetting
} from '../utils/shiftSettings';

const inputClass =
  'h-9 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

type MachineOption = {
  id: string;
  code: string;
  name: string;
};

type MixingReportFilters = {
  tuNgay: string;
  denNgay: string;
  ca: string;
  machineId: string;
};

type MixingShiftGroup = {
  key: string;
  ngay: string;
  ca: string;
  reports: MixingReport[];
};

function compareMixingReports(left: MixingReport, right: MixingReport) {
  return compareMixingReportsBySession(left, right);
}

function buildShiftGroups(
  reports: MixingReport[],
  shiftOptions: ReturnType<typeof getProductionShiftOptions>
): MixingShiftGroup[] {
  const grouped = new Map<string, MixingReport[]>();

  for (const report of reports) {
    const ngay = report.ngay || '-';
    const ca = report.ca || '-';
    const key = `${ngay}|${ca}`;
    const list = grouped.get(key) ?? [];
    list.push(report);
    grouped.set(key, list);
  }

  const shiftOrder = (ca: string) => {
    const index = shiftOptions.findIndex(
      option => option.value === ca || shiftNamesMatch(option.value, ca) || shiftNamesMatch(option.label, ca)
    );
    return index >= 0 ? index : 999;
  };

  return [...grouped.entries()]
    .map(([key, groupReports]) => {
      const separator = key.indexOf('|');
      const ngay = separator >= 0 ? key.slice(0, separator) : key;
      const ca = separator >= 0 ? key.slice(separator + 1) : '-';
      return {
        key,
        ngay,
        ca,
        reports: [...groupReports].sort(compareMixingReports)
      };
    })
    .sort((left, right) => {
      const byDate = left.ngay.localeCompare(right.ngay);
      if (byDate !== 0) return byDate;
      const byShift = shiftOrder(left.ca) - shiftOrder(right.ca);
      if (byShift !== 0) return byShift;
      return left.ca.localeCompare(right.ca, 'vi');
    });
}

function sumGroupKlDinhMuc(reports: MixingReport[]) {
  return reports.reduce((sum, report) => sum + sumReportKlDinhMuc(report), 0);
}

function sumGroupKlThucTe(reports: MixingReport[]) {
  return reports.reduce((sum, report) => sum + (report.thuc_te_su_dung ?? 0), 0);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyFilters(): MixingReportFilters {
  return {
    tuNgay: '',
    denNgay: todayIso(),
    ca: '',
    machineId: ''
  };
}

function buildFilterQuery(filters: MixingReportFilters, machines: MachineOption[]) {
  const params = new URLSearchParams();
  let tuNgay = filters.tuNgay;
  let denNgay = filters.denNgay;
  if (tuNgay && denNgay && tuNgay > denNgay) {
    [tuNgay, denNgay] = [denNgay, tuNgay];
  }
  if (tuNgay) params.set('tu_ngay', tuNgay);
  if (denNgay) params.set('den_ngay', denNgay);
  if (filters.ca) params.set('ca', filters.ca);
  const machine = machines.find(item => item.id === filters.machineId);
  if (machine?.code) params.set('ma_may', machine.code);
  return params.toString();
}

function formatFilterSummary(filters: MixingReportFilters, machines: MachineOption[]) {
  const parts: string[] = [];
  if (filters.tuNgay || filters.denNgay) {
    parts.push(
      filters.tuNgay && filters.denNgay
        ? `${filters.tuNgay} → ${filters.denNgay}`
        : filters.tuNgay
          ? `từ ${filters.tuNgay}`
          : `đến ${filters.denNgay}`
    );
  }
  if (filters.ca) parts.push(filters.ca);
  const machine = machines.find(item => item.id === filters.machineId);
  if (machine) parts.push(`${machine.code} · ${machine.name}`);
  return parts.length > 0 ? parts.join(' · ') : 'tất cả';
}

function sumReportKlDinhMuc(report: MixingReport) {
  return sumReportNormTotal(report.chi_tiet);
}

function renderReasonList(reasons: string[] | undefined) {
  if (!reasons?.length) {
    return <span className="font-semibold text-zinc-400">—</span>;
  }
  return (
    <ul className="list-inside list-disc space-y-0.5 text-xs font-semibold text-zinc-800">
      {reasons.map(reason => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

function renderExplanationText(text: string | undefined) {
  const value = text?.trim();
  if (!value) {
    return <span className="font-semibold text-zinc-400">—</span>;
  }
  return <p className="whitespace-pre-line text-xs font-medium leading-relaxed text-zinc-700">{value}</p>;
}

export default function MixingReportListView({
  onBack
}: {
  onBack: () => void;
}) {
  const [filters, setFilters] = useState<MixingReportFilters>(emptyFilters);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [shiftSettings, setShiftSettings] = useState<ShiftSetting[]>([]);
  const [reports, setReports] = useState<MixingReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [viewingGroupKey, setViewingGroupKey] = useState<string | null>(null);
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string } | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formModalMode, setFormModalMode] = useState<'create' | 'edit'>('create');
  const [pendingEditReport, setPendingEditReport] = useState<MixingReport | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [printReports, setPrintReports] = useState<MixingReport[]>([]);
  const [pendingPrint, setPendingPrint] = useState(false);

  const shiftOptions = useMemo(() => getProductionShiftOptions(shiftSettings), [shiftSettings]);
  const shiftGroups = useMemo(() => buildShiftGroups(reports, shiftOptions), [reports, shiftOptions]);
  const viewingGroup = useMemo(
    () => shiftGroups.find(group => group.key === viewingGroupKey) ?? null,
    [shiftGroups, viewingGroupKey]
  );
  const viewingGroupReports = useMemo(
    () => (viewingGroup ? [...viewingGroup.reports].sort(compareMixingReportsBySession) : []),
    [viewingGroup]
  );

  const loadReferenceData = async () => {
    const [machineRes, settingRes] = await Promise.all([
      fetch('/api/danh-sach-may'),
      fetch('/api/cai-dat')
    ]);
    const machineData = await machineRes.json().catch(() => ({}));
    const settingData = await settingRes.json().catch(() => ({}));
    if (machineRes.ok) {
      const machineRows = Array.isArray(machineData.machines) ? machineData.machines : [];
      setMachines(
        machineRows.map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ''),
          code: String(row.ma_may ?? row.code ?? '').trim(),
          name: String(row.ten_may ?? row.name ?? '').trim()
        }))
      );
    }
    if (settingRes.ok) {
      setShiftSettings(normalizeShiftSettings(settingData));
    }
  };

  const loadReports = async (nextFilters = filters, machineList = machines) => {
    const query = buildFilterQuery(nextFilters, machineList);
    const res = await fetch(`/api/bao-cao-phoi-tron${query ? `?${query}` : ''}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Không thể tải báo cáo phối trộn.');
    const list = Array.isArray(data.reports) ? data.reports : [];
    setReports(list.map((item: Record<string, unknown>) => normalizeMixingReport(item)));
  };

  useEffect(() => {
    void loadReferenceData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        await loadReports(filters, machines);
        if (!cancelled) {
          setViewingGroupKey(null);
          setViewingReportId(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Không thể tải báo cáo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, machines, reloadTick]);

  useEffect(() => {
    if (!viewingReportId) setPreviewPhoto(null);
  }, [viewingReportId]);

  useEffect(() => {
    if (printReports.length === 0) return;
    document.body.classList.add('mixing-report-print-active');
    return () => {
      document.body.classList.remove('mixing-report-print-active');
    };
  }, [printReports]);

  useEffect(() => {
    if (!pendingPrint || printReports.length === 0) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [pendingPrint, printReports]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintReports([]);
      setPendingPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handlePrintViewingGroup = () => {
    if (viewingGroupReports.length === 0) {
      setError('Không có phiếu nào trong ca này để in.');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    setPrintReports(viewingGroupReports);
    setPendingPrint(true);
  };

  const viewingReport = useMemo(
    () => reports.find(report => report.id === viewingReportId) ?? null,
    [reports, viewingReportId]
  );

  const viewingRoundCount = useMemo(() => {
    if (!viewingReport) return 1;
    const fromLines = viewingReport.chi_tiet.reduce(
      (max, line) => Math.max(max, visibleRoundCount(line.lan_su_dung)),
      1
    );
    return Math.min(5, Math.max(viewingReport.so_lan || 1, fromLines));
  }, [viewingReport]);

  const detailSessionStart = viewingReport?.lan_thu && viewingReport.lan_thu > 0 ? viewingReport.lan_thu : 1;

  const viewingRoundPhotos = useMemo(() => {
    if (!viewingReport) return {} as Partial<Record<(typeof MIXING_ROUND_KEYS)[number], MixingRoundPhoto[]>>;
    return resolveMixingReportRoundPhotos(viewingReport);
  }, [viewingReport]);

  const viewingRoundReasons = useMemo(() => {
    if (!viewingReport) return {} as Partial<Record<(typeof MIXING_ROUND_KEYS)[number], string[]>>;
    return resolveMixingReportRoundReasons(viewingReport);
  }, [viewingReport]);

  const viewingRoundExplanations = useMemo(() => {
    if (!viewingReport) return {} as Partial<Record<(typeof MIXING_ROUND_KEYS)[number], string>>;
    return resolveMixingReportRoundExplanations(viewingReport);
  }, [viewingReport]);

  const showDetailQuantityColumns = viewingRoundCount > 1;

  const renderPhotoGallery = (
    photos: MixingRoundPhoto[],
    emptyLabel = 'Chưa có ảnh xác nhận',
    variant: 'thumb' | 'detail' = 'thumb',
    photoLabel = 'Ảnh xác nhận'
  ) => {
    if (photos.length === 0) {
      return (
        <p
          className={`rounded-lg border border-dashed border-zinc-200 bg-white text-center text-xs font-semibold text-zinc-400 ${
            variant === 'detail' ? 'px-3 py-8' : 'px-3 py-4'
          }`}
        >
          {emptyLabel}
        </p>
      );
    }
    if (variant === 'detail') {
      return (
        <div className="flex flex-col gap-2.5">
          {photos.map((photo, photoIndex) => (
            <button
              key={`${photo.url}-${photoIndex}`}
              type="button"
              onClick={() =>
                setPreviewPhoto({
                  url: photo.url,
                  label: photos.length > 1 ? `${photoLabel} · ${photoIndex + 1}/${photos.length}` : photoLabel
                })
              }
              className="block h-36 w-full shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:ring-2 hover:ring-[#ef1b2d]/30 focus:outline-none focus:ring-2 focus:ring-[#ef1b2d]/40"
              title="Xem ảnh"
            >
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, photoIndex) => (
          <a
            key={`${photo.url}-${photoIndex}`}
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            className="block h-20 w-20 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition hover:ring-2 hover:ring-[#ef1b2d]/30"
            title="Xem ảnh"
          >
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
          </a>
        ))}
      </div>
    );
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa báo cáo phối trộn này?')) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/bao-cao-phoi-tron/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa báo cáo.');
      if (viewingReportId === id) setViewingReportId(null);
      if (viewingGroup?.reports.length === 1 && viewingGroup.reports[0]?.id === id) {
        setViewingGroupKey(null);
      }
      setMessage('Đã xóa báo cáo phối trộn.');
      await loadReports(filters, machines);
    } catch (err: any) {
      setError(err.message || 'Không thể xóa báo cáo.');
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b-4 border-[#ef1b2d] bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <img src={vietNhatLogoUrl} alt="Viet Nhat IPT" className="h-14 w-auto max-w-[190px] object-contain" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#ef1b2d]">Bảng trộn vật tư</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormModalMode('create');
                  setPendingEditReport(null);
                  setCreateModalOpen(true);
                }}
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

        <div className="space-y-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-emerald-700" />
              <p className="text-sm font-black text-zinc-950">
                {shiftGroups.length} ca · {reports.length} phiếu
              </p>
            </div>
            <p className="text-[11px] font-semibold text-zinc-500">
              Đang lọc: {formatFilterSummary(filters, machines)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
              <input
                type="date"
                value={filters.tuNgay}
                onChange={e => setFilters(prev => ({ ...prev, tuNgay: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Đến ngày</span>
              <input
                type="date"
                value={filters.denNgay}
                onChange={e => setFilters(prev => ({ ...prev, denNgay: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Ca</span>
              <select
                value={filters.ca}
                onChange={e => setFilters(prev => ({ ...prev, ca: e.target.value }))}
                className={inputClass}
              >
                <option value="">Tất cả ca</option>
                {shiftOptions.map(shift => (
                  <option key={shift.value} value={shift.value}>
                    {shift.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 space-y-1 lg:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Máy</span>
              <select
                value={filters.machineId}
                onChange={e => setFilters(prev => ({ ...prev, machineId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Tất cả máy</option>
                {machines.map(machine => (
                  <option key={machine.id} value={machine.id}>
                    {machine.code} · {machine.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="col-span-2 flex items-end gap-2 lg:col-span-1">
              <button
                type="button"
                onClick={() => setFilters(emptyFilters())}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 text-[10px] font-black text-zinc-600 transition hover:bg-zinc-100"
              >
                Xóa lọc
              </button>
              <button
                type="button"
                onClick={() => setReloadTick(tick => tick + 1)}
                className="inline-flex h-9 flex-[2] items-center justify-center gap-1 rounded-lg bg-[#ef1b2d] px-2 text-[10px] font-extrabold text-white transition hover:bg-[#b30d1c]"
              >
                <Search className="h-3.5 w-3.5" />
                Lọc
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-4 py-3">
          <p className="text-sm font-black text-zinc-950">Danh sách theo ca</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Ngày</th>
                <th className="px-3 py-2 font-black">Ca</th>
                <th className="px-3 py-2 font-black">Số phiếu</th>
                <th className="px-3 py-2 font-black">Số máy</th>
                <th className="px-3 py-2 text-right font-black">KL định mức</th>
                <th className="px-3 py-2 text-right font-black">KL thực tế</th>
                <th className="px-3 py-2 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải...
                  </td>
                </tr>
              ) : shiftGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có báo cáo phối trộn phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                shiftGroups.map(group => {
                  const machineCount = new Set(
                    group.reports.map(report => report.ma_may || report.ten_may || '-')
                  ).size;

                  return (
                    <tr key={group.key} className="transition hover:bg-emerald-50/40">
                      <td className="px-3 py-2 font-mono font-bold text-zinc-700">{group.ngay || '-'}</td>
                      <td className="px-3 py-2 font-semibold text-zinc-800">{group.ca}</td>
                      <td className="px-3 py-2 font-bold text-zinc-700">{group.reports.length}</td>
                      <td className="px-3 py-2 text-zinc-700">{machineCount}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                        {formatNormWeight(sumGroupKlDinhMuc(group.reports)) || '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-[#ef1b2d]">
                        {formatOptionalNumber(sumGroupKlThucTe(group.reports)) || '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setViewingGroupKey(group.key)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[10px] font-black text-zinc-700 transition hover:bg-zinc-50"
                          title="Xem chi tiết ca"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {viewingGroup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="relative flex max-h-[96vh] w-full max-w-[min(96vw,1200px)] flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-lg font-black text-zinc-950">Chi tiết phối trộn theo ca</h3>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  {viewingGroup.ngay || '-'} · Ca {viewingGroup.ca} · {viewingGroup.reports.length} phiếu
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintViewingGroup}
                  disabled={viewingGroupReports.length === 0}
                  title="In nhật ký trộn nguyên liệu — tất cả lần trong ca"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  In tất cả lần
                </button>
                <button
                  type="button"
                  onClick={() => setViewingGroupKey(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-black">Lần</th>
                      <th className="px-3 py-2 font-black">Giờ</th>
                      <th className="px-3 py-2 font-black">Máy</th>
                      <th className="px-3 py-2 font-black">Nhân sự</th>
                      <th className="px-3 py-2 font-black">Dòng VT</th>
                      <th className="px-3 py-2 text-right font-black">KL định mức</th>
                      <th className="px-3 py-2 text-right font-black">KL thực tế</th>
                      <th className="px-3 py-2 text-center font-black">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {viewingGroupReports.map(report => (
                      <tr key={report.id} className="transition hover:bg-zinc-50">
                        <td className="px-3 py-2 font-bold text-zinc-800">
                          {formatMixingReportSessionLabel(report)}
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-600">{report.gio || '-'}</td>
                        <td className="px-3 py-2 text-zinc-700">{report.ten_may || report.ma_may || '-'}</td>
                        <td className="px-3 py-2 text-zinc-600">{report.nhan_su || '-'}</td>
                        <td className="px-3 py-2 font-bold text-zinc-700">{report.chi_tiet.length}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                          {formatNormWeight(sumReportKlDinhMuc(report)) || '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-[#ef1b2d]">
                          {formatOptionalNumber(report.thuc_te_su_dung) || '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setFormModalMode('edit');
                                setPendingEditReport(report);
                                setCreateModalOpen(true);
                              }}
                              className="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-black text-zinc-700 transition hover:bg-zinc-50"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Pencil className="h-3.5 w-3.5" />
                                Sửa
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewingReportId(report.id)}
                              className="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-black text-zinc-700 transition hover:bg-zinc-50"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Eye className="h-3.5 w-3.5" />
                                Xem
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(report.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                              title="Xóa phiếu"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right">
                        Tổng ca
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">
                        {formatNormWeight(sumGroupKlDinhMuc(viewingGroupReports)) || '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-[#ef1b2d]">
                        {formatOptionalNumber(sumGroupKlThucTe(viewingGroupReports)) || '-'}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="border-t border-zinc-200 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setViewingGroupKey(null)}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 sm:w-auto sm:px-4"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingReport && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="relative flex max-h-[96vh] w-full max-w-[min(96vw,1280px)] flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-lg font-black text-zinc-950">Chi tiết các dòng vật tư</h3>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  {viewingReport.ngay || '-'} · {viewingReport.ca || '-'} · {viewingReport.gio || '-'} ·{' '}
                  {viewingReport.ten_may || viewingReport.ma_may || '-'}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-zinc-400">
                  Nhân sự: {viewingReport.nhan_su || '-'} · {formatMixingReportSessionLabel(viewingReport)} · Thực tế:{' '}
                  {formatOptionalNumber(viewingReport.thuc_te_su_dung) || '-'} kg
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingReportId(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {viewingReport.chi_tiet.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-zinc-400">Phiếu này chưa có dòng vật tư.</p>
              ) : (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <aside className="w-full shrink-0 lg:sticky lg:top-0 lg:w-[min(100%,300px)]">
                    <div className="max-h-[min(58vh,520px)] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      {showDetailQuantityColumns ? (
                        <div className="space-y-4">
                          {MIXING_ROUND_KEYS.slice(0, viewingRoundCount).map((roundKey, roundIndex) => {
                            const roundLabel = `Ảnh · ${mixingSessionColumnLabel(detailSessionStart, roundIndex)}`;
                            return (
                            <div key={`detail-photos-${roundKey}`}>
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                                {roundLabel}
                              </p>
                              {renderPhotoGallery(
                                viewingRoundPhotos[roundKey] ?? [],
                                'Chưa có ảnh xác nhận',
                                'detail',
                                roundLabel
                              )}
                              <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 bg-white p-2.5">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                    Lý do
                                  </p>
                                  <div className="mt-1">{renderReasonList(viewingRoundReasons[roundKey])}</div>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                    Giải trình
                                  </p>
                                  <div className="mt-1">
                                    {renderExplanationText(viewingRoundExplanations[roundKey])}
                                  </div>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div>
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            Ảnh · {mixingSessionColumnLabel(detailSessionStart, 0)}
                          </p>
                          {renderPhotoGallery(
                            MIXING_ROUND_KEYS.slice(0, viewingRoundCount).flatMap(
                              roundKey => viewingRoundPhotos[roundKey] ?? []
                            ),
                            'Chưa có ảnh xác nhận',
                            'detail',
                            `Ảnh · ${mixingSessionColumnLabel(detailSessionStart, 0)}`
                          )}
                          <div className="mt-3 space-y-2 rounded-lg border border-zinc-200 bg-white p-2.5">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Lý do</p>
                              <div className="mt-1">
                                {renderReasonList(viewingRoundReasons[MIXING_ROUND_KEYS[0]])}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                Giải trình
                              </p>
                              <div className="mt-1">
                                {renderExplanationText(viewingRoundExplanations[MIXING_ROUND_KEYS[0]])}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </aside>

                  <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-zinc-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                        <tr>
                          <th className="w-10 px-2 py-2 font-black">STT</th>
                          <th className="px-2 py-2 font-black">Mã NVL</th>
                          <th className="px-2 py-2 font-black">Tên vật tư</th>
                          <th className="px-2 py-2 font-black">ĐVT</th>
                          {showDetailQuantityColumns
                            ? MIXING_ROUND_KEYS.slice(0, viewingRoundCount).map((_, roundIndex) => (
                                <th
                                  key={`detail-head-${roundIndex}`}
                                  className="min-w-[72px] whitespace-nowrap px-2 py-2 text-right font-black"
                                >
                                  {mixingSessionColumnLabel(detailSessionStart, roundIndex)}
                                </th>
                              ))
                            : null}
                          <th className="min-w-[72px] whitespace-nowrap px-2 py-2 text-right font-black">
                            KL định mức
                          </th>
                          <th className="min-w-[72px] whitespace-nowrap px-2 py-2 text-right font-black">
                            KL thực tế
                          </th>
                          {MIXING_ROUND_KEYS.slice(0, viewingRoundCount).flatMap((roundKey, roundIndex) => {
                            const roundLabel = mixingSessionColumnLabel(detailSessionStart, roundIndex);
                            const suffix = viewingRoundCount > 1 ? ` · ${roundLabel}` : '';
                            return [
                              <th
                                key={`detail-reason-head-${roundKey}`}
                                className="min-w-[120px] px-2 py-2 font-black"
                              >
                                Lý do{suffix}
                              </th>,
                              <th
                                key={`detail-explain-head-${roundKey}`}
                                className="min-w-[160px] px-2 py-2 font-black"
                              >
                                Giải trình{suffix}
                              </th>
                            ];
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white">
                        {viewingReport.chi_tiet.map((line, index) => {
                          const klDinhMuc = sumLineNormQuantity(line);
                          const klThucTe = resolveLineKlThucTe(line);
                          return (
                            <tr key={`detail-row-${line.stt}-${index}`} className="hover:bg-red-50/20">
                              <td className="whitespace-nowrap px-2 py-2 font-bold text-zinc-600">{index + 1}</td>
                              <td className="whitespace-nowrap px-2 py-2 font-mono font-semibold text-zinc-700">
                                {line.ma_nvl || '-'}
                              </td>
                              <td className="px-2 py-2 text-zinc-800">{line.ten_vat_tu || '-'}</td>
                              <td className="whitespace-nowrap px-2 py-2 text-zinc-600">
                                {deriveLineUnit(line.lan_su_dung)}
                              </td>
                              {showDetailQuantityColumns
                                ? MIXING_ROUND_KEYS.slice(0, viewingRoundCount).map(roundKey => (
                                    <td
                                      key={`${line.stt}-${roundKey}`}
                                      className="whitespace-nowrap px-2 py-2 text-right font-mono text-zinc-700"
                                    >
                                      {formatNormWeight(sumLineRoundNormQuantity(line, roundKey)) || '-'}
                                    </td>
                                  ))
                                : null}
                              <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-bold text-emerald-800">
                                {formatNormWeight(klDinhMuc) || '-'}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-black text-[#ef1b2d]">
                                {klThucTe !== null ? formatOptionalNumber(klThucTe) : '-'}
                              </td>
                              {index === 0
                                ? MIXING_ROUND_KEYS.slice(0, viewingRoundCount).flatMap(roundKey => [
                                    <td
                                      key={`detail-reason-${roundKey}`}
                                      rowSpan={viewingReport.chi_tiet.length}
                                      className="min-w-[120px] max-w-[220px] align-top px-2 py-2"
                                    >
                                      {renderReasonList(viewingRoundReasons[roundKey])}
                                    </td>,
                                    <td
                                      key={`detail-explain-${roundKey}`}
                                      rowSpan={viewingReport.chi_tiet.length}
                                      className="min-w-[160px] max-w-[280px] align-top px-2 py-2"
                                    >
                                      {renderExplanationText(viewingRoundExplanations[roundKey])}
                                    </td>
                                  ])
                                : null}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700">
                        <tr>
                          <td colSpan={4 + (showDetailQuantityColumns ? viewingRoundCount : 0)} className="px-2 py-2 text-right">
                            Thực tế sử dụng
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-bold text-emerald-800">
                            {formatNormWeight(sumReportNormTotal(viewingReport.chi_tiet)) || '-'}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-black text-[#ef1b2d]">
                            {(() => {
                              const fromLines = viewingReport.chi_tiet.reduce(
                                (sum, line) => sum + (resolveLineKlThucTe(line) ?? 0),
                                0
                              );
                              const hasLineActual = viewingReport.chi_tiet.some(
                                line => resolveLineKlThucTe(line) !== null
                              );
                              const total = hasLineActual ? fromLines : viewingReport.thuc_te_su_dung;
                              return total !== null && total !== undefined
                                ? `${formatOptionalNumber(total)} kg`
                                : '-';
                            })()}
                          </td>
                          <td colSpan={2 * viewingRoundCount}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-200 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setViewingReportId(null)}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 sm:w-auto sm:px-4"
              >
                Đóng
              </button>
            </div>

            {previewPhoto ? (
              <div className="absolute inset-0 z-20 flex flex-col bg-zinc-950/95">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-300">{previewPhoto.label}</p>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(null)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-bold text-white transition hover:bg-[#b30d1c]"
                  >
                    <X className="h-3.5 w-3.5" />
                    Đóng ảnh
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                  <img
                    src={previewPhoto.url}
                    alt={previewPhoto.label}
                    className="max-h-full max-w-full rounded-lg object-contain"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
      {createModalOpen && (
        <MixingReportForm
          modalMode
          open
          editReport={pendingEditReport}
          onEditConsumed={() => setPendingEditReport(null)}
          onClose={() => {
            setCreateModalOpen(false);
            setPendingEditReport(null);
            setFormModalMode('create');
          }}
          onSaved={async () => {
            setMessage(
              formModalMode === 'edit' ? 'Đã cập nhật báo cáo phối trộn.' : 'Đã lưu báo cáo phối trộn.'
            );
            await loadReports(filters, machines);
          }}
        />
      )}

      {printReports.length > 0 ? <MixingReportPrintBatch reports={printReports} /> : null}
    </div>
  );
}
