import { useEffect, useMemo, useState } from 'react';
import { Boxes, List, Package, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useTabAccess } from '../../app/useTabAccess';
import { BackButton } from '../../components/layout/NavButtons';
import {
  FilterCombobox,
  TableBody,
  TableDateFilter,
  TableEmptyRow,
  TableHead,
  TableHeadCell,
  TableRow,
  TableSearchInput,
  TableShell,
  TableToolbar
} from '../../components/shared/table';
import { readApiErrorMessage, showAppToast } from '../../lib/appToast';

type StorageType = 'nvl' | 'san_pham';
type ViewType = 'chi-tiet' | 'tong-hop';

type TonKhoRow = {
  ma: string;
  ten: string;
  don_vi: string | null;
  ten_kho: string | null;
  ton_dau_ky: number;
  nhap_trong_ky: number;
  xuat_trong_ky: number;
  ton_cuoi_ky: number;
};

type WarehouseOption = { id: string | number; ten_kho: string };

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function normalizeRows(payload: unknown): TonKhoRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const records = (payload as { records?: unknown }).records;
  if (!Array.isArray(records)) return [];
  return records.flatMap(record => {
    if (!record || typeof record !== 'object') return [];
    const source = record as Record<string, unknown>;
    const ma = String(source.ma ?? '').trim();
    if (!ma) return [];
    return [{
      ma,
      ten: String(source.ten ?? '').trim(),
      don_vi: source.don_vi ? String(source.don_vi).trim() : null,
      ten_kho: source.ten_kho ? String(source.ten_kho).trim() : null,
      ton_dau_ky: numberValue(source.ton_dau_ky),
      nhap_trong_ky: numberValue(source.nhap_trong_ky),
      xuat_trong_ky: numberValue(source.xuat_trong_ky),
      ton_cuoi_ky: numberValue(source.ton_cuoi_ky)
    }];
  });
}

const formatQuantity = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export function TonKhoPanel({ onBack }: { onBack: () => void }) {
  useTabAccess('ton-kho');
  const [view, setView] = useState<ViewType>('chi-tiet');
  const [loaiKho, setLoaiKho] = useState<StorageType>('nvl');
  const [tenKho, setTenKho] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [chiTietRows, setChiTietRows] = useState<TonKhoRow[]>([]);
  const [tongHopRows, setTongHopRows] = useState<TonKhoRow[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/quan-ly-kho');
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(readApiErrorMessage(response, data, 'Không tải được danh mục kho.'));
        const records = Array.isArray(data?.records) ? data.records : [];
        const options = records.flatMap((record: unknown) => {
          if (!record || typeof record !== 'object') return [];
          const row = record as Record<string, unknown>;
          const name = String(row.ten_kho ?? '').trim();
          return name ? [{ id: row.id == null ? name : String(row.id), ten_kho: name }] : [];
        });
        if (active) setWarehouses(options);
      } catch (error: any) {
        if (!active) return;
        setWarehouses([]);
        showAppToast(error?.message || 'Không tải được danh mục kho.', 'error');
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const query = new URLSearchParams({ loai_kho: loaiKho });
        if (tenKho !== 'all') query.set('ten_kho', tenKho);
        if (fromDate) query.set('from', fromDate);
        if (toDate) query.set('to', toDate);
        const response = await fetch(`/api/ton-kho/tong-hop?${query}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(readApiErrorMessage(response, data, 'Không tải được dữ liệu tồn kho.'));
        const rows = normalizeRows(data);
        setChiTietRows(rows);
        setTongHopRows(rows);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setLoadError(error?.message || 'Không tải được dữ liệu tồn kho.');
          setChiTietRows([]);
          setTongHopRows([]);
        }
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [loaiKho, tenKho, fromDate, toDate]);

  useEffect(() => {
    let active = true;
    void Promise.all(chiTietRows.map(async row => {
      try {
        return [row.ma, await QRCode.toDataURL(row.ma, { width: 128, margin: 1, errorCorrectionLevel: 'M' })] as const;
      } catch {
        return [row.ma, ''] as const;
      }
    })).then(entries => {
      if (active) setQrImages(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [chiTietRows]);

  const normalizedSearch = searchText.trim().toLowerCase();
  const filterRows = (rows: TonKhoRow[]) => normalizedSearch
    ? rows.filter(row => `${row.ma} ${row.ten}`.toLowerCase().includes(normalizedSearch))
    : rows;
  const filteredDetails = useMemo(() => filterRows(chiTietRows), [chiTietRows, normalizedSearch]);
  const filteredSummary = useMemo(() => filterRows(tongHopRows), [tongHopRows, normalizedSearch]);
  const totals = useMemo(() => filteredSummary.reduce((sum, row) => ({
    ton_dau_ky: sum.ton_dau_ky + row.ton_dau_ky,
    nhap_trong_ky: sum.nhap_trong_ky + row.nhap_trong_ky,
    xuat_trong_ky: sum.xuat_trong_ky + row.xuat_trong_ky,
    ton_cuoi_ky: sum.ton_cuoi_ky + row.ton_cuoi_ky
  }), { ton_dau_ky: 0, nhap_trong_ky: 0, xuat_trong_ky: 0, ton_cuoi_ky: 0 }), [filteredSummary]);
  const hasActiveFilters = tenKho !== 'all' || Boolean(fromDate || toDate || searchText);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div><h1 className="text-xl font-black text-zinc-950">Tồn kho</h1><p className="text-sm text-zinc-500">Theo dõi nguyên vật liệu và thành phẩm theo kho.</p></div>
        </div>
        <div className="flex rounded-xl border border-zinc-200 bg-white p-1">
          {([['chi-tiet', QrCode, 'Danh sách chi tiết'], ['tong-hop', List, 'Bảng tổng hợp']] as const).map(([value, Icon, label]) => (
            <button key={value} type="button" onClick={() => setView(value)} className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold ${view === value ? 'bg-zinc-950 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:w-fit">
        {([['nvl', Boxes, 'NVL'], ['san_pham', Package, 'Thành phẩm']] as const).map(([value, Icon, label]) => (
          <button key={value} type="button" onClick={() => setLoaiKho(value)} className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-black transition ${loaiKho === value ? 'border-[#ef1b2d] bg-[#ef1b2d] text-white' : 'border-zinc-200 bg-white text-zinc-700'}`}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>

      <TableToolbar hasActiveFilters={hasActiveFilters} onResetFilters={() => { setTenKho('all'); setFromDate(''); setToDate(''); setSearchText(''); }} isLoading={isLoading} loadError={loadError}>
        <TableSearchInput value={searchText} onChange={setSearchText} placeholder="Tìm mã hoặc tên..." disabled={isLoading} />
        <FilterCombobox label="Kho" options={warehouses.map(item => item.ten_kho)} value={tenKho} onChange={setTenKho} searchPlaceholder="Tìm kho..." />
        <TableDateFilter label="Từ ngày" value={fromDate} onChange={setFromDate} />
        <TableDateFilter label="Đến ngày" value={toDate} onChange={setToDate} />
      </TableToolbar>

      {view === 'chi-tiet' ? <>
        <p className="text-sm font-bold text-zinc-600">{filteredDetails.length.toLocaleString('vi-VN')} mã QR</p>
        <TableShell minWidthClassName="min-w-[800px]">
          <TableHead><TableHeadCell align="center">STT</TableHeadCell><TableHeadCell align="center">QR</TableHeadCell><TableHeadCell>Mã</TableHeadCell><TableHeadCell>Tên</TableHeadCell><TableHeadCell>Loại</TableHeadCell><TableHeadCell>Đơn vị</TableHeadCell><TableHeadCell>Kho</TableHeadCell></TableHead>
          <TableBody>
            {filteredDetails.map((row, index) => <TableRow key={row.ma}>
              <td className="px-4 py-3 text-center font-bold">{index + 1}</td><td className="px-4 py-2 text-center">{qrImages[row.ma] ? <img src={qrImages[row.ma]} alt={`QR ${row.ma}`} className="mx-auto h-14 w-14" /> : <span className="text-xs text-zinc-400">Đang tạo</span>}</td><td className="px-4 py-3 font-black">{row.ma}</td><td className="px-4 py-3">{row.ten || '—'}</td><td className="px-4 py-3">{loaiKho === 'nvl' ? 'NVL' : 'Thành phẩm'}</td><td className="px-4 py-3">{row.don_vi || '—'}</td><td className="px-4 py-3">{row.ten_kho || '—'}</td>
            </TableRow>)}
            {!isLoading && filteredDetails.length === 0 && <TableEmptyRow colSpan={7}>Không có dữ liệu phù hợp bộ lọc.</TableEmptyRow>}
          </TableBody>
        </TableShell>
      </> : <TableShell minWidthClassName="min-w-[900px]">
        <TableHead><TableHeadCell>Mã</TableHeadCell><TableHeadCell>Tên</TableHeadCell><TableHeadCell>Đơn vị</TableHeadCell><TableHeadCell>Tồn đầu kỳ</TableHeadCell><TableHeadCell>Nhập trong kỳ</TableHeadCell><TableHeadCell>Xuất trong kỳ</TableHeadCell><TableHeadCell>Tồn cuối kỳ</TableHeadCell></TableHead>
        <TableBody>
          {filteredSummary.map(row => <TableRow key={row.ma}><td className="px-4 py-3 font-black">{row.ma}</td><td className="px-4 py-3">{row.ten || '—'}</td><td className="px-4 py-3">{row.don_vi || '—'}</td><td className="px-4 py-3 font-semibold">{formatQuantity(row.ton_dau_ky)}</td><td className="px-4 py-3 font-semibold">{formatQuantity(row.nhap_trong_ky)}</td><td className="px-4 py-3 font-semibold">{formatQuantity(row.xuat_trong_ky)}</td><td className="px-4 py-3 font-black">{formatQuantity(row.ton_cuoi_ky)}</td></TableRow>)}
          {filteredSummary.length > 0 && <tr className="bg-zinc-100 font-black"><td colSpan={3} className="px-4 py-3">Tổng cộng</td><td className="px-4 py-3">{formatQuantity(totals.ton_dau_ky)}</td><td className="px-4 py-3">{formatQuantity(totals.nhap_trong_ky)}</td><td className="px-4 py-3">{formatQuantity(totals.xuat_trong_ky)}</td><td className="px-4 py-3">{formatQuantity(totals.ton_cuoi_ky)}</td></tr>}
          {!isLoading && filteredSummary.length === 0 && <TableEmptyRow colSpan={7}>Không có dữ liệu phù hợp bộ lọc.</TableEmptyRow>}
        </TableBody>
      </TableShell>}
    </div>
  );
}
