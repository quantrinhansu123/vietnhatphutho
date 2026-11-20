import React, { useEffect, useMemo, useState } from 'react';
import { VnCalendarPicker } from '../so-che-do-may';
import {
  DOT_SAN_XUAT_OPTIONS,
  formatDotSoLabel,
  formatTongHopDate,
  LOAI_SAN_XUAT_LABEL,
  LOAI_SAN_XUAT_OPTIONS,
  normalizeDotSo,
  type TongHopHeader
} from './model';
import { formatQty } from '../../utils';

type Props = {
  onBack: () => void;
  onOpenForm: (opts?: { processId?: string; stepId?: string }) => void;
};

type AggRow = {
  key: string;
  ngay: string;
  dotSo: string;
  may: string;
  loaiSx: string;
  xuatKg: number;
  nhapLaiKg: number;
  pheKg: number;
  phieuCount: number;
};

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function lineQty(item: Record<string, unknown>) {
  const raw = item.so_luong ?? item.soLuong ?? item.quy_doi_kg ?? item.quyDoiKg;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function extractMay(row: TongHopHeader): string {
  if (row.dich_loai === 'may' && row.dich_id) return String(row.dich_id);
  if (row.nguon_loai === 'may' && row.nguon_id) return String(row.nguon_id);
  const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
  for (const item of detail) {
    if (String(item.dich_dong_loai || '') === 'may' && item.dich_dong_id) return String(item.dich_dong_id);
    if (String(item.nguon_dong_loai || '') === 'may' && item.nguon_dong_id) return String(item.nguon_dong_id);
    if (String(item.src_loai || '') === 'may' && item.src_id) return String(item.src_id);
  }
  return '';
}

function classifyNhap(loaiNhap: string | null): 'nhap_lai' | 'phe' | 'other' {
  const f = fold(String(loaiNhap || ''));
  if (f.includes('phe')) return 'phe';
  if (f.includes('nhap lai')) return 'nhap_lai';
  return 'other';
}

export function NvlDotMayPanel({ onBack, onOpenForm }: Props) {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [dotFilter, setDotFilter] = useState('');
  const [loaiSxFilter, setLoaiSxFilter] = useState('');
  const [mayFilter, setMayFilter] = useState('');
  const [records, setRecords] = useState<TongHopHeader[]>([]);
  const [machines, setMachines] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void fetch('/api/danh-sach-may')
      .then(r => r.json().catch(() => ({})))
      .then(data => {
        if (!alive) return;
        const rows = Array.isArray(data.machines) ? data.machines : [];
        setMachines(
          rows.map((row: Record<string, unknown>) => ({
            id: String(row.ma_may || row.id || ''),
            label: String(row.ten_may || row.ma_may || row.id || '')
          })).filter((item: { id: string }) => item.id)
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    qs.set('limit', '1000');
    void Promise.all([
      fetch(`/api/xuat-nhap-tong-hop?loai=xuat&${qs.toString()}`).then(r => r.json().catch(() => ({}))),
      fetch(`/api/xuat-nhap-tong-hop?loai=nhap&${qs.toString()}`).then(r => r.json().catch(() => ({})))
    ])
      .then(([xuatRes, nhapRes]) => {
        if (!alive) return;
        const xuat = Array.isArray(xuatRes.records) ? xuatRes.records : [];
        const nhap = Array.isArray(nhapRes.records) ? nhapRes.records : [];
        setRecords([...xuat, ...nhap] as TongHopHeader[]);
      })
      .catch(() => {
        if (alive) setError('Không tải được phiếu tổng hợp.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [from, to]);

  const machineLabel = (id: string) => machines.find(item => item.id === id)?.label || id || '—';

  const rows = useMemo(() => {
    const map = new Map<string, AggRow>();
    for (const row of records) {
      if (row.trang_thai === 'huy') continue;
      const dotSo = normalizeDotSo(row.dot_so);
      if (dotFilter && dotSo !== dotFilter) continue;
      const loaiSx = String(row.phan_xuong || '').trim();
      if (loaiSxFilter && loaiSx !== loaiSxFilter) continue;
      const may = extractMay(row);
      if (mayFilter && may !== mayFilter) continue;
      const ngay = String(row.ngay || '').slice(0, 10);
      const key = `${ngay}|${dotSo}|${may}|${loaiSx}`;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          key,
          ngay,
          dotSo,
          may,
          loaiSx,
          xuatKg: 0,
          nhapLaiKg: 0,
          pheKg: 0,
          phieuCount: 0
        };
        map.set(key, agg);
      }
      agg.phieuCount += 1;
      const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
      const qty = detail.reduce((sum, item) => sum + lineQty(item as Record<string, unknown>), 0);
      if (row.loai === 'xuat') agg.xuatKg += qty;
      else {
        const kind = classifyNhap(row.loai_nhap);
        if (kind === 'phe') agg.pheKg += qty;
        else if (kind === 'nhap_lai') agg.nhapLaiKg += qty;
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.ngay !== b.ngay) return b.ngay.localeCompare(a.ngay);
      return Number(a.dotSo || 0) - Number(b.dotSo || 0);
    });
  }, [records, dotFilter, loaiSxFilter, mayFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="text-xs font-extrabold text-[#ef1b2d]">
          ← Kho
        </button>
        <h1 className="text-sm font-black uppercase tracking-wide text-zinc-950">NVL theo đợt – máy</h1>
        <button
          type="button"
          onClick={() => onOpenForm({ processId: 'xuat-sx', stepId: 'xuat-theo-may' })}
          className="text-xs font-extrabold text-[#ef1b2d]"
        >
          Lập phiếu xuất
        </button>
      </div>

      <section className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase text-zinc-500">Từ ngày</span>
          <VnCalendarPicker value={from} onChange={setFrom} />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase text-zinc-500">Đến ngày</span>
          <VnCalendarPicker value={to} onChange={setTo} />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase text-zinc-500">Đợt</span>
          <select
            value={dotFilter}
            onChange={event => setDotFilter(event.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs font-semibold"
          >
            <option value="">Tất cả đợt</option>
            {DOT_SAN_XUAT_OPTIONS.map(so => (
              <option key={so} value={so}>
                {formatDotSoLabel(so)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase text-zinc-500">{LOAI_SAN_XUAT_LABEL}</span>
          <select
            value={loaiSxFilter}
            onChange={event => setLoaiSxFilter(event.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs font-semibold"
          >
            <option value="">Tất cả</option>
            {LOAI_SAN_XUAT_OPTIONS.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 sm:col-span-2 lg:col-span-4">
          <span className="text-[10px] font-black uppercase text-zinc-500">Máy</span>
          <select
            value={mayFilter}
            onChange={event => setMayFilter(event.target.value)}
            className="h-9 w-full rounded-lg border border-zinc-200 px-2 text-xs font-semibold"
          >
            <option value="">Tất cả máy</option>
            {machines.map(item => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.id})
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      {loading ? <p className="text-xs font-semibold text-zinc-500">Đang tải…</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-950 text-[10px] uppercase tracking-wide text-white">
            <tr>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Đợt</th>
              <th className="px-3 py-2">Máy</th>
              <th className="px-3 py-2">{LOAI_SAN_XUAT_LABEL}</th>
              <th className="px-3 py-2 text-right">Xuất</th>
              <th className="px-3 py-2 text-right">Nhập lại</th>
              <th className="px-3 py-2 text-right">Phế</th>
              <th className="px-3 py-2 text-right">Còn lại*</th>
              <th className="px-3 py-2">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-zinc-400">
                  Không có dữ liệu trong kỳ lọc.
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const conLai = row.xuatKg - row.nhapLaiKg;
                return (
                  <tr key={row.key} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-2 font-semibold">{formatTongHopDate(row.ngay)}</td>
                    <td className="px-3 py-2">{formatDotSoLabel(row.dotSo) || '—'}</td>
                    <td className="px-3 py-2">{machineLabel(row.may)}</td>
                    <td className="px-3 py-2">{row.loaiSx || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatQty(row.xuatKg)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatQty(row.nhapLaiKg)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatQty(row.pheKg)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{formatQty(conLai)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-[11px] font-extrabold text-[#ef1b2d] hover:underline"
                          onClick={() => onOpenForm({ processId: 'nhap-lai', stepId: 'nhap-lai-giua' })}
                        >
                          Nhập lại
                        </button>
                        <button
                          type="button"
                          className="text-[11px] font-extrabold text-[#ef1b2d] hover:underline"
                          onClick={() => onOpenForm({ processId: 'nhap-phe', stepId: 'nhap-phe-sx' })}
                        >
                          Nhập phế
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
      <p className="text-[11px] font-semibold text-zinc-500">
        * Còn lại ≈ Xuất − Nhập lại (tham chiếu theo đợt–máy–loại SX; không thay sổ tồn chi tiết theo lô).
      </p>
    </div>
  );
}
