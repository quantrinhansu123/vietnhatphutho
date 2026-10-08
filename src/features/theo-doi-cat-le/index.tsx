import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { readApiErrorMessage } from '../../lib/appToast';
import { VnCalendarPicker, formatDateVN } from '../so-che-do-may';
import { exportTheoDoiCatLe } from '../_shared/catLeExcel';

type TrackRow = {
  maHang: string;
  tenHang?: string;
  maMoi?: string[];
  donVi: string;
  nhomVthh?: string;
  ngayCat?: string;
  tonDau: number;
  tonDauKg: number;
  nhap: number;
  nhapKg: number;
  xuat: number;
  xuatKg: number;
  tonCuoi: number;
  tonCuoiKg: number;
  tonCuoiTien: number;
  // Tương thích payload cũ.
  ton?: number;
};

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

function formatQty(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value);
  return numberFormat.format(Number.isFinite(n) ? n : 0);
}

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function firstDayOfMonthISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return `${d.toISOString().slice(0, 7)}-01`;
}

const NHOM_OPTIONS = [
  { value: 'all', label: 'Tất cả VTHH' },
  { value: 'dac', label: 'Đặc' },
  { value: 'song', label: 'Sóng' },
  { value: 'rong', label: 'Rỗng' },
  { value: 'khac', label: 'Khác' }
];

const selectClass =
  'h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400';

export function TheoDoiCatLePanel({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [nhom, setNhom] = useState('all');

  const loadRows = useCallback(
    async (queryFrom?: string, queryTo?: string, queryNhom?: string) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        const f = (queryFrom ?? from).trim();
        const t = (queryTo ?? to).trim();
        const n = (queryNhom ?? nhom).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(f)) params.set('from', f);
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) params.set('to', t);
        if (n && n !== 'all') params.set('nhom', n);
        const res = await fetch(`/api/theo-doi-cat-le?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được theo dõi cắt lẻ.'));
        setRows(Array.isArray(data.records) ? data.records : []);
      } catch (err: unknown) {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Không tải được theo dõi cắt lẻ.');
      } finally {
        setLoading(false);
      }
    },
    [from, to, nhom]
  );

  useEffect(() => {
    void loadRows();
    // Chỉ tải 1 lần khi mở màn hình; đổi lọc thì bấm Xem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi');
    if (!q) return rows;
    return rows.filter(
      row =>
        row.maHang.toLocaleLowerCase('vi').includes(q) ||
        (row.tenHang || '').toLocaleLowerCase('vi').includes(q) ||
        (row.maMoi || []).some(code => code.toLocaleLowerCase('vi').includes(q))
    );
  }, [query, rows]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-lg font-black text-zinc-900">Theo dõi cắt lẻ</h2>
          <p className="text-xs font-semibold text-zinc-500">
            Mã cắt mới gộp theo mã AMIS cũ. Tồn cuối tính từ ngày đến ngày.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportTheoDoiCatLe(
              visible.map(row => ({
                maHang: row.maHang,
                tenHang: row.tenHang,
                maMoi: row.maMoi,
                donVi: row.donVi,
                nhomVthh: row.nhomVthh,
                ngayCat: row.ngayCat,
                tonDau: row.tonDau || 0,
                tonDauKg: row.tonDauKg || 0,
                nhap: row.nhap || 0,
                nhapKg: row.nhapKg || 0,
                xuat: row.xuat || 0,
                xuatKg: row.xuatKg || 0,
                tonCuoi: row.tonCuoi ?? row.ton ?? 0,
                tonCuoiKg: row.tonCuoiKg || 0,
                tonCuoiTien: row.tonCuoiTien || 0
              })),
              from,
              to
            )
          }
          disabled={loading || visible.length === 0}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-xs font-black text-emerald-800 disabled:opacity-50"
        >
          <Download size={14} /> Export Excel
        </button>
      </div>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-5">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Từ ngày</span>
          <VnCalendarPicker value={from} onChange={setFrom} />
          <p className="text-[11px] font-semibold text-zinc-600">{from ? formatDateVN(from) : '—'}</p>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Đến ngày</span>
          <VnCalendarPicker value={to} onChange={setTo} />
          <p className="text-[11px] font-semibold text-zinc-600">{to ? formatDateVN(to) : '—'}</p>
        </div>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Sản phẩm VTHH</span>
          <select value={nhom} onChange={e => setNhom(e.target.value)} className={selectClass}>
            {NHOM_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Tìm mã hàng</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Mã AMIS cũ hoặc mã mới"
            className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void loadRows()}
            disabled={loading}
            className="h-11 w-full rounded-lg bg-zinc-900 px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {loading ? 'Đang xem...' : 'Xem'}
          </button>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b px-3 py-2 text-xs font-black uppercase text-zinc-600">
          Danh sách {loading ? '(đang tải...)' : `(${visible.length})`}
        </div>
        {error ? <p className="px-3 py-2 text-xs font-bold text-red-600">{error}</p> : null}
        <div className="h-full overflow-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="sticky top-0 bg-zinc-50 text-[10px] uppercase text-zinc-500">
              <tr>
                <th className="w-14 px-3 py-2">STT</th>
                <th className="px-3 py-2">Mã hàng</th>
                <th className="px-3 py-2 text-right">Tồn cuối</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.maHang} className="border-t">
                  <td className="px-3 py-2 font-black tabular-nums text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2">
                    <p className="font-black text-zinc-900">{row.maHang}</p>
                    {row.tenHang ? <p className="text-[11px] font-semibold text-zinc-500">{row.tenHang}</p> : null}
                    {row.ngayCat ? <p className="text-[11px] font-semibold text-zinc-400">Ngày cắt: {formatDateVN(row.ngayCat)}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-right font-black tabular-nums">{formatQty(row.tonCuoi ?? row.ton ?? 0)}</td>
                </tr>
              ))}
              {visible.length === 0 && !loading && !error ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có sản phẩm cắt lẻ để theo dõi.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
