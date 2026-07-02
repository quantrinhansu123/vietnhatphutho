import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ClipboardList, Eye, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import {
  MIXING_ROUND_KEYS,
  deriveLineUnit,
  formatOptionalNumber,
  mixingRoundColumnLabel,
  sumMixingRounds,
  sumRoundQuantity,
  visibleRoundCount,
  normalizeMixingReport
} from '../lib/mixingReportModel';
import type { MixingReport } from './MixingReportForm';
import MixingReportForm from './MixingReportForm';
import {
  getProductionShiftOptions,
  normalizeShiftSettings,
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
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const shiftOptions = useMemo(() => getProductionShiftOptions(shiftSettings), [shiftSettings]);

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
        if (!cancelled) setViewingReportId(null);
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa báo cáo phối trộn này?')) return;
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/bao-cao-phoi-tron/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa báo cáo.');
      if (viewingReportId === id) setViewingReportId(null);
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
                <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950">
                  Danh sách báo cáo phối trộn
                </h2>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  Xem các dòng vật tư đã lưu theo ngày / ca / máy
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
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
              <p className="text-sm font-black text-zinc-950">{reports.length} phiếu</p>
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
                className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#ef1b2d] px-2 text-[10px] font-extrabold text-white transition hover:bg-[#b30d1c]"
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
          <p className="text-sm font-black text-zinc-950">Danh sách phiếu</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Ngày</th>
                <th className="px-3 py-2 font-black">Ca</th>
                <th className="px-3 py-2 font-black">Giờ</th>
                <th className="px-3 py-2 font-black">Máy</th>
                <th className="px-3 py-2 font-black">Nhân sự</th>
                <th className="px-3 py-2 font-black">Dòng VT</th>
                <th className="px-3 py-2 font-black">Thực tế kg</th>
                <th className="px-3 py-2 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có báo cáo phối trộn phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                reports.map(report => (
                  <tr key={report.id} className="transition hover:bg-zinc-50">
                    <td className="px-3 py-2 font-mono font-bold text-zinc-700">{report.ngay || '-'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-800">{report.ca || '-'}</td>
                    <td className="px-3 py-2 font-mono text-zinc-600">{report.gio || '-'}</td>
                    <td className="px-3 py-2 text-zinc-700">{report.ten_may || report.ma_may || '-'}</td>
                    <td className="px-3 py-2 text-zinc-600">{report.nhan_su || '-'}</td>
                    <td className="px-3 py-2 font-bold text-zinc-700">{report.chi_tiet.length}</td>
                    <td className="px-3 py-2 font-mono font-bold text-emerald-700">
                      {formatOptionalNumber(report.thuc_te_su_dung) || '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-lg font-black text-zinc-950">Chi tiết các dòng vật tư</h3>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  {viewingReport.ngay || '-'} · {viewingReport.ca || '-'} · {viewingReport.gio || '-'} ·{' '}
                  {viewingReport.ten_may || viewingReport.ma_may || '-'}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-zinc-400">
                  Nhân sự: {viewingReport.nhan_su || '-'} · Thực tế:{' '}
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
                <div className="space-y-4">
                  {MIXING_ROUND_KEYS.slice(0, viewingRoundCount).some(roundKey => {
                    const roundPhotos = viewingReport.hinh_anh_theo_lan?.[roundKey] ?? [];
                    return roundPhotos.length > 0;
                  }) ? (
                    <div className="flex flex-wrap gap-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
                      {MIXING_ROUND_KEYS.slice(0, viewingRoundCount).map((roundKey, roundIndex) => {
                        const photos = viewingReport.hinh_anh_theo_lan?.[roundKey] ?? [];
                        if (photos.length === 0) return null;
                        return (
                          <div key={`detail-photos-${roundKey}`} className="min-w-[120px]">
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              {mixingRoundColumnLabel(roundIndex)}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {photos.map((photo, photoIndex) => (
                                <a
                                  key={`${roundKey}-${photoIndex}`}
                                  href={photo.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-14 w-14 overflow-hidden rounded-lg border border-zinc-200 bg-white"
                                >
                                  <img
                                    src={photo.url}
                                    alt={`Ảnh ${roundIndex + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="overflow-x-auto rounded-xl border border-zinc-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-[10px] uppercase tracking-wider text-white">
                        <tr>
                          <th className="w-10 px-2 py-2 font-black">STT</th>
                          <th className="px-2 py-2 font-black">Mã NVL</th>
                          <th className="px-2 py-2 font-black">Tên vật tư</th>
                          <th className="px-2 py-2 font-black">ĐVT</th>
                          {MIXING_ROUND_KEYS.slice(0, viewingRoundCount).map((_, roundIndex) => (
                            <th
                              key={`detail-head-${roundIndex}`}
                              className="min-w-[72px] whitespace-nowrap px-2 py-2 text-right font-black"
                            >
                              {mixingRoundColumnLabel(roundIndex)}
                            </th>
                          ))}
                          <th className="min-w-[72px] whitespace-nowrap px-2 py-2 text-right font-black">
                            Tổng trộn
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white">
                        {viewingReport.chi_tiet.map((line, index) => {
                          const tongTron = line.tong_nhua_tron ?? sumMixingRounds(line.lan_su_dung);
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
                              {MIXING_ROUND_KEYS.slice(0, viewingRoundCount).map(roundKey => (
                                <td
                                  key={`${line.stt}-${roundKey}`}
                                  className="whitespace-nowrap px-2 py-2 text-right font-mono text-zinc-700"
                                >
                                  {formatOptionalNumber(sumRoundQuantity(line.lan_su_dung, roundKey)) || '-'}
                                </td>
                              ))}
                              <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-black text-[#ef1b2d]">
                                {formatOptionalNumber(tongTron) || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700">
                        <tr>
                          <td colSpan={4 + viewingRoundCount} className="px-2 py-2 text-right">
                            Thực tế sử dụng
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-black text-[#ef1b2d]">
                            {formatOptionalNumber(viewingReport.thuc_te_su_dung) || '-'} kg
                          </td>
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
          </div>
        </div>
      )}
      {createModalOpen && (
        <MixingReportForm
          modalMode
          open
          onClose={() => setCreateModalOpen(false)}
          onSaved={async () => {
            setMessage('Đã lưu báo cáo phối trộn.');
            await loadReports(filters, machines);
          }}
        />
      )}
    </div>
  );
}
