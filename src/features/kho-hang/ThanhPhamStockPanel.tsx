import { useEffect, useMemo, useState } from 'react';
import { SoTronDatePicker } from '../so-tron/SoTronDatePicker';

export type ThanhPhamStockMetric = {
  sl: number;
  kg: number;
  m_dai: number;
  m2: number;
};

export type ThanhPhamStockRow = {
  ma_sp: string;
  ma_qr?: string;
  ma_sp_full?: string;
  ten_sp: string;
  tinh_chat?: string;
  don_vi: string;
  nhom_vthh: string;
  loai_kho: string;
  ten_kho: string;
  tong_tl_kg?: number;
  ton_dau: ThanhPhamStockMetric;
  nhap: ThanhPhamStockMetric;
  xuat: ThanhPhamStockMetric;
  ton_cuoi: ThanhPhamStockMetric;
};

function formatQty(value: number | undefined) {
  if (!Number.isFinite(value)) return '—';
  return String(value);
}

function formatKg(value: number | undefined) {
  if (!Number.isFinite(value)) return '—';
  return `${value}`;
}

type Props = {
  warehouseName: string;
  topControls?: React.ReactNode;
  onBack?: () => void;
};

/**
 * /kho-hang → Kho thành phẩm (một màn).
 * Từ ngày → Đến ngày → danh sách SP từ nhap_kho (thanh_pham) gộp mã+tên;
 * Tồn đầu / Nhập / Xuất lấy từ phiếu nhập xuất kho.
 */
export function ThanhPhamStockPanel({ warehouseName, topControls, onBack }: Props) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<ThanhPhamStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const canLoad = Boolean(fromDate && toDate);

  const load = async () => {
    if (!fromDate || !toDate) {
      setRows([]);
      setHasLoaded(false);
      setError('');
      return;
    }
    if (fromDate > toDate) {
      setRows([]);
      setHasLoaded(false);
      setError('Từ ngày không được lớn hơn Đến ngày.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (warehouseName.trim()) params.set('ten_kho', warehouseName.trim());
      params.set('from', fromDate);
      params.set('to', toDate);
      if (keyword.trim()) params.set('q', keyword.trim());
      const response = await fetch(`/api/nhap-kho?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Không thể tải danh sách nhập kho thành phẩm.');
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setHasLoaded(true);
    } catch (err) {
      setRows([]);
      setHasLoaded(true);
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách nhập kho thành phẩm.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canLoad) {
      setRows([]);
      setHasLoaded(false);
      setError('');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseName, fromDate, toDate]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLocaleLowerCase('vi');
    if (!q) return rows;
    return rows.filter(
      row =>
        row.ma_sp.toLocaleLowerCase('vi').includes(q) ||
        String(row.ma_qr || '')
          .toLocaleLowerCase('vi')
          .includes(q) ||
        row.ten_sp.toLocaleLowerCase('vi').includes(q) ||
        row.nhom_vthh.toLocaleLowerCase('vi').includes(q) ||
        String(row.tinh_chat || '')
          .toLocaleLowerCase('vi')
          .includes(q)
    );
  }, [keyword, rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {topControls}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
          >
            Quay lại
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
            <SoTronDatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Đến ngày</span>
            <SoTronDatePicker value={toDate} onChange={setToDate} />
          </div>
          <label className="min-w-[200px] flex-1 space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Tìm SP</span>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d]"
              placeholder="Mã / QR / tên / tính chất / nhóm"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={!canLoad || loading}
            className="rounded-lg bg-[#ef1b2d] px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-[#d41424] disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Tải lại
          </button>
        </div>
        <p className="text-xs font-semibold text-zinc-500">
          Kho: <span className="text-zinc-800">{warehouseName || '—'}</span>
          {' · '}
          Danh sách SP lấy từ sổ nhập kho thành phẩm (không theo ngày). Chọn Từ ngày → Đến ngày để
          tính Tồn đầu / Nhập / Xuất từ phiếu nhập xuất kho (khớp theo mã + tên SP).
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[1280px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2">Mã SP</th>
              <th className="px-3 py-2">Mã QR</th>
              <th className="px-3 py-2">Tên sản phẩm</th>
              <th className="px-3 py-2">Tính chất</th>
              <th className="px-3 py-2">Nhóm</th>
              <th className="px-3 py-2">Đơn vị</th>
              <th className="px-3 py-2">Kho</th>
              <th className="px-3 py-2 text-right">Tổng TL (kg)</th>
              <th className="px-3 py-2 text-right">Tồn đầu</th>
              <th className="px-3 py-2 text-right">Nhập</th>
              <th className="px-3 py-2 text-right">Xuất</th>
              <th className="px-3 py-2 text-right">Tồn</th>
            </tr>
          </thead>
          <tbody>
            {!canLoad ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center font-semibold text-zinc-400">
                  Chọn Từ ngày và Đến ngày để hiển thị danh sách sản phẩm nhập kho thành phẩm.
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center font-semibold text-zinc-400">
                  Đang tải sổ nhập kho thành phẩm…
                </td>
              </tr>
            ) : !hasLoaded ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center font-semibold text-zinc-400">
                  Chọn khoảng ngày để tải dữ liệu.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center font-semibold text-zinc-400">
                  Không có sản phẩm trong sổ nhập kho thành phẩm (hoặc không khớp tìm kiếm).
                </td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr
                  key={`${row.ma_sp_full || row.ma_sp}||${row.ten_sp}||${row.ten_kho}`}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-3 py-2 font-bold text-zinc-900">{row.ma_sp || '—'}</td>
                  <td className="px-3 py-2 font-mono text-[11px] font-semibold text-zinc-700">
                    {row.ma_qr || '—'}
                  </td>
                  <td className="px-3 py-2 font-semibold text-zinc-800">{row.ten_sp || '—'}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.tinh_chat || '—'}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.nhom_vthh || '—'}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.don_vi || '—'}</td>
                  <td className="px-3 py-2 text-zinc-700">{row.ten_kho || warehouseName || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-800">
                    {formatKg(row.tong_tl_kg ?? row.ton_cuoi?.kg)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-800">
                    {formatQty(row.ton_dau?.sl)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                    {formatQty(row.nhap?.sl)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                    {formatQty(row.xuat?.sl)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-zinc-950">
                    {formatQty(row.ton_cuoi?.sl)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ThanhPhamStockPanel;
