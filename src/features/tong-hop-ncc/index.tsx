import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Loader2, Search } from 'lucide-react';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { VnCalendarPicker } from '../so-che-do-may';
import { LOAI_NHAP_OPTIONS, LOAI_XUAT_TRA_NCC, queueTongHopEdit, type TongHopHeader } from '../xuat-nhap-tong-hop/model';
import { sumKemStored } from '../xuat-nhap-tong-hop/chiPhiKemTheo';
import { formatMoney, formatNumber } from '../../utils';

const LOAI_NHAP_NCC = LOAI_NHAP_OPTIONS[0];

type SupplierOption = { id: string; label: string };

type SlipLine = Record<string, unknown>;

type SlipRecord = {
  id: string;
  ma_phieu_chung: string;
  loai: string;
  ngay: string;
  nguon_loai: string | null;
  nguon_id: string | null;
  dich_loai: string | null;
  dich_id: string | null;
  loai_nhap: string | null;
  loai_xuat: string | null;
  trang_thai: string | null;
  chi_tiet: SlipLine[];
};

type ReportRow = {
  key: string;
  slipId: string;
  ngay: string;
  maPhieu: string;
  kind: 'nhap' | 'tra';
  maHang: string;
  tenHang: string;
  tenSx: string;
  slNhap: number;
  donGiaNhap: number;
  giaNhapKho: number;
  thanhTienNhap: number;
  thanhTienNhapKho: number;
  slTra: number;
  donGiaTra: number;
  thanhTienTra: number;
};

type RenderRow =
  | { type: 'section'; key: string; label: string }
  | { type: 'group'; key: string; side: 'nhap' | 'tra'; tenHang: string; tenSx: string }
  | { type: 'data'; row: ReportRow }
  | {
      type: 'subtotal';
      key: string;
      side: 'nhap' | 'tra';
      tenSx: string;
      slNhap: number;
      thanhTienNhap: number;
      thanhTienNhapKho: number;
      slTra: number;
      thanhTienTra: number;
    };

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function firstDayOfMonthIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
}

function formatDateVN(iso: string) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso || '').slice(0, 10);
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeNccKey(value: string) {
  return text(value).toLocaleLowerCase('vi');
}

function matchNcc(selected: string, ...candidates: Array<string | null | undefined>) {
  if (!selected) return true;
  const want = normalizeNccKey(selected);
  return candidates.some(item => item && normalizeNccKey(item) === want);
}

export function TongHopNccPanel({ onBack, onEdit }: { onBack: () => void; onEdit: () => void }) {
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [nccId, setNccId] = useState('');
  const [records, setRecords] = useState<SlipRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void fetch('/api/nha-cung-cap')
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        if (!alive) return;
        const rows = Array.isArray(data.suppliers)
          ? data.suppliers
          : Array.isArray(data.records)
            ? data.records
            : [];
        setSuppliers(
          rows
            .map((row: Record<string, unknown>) => {
              const id = text(row.ma_nha_cung_cap ?? row.id);
              const ten = text(row.ten_nha_cung_cap);
              return id ? { id, label: ten ? `${id} — ${ten}` : id } : null;
            })
            .filter(Boolean) as SupplierOption[]
        );
      })
      .catch(() => {
        if (alive) setSuppliers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedNccLabel = useMemo(() => {
    if (!nccId) return 'Tất cả nhà cung cấp';
    return suppliers.find(item => item.id === nccId)?.label || nccId;
  }, [nccId, suppliers]);

  async function loadReport() {
    if (!from || !to) {
      setError('Chọn từ ngày và đến ngày.');
      return;
    }
    if (from > to) {
      setError('Từ ngày phải trước hoặc bằng đến ngày.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from: from.slice(0, 10), to: to.slice(0, 10), limit: '2000' });
      const res = await fetch(`/api/xuat-nhap-tong-hop?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Không tải được phiếu tổng hợp.');
        setRecords([]);
        setLoaded(true);
        return;
      }
      setRecords(Array.isArray(data.records) ? data.records : []);
      setLoaded(true);
    } catch {
      setError('Không tải được phiếu tổng hợp.');
      setRecords([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  function openSlip(slipId: string) {
    const slip = records.find(item => text(item.id) === slipId);
    if (!slip) return;
    queueTongHopEdit(slip as unknown as TongHopHeader);
    onEdit();
  }

  const rows = useMemo<ReportRow[]>(() => {
    const out: ReportRow[] = [];
    for (const slip of records) {
      if (text(slip.trang_thai) === 'huy') continue;
      const ngay = text(slip.ngay).slice(0, 10);
      if (!ngay || ngay < from.slice(0, 10) || ngay > to.slice(0, 10)) continue;
      const detail = Array.isArray(slip.chi_tiet) ? slip.chi_tiet : [];
      if (text(slip.loai) === 'nhap') {
        if (text(slip.loai_nhap) !== LOAI_NHAP_NCC) continue;
        if (text(slip.nguon_loai) !== 'ncc') continue;
        if (!matchNcc(nccId, slip.nguon_id)) continue;
        const totalKem = detail.reduce((sum, line) => sum + sumKemStored(line.chi_phi_kem_theo), 0);
        const totalKg = detail.reduce((sum, line) => sum + num(line.quy_doi_kg), 0);
        const kemPerKg = totalKg > 0 ? totalKem / totalKg : 0;
        detail.forEach((line, index) => {
          const maHang = text(line.ma_hang);
          if (!maHang) return;
          const qty = num(line.so_luong);
          const price = num(line.don_gia);
          const amount = num(line.thanh_tien) || Math.round(qty * price * 1000) / 1000;
          const importPrice = Math.round((price + kemPerKg) * 1000) / 1000;
          const importAmount = Math.round(qty * importPrice * 1000) / 1000;
          const tenHang = text(line.ten_hang);
          const tenSx = text(line.ten_nvl_sx) || tenHang;
          out.push({
            key: `${ngay}|${slip.ma_phieu_chung}|nhap|${index}|${maHang}`,
            slipId: text(slip.id),
            ngay,
            maPhieu: text(slip.ma_phieu_chung),
            kind: 'nhap',
            maHang,
            tenHang,
            tenSx,
            slNhap: qty,
            donGiaNhap: price,
            giaNhapKho: importPrice,
            thanhTienNhap: amount,
            thanhTienNhapKho: importAmount,
            slTra: 0,
            donGiaTra: 0,
            thanhTienTra: 0
          });
        });
      } else if (text(slip.loai) === 'xuat') {
        const isTraNccSlip =
          text(slip.loai_xuat) === LOAI_XUAT_TRA_NCC ||
          text(slip.dich_loai) === 'ncc' ||
          detail.some(line => text(line.dich_dong_loai) === 'ncc');
        if (!isTraNccSlip) continue;
        detail.forEach((line, index) => {
          if (text(line.dich_dong_loai) !== 'ncc') return;
          const dichId = text(line.dich_dong_id);
          if (!matchNcc(nccId, dichId, slip.dich_loai === 'ncc' ? text(slip.dich_id) : '')) return;
          const maHang = text(line.ma_hang);
          if (!maHang) return;
          const qty = num(line.so_luong);
          const price = num(line.don_gia);
          const amount = num(line.thanh_tien) || Math.round(qty * price * 1000) / 1000;
          const tenHang = text(line.ten_hang);
          const tenSx = text(line.ten_nvl_sx) || tenHang;
          out.push({
            key: `${ngay}|${slip.ma_phieu_chung}|tra|${index}|${maHang}`,
            slipId: text(slip.id),
            ngay,
            maPhieu: text(slip.ma_phieu_chung),
            kind: 'tra',
            maHang,
            tenHang,
            tenSx,
            slNhap: 0,
            donGiaNhap: 0,
            giaNhapKho: 0,
            thanhTienNhap: 0,
            thanhTienNhapKho: 0,
            slTra: qty,
            donGiaTra: price,
            thanhTienTra: amount
          });
        });
      }
    }
    out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'nhap' ? -1 : 1;
      const name = a.tenSx.localeCompare(b.tenSx, 'vi');
      if (name) return name;
      const hang = a.tenHang.localeCompare(b.tenHang, 'vi');
      if (hang) return hang;
      if (a.ngay !== b.ngay) return a.ngay.localeCompare(b.ngay);
      if (a.maPhieu !== b.maPhieu) return a.maPhieu.localeCompare(b.maPhieu);
      return a.maHang.localeCompare(b.maHang, 'vi');
    });
    return out;
  }, [records, from, to, nccId]);

  const renderRows = useMemo<RenderRow[]>(() => {
    const list: RenderRow[] = [];
    const appendBlock = (source: ReportRow[], side: 'nhap' | 'tra', sectionLabel: string) => {
      if (!source.length) return;
      list.push({ type: 'section', key: `section|${side}`, label: sectionLabel });
      const sorted = [...source].sort((a, b) => {
        const name = a.tenSx.localeCompare(b.tenSx, 'vi');
        if (name) return name;
        const hang = a.tenHang.localeCompare(b.tenHang, 'vi');
        if (hang) return hang;
        if (a.ngay !== b.ngay) return a.ngay.localeCompare(b.ngay);
        if (a.maPhieu !== b.maPhieu) return a.maPhieu.localeCompare(b.maPhieu);
        return a.maHang.localeCompare(b.maHang, 'vi');
      });
      let groupKey = '';
      let group: ReportRow[] = [];
      const flush = () => {
        if (!group.length) return;
        const first = group[0];
        list.push({
          type: 'group',
          key: `grp|${side}|${groupKey}`,
          side,
          tenHang: first.tenHang,
          tenSx: first.tenSx
        });
        for (const row of group) list.push({ type: 'data', row });
        list.push({
          type: 'subtotal',
          key: `sub|${side}|${groupKey}`,
          side,
          tenSx: first.tenSx,
          slNhap: group.reduce((sum, item) => sum + item.slNhap, 0),
          thanhTienNhap: group.reduce((sum, item) => sum + item.thanhTienNhap, 0),
          thanhTienNhapKho: group.reduce((sum, item) => sum + item.thanhTienNhapKho, 0),
          slTra: group.reduce((sum, item) => sum + item.slTra, 0),
          thanhTienTra: group.reduce((sum, item) => sum + item.thanhTienTra, 0)
        });
        group = [];
      };
      for (const row of sorted) {
        const key = `${row.tenSx.toLocaleLowerCase('vi')}||${row.tenHang.toLocaleLowerCase('vi')}`;
        if (key !== groupKey) {
          flush();
          groupKey = key;
        }
        group.push(row);
      }
      flush();
    };
    appendBlock(rows.filter(row => row.kind === 'nhap'), 'nhap', 'Nhập');
    appendBlock(rows.filter(row => row.kind === 'tra'), 'tra', 'Xuất Trả NCC');
    return list;
  }, [rows]);

  const totals = useMemo(() => {
    const maHang = new Set(rows.map(item => item.maHang.toLocaleLowerCase('vi')));
    return {
      maHang: maHang.size,
      slNhap: rows.reduce((sum, item) => sum + item.slNhap, 0),
      slTra: rows.reduce((sum, item) => sum + item.slTra, 0),
      thanhTienNhap: rows.reduce((sum, item) => sum + item.thanhTienNhap, 0),
      thanhTienNhapKho: rows.reduce((sum, item) => sum + item.thanhTienNhapKho, 0),
      thanhTienTra: rows.reduce((sum, item) => sum + item.thanhTienTra, 0)
    };
  }, [rows]);

  function summaryBar(position: 'tren' | 'duoi') {
    const stat = (label: string, value: string, valueClass: string) => (
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
        <p className={`mt-0.5 truncate text-sm font-black tabular-nums ${valueClass}`}>{value}</p>
      </div>
    );
    return (
      <div
        data-testid={`tong-hop-ncc-summary-${position}`}
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
      >
        <div className="grid md:grid-cols-2">
          <div className="border-b border-emerald-100 bg-emerald-50/70 p-3 md:border-b-0 md:border-r">
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-800">Nhập từ nhà cung cấp</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {stat('SL nhập', formatNumber(totals.slNhap, 3), 'text-emerald-800')}
              {stat('Thành tiền', formatMoney(totals.thanhTienNhap, 0), 'text-zinc-900')}
              {stat('Tổng tiền theo giá nhập kho', formatMoney(totals.thanhTienNhapKho, 0), 'text-sky-800')}
            </div>
          </div>
          <div className="bg-rose-50/70 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-rose-800">Trả lại nhà cung cấp</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {stat('SL trả', formatNumber(totals.slTra, 3), 'text-rose-800')}
              {stat('Thành tiền trả', formatMoney(totals.thanhTienTra, 0), 'text-zinc-900')}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span>
            Tổng mã hàng <strong className="font-black tabular-nums text-zinc-900">{formatNumber(totals.maHang, 0)}</strong>
          </span>
          <span className="text-zinc-300">·</span>
          <span>Đã gộp Kho NVL Chính, Kho NVL Phụ và Kho PC</span>
          <span className="text-zinc-300">·</span>
          <span>{rows.length} dòng chi tiết</span>
        </div>
      </div>
    );
  }

  function exportCsv() {
    const header = [
      'Ngay',
      'Phieu',
      'Loai',
      'Ten NVL',
      'Ten NVL san xuat',
      'SL Nhap',
      'Don gia nhap',
      'Gia nhap kho',
      'Thanh tien nhap',
      'Thanh tien nhap (gia nhap kho)',
      'SL tra lai NCC',
      'Don gia tra',
      'Thanh tien tra'
    ];
    const lines = rows.map(item =>
      [
        formatDateVN(item.ngay),
        item.maPhieu,
        item.kind === 'nhap' ? 'Nhap' : 'Tra NCC',
        `"${item.tenHang.replace(/"/g, '""')}"`,
        `"${item.tenSx.replace(/"/g, '""')}"`,
        String(Math.round(item.slNhap * 1000) / 1000),
        String(Math.round(item.donGiaNhap * 1000) / 1000),
        String(Math.round(item.giaNhapKho * 1000) / 1000),
        String(Math.round(item.thanhTienNhap * 1000) / 1000),
        String(Math.round(item.thanhTienNhapKho * 1000) / 1000),
        String(Math.round(item.slTra * 1000) / 1000),
        String(Math.round(item.donGiaTra * 1000) / 1000),
        String(Math.round(item.thanhTienTra * 1000) / 1000)
      ].join(',')
    );
    const csv = `﻿${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tong-hop-ncc-${from.slice(0, 10)}-${to.slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-xs font-extrabold text-[#ef1b2d]">
            ← Kho
          </button>
          <h2 className="mt-1 text-base font-black text-zinc-950">Tổng hợp NVL từ nhà cung cấp</h2>
          <p className="mt-0.5 max-w-2xl text-xs font-medium text-zinc-500">
            Phiếu nhập từ nhà cung cấp và phiếu trả hàng không đúng quy cách. Tên NVL gộp Kho NVL Chính, Phụ và PC.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="grid items-end gap-3 md:grid-cols-[11.5rem_11.5rem_minmax(0,1fr)_auto]">
          <label className="block space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Từ ngày</span>
            <VnCalendarPicker value={from} onChange={setFrom} />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Đến ngày</span>
            <VnCalendarPicker value={to} onChange={setTo} />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Nhà cung cấp</span>
            <SearchableSelect
              value={nccId}
              onChange={setNccId}
              options={suppliers}
              getValue={(item: SupplierOption) => item.id}
              getLabel={(item: SupplierOption) => item.label}
              getSearchText={(item: SupplierOption) => item.label}
              placeholder="Tất cả nhà cung cấp"
              inputClassName="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10"
              comboboxMode
              comboboxSearchable
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadReport()}
              disabled={loading}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-3.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Xem
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!rows.length}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              Excel
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>
      ) : null}

      {loaded ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">
              {formatDateVN(from)} – {formatDateVN(to)}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">{selectedNccLabel}</span>
          </div>
          {summaryBar('tren')}
          <div className="max-h-[min(70vh,52rem)] overflow-auto rounded-xl border border-zinc-300 bg-white shadow-sm">
            <table className="w-max min-w-full border-collapse text-[13px] text-zinc-900">
              <thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgb(212_212_216)]">
                <tr>
                  <th rowSpan={2} className="min-w-[6.5rem] border border-zinc-300 bg-zinc-100 px-2.5 py-2 text-center text-[11px] font-bold">Ngày</th>
                  <th rowSpan={2} className="min-w-[7rem] border border-zinc-300 bg-zinc-100 px-2.5 py-2 text-center text-[11px] font-bold">Phiếu</th>
                  <th rowSpan={2} className="min-w-[12rem] border border-zinc-300 bg-zinc-100 px-2.5 py-2 text-center text-[11px] font-bold">Tên NVL</th>
                  <th rowSpan={2} className="min-w-[12rem] border border-zinc-300 bg-zinc-100 px-2.5 py-2 text-center text-[11px] font-bold">Tên NVL sản xuất</th>
                  <th colSpan={4} className="border border-emerald-200 bg-emerald-100 px-2 py-1.5 text-center text-[11px] font-bold text-emerald-950">Liên quan đến nhập</th>
                  <th colSpan={3} className="border border-rose-200 bg-rose-100 px-2 py-1.5 text-center text-[11px] font-bold text-rose-950">Liên quan đến trả NCC</th>
                </tr>
                <tr>
                  {['SL Nhập', 'Đơn giá', 'Giá nhập kho', 'Thành tiền'].map(label => (
                    <th key={label} className="whitespace-nowrap border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center text-[11px] font-bold text-emerald-950">
                      {label}
                    </th>
                  ))}
                  {['SL trả lại NCC', 'Đơn giá', 'Thành tiền'].map(label => (
                    <th key={`tra-${label}`} className="whitespace-nowrap border border-rose-200 bg-rose-50 px-2 py-1.5 text-center text-[11px] font-bold text-rose-950">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="border border-zinc-200 px-3 py-8 text-center font-semibold text-zinc-400">
                      Chưa có dữ liệu nhập hoặc trả nhà cung cấp trong kỳ này.
                    </td>
                  </tr>
                ) : (
                  renderRows.map(item => {
                    const cell = 'border border-zinc-200 px-2.5 py-1.5 align-middle';
                    const nhapNum = `${cell} whitespace-nowrap bg-emerald-50/50 text-right tabular-nums`;
                    const traNum = `${cell} whitespace-nowrap bg-rose-50/50 text-right tabular-nums`;
                    if (item.type === 'section') {
                      const nhapSection = item.label === 'Nhập';
                      return (
                        <tr key={item.key} className={nhapSection ? 'bg-emerald-50' : 'bg-rose-50'}>
                          <td colSpan={11} className={`${cell} font-bold ${nhapSection ? 'text-emerald-950' : 'text-rose-950'}`}>
                            {item.label}
                          </td>
                        </tr>
                      );
                    }
                    if (item.type === 'group') {
                      const nhap = item.side === 'nhap';
                      const title = item.tenSx && item.tenSx !== item.tenHang ? item.tenSx : item.tenHang;
                      const subtitle = title !== item.tenHang ? item.tenHang : '';
                      return (
                        <tr key={item.key} className={nhap ? 'bg-emerald-100/70' : 'bg-rose-100/70'}>
                          <td colSpan={11} className={`${cell} py-2`}>
                            <span className="font-black text-zinc-950">{title}</span>
                            {subtitle ? <span className="font-semibold text-zinc-500"> · {subtitle}</span> : null}
                          </td>
                        </tr>
                      );
                    }
                    if (item.type === 'subtotal') {
                      const nhap = item.side === 'nhap';
                      return (
                        <tr key={item.key} className="bg-amber-50 font-bold">
                          <td className={cell} />
                          <td className={cell} />
                          <td className={`${cell} text-center`}>Tổng</td>
                          <td className={cell} />
                          <td className={nhapNum}>{nhap && item.slNhap ? formatNumber(item.slNhap, 3) : ''}</td>
                          <td className={nhapNum} />
                          <td className={nhapNum} />
                          <td className={nhapNum}>{nhap && item.thanhTienNhap ? formatMoney(item.thanhTienNhap, 0) : ''}</td>
                          <td className={traNum}>{!nhap && item.slTra ? formatNumber(item.slTra, 3) : ''}</td>
                          <td className={traNum} />
                          <td className={traNum}>{!nhap && item.thanhTienTra ? formatMoney(item.thanhTienTra, 0) : ''}</td>
                        </tr>
                      );
                    }
                    const row = item.row;
                    const nhap = row.kind === 'nhap';
                    return (
                      <tr key={row.key} className="bg-white hover:bg-amber-50/40">
                        <td className={`${cell} whitespace-nowrap text-center`}>{formatDateVN(row.ngay)}</td>
                        <td className={`${cell} whitespace-nowrap`}>
                          <button
                            type="button"
                            title="Bấm để sửa phiếu"
                            onClick={() => openSlip(row.slipId)}
                            className="cursor-pointer font-semibold text-[#ef1b2d] hover:underline"
                          >
                            {row.maPhieu}
                          </button>
                        </td>
                        <td className={cell} />
                        <td className={cell} />
                        <td className={nhapNum}>{nhap ? formatNumber(row.slNhap, 3) : ''}</td>
                        <td className={nhapNum}>{nhap ? formatMoney(row.donGiaNhap, 0) : ''}</td>
                        <td className={nhapNum}>{nhap ? formatMoney(row.giaNhapKho, 0) : ''}</td>
                        <td className={nhapNum}>{nhap ? formatMoney(row.thanhTienNhap, 0) : ''}</td>
                        <td className={traNum}>{!nhap ? formatNumber(row.slTra, 3) : ''}</td>
                        <td className={traNum}>{!nhap ? formatMoney(row.donGiaTra, 0) : ''}</td>
                        <td className={traNum}>{!nhap ? formatMoney(row.thanhTienTra, 0) : ''}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {summaryBar('duoi')}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center">
          <p className="text-sm font-bold text-zinc-700">Chưa có số liệu trên màn hình</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Chọn từ ngày, đến ngày và nhà cung cấp, rồi bấm Xem.</p>
        </div>
      )}
    </div>
  );
}
