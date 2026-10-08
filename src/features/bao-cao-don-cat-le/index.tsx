import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { useTabAccess } from '../../app/useTabAccess';
import { formatDateVN, VnCalendarPicker } from '../so-che-do-may';
import { readApiErrorMessage } from '../../lib/appToast';
import { exportBaoCaoCatLe } from '../_shared/catLeExcel';

type TongHopRow = {
  maHang: string;
  tenHang?: string;
  dvt: string;
  dvc: string;
  maMoi?: string[];
  nhomVthh?: string;
  dauSl: number;
  dauDvc: number;
  dauTien: number;
  nhapSl: number;
  nhapDvc: number;
  nhapTien: number;
  xuatSl: number;
  xuatDvc: number;
  xuatTien: number;
  cuoiSl: number;
  cuoiDvc: number;
  cuoiTien: number;
};

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
const moneyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

function formatQty(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value);
  return numberFormat.format(Number.isFinite(n) ? n : 0);
}

function formatMoney(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value);
  return moneyFormat.format(Number.isFinite(n) ? n : 0);
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

export function BaoCaoDonCatLePanel({ onBack }: { onBack: () => void }) {
  useTabAccess('bao-cao-don-cat-le');
  const [rows, setRows] = useState<TongHopRow[]>([]);
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
        const res = await fetch(`/api/bao-cao-cat-le-tong-hop?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được báo cáo cắt lẻ.'));
        setRows(Array.isArray(data.records) ? data.records : []);
      } catch (err: unknown) {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Không tải được báo cáo cắt lẻ.');
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

  const totals = useMemo(() => {
    const sum = (pick: (r: TongHopRow) => number) =>
      Math.round(visible.reduce((s, r) => s + (Number(pick(r)) || 0), 0) * 1000) / 1000;
    return {
      dauSl: sum(r => r.dauSl),
      dauDvc: sum(r => r.dauDvc),
      dauTien: sum(r => r.dauTien),
      nhapSl: sum(r => r.nhapSl),
      nhapDvc: sum(r => r.nhapDvc),
      nhapTien: sum(r => r.nhapTien),
      xuatSl: sum(r => r.xuatSl),
      xuatDvc: sum(r => r.xuatDvc),
      xuatTien: sum(r => r.xuatTien),
      cuoiSl: sum(r => r.cuoiSl),
      cuoiDvc: sum(r => r.cuoiDvc),
      cuoiTien: sum(r => r.cuoiTien)
    };
  }, [visible]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-lg font-black text-zinc-900">Báo cáo đơn cắt lẻ</h2>
          <p className="text-xs font-semibold text-zinc-500">
            Tổng hợp tồn kho cắt lẻ: mã AMIS cũ gộp các mã AMIS trong sổ nhập kho. Số liệu từ phiếu nhập/xuất kho.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportBaoCaoCatLe(visible, from, to)}
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
          Tổng hợp {loading ? '(đang tải...)' : `(${visible.length})`}
        </div>
        {error ? <p className="px-3 py-2 text-xs font-bold text-red-600">{error}</p> : null}
        <div className="h-full overflow-auto">
          <table className="w-full min-w-[1180px] text-left text-xs">
            <thead className="sticky top-0 bg-zinc-50 text-[10px] uppercase text-zinc-500">
              <tr>
                <th rowSpan={2} className="px-3 py-2">Mã hàng</th>
                <th rowSpan={2} className="px-3 py-2">Tên hàng</th>
                <th rowSpan={2} className="px-3 py-2">ĐVT</th>
                <th rowSpan={2} className="px-3 py-2">ĐVC</th>
                <th colSpan={3} className="border-x px-3 py-2 text-center">Đầu kỳ</th>
                <th colSpan={3} className="border-x px-3 py-2 text-center">Nhập kho</th>
                <th colSpan={3} className="border-x px-3 py-2 text-center">Xuất kho</th>
                <th colSpan={3} className="border-x px-3 py-2 text-center">Cuối kỳ</th>
              </tr>
              <tr>
                <th className="border-x px-3 py-2 text-right">Số lượng</th>
                <th className="px-3 py-2 text-right">SL theo ĐVC</th>
                <th className="border-x px-3 py-2 text-right">Giá trị</th>
                <th className="border-x px-3 py-2 text-right">Số lượng</th>
                <th className="px-3 py-2 text-right">SL theo ĐVC</th>
                <th className="border-x px-3 py-2 text-right">Giá trị</th>
                <th className="border-x px-3 py-2 text-right">Số lượng</th>
                <th className="px-3 py-2 text-right">SL theo ĐVC</th>
                <th className="border-x px-3 py-2 text-right">Giá trị</th>
                <th className="border-x px-3 py-2 text-right">Số lượng</th>
                <th className="px-3 py-2 text-right">SL theo ĐVC</th>
                <th className="px-3 py-2 text-right">Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.maHang} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-black text-zinc-900">{row.maHang}</p>
                    {(row.maMoi || []).length > 0 ? (
                      <p className="max-w-[240px] truncate text-[11px] font-semibold text-zinc-500" title={(row.maMoi || []).join(', ')}>
                        {(row.maMoi || []).slice(0, 2).join(', ')}
                        {(row.maMoi || []).length > 2 ? ` +${(row.maMoi || []).length - 2}` : ''}
                      </p>
                    ) : null}
                  </td>
                  <td className="min-w-[220px] px-3 py-2 font-semibold break-words whitespace-normal text-zinc-700">
                    {row.tenHang || '—'}
                  </td>
                  <td className="px-3 py-2 font-semibold">{row.dvt}</td>
                  <td className="px-3 py-2 font-semibold">{row.dvc}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatQty(row.dauSl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatQty(row.dauDvc)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatMoney(row.dauTien)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatQty(row.nhapSl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatQty(row.nhapDvc)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatMoney(row.nhapTien)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatQty(row.xuatSl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatQty(row.xuatDvc)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatMoney(row.xuatTien)}</td>
                  <td className="border-x px-3 py-2 text-right font-black tabular-nums">{formatQty(row.cuoiSl)}</td>
                  <td className="px-3 py-2 text-right font-black tabular-nums">{formatQty(row.cuoiDvc)}</td>
                  <td className="px-3 py-2 text-right font-black tabular-nums">{formatMoney(row.cuoiTien)}</td>
                </tr>
              ))}
              {visible.length > 0 ? (
                <tr className="border-t-2 bg-zinc-50 font-black">
                  <td colSpan={4} className="px-3 py-2">Tổng cộng</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatQty(totals.dauSl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatQty(totals.dauDvc)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatMoney(totals.dauTien)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatQty(totals.nhapSl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatQty(totals.nhapDvc)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatMoney(totals.nhapTien)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatQty(totals.xuatSl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatQty(totals.xuatDvc)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatMoney(totals.xuatTien)}</td>
                  <td className="border-x px-3 py-2 text-right tabular-nums">{formatQty(totals.cuoiSl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatQty(totals.cuoiDvc)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.cuoiTien)}</td>
                </tr>
              ) : null}
              {visible.length === 0 && !loading && !error ? (
                <tr>
                  <td colSpan={16} className="px-3 py-8 text-center font-bold text-zinc-400">
                    Chưa có dữ liệu cắt lẻ trong kỳ.
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
