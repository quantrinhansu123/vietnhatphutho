import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackButton } from '../../components/layout/NavButtons';
import { readApiErrorMessage } from '../../lib/appToast';

type TrackRow = {
  maHang: string;
  donVi: string;
  ton: number;
  nhap: number;
  xuat: number;
  trongLuong: number;
  thanhTien: number;
};

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

function formatQty(value: number): string {
  return numberFormat.format(Number.isFinite(value) ? value : 0);
}

export function TheoDoiCatLePanel({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/theo-doi-cat-le');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiErrorMessage(res, data, 'Không tải được theo dõi cắt lẻ.'));
      setRows(Array.isArray(data.records) ? data.records : []);
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Không tải được theo dõi cắt lẻ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi');
    if (!q) return rows;
    return rows.filter(row => row.maHang.toLocaleLowerCase('vi').includes(q));
  }, [query, rows]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton onClick={onBack} />
        <div>
          <h2 className="text-lg font-black text-zinc-900">Theo dõi cắt lẻ</h2>
          <p className="text-xs font-semibold text-zinc-500">
            Gộp theo mã AMIS cũ. Không có mã cũ thì hiện mã AMIS. Nhập, xuất chỉ tính phiếu trùng mã AMIS, tên sản phẩm và tên sản xuất.
          </p>
        </div>
      </div>

      <label className="block max-w-sm space-y-1">
        <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Tìm mã hàng</span>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Mã AMIS cũ hoặc mã AMIS"
          className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-zinc-400"
        />
      </label>

      <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b px-3 py-2 text-xs font-black uppercase text-zinc-600">
          Danh sách {loading ? '(đang tải...)' : `(${visible.length})`}
        </div>
        {error ? <p className="px-3 py-2 text-xs font-bold text-red-600">{error}</p> : null}
        <div className="overflow-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">STT</th>
                <th className="px-3 py-2">Mã hàng</th>
                <th className="px-3 py-2">ĐVT</th>
                <th className="px-3 py-2 text-right">Tồn</th>
                <th className="px-3 py-2 text-right">Nhập</th>
                <th className="px-3 py-2 text-right">Xuất</th>
                <th className="px-3 py-2 text-right">Trọng lượng</th>
                <th className="px-3 py-2 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.maHang} className="border-t">
                  <td className="px-3 py-2 font-black tabular-nums text-zinc-500">{index + 1}</td>
                  <td className="px-3 py-2 font-black">{row.maHang}</td>
                  <td className="px-3 py-2 font-semibold">{row.donVi || '—'}</td>
                  <td className="px-3 py-2 text-right font-black tabular-nums">{formatQty(row.ton)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatQty(row.nhap)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatQty(row.xuat)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatQty(row.trongLuong)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatQty(row.thanhTien)}</td>
                </tr>
              ))}
              {visible.length === 0 && !loading && !error ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center font-bold text-zinc-400">
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
