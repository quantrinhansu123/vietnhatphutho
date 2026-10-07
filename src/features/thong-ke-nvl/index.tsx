import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Loader2, Search } from 'lucide-react';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import { VnCalendarPicker } from '../so-che-do-may';
import { queueTongHopEdit, type TongHopHeader } from '../xuat-nhap-tong-hop/model';
import { sumKemStored } from '../xuat-nhap-tong-hop/chiPhiKemTheo';
import { formatMoney, formatNumber } from '../../utils';
import { normalizeWarehouseName } from '../kho-hang';

type PickOption = { id: string; label: string };

type SlipLine = Record<string, unknown>;

type SlipRecord = {
  id: string;
  ma_phieu_chung: string;
  loai: string;
  ngay: string;
  kho_dich: string | null;
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
  kind: 'nhap' | 'xuat';
  maHang: string;
  tenHang: string;
  tenSx: string;
  kho: string;
  may: string;
  slNhap: number;
  donGiaNhap: number;
  giaNhapKho: number;
  thanhTienNhap: number;
  thanhTienNhapKho: number;
  slXuat: number;
  donGiaXuat: number;
  thanhTienXuat: number;
};

type RenderRow =
  | { type: 'section'; key: string; label: string }
  | { type: 'group'; key: string; side: 'nhap' | 'xuat'; tenHang: string; tenSx: string }
  | { type: 'data'; row: ReportRow }
  | {
      type: 'subtotal';
      key: string;
      side: 'nhap' | 'xuat';
      slNhap: number;
      thanhTienNhap: number;
      thanhTienNhapKho: number;
      slXuat: number;
      thanhTienXuat: number;
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

/** Chuẩn hóa để khớp máy/kho: không phân biệt hoa thường, dấu, khoảng trắng thừa. */
export function foldPartyKey(value: string) {
  return normalizeWarehouseName(text(value)).replace(/\s+/g, ' ').trim();
}

/** Gom mọi kho/máy liên quan của 1 dòng chi tiết (cả header lẫn dòng, cả nguồn lẫn đích). */
export function collectLineParties(slip: SlipRecord, line: SlipLine): { khos: string[]; mays: string[] } {
  const khos: string[] = [];
  const mays: string[] = [];
  const pushKho = (value: unknown) => {
    const v = text(value);
    if (v && v !== '-') khos.push(v);
  };
  const pushMay = (value: unknown) => {
    const v = text(value);
    if (v && v !== '-') mays.push(v);
  };
  const route = (loai: unknown, id: unknown, ten: unknown) => {
    const kind = foldPartyKey(String(loai ?? ''));
    const idText = text(id);
    const tenText = text(ten);
    if (kind === 'may') {
      if (idText) pushMay(idText);
      if (tenText && tenText !== idText) pushMay(tenText);
    } else if (kind === 'kho' || kind === 'ncc') {
      if (idText) pushKho(idText);
      if (tenText && tenText !== idText) pushKho(tenText);
    } else {
      if (idText) pushKho(idText);
      if (tenText && tenText !== idText) pushKho(tenText);
    }
  };

  pushKho(line.kho_dong_ten);
  pushKho(line.kho_dong_id);
  pushKho(slip.kho_dich);
  if (text(line.may)) pushMay(line.may);
  route(slip.nguon_loai, slip.nguon_id, null);
  route(slip.dich_loai, slip.dich_id, null);
  route(line.src_loai, line.src_id, line.src_ten);
  route(line.nguon_dong_loai, line.nguon_dong_id, line.nguon_dong_ten);
  route(line.dich_dong_loai, line.dich_dong_id, null);
  return { khos, mays };
}

/** Điều kiện đa chọn: trống = tất cả; có chọn thì dòng phải khớp ≥1 máy đã chọn VÀ ≥1 kho đã chọn. */
export function matchPartyFilter(
  parties: { khos: string[]; mays: string[] },
  maySet: Set<string>,
  khoSet: Set<string>
) {
  if (maySet.size > 0) {
    const hit = parties.mays.some(m => maySet.has(foldPartyKey(m)));
    if (!hit) return false;
  }
  if (khoSet.size > 0) {
    const hit = parties.khos.some(k => khoSet.has(foldPartyKey(k)));
    if (!hit) return false;
  }
  return true;
}

export type PartyKind = 'may' | 'kho';

/**
 * Bản đồ giá trị → loại (máy/kho) dựng từ danh mục đã load (ma_may + ten_may + ten_kho).
 * Phiếu lưu máy/kho dưới nhiều biến thể (mã, tên, label gộp, cột legacy) nên tra theo
 * GIÁ TRỊ thay vì theo tên cột — cột nào chứa giá trị của máy đã chọn thì dòng đó liên quan máy.
 */
export function buildPartyAliasKind(
  machineOptions: PickOption[],
  warehouseOptions: PickOption[]
): Map<string, PartyKind> {
  const map = new Map<string, PartyKind>();
  const addMay = (value: string) => {
    const key = foldPartyKey(value);
    if (key) map.set(key, 'may');
  };
  for (const item of machineOptions) {
    addMay(item.id);
    for (const part of item.label.split('—')) addMay(part);
  }
  for (const item of warehouseOptions) {
    const key = foldPartyKey(item.id);
    if (key && !map.has(key)) map.set(key, 'kho');
    const labelKey = foldPartyKey(item.label);
    if (labelKey && !map.has(labelKey)) map.set(labelKey, 'kho');
  }
  return map;
}

/** Các key hàng hóa/số liệu/ngày tháng/ghi chú — không dùng để nhận diện máy/kho. */
const TOKEN_SKIP_KEYS = new Set([
  'ma_hang', 'ten_hang', 'ten_nvl_sx', 'don_vi', 'so_luong', 'don_gia', 'thanh_tien',
  'quy_doi_kg', 'chi_phi_kem_theo', 'phan_loai_nvl', 'so_luong_ct', 'nhom_vthh',
  'norm_kg_per_unit', 'link_anh_can_thuc_te', 'link_anh_can_thuc_te_public_id',
  'ma_phieu_chung', 'ngay', 'loai', 'loai_nhap', 'loai_xuat', 'trang_thai', 'ca',
  'ca_dong', 'ngay_dong', 'dia_diem', 'ly_do', 'ghi_chu', 'nguoi_lap', 'nguoi_giao',
  'ton_dau_ca', 'ton_dau_ca_may', 'ma_phieu_nhap', 'ma_phieu_xuat',
  'ma_phieu_nhap_huy', 'ma_phieu_xuat_huy', 'id', 'created_at', 'updated_at'
]);

/** Gom mọi chuỗi định danh của phiếu + dòng (mã/ten kho-máy-nguồn-đích, bỏ số liệu). */
export function collectLineTokens(slip: SlipRecord, line: SlipLine): string[] {
  const out: string[] = [];
  const push = (value: unknown) => {
    const s = text(value);
    if (s && s !== '-') out.push(s);
  };
  for (const [key, value] of Object.entries(slip)) {
    if (key === 'chi_tiet' || TOKEN_SKIP_KEYS.has(key)) continue;
    push(value);
  }
  for (const [key, value] of Object.entries(line)) {
    if (TOKEN_SKIP_KEYS.has(key)) continue;
    push(value);
  }
  return out;
}

/**
 * Khớp đa chọn theo giá trị (OR): dòng được giữ khi có ≥1 token là máy
 * HOẶC kho đã chọn. Trống cả hai = tất cả. Token không tra được loại
 * (máy/kho đã xóa khỏi danh mục) thì so thô với lựa chọn để không mất dữ liệu cũ.
 */
export function matchTokenFilter(
  tokens: string[],
  maySet: Set<string>,
  khoSet: Set<string>,
  aliasKind: Map<string, PartyKind>
) {
  if (maySet.size === 0 && khoSet.size === 0) return true;
  for (const token of tokens) {
    const key = foldPartyKey(token);
    if (!key) continue;
    const kind = aliasKind.get(key);
    if (kind === 'may') {
      if (maySet.has(key)) return true;
    } else if (kind === 'kho') {
      if (khoSet.has(key)) return true;
    } else if (maySet.has(key) || khoSet.has(key)) {
      return true;
    }
  }
  return false;
}

export function ThongKeNvlPanel({ onBack, onEdit }: { onBack: () => void; onEdit: () => void }) {
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [machineOptions, setMachineOptions] = useState<PickOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<PickOption[]>([]);
  const [machines, setMachines] = useState<PickOption[]>([]);
  const [warehouses, setWarehouses] = useState<PickOption[]>([]);
  const [records, setRecords] = useState<SlipRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

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
        if (!alive) return;
        setMachineOptions([]);
        setWarehouseOptions([]);
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

  const filterLabel = useMemo(() => {
    const may = machines.length ? `${machines.length} máy` : 'Tất cả máy';
    const kho = warehouses.length ? `${warehouses.length} kho` : 'Tất cả kho';
    return `${may} · ${kho}`;
  }, [machines, warehouses]);

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
      // API giới hạn 2000 phiếu mới nhất/kiểu — gọi riêng nhập + xuất rồi gộp
      // để kỳ dài không mất phiếu cũ (order ngay desc + limit ở server).
      const fetchKind = async (loai: 'nhap' | 'xuat') => {
        const params = new URLSearchParams({ from: from.slice(0, 10), to: to.slice(0, 10), loai, limit: '2000' });
        const res = await fetch(`/api/xuat-nhap-tong-hop?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không tải được phiếu tổng hợp.');
        return (Array.isArray(data.records) ? data.records : []) as SlipRecord[];
      };
      const [nhapRecords, xuatRecords] = await Promise.all([fetchKind('nhap'), fetchKind('xuat')]);
      const merged = new Map<string, SlipRecord>();
      for (const slip of [...nhapRecords, ...xuatRecords]) {
        const key = text(slip.id) || `${text(slip.ma_phieu_chung)}|${text(slip.loai)}`;
        if (key && !merged.has(key)) merged.set(key, slip);
      }
      setRecords([...merged.values()]);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được phiếu tổng hợp.');
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
      const isNhap = text(slip.loai) === 'nhap';
      const isXuat = text(slip.loai) === 'xuat';
      if (!isNhap && !isXuat) continue;
      const totalKem = detail.reduce((sum, line) => sum + sumKemStored(line.chi_phi_kem_theo), 0);
      const totalKg = detail.reduce((sum, line) => sum + num(line.quy_doi_kg), 0);
      const kemPerKg = totalKg > 0 ? totalKem / totalKg : 0;
      detail.forEach((line, index) => {
        const maHang = text(line.ma_hang);
        if (!maHang) return;
        if (!matchTokenFilter(collectLineTokens(slip, line), maySet, khoSet, aliasKind)) return;
        const qty = num(line.so_luong);
        const price = num(line.don_gia);
        const amount = num(line.thanh_tien) || Math.round(qty * price * 1000) / 1000;
        const tenHang = text(line.ten_hang);
        const tenSx = text(line.ten_nvl_sx) || tenHang;
        const parties = collectLineParties(slip, line);
        const kho = text(line.kho_dong_ten) || text(line.kho_dong_id) || text(slip.kho_dich);
        const may =
          text(line.may) ||
          (text(line.dich_dong_loai) === 'may' ? text(line.dich_dong_id) : '') ||
          (text(slip.dich_loai) === 'may' ? text(slip.dich_id) : '') ||
          (text(line.src_loai) === 'may' ? text(line.src_id) : '') ||
          parties.mays[0] ||
          '';
        if (isNhap) {
          const importPrice = Math.round((price + kemPerKg) * 1000) / 1000;
          const importAmount = Math.round(qty * importPrice * 1000) / 1000;
          out.push({
            key: `${ngay}|${slip.ma_phieu_chung}|nhap|${index}|${maHang}`,
            slipId: text(slip.id),
            ngay,
            maPhieu: text(slip.ma_phieu_chung),
            kind: 'nhap',
            maHang,
            tenHang,
            tenSx,
            kho,
            may,
            slNhap: qty,
            donGiaNhap: price,
            giaNhapKho: importPrice,
            thanhTienNhap: amount,
            thanhTienNhapKho: importAmount,
            slXuat: 0,
            donGiaXuat: 0,
            thanhTienXuat: 0
          });
        } else {
          out.push({
            key: `${ngay}|${slip.ma_phieu_chung}|xuat|${index}|${maHang}`,
            slipId: text(slip.id),
            ngay,
            maPhieu: text(slip.ma_phieu_chung),
            kind: 'xuat',
            maHang,
            tenHang,
            tenSx,
            kho,
            may,
            slNhap: 0,
            donGiaNhap: 0,
            giaNhapKho: 0,
            thanhTienNhap: 0,
            thanhTienNhapKho: 0,
            slXuat: qty,
            donGiaXuat: price,
            thanhTienXuat: amount
          });
        }
      });
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
  }, [records, from, to, maySet, khoSet, aliasKind]);

  const renderRows = useMemo<RenderRow[]>(() => {
    const list: RenderRow[] = [];
    const appendBlock = (source: ReportRow[], side: 'nhap' | 'xuat', sectionLabel: string) => {
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
          slNhap: group.reduce((sum, item) => sum + item.slNhap, 0),
          thanhTienNhap: group.reduce((sum, item) => sum + item.thanhTienNhap, 0),
          thanhTienNhapKho: group.reduce((sum, item) => sum + item.thanhTienNhapKho, 0),
          slXuat: group.reduce((sum, item) => sum + item.slXuat, 0),
          thanhTienXuat: group.reduce((sum, item) => sum + item.thanhTienXuat, 0)
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
    appendBlock(rows.filter(row => row.kind === 'xuat'), 'xuat', 'Xuất');
    return list;
  }, [rows]);

  const totals = useMemo(() => {
    const maHang = new Set(rows.map(item => item.maHang.toLocaleLowerCase('vi')));
    return {
      maHang: maHang.size,
      slNhap: rows.reduce((sum, item) => sum + item.slNhap, 0),
      slXuat: rows.reduce((sum, item) => sum + item.slXuat, 0),
      thanhTienNhap: rows.reduce((sum, item) => sum + item.thanhTienNhap, 0),
      thanhTienNhapKho: rows.reduce((sum, item) => sum + item.thanhTienNhapKho, 0),
      thanhTienXuat: rows.reduce((sum, item) => sum + item.thanhTienXuat, 0)
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
        data-testid={`thong-ke-nvl-summary-${position}`}
        className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
      >
        <div className="grid md:grid-cols-2">
          <div className="border-b border-emerald-100 bg-emerald-50/70 p-3 md:border-b-0 md:border-r">
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-800">Nhập NVL</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {stat('SL nhập', formatNumber(totals.slNhap, 3), 'text-emerald-800')}
              {stat('Thành tiền', formatMoney(totals.thanhTienNhap, 0), 'text-zinc-900')}
              {stat('Tổng tiền theo giá nhập kho', formatMoney(totals.thanhTienNhapKho, 0), 'text-sky-800')}
            </div>
          </div>
          <div className="bg-rose-50/70 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-rose-800">Xuất NVL</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {stat('SL xuất', formatNumber(totals.slXuat, 3), 'text-rose-800')}
              {stat('Thành tiền xuất', formatMoney(totals.thanhTienXuat, 0), 'text-zinc-900')}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <span>
            Tổng mã hàng <strong className="font-black tabular-nums text-zinc-900">{formatNumber(totals.maHang, 0)}</strong>
          </span>
          <span className="text-zinc-300">·</span>
          <span>{filterLabel}</span>
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
      'Kho',
      'May',
      'SL Nhap',
      'Don gia nhap',
      'Gia nhap kho',
      'Thanh tien nhap',
      'Thanh tien nhap (gia nhap kho)',
      'SL xuat',
      'Don gia xuat',
      'Thanh tien xuat'
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map(item =>
      [
        formatDateVN(item.ngay),
        item.maPhieu,
        item.kind === 'nhap' ? 'Nhap' : 'Xuat',
        esc(item.tenHang),
        esc(item.tenSx),
        esc(item.kho),
        esc(item.may),
        String(Math.round(item.slNhap * 1000) / 1000),
        String(Math.round(item.donGiaNhap * 1000) / 1000),
        String(Math.round(item.giaNhapKho * 1000) / 1000),
        String(Math.round(item.thanhTienNhap * 1000) / 1000),
        String(Math.round(item.thanhTienNhapKho * 1000) / 1000),
        String(Math.round(item.slXuat * 1000) / 1000),
        String(Math.round(item.donGiaXuat * 1000) / 1000),
        String(Math.round(item.thanhTienXuat * 1000) / 1000)
      ].join(',')
    );
    const csv = `﻿${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `thong-ke-nvl-${from.slice(0, 10)}-${to.slice(0, 10)}.csv`;
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
          <h2 className="mt-1 text-base font-black text-zinc-950">Thống kê NVL</h2>
          <p className="mt-0.5 max-w-2xl text-xs font-medium text-zinc-500">
            Nhập – xuất NVL theo kỳ, lọc nhiều máy và nhiều kho. Để trống máy/kho là lấy tất cả.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
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
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-zinc-200">{filterLabel}</span>
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
                  <th rowSpan={2} className="min-w-[9rem] border border-zinc-300 bg-zinc-100 px-2.5 py-2 text-center text-[11px] font-bold">Kho</th>
                  <th rowSpan={2} className="min-w-[9rem] border border-zinc-300 bg-zinc-100 px-2.5 py-2 text-center text-[11px] font-bold">Máy</th>
                  <th colSpan={4} className="border border-emerald-200 bg-emerald-100 px-2 py-1.5 text-center text-[11px] font-bold text-emerald-950">Liên quan đến nhập</th>
                  <th colSpan={3} className="border border-rose-200 bg-rose-100 px-2 py-1.5 text-center text-[11px] font-bold text-rose-950">Liên quan đến xuất</th>
                </tr>
                <tr>
                  {['SL Nhập', 'Đơn giá', 'Giá nhập kho', 'Thành tiền'].map(label => (
                    <th key={label} className="whitespace-nowrap border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center text-[11px] font-bold text-emerald-950">
                      {label}
                    </th>
                  ))}
                  {['SL xuất', 'Đơn giá', 'Thành tiền'].map(label => (
                    <th key={`xuat-${label}`} className="whitespace-nowrap border border-rose-200 bg-rose-50 px-2 py-1.5 text-center text-[11px] font-bold text-rose-950">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renderRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="border border-zinc-200 px-3 py-8 text-center font-semibold text-zinc-400">
                      Chưa có dữ liệu nhập hoặc xuất NVL trong kỳ này.
                    </td>
                  </tr>
                ) : (
                  renderRows.map(item => {
                    const cell = 'border border-zinc-200 px-2.5 py-1.5 align-middle';
                    const nhapNum = `${cell} whitespace-nowrap bg-emerald-50/50 text-right tabular-nums`;
                    const xuatNum = `${cell} whitespace-nowrap bg-rose-50/50 text-right tabular-nums`;
                    if (item.type === 'section') {
                      const nhapSection = item.label === 'Nhập';
                      return (
                        <tr key={item.key} className={nhapSection ? 'bg-emerald-50' : 'bg-rose-50'}>
                          <td colSpan={13} className={`${cell} font-bold ${nhapSection ? 'text-emerald-950' : 'text-rose-950'}`}>
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
                          <td colSpan={13} className={`${cell} py-2`}>
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
                          <td className={cell} />
                          <td className={cell} />
                          <td className={nhapNum}>{nhap && item.slNhap ? formatNumber(item.slNhap, 3) : ''}</td>
                          <td className={nhapNum} />
                          <td className={nhapNum} />
                          <td className={nhapNum}>{nhap && item.thanhTienNhap ? formatMoney(item.thanhTienNhap, 0) : ''}</td>
                          <td className={xuatNum}>{!nhap && item.slXuat ? formatNumber(item.slXuat, 3) : ''}</td>
                          <td className={xuatNum} />
                          <td className={xuatNum}>{!nhap && item.thanhTienXuat ? formatMoney(item.thanhTienXuat, 0) : ''}</td>
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
                        <td className={`${cell} max-w-[16rem] truncate`} title={row.tenHang}>{row.tenHang}</td>
                        <td className={`${cell} max-w-[16rem] truncate`} title={row.tenSx}>{row.tenSx}</td>
                        <td className={`${cell} whitespace-nowrap`}>{row.kho || '—'}</td>
                        <td className={`${cell} whitespace-nowrap`}>{row.may || '—'}</td>
                        <td className={nhapNum}>{nhap ? formatNumber(row.slNhap, 3) : ''}</td>
                        <td className={nhapNum}>{nhap ? formatMoney(row.donGiaNhap, 0) : ''}</td>
                        <td className={nhapNum}>{nhap ? formatMoney(row.giaNhapKho, 0) : ''}</td>
                        <td className={nhapNum}>{nhap ? formatMoney(row.thanhTienNhap, 0) : ''}</td>
                        <td className={xuatNum}>{!nhap ? formatNumber(row.slXuat, 3) : ''}</td>
                        <td className={xuatNum}>{!nhap ? formatMoney(row.donGiaXuat, 0) : ''}</td>
                        <td className={xuatNum}>{!nhap ? formatMoney(row.thanhTienXuat, 0) : ''}</td>
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
          <p className="mt-1 text-xs font-medium text-zinc-500">Chọn từ ngày, đến ngày, máy và kho rồi bấm Xem.</p>
        </div>
      )}
    </div>
  );
}
