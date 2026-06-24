import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Eye,
  Factory,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users
} from 'lucide-react';
import vietNhatLogoUrl from '../../logovietnhat_1.png';
import WeighingReportForm from './WeighingReportForm';
import WeighingSlipSetupModal, { type SlipSetupPayload } from './WeighingSlipSetupModal';

const SHIFT_ORDER = ['Ca sáng', 'Ca chiều', 'Ca tối'] as const;
const FACTORY_PLACEHOLDER = 'Nhà máy Đà Nẵng';

function isRealMachineName(name?: string) {
  const value = String(name ?? '').trim();
  return Boolean(value) && value !== FACTORY_PLACEHOLDER;
}

function resolveMachineName(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    if (isRealMachineName(candidate)) {
      return String(candidate).trim();
    }
  }
  return '—';
}

function normalizeShiftName(shiftName: string) {
  const value = shiftName.trim().toLowerCase();
  if (value.includes('sáng') || value.includes('sang')) return 'Ca sáng';
  if (value.includes('chiều') || value.includes('chieu')) return 'Ca chiều';
  if (value.includes('tối') || value.includes('toi')) return 'Ca tối';
  return shiftName.trim();
}

export interface WeighingRecord {
  id?: string | number;
  documentNo: string;
  reportDate: string;
  productionDate: string;
  shiftName: string;
  worker1: string;
  worker2: string;
  weigherName: string;
  productCode: string;
  productName: string;
  machineName: string;
  weighNo: string;
  weighTime: string;
  coreWeight: string;
  weight: string;
  imageUrl?: string;
  coreWeightImageUrl?: string;
  createdAt?: string;
}

interface WeighingSlip {
  key: string;
  documentNo: string;
  reportDate: string;
  productionDate: string;
  shiftName: string;
  worker1: string;
  worker2: string;
  machineName: string;
  rows: WeighingRecord[];
}

function formatDateVi(value: string) {
  if (!value) return '—';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function slipKey(record: WeighingRecord) {
  return [
    record.productionDate,
    record.shiftName,
    record.documentNo,
    record.reportDate,
    record.worker1,
    record.worker2
  ].join('|');
}

export function isSlipHeaderRow(row: Pick<WeighingRecord, 'weighNo' | 'productName' | 'productCode' | 'weight' | 'coreWeight' | 'imageUrl' | 'coreWeightImageUrl'>) {
  return (
    !row.weighNo?.trim() &&
    !row.productName?.trim() &&
    !row.productCode?.trim() &&
    !row.weight?.trim() &&
    !row.coreWeight?.trim() &&
    !row.imageUrl &&
    !row.coreWeightImageUrl
  );
}

export function getWeighingDataRows<T extends WeighingRecord>(rows: T[]) {
  return rows.filter(row => !isSlipHeaderRow(row));
}

function countWeighingRounds(rows: WeighingRecord[]) {
  return getWeighingDataRows(rows).length;
}

interface DateSlipGroup {
  date: string;
  slips: WeighingSlip[];
  slipCount: number;
  totalWeighRounds: number;
}

function groupSlipsByDate(slips: WeighingSlip[]): DateSlipGroup[] {
  const map = new Map<string, WeighingSlip[]>();

  slips.forEach(slip => {
    const date = slip.productionDate || slip.reportDate || '';
    const bucket = map.get(date) ?? [];
    bucket.push(slip);
    map.set(date, bucket);
  });

  return [...map.entries()]
    .map(([date, dateSlips]) => ({
      date,
      slips: [...dateSlips].sort((a, b) => b.reportDate.localeCompare(a.reportDate)),
      slipCount: dateSlips.length,
      totalWeighRounds: dateSlips.reduce((sum, slip) => sum + countWeighingRounds(slip.rows), 0)
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function groupByShift(records: WeighingRecord[]) {
  const slipMap = new Map<string, WeighingSlip>();

  records.forEach(record => {
    const key = slipKey(record);
    const existing = slipMap.get(key);
    if (existing) {
      existing.rows.push(record);
      const machineName = resolveMachineName(record.machineName, existing.machineName);
      if (machineName !== '—') {
        existing.machineName = machineName;
      }
      return;
    }

    slipMap.set(key, {
      key,
      documentNo: record.documentNo,
      reportDate: record.reportDate,
      productionDate: record.productionDate,
      shiftName: record.shiftName,
      worker1: record.worker1,
      worker2: record.worker2,
      machineName: resolveMachineName(record.machineName),
      rows: [record]
    });
  });

  const slips = [...slipMap.values()].map(slip => ({
    ...slip,
    rows: [...slip.rows].sort((a, b) => Number(a.weighNo) - Number(b.weighNo))
  }));

  return SHIFT_ORDER.map(shiftName => {
    const shiftSlips = slips
      .filter(slip => slip.shiftName === shiftName)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate));

    return {
      shiftName,
      slips: shiftSlips,
      dateGroups: groupSlipsByDate(shiftSlips),
      slipCount: shiftSlips.length,
      totalWeighRounds: shiftSlips.reduce((sum, slip) => sum + countWeighingRounds(slip.rows), 0)
    };
  });
}

function normalizeRecords(data: unknown): WeighingRecord[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      return {
        id: row.id as string | number | undefined,
        documentNo: String(row.documentNo ?? row.document_no ?? '').trim(),
        reportDate: String(row.reportDate ?? row.report_date ?? '').trim(),
        productionDate: String(row.productionDate ?? row.ngay_san_xuat ?? '').trim(),
        shiftName: normalizeShiftName(String(row.shiftName ?? row.ca_san_xuat ?? '').trim()),
        worker1: String(row.worker1 ?? row.ten_cn_1 ?? '').trim(),
        worker2: String(row.worker2 ?? row.ten_cn_2 ?? '').trim(),
        weigherName: String(row.weigherName ?? row.ten_nguoi_can ?? '').trim(),
        productCode: String(row.productCode ?? row.ma_san_pham ?? '').trim(),
        productName: String(row.productName ?? row.ten_san_pham ?? '').trim(),
        machineName: (() => {
          const raw = String(row.machineName ?? row.ten_may_san_xuat ?? '').trim();
          return isRealMachineName(raw) ? raw : '';
        })(),
        weighNo: String(row.weighNo ?? row.lan_can ?? '').trim(),
        weighTime: String(row.weighTime ?? row.gio_can ?? '').trim(),
        coreWeight: String(row.coreWeight ?? row.trong_luong_loi ?? '').trim(),
        weight: String(row.weight ?? row.trong_luong ?? '').trim(),
        imageUrl: String(row.imageUrl ?? row.anh_url ?? '').trim() || undefined,
        coreWeightImageUrl: String(row.coreWeightImageUrl ?? row.anh_trong_luong_loi_url ?? '').trim() || undefined,
        createdAt: String(row.createdAt ?? row.created_at ?? '').trim() || undefined
      } satisfies WeighingRecord;
    })
    .filter((item): item is WeighingRecord => Boolean(item));
}

export interface WeighingPendingAdd {
  productionDate: string;
  shiftName?: string;
  worker1?: string;
  worker2?: string;
  documentNo?: string;
  reportDate?: string;
  productName?: string;
  productCode?: string;
  machineName?: string;
  existingRows?: WeighingRecord[];
  editingRow?: WeighingRecord;
  createNewSlip?: boolean;
}

export function generateWeighingDocumentNo(productionDate?: string) {
  const now = new Date();
  const datePart = (productionDate || now.toISOString().split('T')[0]).replace(/-/g, '');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `P-${datePart}-${hh}${mm}${ss}-${rand}`;
}

export default function WeighingShiftSummary() {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [records, setRecords] = useState<WeighingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeShift, setActiveShift] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [activeSlipKey, setActiveSlipKey] = useState<string | null>(null);
  const [viewingRow, setViewingRow] = useState<WeighingRecord | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | number | null>(null);
  const [deletingSlipKey, setDeletingSlipKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [showReportForm, setShowReportForm] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<WeighingPendingAdd | null>(null);
  const [slipSetupOpen, setSlipSetupOpen] = useState(false);
  const [slipSetupDefaults, setSlipSetupDefaults] = useState<{ productionDate: string; shiftName?: string }>({
    productionDate: today
  });

  const handleOpenSlipSetup = (options: { productionDate: string; shiftName?: string }) => {
    setSlipSetupDefaults(options);
    setSlipSetupOpen(true);
  };

  const handleCreateSlipHeader = async (payload: SlipSetupPayload) => {
    const documentNo = generateWeighingDocumentNo(payload.productionDate);
    const headerRow = {
      productionDate: payload.productionDate,
      shiftName: payload.shiftName,
      worker1: payload.worker1,
      worker2: payload.worker2,
      machineName: payload.machineName
    };

    const res = await fetch('/api/phieu-can-dinh-ki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentNo,
        reportDate: payload.productionDate,
        productionDate: payload.productionDate,
        shiftName: payload.shiftName,
        worker1: payload.worker1,
        worker2: payload.worker2,
        rows: [headerRow]
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Không thể tạo phiếu mới.');
    }

    await loadReports();

    const newKey = slipKey({
      productionDate: payload.productionDate,
      shiftName: payload.shiftName,
      documentNo,
      reportDate: payload.productionDate,
      worker1: payload.worker1,
      worker2: payload.worker2,
      weigherName: '',
      productCode: '',
      productName: '',
      machineName: payload.machineName,
      weighNo: '',
      weighTime: '',
      coreWeight: '',
      weight: ''
    });

    setActiveShift(payload.shiftName);
    setActiveDate(payload.productionDate);
    setActiveSlipKey(newKey);
    setActionMessage('Đã tạo phiếu mới. Bấm Bổ sung lần cân để thêm dòng.');
  };

  const handleOpenReportForm = (options: WeighingPendingAdd) => {
    setPendingAdd(options);
    setShowReportForm(true);
  };

  const handleCloseReportForm = async () => {
    setShowReportForm(false);
    setPendingAdd(null);
    await loadReports();
  };

  const shiftSummaries = useMemo(() => groupByShift(records), [records]);
  const activeShiftSummary = useMemo(
    () => shiftSummaries.find(shift => shift.shiftName === activeShift) ?? null,
    [shiftSummaries, activeShift]
  );
  const activeDateGroup = useMemo(
    () => activeShiftSummary?.dateGroups.find(group => group.date === activeDate) ?? null,
    [activeShiftSummary, activeDate]
  );
  const activeSlip = useMemo(
    () => activeDateGroup?.slips.find(slip => slip.key === activeSlipKey) ?? null,
    [activeDateGroup, activeSlipKey]
  );
  const activeSlipWeighingRows = useMemo(
    () => (activeSlip ? getWeighingDataRows(activeSlip.rows) : []),
    [activeSlip]
  );
  const totalSlips = shiftSummaries.reduce((sum, shift) => sum + shift.slipCount, 0);
  const totalRounds = shiftSummaries.reduce((sum, shift) => sum + shift.totalWeighRounds, 0);

  const loadReports = async () => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ ngay: selectedDate });
      const res = await fetch(`/api/phieu-can-dinh-ki?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải báo cáo cân.');
      }

      setRecords(normalizeRecords(data));
    } catch (err: any) {
      setError(err.message || 'Không thể tải báo cáo cân.');
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    setActiveShift(null);
    setActiveDate(null);
    setActiveSlipKey(null);
    setViewingRow(null);
    setActionMessage('');
  }, [selectedDate]);

  const handleDeleteRow = async (row: WeighingRecord) => {
    if (!row.id) {
      setActionMessage('Không tìm thấy ID dòng để xóa.');
      return;
    }

    if (!window.confirm('Bạn có chắc muốn xóa dòng cân này?')) return;

    setDeletingRowId(row.id);
    setActionMessage('');

    try {
      const res = await fetch(`/api/phieu-can-dinh-ki/${row.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xóa dòng cân.');
      }

      setActionMessage('Đã xóa dòng cân.');
      if (viewingRow?.id === row.id) setViewingRow(null);
      await loadReports();
    } catch (err: any) {
      setActionMessage(err.message || 'Không thể xóa dòng cân.');
    } finally {
      setDeletingRowId(null);
    }
  };

  const handleEditRow = (row: WeighingRecord) => {
    if (!activeSlip) return;

    handleOpenReportForm({
      productionDate: activeSlip.productionDate,
      shiftName: activeSlip.shiftName,
      worker1: activeSlip.worker1,
      worker2: activeSlip.worker2,
      documentNo: activeSlip.documentNo,
      reportDate: activeSlip.reportDate,
      productName: row.productName,
      existingRows: activeSlip.rows,
      editingRow: row
    });
  };

  const handleEditSlip = (slip: WeighingSlip) => {
    handleOpenReportForm({
      productionDate: slip.productionDate,
      shiftName: slip.shiftName,
      worker1: slip.worker1,
      worker2: slip.worker2,
      documentNo: slip.documentNo,
      reportDate: slip.reportDate,
      productCode: slip.rows[0]?.productCode,
      productName: slip.rows[0]?.productName,
      machineName: (() => {
        const name = resolveMachineName(slip.machineName, ...slip.rows.map(row => row.machineName));
        return name !== '—' ? name : undefined;
      })(),
      existingRows: slip.rows
    });
  };

  const handleDeleteSlip = async (slip: WeighingSlip) => {
    const deletableRows = slip.rows.filter(row => row.id);
    if (deletableRows.length === 0) {
      setActionMessage('Không tìm thấy ID dòng trong phiếu để xóa.');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa phiếu ${slip.documentNo || '—'} và toàn bộ ${deletableRows.length} dòng liên quan?`)) {
      return;
    }

    setDeletingSlipKey(slip.key);
    setActionMessage('');

    try {
      for (const row of deletableRows) {
        const res = await fetch(`/api/phieu-can-dinh-ki/${row.id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Không thể xóa phiếu.');
        }
      }

      if (activeSlipKey === slip.key) {
        setActiveSlipKey(null);
      }
      setActionMessage('Đã xóa phiếu.');
      await loadReports();
    } catch (err: any) {
      setActionMessage(err.message || 'Không thể xóa phiếu.');
    } finally {
      setDeletingSlipKey(null);
    }
  };

  const goBack = () => {
    if (activeSlipKey) {
      setActiveSlipKey(null);
      return;
    }
    if (activeDate) {
      setActiveDate(null);
      return;
    }
    if (activeShift) {
      setActiveShift(null);
    }
  };

  if (showReportForm) {
    return (
      <div className="relative space-y-3 pb-28">
        <button
          type="button"
          onClick={handleCloseReportForm}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-600 shadow-sm transition hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Phiếu cân ca
        </button>
        <WeighingReportForm
          pendingAdd={pendingAdd}
          onPendingAddHandled={() => setPendingAdd(null)}
        />
      </div>
    );
  }

  return (
    <div className="relative space-y-4 pb-28">
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 gap-3 border-b border-zinc-100 bg-zinc-50 p-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Tổng phiếu</p>
            <p className="mt-1 text-2xl font-black text-zinc-900">{totalSlips}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Tổng lần cân</p>
            <p className="mt-1 text-2xl font-black text-[#ef1b2d]">{totalRounds}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Ngày xem</p>
            <p className="mt-1 text-sm font-black text-zinc-900">{formatDateVi(selectedDate)}</p>
          </div>
        </div>

        <div className="border-b-4 border-[#ef1b2d] bg-white p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={vietNhatLogoUrl} alt="Viet Nhat IPT" className="h-14 w-auto max-w-[190px] object-contain" />
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-zinc-950">Tổng hợp báo cáo cân</h2>
                <p className="mt-1 text-xs font-semibold text-zinc-500">Theo dõi phiếu cân theo từng ca sản xuất</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[160px] flex-1 space-y-1 sm:max-w-[200px]">
                <span className="flex items-center gap-1 text-xs font-bold text-zinc-600">
                  <CalendarDays className="h-3.5 w-3.5 text-[#ef1b2d]" />
                  Ngày sản xuất
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
                />
              </label>
              <button
                type="button"
                onClick={loadReports}
                disabled={isLoading}
                className="flex h-11 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Làm mới
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

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white py-16 text-sm font-bold text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#ef1b2d]" />
          Đang tải báo cáo các ca...
        </div>
      ) : activeSlip && activeShiftSummary && activeDateGroup ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
            <button
              type="button"
              onClick={goBack}
              className="flex h-9 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-zinc-900">Phiếu {activeSlip.documentNo || '—'}</p>
              <p className="truncate text-xs font-semibold text-zinc-500">
                {activeShiftSummary.shiftName} · {formatDateVi(activeDateGroup.date)}
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-zinc-600 md:grid-cols-3">
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <Users className="h-3.5 w-3.5" /> CN 1
                </span>
                <p className="mt-1 font-bold text-zinc-800">{activeSlip.worker1 || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <Users className="h-3.5 w-3.5" /> CN 2
                </span>
                <p className="mt-1 font-bold text-zinc-800">{activeSlip.worker2 || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  <Factory className="h-3.5 w-3.5" /> Tên máy
                </span>
                <p className="mt-1 font-bold text-zinc-800">
                  {resolveMachineName(activeSlip.machineName, ...activeSlip.rows.map(row => row.machineName))}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              {actionMessage && (
                <p className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-bold text-[#ef1b2d]">
                  {actionMessage}
                </p>
              )}
              <table className="w-full min-w-[960px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-zinc-950 text-[10px] font-black uppercase tracking-wider text-white">
                    <th className="px-3 py-2 text-center">Lần</th>
                    <th className="px-3 py-2">Người cân</th>
                    <th className="px-3 py-2">TL lõi</th>
                    <th className="px-3 py-2">Trọng lượng</th>
                    <th className="px-3 py-2">Giờ</th>
                    <th className="px-3 py-2">Ảnh TL lõi</th>
                    <th className="px-3 py-2">Ảnh</th>
                    <th className="px-3 py-2 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {activeSlipWeighingRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm font-semibold text-zinc-400">
                        Chưa có lần cân. Bấm Bổ sung lần cân để thêm dòng.
                      </td>
                    </tr>
                  ) : (
                  activeSlipWeighingRows.map((row, index) => (
                    <tr key={row.id ?? `${activeSlip.key}-${index}`}>
                      <td className="px-3 py-2 text-center font-black text-zinc-800">{row.weighNo || index + 1}</td>
                      <td className="px-3 py-2 font-semibold text-zinc-600">{row.weigherName || '—'}</td>
                      <td className="px-3 py-2 font-semibold text-zinc-700">{row.coreWeight || '—'}</td>
                      <td className="px-3 py-2 font-bold text-zinc-900">{row.weight || '—'}</td>
                      <td className="px-3 py-2 font-semibold text-zinc-600">{row.weighTime || '—'}</td>
                      <td className="px-3 py-2">
                        {row.coreWeightImageUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingImage({ url: row.coreWeightImageUrl!, title: 'Ảnh trọng lượng lõi' })}
                            className="block h-12 w-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition hover:border-[#ef1b2d]"
                          >
                            <img src={row.coreWeightImageUrl} alt="Ảnh trọng lượng lõi" crossOrigin="anonymous" className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-zinc-300">Chưa có</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewingImage({ url: row.imageUrl!, title: 'Ảnh cân' })}
                            className="block h-12 w-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition hover:border-[#ef1b2d]"
                          >
                            <img src={row.imageUrl} alt="Ảnh cân" crossOrigin="anonymous" className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-zinc-300">Chưa có</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingRow(row)}
                            title="Xem"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditRow(row)}
                            title="Sửa"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row)}
                            disabled={deletingRowId === row.id}
                            title="Xóa"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingRowId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleOpenReportForm({
                  productionDate: activeSlip.productionDate,
                  shiftName: activeSlip.shiftName,
                  worker1: activeSlip.worker1,
                  worker2: activeSlip.worker2,
                  documentNo: activeSlip.documentNo,
                  reportDate: activeSlip.reportDate,
                  productCode: activeSlip.rows[0]?.productCode,
                  productName: activeSlip.rows[0]?.productName,
                  machineName: (() => {
                    const name = resolveMachineName(
                      activeSlip.machineName,
                      ...activeSlip.rows.map(row => row.machineName)
                    );
                    return name !== '—' ? name : undefined;
                  })(),
                  existingRows: activeSlip.rows
                })}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#b30d1c]"
              >
                <Plus className="h-4 w-4" />
                Bổ sung lần cân
              </button>
            </div>
          </div>
        </section>
      ) : activeDateGroup && activeShiftSummary ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={goBack}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-zinc-900">{formatDateVi(activeDateGroup.date)}</p>
                <p className="truncate text-xs font-semibold text-zinc-500">{activeShiftSummary.shiftName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenSlipSetup({
                productionDate: activeDateGroup.date || selectedDate,
                shiftName: activeShiftSummary.shiftName
              })}
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-xs font-bold text-[#ef1b2d] transition hover:bg-red-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm
            </button>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {activeDateGroup.slips.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm font-semibold text-zinc-400">
                Chưa có phiếu cho ngày này.
              </p>
            ) : (
              activeDateGroup.slips.map(slip => {
                const machineLabel = resolveMachineName(
                  slip.machineName,
                  ...slip.rows.map(row => row.machineName)
                );

                return (
                  <div
                    key={slip.key}
                    className="rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-red-200 hover:bg-red-50/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSlipKey(slip.key)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="flex items-center gap-1.5 text-sm font-black text-zinc-900">
                          <ClipboardList className="h-4 w-4 shrink-0 text-[#ef1b2d]" />
                          Phiếu {slip.documentNo || '—'}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditSlip(slip)}
                          title="Sửa phiếu"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-[#ef1b2d] transition hover:bg-red-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSlip(slip)}
                          disabled={deletingSlipKey === slip.key}
                          title="Xóa phiếu"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingSlipKey === slip.key ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSlipKey(slip.key)}
                          title="Xem phiếu"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-zinc-600">
                      {slip.worker1 || '—'}
                      {slip.worker2 ? ` · ${slip.worker2}` : ''}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      {countWeighingRounds(slip.rows)} lần cân
                      {machineLabel !== '—' ? ` · ${machineLabel}` : ''}
                    </p>
                    {machineLabel !== '—' && (
                    <span className="mt-3 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#ef1b2d]">
                      {machineLabel}
                    </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : activeShiftSummary ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={goBack}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase tracking-wider text-zinc-900">{activeShiftSummary.shiftName}</p>
                <p className="truncate text-xs font-semibold text-zinc-500">
                  {activeShiftSummary.slipCount} phiếu · {activeShiftSummary.totalWeighRounds} lần cân
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {activeShiftSummary.dateGroups.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm font-semibold text-zinc-400">
                Chưa có báo cáo cho ca này.
              </p>
            ) : (
              activeShiftSummary.dateGroups.map(dateGroup => (
                <button
                  key={`${activeShiftSummary.shiftName}-${dateGroup.date || 'unknown'}`}
                  type="button"
                  onClick={() => setActiveDate(dateGroup.date)}
                  className="rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-red-200 hover:bg-red-50/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 shrink-0 text-[#ef1b2d]" />
                      <p className="text-sm font-black text-zinc-900">{formatDateVi(dateGroup.date)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-zinc-500">
                    {dateGroup.slipCount} phiếu · {dateGroup.totalWeighRounds} lần cân
                  </p>
                </button>
              ))
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          {shiftSummaries.map(shift => {
            const machines = [
              ...new Set(
                shift.slips.flatMap(slip => {
                  const name = resolveMachineName(
                    slip.machineName,
                    ...slip.rows.map(row => row.machineName)
                  );
                  return name !== '—' ? [name] : [];
                })
              )
            ];

            return (
              <section key={shift.shiftName} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setActiveShift(shift.shiftName)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left transition hover:opacity-80"
                  >
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900">{shift.shiftName}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                        {shift.slipCount} phiếu · {shift.totalWeighRounds} lần cân
                        {machines.length > 0 ? ` · ${machines.length} máy` : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => handleOpenSlipSetup({ productionDate: selectedDate })}
        className="fixed bottom-24 right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-[#ef1b2d] px-5 text-sm font-extrabold text-white shadow-lg shadow-red-500/30 transition hover:bg-[#b30d1c] sm:hidden"
      >
        <Plus className="h-5 w-5" />
        Thêm báo cáo
      </button>

      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">{viewingImage.title}</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-400">Click Đóng để quay lại bảng cân</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="h-9 rounded-lg bg-[#ef1b2d] px-3 text-xs font-bold text-white transition hover:bg-[#b30d1c]"
              >
                Đóng
              </button>
            </div>
            <div className="flex max-h-[calc(90vh-58px)] items-center justify-center bg-black p-3">
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                crossOrigin="anonymous"
                className="max-h-[calc(90vh-82px)] max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {viewingRow && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Chi tiết dòng cân</h3>
                <p className="mt-0.5 text-xs font-semibold text-zinc-500">
                  Lần {viewingRow.weighNo || '—'} · {viewingRow.weighTime || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingRow(null)}
                className="h-9 rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 text-xs">
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">TL lõi</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.coreWeight || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Trọng lượng</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.weight || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Mã SP</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.productCode || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Sản phẩm</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.productName || '—'}</p>
              </div>
              <div className="col-span-2 rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Người cân</span>
                <p className="mt-1 font-bold text-zinc-800">{viewingRow.weigherName || '—'}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Ảnh TL lõi</span>
                {viewingRow.coreWeightImageUrl ? (
                  <a href={viewingRow.coreWeightImageUrl} target="_blank" rel="noreferrer" className="mt-2 block h-24 overflow-hidden rounded-lg border border-zinc-200">
                    <img src={viewingRow.coreWeightImageUrl} alt="Ảnh TL lõi" className="h-full w-full object-cover" />
                  </a>
                ) : (
                  <p className="mt-1 font-semibold text-zinc-400">Chưa có</p>
                )}
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2">
                <span className="font-black uppercase tracking-wider text-zinc-400">Ảnh cân</span>
                {viewingRow.imageUrl ? (
                  <a href={viewingRow.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block h-24 overflow-hidden rounded-lg border border-zinc-200">
                    <img src={viewingRow.imageUrl} alt="Ảnh cân" className="h-full w-full object-cover" />
                  </a>
                ) : (
                  <p className="mt-1 font-semibold text-zinc-400">Chưa có</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              {activeSlip && (
                <button
                  type="button"
                  onClick={() => {
                    setViewingRow(null);
                    handleEditRow(viewingRow);
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-[#ef1b2d] transition hover:bg-red-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Sửa
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingRow(null)}
                className="h-9 rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white transition hover:bg-zinc-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <WeighingSlipSetupModal
        open={slipSetupOpen}
        initialProductionDate={slipSetupDefaults.productionDate}
        initialShiftName={slipSetupDefaults.shiftName}
        onClose={() => setSlipSetupOpen(false)}
        onCreate={handleCreateSlipHeader}
      />
    </div>
  );
}
