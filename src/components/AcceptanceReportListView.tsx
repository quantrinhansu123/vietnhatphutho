import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ClipboardList, Eye, Loader2, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import { formatNumber } from '../utils';
import { AcceptanceReportPrintBatch, buildAcceptancePrintSlips, sumByUnit } from './AcceptanceReportPrintSheet';
import type { AcceptanceReport } from './AcceptanceReportForm';
import { normalizeReportFromApi } from './AcceptanceReportForm';

const inputClass =
  'h-9 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

type AcceptanceShiftGroup = {
  ca: string;
  ngay: string;
  reports: AcceptanceReport[];
};

type ProductNameOption = {
  code: string;
  name: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function compareAcceptanceReports(a: AcceptanceReport, b: AcceptanceReport) {
  const machineA = a.ten_may || a.ma_may || '';
  const machineB = b.ten_may || b.ma_may || '';
  const byMachine = machineA.localeCompare(machineB, 'vi');
  if (byMachine !== 0) return byMachine;
  const byLan = String(a.lan).localeCompare(String(b.lan), 'vi', { numeric: true });
  if (byLan !== 0) return byLan;
  const byTime = String(a.gio).localeCompare(String(b.gio));
  if (byTime !== 0) return byTime;
  return String(a.mat_hang).localeCompare(String(b.mat_hang), 'vi');
}

function normalizeProductKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeProductNames(data: unknown): ProductNameOption[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { products?: unknown }).products)
      ? (data as { products: unknown[] }).products
      : [];

  return rows
    .map((item): ProductNameOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = String(
        record.ma_sp ?? record.ma_san_pham ?? record.productCode ?? record.code ?? ''
      ).trim();
      const name = String(
        record.ten_sp ?? record.ten_san_pham ?? record.productName ?? record.name ?? ''
      ).trim();
      if (!code || !name) return null;
      return { code, name };
    })
    .filter((item): item is ProductNameOption => Boolean(item));
}

function buildShiftGroups(reports: AcceptanceReport[], ngay: string): AcceptanceShiftGroup[] {
  const grouped = new Map<string, AcceptanceReport[]>();

  for (const report of reports) {
    const ca = report.ca || '-';
    const list = grouped.get(ca) ?? [];
    list.push(report);
    grouped.set(ca, list);
  }

  return [...grouped.entries()]
    .map(([ca, groupReports]) => ({
      ca,
      ngay: groupReports[0]?.ngay || ngay,
      reports: [...groupReports].sort(compareAcceptanceReports)
    }))
    .sort((a, b) => a.ca.localeCompare(b.ca, 'vi'));
}

export default function AcceptanceReportListView({
  onBack,
  onCreate,
  onEdit
}: {
  onBack: () => void;
  onCreate: () => void;
  onEdit: (report: AcceptanceReport) => void;
}) {
  const [filterDate, setFilterDate] = useState(todayIso());
  const [reports, setReports] = useState<AcceptanceReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingPrint, setPendingPrint] = useState(false);
  const [activePrintSlips, setActivePrintSlips] = useState<ReturnType<typeof buildAcceptancePrintSlips>>([]);
  const [viewingCa, setViewingCa] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productNameByCode, setProductNameByCode] = useState<Map<string, string>>(() => new Map());

  const shiftGroups = useMemo(() => buildShiftGroups(reports, filterDate), [reports, filterDate]);
  const viewingGroup = useMemo(
    () => shiftGroups.find(group => group.ca === viewingCa) ?? null,
    [shiftGroups, viewingCa]
  );
  const viewingTotalsByUnit = useMemo(
    () =>
      viewingGroup
        ? sumByUnit(
            viewingGroup.reports.map(report => ({
              mat_hang: report.mat_hang,
              don_vi: report.don_vi,
              so_luong: report.so_luong
            }))
          )
        : [],
    [viewingGroup]
  );

  const addProductNamesForPrint = (sourceReports: AcceptanceReport[]) =>
    sourceReports.map(report => ({
      ...report,
      ten_sp: productNameByCode.get(normalizeProductKey(report.mat_hang)) || ''
    }));

  useEffect(() => {
    if (!pendingPrint || activePrintSlips.length === 0) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPendingPrint(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pendingPrint, activePrintSlips]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setActivePrintSlips([]);
      setPendingPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/san-pham?format=table');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;

        const next = new Map<string, string>();
        normalizeProductNames(data).forEach(product => {
          const key = normalizeProductKey(product.code);
          if (key) next.set(key, product.name);
        });
        setProductNameByCode(next);
      } catch {
        if (!cancelled) setProductNameByCode(new Map());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadReports = async (ngay = filterDate) => {
    const res = await fetch(`/api/bao-cao-nghiem-thu?ngay=${encodeURIComponent(ngay)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Không thể tải báo cáo sản lượng.');
    const list = Array.isArray(data.reports) ? data.reports : [];
    setReports(list.map((item: Record<string, unknown>) => normalizeReportFromApi(item)));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError('');
      setViewingCa(null);
      try {
        await loadReports(filterDate);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Không thể tải báo cáo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterDate]);

  const startPrint = (slips: ReturnType<typeof buildAcceptancePrintSlips>) => {
    if (slips.length === 0) {
      setError('Chưa có báo cáo sản lượng để in.');
      return;
    }
    setError('');
    setActivePrintSlips(slips);
    setPendingPrint(true);
  };

  const handlePrint = () => {
    startPrint(buildAcceptancePrintSlips(addProductNamesForPrint(reports)));
  };

  const handlePrintGroup = () => {
    if (!viewingGroup) return;
    startPrint(buildAcceptancePrintSlips(addProductNamesForPrint(viewingGroup.reports)));
  };

  const sortedReports = useMemo(() => [...reports].sort(compareAcceptanceReports), [reports]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa báo cáo sản lượng này?')) return;
    setError('');
    setMessage('');
    setDeletingId(id);
    try {
      const res = await fetch(`/api/bao-cao-nghiem-thu/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa báo cáo.');
      setMessage('Đã xóa báo cáo sản lượng.');
      await loadReports(filterDate);
      if (viewingGroup && viewingGroup.reports.length === 1 && viewingGroup.reports[0]?.id === id) {
        setViewingCa(null);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể xóa báo cáo.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderReportActions = (report: AcceptanceReport, closeModalOnEdit = false) => (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => {
          if (closeModalOnEdit) setViewingCa(null);
          onEdit(report);
        }}
        className="rounded-lg border border-zinc-200 px-2 py-1 text-[10px] font-black text-zinc-700 transition hover:bg-zinc-50"
        title="Sửa báo cáo"
      >
        <span className="inline-flex items-center gap-1">
          <Pencil className="h-3.5 w-3.5" />
          Sửa
        </span>
      </button>
      <button
        type="button"
        onClick={() => handleDelete(report.id)}
        disabled={deletingId === report.id}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        title="Xóa báo cáo"
      >
        {deletingId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="space-y-4 pb-24">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b-4 border-[#ef1b2d] bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <img src={vietNhatLogoUrl} alt="Viet Nhat IPT" className="h-14 w-auto max-w-[190px] object-contain" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#ef1b2d]">Báo cáo sản lượng</p>
                <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950">Danh sách báo cáo</h2>
                <p className="mt-1 text-xs font-semibold text-zinc-500">Xem theo ca, in phiếu và quản lý sản lượng đã lưu</p>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-700" />
            <span className="text-xs font-black uppercase tracking-wider text-zinc-600">
              {shiftGroups.length} ca · {reports.length} dòng trong ngày
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={reports.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              In phiếu
            </button>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-600">
              Ngày
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Ngày</th>
                <th className="px-3 py-2 font-black">Ca</th>
                <th className="px-3 py-2 font-black">Số dòng</th>
                <th className="px-3 py-2 font-black">Số tổ</th>
                <th className="px-3 py-2 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center font-bold text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Đang tải...
                  </td>
                </tr>
              ) : shiftGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có báo cáo trong ngày này.
                  </td>
                </tr>
              ) : (
                shiftGroups.map(group => {
                  const machineCount = new Set(
                    group.reports.map(report => report.ma_may || report.ten_may || '-')
                  ).size;

                  return (
                    <tr key={group.ca} className="hover:bg-emerald-50/40">
                      <td className="px-3 py-2 font-mono font-bold text-zinc-700">{group.ngay || '-'}</td>
                      <td className="px-3 py-2 font-semibold text-zinc-800">{group.ca}</td>
                      <td className="px-3 py-2 font-bold text-zinc-700">{group.reports.length}</td>
                      <td className="px-3 py-2 text-zinc-700">{machineCount}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setViewingCa(group.ca)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-[10px] font-black text-zinc-700 transition hover:bg-zinc-50"
                            title="Xem chi tiết ca"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Xem
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-4 py-3">
          <p className="text-sm font-black text-zinc-950">Chi tiết từng dòng</p>
          <p className="mt-0.5 text-xs font-semibold text-zinc-500">Sửa hoặc xóa trực tiếp từng báo cáo sản lượng</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-black">Ca</th>
                <th className="px-3 py-2 font-black">Tổ</th>
                <th className="px-3 py-2 font-black">Lần</th>
                <th className="px-3 py-2 font-black">Giờ</th>
                <th className="px-3 py-2 font-black">Mặt hàng</th>
                <th className="px-3 py-2 font-black">ĐVT</th>
                <th className="px-3 py-2 font-black">SL</th>
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
              ) : sortedReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có báo cáo trong ngày này.
                  </td>
                </tr>
              ) : (
                sortedReports.map(report => (
                  <tr key={report.id} className="hover:bg-emerald-50/40">
                    <td className="px-3 py-2 font-semibold text-zinc-800">{report.ca || '-'}</td>
                    <td className="px-3 py-2 text-zinc-700">{report.ten_may || report.ma_may || '-'}</td>
                    <td className="px-3 py-2 font-bold text-zinc-700">{report.lan || '-'}</td>
                    <td className="px-3 py-2 font-mono text-zinc-600">{report.gio || '-'}</td>
                    <td className="px-3 py-2 text-zinc-700">{report.mat_hang || '-'}</td>
                    <td className="px-3 py-2 font-semibold text-zinc-600">{report.don_vi || '-'}</td>
                    <td className="px-3 py-2 font-mono font-bold text-emerald-700">
                      {report.so_luong === null ? '-' : formatNumber(report.so_luong, 2)}
                    </td>
                    <td className="px-3 py-2">{renderReportActions(report)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

      {viewingGroup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="relative flex max-h-[96vh] w-full max-w-[min(96vw,1100px)] flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-lg font-black text-zinc-950">Chi tiết sản lượng theo ca</h3>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  {viewingGroup.ngay || '-'} · Ca {viewingGroup.ca} · {viewingGroup.reports.length} dòng
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintGroup}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100"
                >
                  <Printer className="h-4 w-4" />
                  In phiếu
                </button>
                <button
                  type="button"
                  onClick={() => setViewingCa(null)}
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
                      <th className="px-3 py-2 font-black">Ảnh</th>
                      <th className="px-3 py-2 font-black">Tổ</th>
                      <th className="px-3 py-2 font-black">Lần</th>
                      <th className="px-3 py-2 font-black">Giờ</th>
                      <th className="px-3 py-2 font-black">Mặt hàng</th>
                      <th className="px-3 py-2 font-black">ĐVT</th>
                      <th className="px-3 py-2 font-black">SL</th>
                      <th className="px-3 py-2 text-center font-black">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {viewingGroup.reports.map(report => (
                      <tr key={report.id} className="hover:bg-emerald-50/40">
                        <td className="px-3 py-2">
                          {report.hinh_anh ? (
                            <a
                              href={report.hinh_anh}
                              target="_blank"
                              rel="noreferrer"
                              className="block h-10 w-10 overflow-hidden rounded-lg border border-zinc-200"
                            >
                              <img src={report.hinh_anh} alt="Sản lượng" className="h-full w-full object-cover" />
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-zinc-700">{report.ten_may || report.ma_may || '-'}</td>
                        <td className="px-3 py-2 font-bold text-zinc-700">{report.lan || '-'}</td>
                        <td className="px-3 py-2 font-mono text-zinc-600">{report.gio || '-'}</td>
                        <td className="px-3 py-2 text-zinc-700">{report.mat_hang || '-'}</td>
                        <td className="px-3 py-2 font-semibold text-zinc-600">{report.don_vi || '-'}</td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-700">
                          {report.so_luong === null ? '-' : formatNumber(report.so_luong, 2)}
                        </td>
                        <td className="px-3 py-2">{renderReportActions(report, true)}</td>
                      </tr>
                    ))}
                    {viewingTotalsByUnit.map(([unit, total]) => (
                      <tr key={unit} className="bg-zinc-50">
                        <td colSpan={6} className="px-3 py-2 text-right font-black text-zinc-800">
                          Tổng cộng ({unit})
                        </td>
                        <td className="px-3 py-2 font-mono font-black text-emerald-700">
                          {formatNumber(total, 2)}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-zinc-200 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => setViewingCa(null)}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 sm:w-auto sm:px-4"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingPrint &&
        activePrintSlips.length > 0 &&
        createPortal(<AcceptanceReportPrintBatch slips={activePrintSlips} />, document.body)}
    </div>
  );
}
