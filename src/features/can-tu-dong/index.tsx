import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Scale } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import WeighingImagePreviewModal, {
  WeighingImageThumbnail,
  type WeighingPreviewImage
} from '../../components/WeighingImagePreviewModal';
import { formatNumber } from '../../utils';
import { readApiErrorMessage, showAppToast } from '../../lib/appToast';

export type CanTuDongRecord = {
  id: number | string;
  event_id?: string | null;
  qr_code?: string | null;
  weight?: number | string | null;
  tare_weight?: number | string | null;
  net_weight?: number | string | null;
  unit?: string | null;
  captured_at?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  preview_url?: string | null;
  device_id?: string | null;
  weight_source?: string | null;
  qr_source?: string | null;
  weight_kind?: string | null;
  status?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultFromDate(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(0, days - 1));
  return d.toISOString().slice(0, 10);
}

function formatDateTime(value?: string | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatWeight(value?: number | string | null, unit?: string | null) {
  if (value == null || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) return String(value);
  const unitLabel = String(unit ?? 'kg').trim() || 'kg';
  return `${formatNumber(num)} ${unitLabel}`;
}

function statusClass(status?: string | null) {
  const key = String(status ?? '')
    .trim()
    .toLowerCase();
  if (key === 'confirmed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (key === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (key === 'rejected' || key === 'error') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-zinc-50 text-zinc-600 border-zinc-200';
}

function resolvePreviewUrl(row: CanTuDongRecord) {
  return String(row.preview_url || row.image_url || '').trim();
}

export function CanTuDongPanel({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<CanTuDongRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState(() => defaultFromDate(14));
  const [toDate, setToDate] = useState(() => todayIso());
  const [deviceFilter, setDeviceFilter] = useState('');
  const [qrFilter, setQrFilter] = useState('');
  const [viewingImage, setViewingImage] = useState<WeighingPreviewImage | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (deviceFilter.trim()) params.set('deviceId', deviceFilter.trim());
      if (qrFilter.trim()) params.set('qrCode', qrFilter.trim());

      const res = await fetch(`/api/can-tu-dong?${params.toString()}`);
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, 'Không tải được cân tự động.'));
      }
      const payload = await res.json();
      setRecords(Array.isArray(payload?.records) ? payload.records : []);
    } catch (err: any) {
      const message = err?.message || 'Không tải được cân tự động.';
      setError(message);
      setRecords([]);
      showAppToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ load lần đầu; lọc bằng nút Tải lại
  }, []);

  const deviceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of records) {
      const id = String(row.device_id ?? '').trim();
      if (id) set.add(id);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [records]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <BackButton onClick={onBack} />
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#ef1b2d]/10 text-[#ef1b2d]">
              <Scale className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-black text-zinc-900 sm:text-xl">Cân tự động</h1>
              <p className="text-xs font-semibold text-zinc-500">
                Bảng <span className="font-mono">can_tu_dong</span> · ảnh mở modal khi nhấn
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadRecords()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#ef1b2d] px-3 text-xs font-bold text-white transition hover:bg-[#b30d1c] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Tải lại
        </button>
      </div>

      <div className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
          Từ ngày
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]"
          />
        </label>
        <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
          Đến ngày
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]"
          />
        </label>
        <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400">
          Thiết bị
          <input
            list="can-tu-dong-devices"
            value={deviceFilter}
            onChange={e => setDeviceFilter(e.target.value)}
            placeholder="station-01"
            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]"
          />
          <datalist id="can-tu-dong-devices">
            {deviceOptions.map(id => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </label>
        <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 sm:col-span-2 lg:col-span-1">
          Mã QR
          <input
            value={qrFilter}
            onChange={e => setQrFilter(e.target.value)}
            placeholder="ROLL-..."
            className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]"
          />
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={() => void loadRecords()}
            disabled={loading}
            className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60"
          >
            Áp dụng lọc
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] font-black uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5">Ảnh</th>
                <th className="whitespace-nowrap px-3 py-2.5">Thời điểm</th>
                <th className="whitespace-nowrap px-3 py-2.5">QR</th>
                <th className="whitespace-nowrap px-3 py-2.5">Net</th>
                <th className="whitespace-nowrap px-3 py-2.5">Gross</th>
                <th className="whitespace-nowrap px-3 py-2.5">Tare</th>
                <th className="whitespace-nowrap px-3 py-2.5">Thiết bị</th>
                <th className="whitespace-nowrap px-3 py-2.5">Trạng thái</th>
                <th className="whitespace-nowrap px-3 py-2.5">Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm font-semibold text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải cân tự động…
                    </span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm font-semibold text-zinc-500">
                    Không có bản ghi trong khoảng lọc.
                  </td>
                </tr>
              ) : (
                records.map(row => {
                  const previewUrl = resolvePreviewUrl(row);
                  const title = `Ảnh cân · ${row.qr_code || row.event_id || row.id}`;
                  return (
                    <tr key={String(row.id)} className="border-t border-zinc-100 hover:bg-zinc-50/70">
                      <td className="px-3 py-2 align-middle">
                        {previewUrl ? (
                          <WeighingImageThumbnail
                            url={previewUrl}
                            alt={title}
                            title="Xem ảnh cân"
                            onView={() => setViewingImage({ url: previewUrl, title })}
                          />
                        ) : (
                          <span className="inline-flex h-12 w-16 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-[10px] font-bold text-zinc-400">
                            Không ảnh
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-700">
                        {formatDateTime(row.captured_at || row.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-zinc-900">
                        {row.qr_code || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold text-zinc-900">
                        {formatWeight(row.net_weight, row.unit)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-700">
                        {formatWeight(row.weight, row.unit)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-600">
                        {formatWeight(row.tare_weight, row.unit)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-zinc-700">
                        {row.device_id || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${statusClass(row.status)}`}
                        >
                          {row.status || '—'}
                        </span>
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 font-semibold text-zinc-500" title={String(row.weight_source || '')}>
                        {row.weight_source || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && records.length > 0 ? (
          <div className="border-t border-zinc-100 px-3 py-2 text-[11px] font-semibold text-zinc-500">
            {records.length} bản ghi
          </div>
        ) : null}
      </div>

      <WeighingImagePreviewModal image={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  );
}

export default CanTuDongPanel;
