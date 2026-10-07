import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Search } from 'lucide-react';
import WarehouseSlipPrintModal, { type WarehouseSlipPrintData } from '../../components/WarehouseSlipPrintModal';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import { VnCalendarPicker } from '../so-che-do-may';
import { TongHopViewModal } from './ViewModal';
import {
  formatTongHopDate,
  isNvlWarehouseName,
  queueTongHopEdit,
  queueTongHopView,
  type TongHopHeader,
  type TongHopMode
} from './model';
import { roundKem, sumKemStored } from './chiPhiKemTheo';
import {
  buildPartyAliasKind,
  collectLineTokens,
  foldPartyKey,
  matchTokenFilter
} from '../thong-ke-nvl';

type Filter = 'all' | TongHopMode;

type PickOption = { id: string; label: string };

function text(value: unknown) {
  return String(value ?? '').trim();
}

function statusLabel(status: string) {
  if (status === 'huy') return 'Đã hủy';
  if (status === 'hoan_thanh') return 'Đã ghi sổ';
  return status || '—';
}

function slipsFromRecord(row: TongHopHeader): WarehouseSlipPrintData[] {
  const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const line of detail) {
    const key = String(line.kho_dong_ten || line.nguon_dong_ten || line.nguon_dong_id || row.kho_dich || 'Phiếu');
    groups.set(key, [...(groups.get(key) || []), line]);
  }
  return [...groups.entries()].map(([name, groupLines], index) => {
    const totalAmount = groupLines.reduce((sum, line) => sum + (Number(line.thanh_tien) || 0), 0);
    const totalKem = roundKem(groupLines.reduce((sum, line) => sum + sumKemStored(line.chi_phi_kem_theo), 0));
    const totalKg = roundKem(groupLines.reduce((sum, line) => sum + (Number(String(line.quy_doi_kg ?? '')) || 0), 0));
    return {
    slipCode: `${row.ma_phieu_chung}-${index + 1}`,
    slipType: row.loai,
    warehouseKind: isNvlWarehouseName(name) || row.dich_loai === 'may' ? 'nvl' : 'san_pham',
    slipDate: formatTongHopDate(String(row.ngay || '').slice(0, 10)),
    reason: row.ly_do || (row.loai === 'nhap' ? row.loai_nhap || '' : row.loai_xuat || ''),
    note: row.ghi_chu || '',
    createdBy: row.nguoi_lap || '',
    deliverer: row.nguoi_giao || '',
    warehouseLocation: row.dia_diem || '',
    totalAmount,
    totalKem,
    totalCong: roundKem(totalAmount + totalKem),
    totalKg,
    shift: row.ca || '',
    machine: row.dich_loai === 'may' ? row.dich_id || '' : '',
    warehouseName: name,
    useWarehouseNameInTitle: true,
    isTemporary: false,
    lines: groupLines.map(line => ({
      code: String(line.ma_hang || ''),
      name: String(line.ten_hang || ''),
      unit: String(line.don_vi || ''),
      quantity: Number(line.so_luong) || 0,
      unitPrice: Number(line.don_gia) || 0,
      lineAmount: Number(line.thanh_tien) || 0,
      weightKg: Number(String(line.quy_doi_kg ?? '')) || null,
      chiPhiKemTheo: (Array.isArray(line.chi_phi_kem_theo) ? line.chi_phi_kem_theo : []).map(item => {
        const rowItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
          ten: String(rowItem.ten || ''),
          donGia: Number(rowItem.don_gia) || 0,
          thanhTien: Number(rowItem.thanh_tien) || 0
        };
      })
    }))
    };
  });
}

export function TongHopListPanel({
  onBack,
  onCreate,
  onEdit
}: {
  onBack: () => void;
  onCreate: () => void;
  onEdit: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [records, setRecords] = useState<TongHopHeader[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [printSlips, setPrintSlips] = useState<WarehouseSlipPrintData[] | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [machineOptions, setMachineOptions] = useState<PickOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<PickOption[]>([]);
  const [machines, setMachines] = useState<PickOption[]>([]);
  const [warehouses, setWarehouses] = useState<PickOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch('/api/danh-sach-may').then(r => r.json().catch(() => ({}))),
      fetch('/api/quan-ly-kho').then(r => r.json().catch(() => ({})))
    ])
      .then(([mayRes, khoRes]) => {
        if (!alive) return;
        const mayRows = Array.isArray((mayRes as { machines?: unknown }).machines)
          ? ((mayRes as { machines: Record<string, unknown>[] }).machines)
          : [];
        setMachineOptions(
          mayRows
            .map(row => {
              const id = text(row.ma_may);
              const ten = text(row.ten_may);
              return id ? { id, label: ten ? `${id} — ${ten}` : id } : null;
            })
            .filter(Boolean) as PickOption[]
        );
        const khoRows = Array.isArray((khoRes as { records?: unknown }).records)
          ? ((khoRes as { records: Record<string, unknown>[] }).records)
          : [];
        setWarehouseOptions(
          khoRows
            .map(row => {
              const ten = text(row.ten_kho);
              return ten ? { id: ten, label: ten } : null;
            })
            .filter(Boolean) as PickOption[]
        );
      })
      .catch(() => {
        if (alive) {
          setMachineOptions([]);
          setWarehouseOptions([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const aliasKind = useMemo(
    () => buildPartyAliasKind(machineOptions, warehouseOptions),
    [machineOptions, warehouseOptions]
  );

  const maySet = useMemo(() => {
    const set = new Set<string>();
    for (const item of machines) {
      set.add(foldPartyKey(item.id));
      set.add(foldPartyKey(item.label));
      for (const part of item.label.split('—')) {
        const key = foldPartyKey(part);
        if (key) set.add(key);
      }
    }
    return set;
  }, [machines]);

  const khoSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of warehouses) {
      set.add(foldPartyKey(item.id));
      set.add(foldPartyKey(item.label));
    }
    return set;
  }, [warehouses]);

  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (from && to && from > to) {
      setError('Từ ngày phải trước hoặc bằng đến ngày.');
      setRecords([]);
      setLoaded(true);
      return;
    }
    setLoading(true);
    try {
      // API giới hạn 2000 phiếu mới nhất/kiểu — tải riêng nhập + xuất rồi gộp.
      const fetchKind = async (loai: TongHopMode) => {
        const params = new URLSearchParams({ loai, limit: '2000' });
        if (from) params.set('from', from.slice(0, 10));
        if (to) params.set('to', to.slice(0, 10));
        const res = await fetch(`/api/xuat-nhap-tong-hop?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không tải được danh sách.');
        return (Array.isArray(data.records) ? data.records : []) as TongHopHeader[];
      };
      const kinds: TongHopMode[] = filter === 'all' ? ['nhap', 'xuat'] : [filter];
      const lists = await Promise.all(kinds.map(fetchKind));
      const merged = new Map<string, TongHopHeader>();
      for (const row of lists.flat()) {
        const key = text(row.id) || `${text(row.ma_phieu_chung)}|${text(row.loai)}`;
        if (key && !merged.has(key)) merged.set(key, row);
      }
      setError('');
      setRecords([...merged.values()]);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách.');
      setRecords([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  // Tải lại sau khi hủy phiếu (giữ nguyên điều kiện đang xem).
  useEffect(() => {
    if (info && loaded) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  const visibleRecords = useMemo(() => {
    const needParty = maySet.size > 0 || khoSet.size > 0;
    return records.filter(row => {
      if (from && text(row.ngay).slice(0, 10) < from.slice(0, 10)) return false;
      if (to && text(row.ngay).slice(0, 10) > to.slice(0, 10)) return false;
      if (!needParty) return true;
      const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
      if (!detail.length) {
        return matchTokenFilter(
          [text(row.nguon_id), text(row.dich_id), text(row.kho_dich)],
          maySet,
          khoSet,
          aliasKind
        );
      }
      return detail.some(line =>
        matchTokenFilter(
          collectLineTokens(
            row as unknown as Parameters<typeof collectLineTokens>[0],
            line as Record<string, unknown>
          ),
          maySet,
          khoSet,
          aliasKind
        )
      );
    });
  }, [records, from, to, maySet, khoSet, aliasKind]);

  async function cancelRecord(row: TongHopHeader) {
    if (!window.confirm(`Hủy ${row.ma_phieu_chung}? Hệ thống sinh phiếu đảo.`)) return;
    const res = await fetch(`/api/xuat-nhap-tong-hop/${row.id}/huy`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Không hủy được.');
      return;
    }
    setInfo(`Đã hủy ${row.ma_phieu_chung}.`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-xs font-extrabold text-[#ef1b2d]">← Kho</button>
        <h1 className="text-sm font-black uppercase tracking-wide text-zinc-950">Danh sách xuất nhập kho NVL</h1>
        <button type="button" onClick={onCreate} className="text-xs font-extrabold text-[#ef1b2d]">Tạo phiếu</button>
      </div>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {([
            ['all', 'Tất cả'],
            ['nhap', 'Phiếu nhập'],
            ['xuat', 'Phiếu xuất']
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`flex h-9 items-center justify-center rounded-lg border px-2 text-xs font-extrabold transition ${
                filter === value
                  ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="block min-w-0 space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
            <VnCalendarPicker value={from} onChange={setFrom} />
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Đến ngày</span>
            <VnCalendarPicker value={to} onChange={setTo} />
          </label>
          <div className="block min-w-0 space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Máy (chọn nhiều)</span>
            <SearchableMultiSelect<PickOption>
              values={machines}
              onChange={setMachines}
              options={machineOptions}
              getValue={item => item.id}
              getLabel={item => item.label}
              getSearchText={item => item.label}
              placeholder="Tất cả máy"
              allowCustomValues={false}
              keepOptionsOrder
              maxResults={100}
            />
          </div>
          <div className="block min-w-0 space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Kho (chọn nhiều)</span>
            <SearchableMultiSelect<PickOption>
              values={warehouses}
              onChange={setWarehouses}
              options={warehouseOptions}
              getValue={item => item.id}
              getLabel={item => item.label}
              getSearchText={item => item.label}
              placeholder="Tất cả kho"
              allowCustomValues={false}
              keepOptionsOrder
              maxResults={100}
            />
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              <Search className="h-3.5 w-3.5" />
              Xem
            </button>
          </div>
        </div>
        {loaded ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
            {loading ? 'Đang tải phiếu…' : `${visibleRecords.length}/${records.length} phiếu`}
            <Search className="h-3.5 w-3.5" />
            <span>Để trống ngày/kho/máy là lấy tất cả. Phiếu khớp khi có ≥1 dòng liên quan máy hoặc kho đã chọn.</span>
          </p>
        ) : null}
      </section>

      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      {info ? <p className="text-sm font-semibold text-emerald-700">{info}</p> : null}

      {!loaded && !loading ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center">
          <p className="text-sm font-bold text-zinc-700">Chưa có số liệu trên màn hình</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Chọn từ ngày, đến ngày, máy và kho rồi bấm Xem.</p>
        </div>
      ) : null}

      {loaded ? (
      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-[860px] w-full text-xs">
          <thead>
            <tr className="bg-[#ef1b2d] text-left text-white">
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Loại</th>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Nguồn</th>
              <th className="px-3 py-2">Đích</th>
              <th className="px-3 py-2">Ca</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map(row => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-semibold">
                  <button
                    type="button"
                    title="Bấm để sửa phiếu"
                    onClick={() => {
                      queueTongHopEdit(row);
                      onEdit();
                    }}
                    className="cursor-pointer font-mono text-[#ef1b2d] transition-colors hover:text-red-700 hover:underline"
                  >
                    {row.ma_phieu_chung}
                  </button>
                </td>
                <td className="px-3 py-2">{row.loai === 'nhap' ? 'Nhập' : 'Xuất'}</td>
                <td className="px-3 py-2">{formatTongHopDate(String(row.ngay || '').slice(0, 10))}</td>
                <td className="px-3 py-2">{row.nguon_id || '—'}</td>
                <td className="px-3 py-2">{row.kho_dich || row.dich_id || '—'}</td>
                <td className="px-3 py-2">{row.ca || '—'}</td>
                <td className="px-3 py-2">{statusLabel(row.trang_thai)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setPrintSlips(slipsFromRecord(row))} className="text-slate-600" aria-label="In phiếu">
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        queueTongHopView(row);
                        setViewOpen(true);
                      }}
                      className="text-xs font-extrabold text-blue-600"
                    >
                      Xem
                    </button>
                    {row.trang_thai !== 'huy' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            queueTongHopEdit(row);
                            onEdit();
                          }}
                          className="text-xs font-extrabold text-[#ef1b2d]"
                        >
                          Sửa
                        </button>
                        <button type="button" onClick={() => void cancelRecord(row)} className="text-sm font-semibold text-rose-600">Hủy</button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {visibleRecords.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Chưa có phiếu phù hợp.</td></tr> : null}
          </tbody>
        </table>
      </section>
      ) : null}

      <WarehouseSlipPrintModal open={Boolean(printSlips)} slips={printSlips} onClose={() => setPrintSlips(null)} />
      <TongHopViewModal open={viewOpen} onClose={() => setViewOpen(false)} />
    </div>
  );
}
