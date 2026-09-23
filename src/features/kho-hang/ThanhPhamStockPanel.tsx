import { Fragment, useEffect, useMemo, useState } from 'react';
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
  trong_luong_kg_mot_sp?: number;
  so_m2_mot_sp?: number;
  so_m_dai_mot_sp?: number;
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

type StockUnitKind = 'base' | 'm_dai' | 'm2' | 'kg';

type StockUnitLine = {
  unit: string;
  kind: StockUnitKind;
};

function normalizeUnitLabel(unit: string) {
  return String(unit || '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function isM2Unit(unit: string) {
  const n = normalizeUnitLabel(unit);
  return n === 'm2' || n.includes('met vuong');
}

function isLengthUnit(unit: string) {
  const n = normalizeUnitLabel(unit);
  return n === 'm' || n === 'm dai' || n === 'met' || n === 'met dai';
}

function isKgUnit(unit: string) {
  const n = normalizeUnitLabel(unit);
  return n === 'kg' || n === 'kilogram';
}

function hasAmount(values: Array<number | undefined>) {
  return values.some(value => Number.isFinite(value) && Number(value) > 0);
}

/** Dòng gốc theo ĐVT, rồi m dài / m² / kg khi sổ có hệ số hoặc phiếu có số. */
function stockUnitLines(row: ThanhPhamStockRow): StockUnitLine[] {
  const lines: StockUnitLine[] = [{ unit: row.don_vi || '—', kind: 'base' }];
  const metrics = [row.ton_dau, row.nhap, row.xuat, row.ton_cuoi];
  if (
    !isLengthUnit(row.don_vi) &&
    hasAmount([row.so_m_dai_mot_sp, ...metrics.map(metric => metric?.m_dai)])
  ) {
    lines.push({ unit: 'm dài', kind: 'm_dai' });
  }
  if (!isM2Unit(row.don_vi) && hasAmount([row.so_m2_mot_sp, ...metrics.map(metric => metric?.m2)])) {
    lines.push({ unit: 'm²', kind: 'm2' });
  }
  if (
    !isKgUnit(row.don_vi) &&
    hasAmount([row.trong_luong_kg_mot_sp, row.tong_tl_kg, ...metrics.map(metric => metric?.kg)])
  ) {
    lines.push({ unit: 'kg', kind: 'kg' });
  }
  return lines;
}

function metricAmount(metric: ThanhPhamStockMetric | undefined, kind: StockUnitKind) {
  if (!metric) return undefined;
  if (kind === 'm2') return metric.m2;
  if (kind === 'm_dai') return metric.m_dai;
  if (kind === 'kg') return metric.kg;
  return metric.sl;
}

type Props = {
  warehouseName: string;
  topControls?: React.ReactNode;
  onBack?: () => void;
};

/**
 * /kho-hang → Kho thành phẩm (một màn).
 * Từ ngày → Đến ngày → danh sách SP từ nhap_kho.
 * Mỗi SP một nhóm dòng giống /san-pham: ĐVT gốc, thêm m dài / m² / kg khi có quy đổi.
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
          tính Tồn đầu / Nhập / Xuất từ phiếu nhập xuất kho. Có m² hoặc m dài thì hiện thêm dòng đơn vị, giống danh sách sản phẩm.
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
              <th className="px-3 py-2">Kho</th>
              <th className="px-3 py-2 text-center">Đơn vị</th>
              <th className="px-3 py-2 text-center">Tổng TL (kg)</th>
              <th className="px-3 py-2 text-center">Tồn đầu</th>
              <th className="px-3 py-2 text-center">Nhập</th>
              <th className="px-3 py-2 text-center">Xuất</th>
              <th className="px-3 py-2 text-center">Tồn</th>
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
              filtered.map(row => {
                const lines = stockUnitLines(row);
                const rowSpan = lines.length;
                const groupKey = `${row.ma_sp_full || row.ma_sp}||${row.ten_sp}||${row.trong_luong_kg_mot_sp || 0}|${row.so_m2_mot_sp || 0}|${row.so_m_dai_mot_sp || 0}||${row.ten_kho}`;
                const quantityClass = (id: string, muted: boolean) => {
                  if (muted) return 'font-bold text-zinc-700';
                  if (id === 'nhap') return 'font-bold text-emerald-700';
                  if (id === 'xuat') return 'font-bold text-rose-700';
                  if (id === 'ton_cuoi') return 'font-bold text-zinc-950';
                  return 'font-bold text-zinc-800';
                };
                const quantityCells = (line: StockUnitLine, muted: boolean) =>
                  (
                    [
                      ['ton_dau', row.ton_dau],
                      ['nhap', row.nhap],
                      ['xuat', row.xuat],
                      ['ton_cuoi', row.ton_cuoi]
                    ] as const
                  ).map(([id, metric]) => (
                    <td
                      key={id}
                      className={`px-3 py-2.5 text-center font-mono tabular-nums ${quantityClass(id, muted)}`}
                    >
                      {formatQty(metricAmount(metric, line.kind))}
                    </td>
                  ));
                return (
                  <Fragment key={groupKey}>
                    <tr className="border-t-2 border-zinc-300 bg-white">
                      <td rowSpan={rowSpan} className="px-3 py-2.5 align-middle font-bold text-zinc-900">
                        {row.ma_sp || '—'}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2.5 align-middle font-mono text-[11px] font-semibold text-zinc-700">
                        {row.ma_qr || '—'}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2.5 align-middle font-semibold text-zinc-800">
                        {row.ten_sp || '—'}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2.5 align-middle text-zinc-700">
                        {row.tinh_chat || '—'}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2.5 align-middle text-zinc-700">
                        {row.nhom_vthh || '—'}
                      </td>
                      <td rowSpan={rowSpan} className="px-3 py-2.5 align-middle text-zinc-700">
                        {row.ten_kho || warehouseName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-zinc-800">{lines[0].unit}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold tabular-nums text-emerald-800">
                        {formatKg(row.tong_tl_kg ?? row.ton_cuoi?.kg)}
                      </td>
                      {quantityCells(lines[0], false)}
                    </tr>
                    {lines.slice(1).map(line => (
                      <tr key={`${groupKey}||${line.kind}`} className="border-t border-zinc-100 bg-zinc-50/70">
                        <td className="px-3 py-2 text-center font-bold text-zinc-700">{line.unit}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-zinc-400">—</td>
                        {quantityCells(line, true)}
                      </tr>
                    ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ThanhPhamStockPanel;
