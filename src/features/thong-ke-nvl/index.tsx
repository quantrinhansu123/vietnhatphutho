import { isIsoDate } from '../../utils/isoDate';
import { movementOf, scopeBalance, type UsageReport } from './stockModel';
import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, FileDown, LayoutDashboard, Loader2, Search } from 'lucide-react';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import { VnCalendarPicker } from '../so-che-do-may';
import { queueTongHopEdit, type TongHopHeader } from '../xuat-nhap-tong-hop/model';
import { sumKemStored } from '../xuat-nhap-tong-hop/chiPhiKemTheo';
import { formatMoney, formatNumber, formatQty } from '../../utils';
import { normalizeWarehouseName } from '../kho-hang';
import { getProductionShiftOptions, normalizeShiftSettings, type ShiftOption } from '../../utils/shiftSettings';
import { MachineStockTab } from './MachineStockTab';

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
  dot_san_xuat_id?: string;
  dot_so?: number;
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
  source: string;
  dot: string;
  unit: string;
  slNhap: number;
  donGiaNhap: number;
  giaNhapKho: number;
  thanhTienNhap: number;
  thanhTienNhapKho: number;
  slXuat: number;
  donGiaXuat: number;
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
  const [viewMode, setViewMode] = useState<'overview' | 'movements' | 'balance' | 'machine-stock'>('overview');
  const [movementSide, setMovementSide] = useState<'xuat' | 'nhap'>('xuat');
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [from, setFrom] = useState(firstDayOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [machineOptions, setMachineOptions] = useState<PickOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<PickOption[]>([]);
  const [machines, setMachines] = useState<PickOption[]>([]);
  const [warehouses, setWarehouses] = useState<PickOption[]>([]);
  const [dot, setDot] = useState('');
  const [usage, setUsage] = useState<UsageReport[]>([]);
  const [applied, setApplied] = useState({ from, to, machines, warehouses, dot });
  const [records, setRecords] = useState<SlipRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch('/api/danh-sach-may').then(r => r.json().catch(() => ({}))),
      fetch('/api/quan-ly-kho').then(r => r.json().catch(() => ({}))),
      fetch('/api/cai-dat').then(r => r.json().catch(() => ({})))
    ])
      .then(([mayRes, khoRes, settingsRes]) => {
        if (!alive) return;
        setShiftOptions(getProductionShiftOptions(normalizeShiftSettings(settingsRes)));
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

  // Tải lần đầu; các thay đổi bộ lọc chỉ áp dụng khi nhấn Xem để màn hình và CSV dùng cùng một snapshot.
  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aliasKind = useMemo(
    () => buildPartyAliasKind(machineOptions, warehouseOptions),
    [machineOptions, warehouseOptions]
  );

  const maySet = useMemo(() => {
    const set = new Set<string>();
    for (const item of applied.machines) {
      set.add(foldPartyKey(item.id));
      set.add(foldPartyKey(item.label));
      for (const part of item.label.split('—')) {
        const key = foldPartyKey(part);
        if (key) set.add(key);
      }
    }
    return set;
  }, [applied.machines]);

  const khoSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of applied.warehouses) {
      set.add(foldPartyKey(item.id));
      set.add(foldPartyKey(item.label));
    }
    return set;
  }, [applied.warehouses]);

  const dotOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const slip of records) {
      const id = text(slip.dot_san_xuat_id);
      if (id) options.set(id, `Đợt ${text(slip.dot_so) || id.slice(0, 8)}`);
      else if (slip.dot_so != null) options.set(`legacy:${slip.dot_so}`, `Đợt ${slip.dot_so} (phiếu cũ, chưa có mã đợt)`);
    }
    return [...options].map(([id, label]) => ({ id, label }));
  }, [records]);

  const filterLabel = useMemo(() => {
    const may = applied.machines.length ? `${applied.machines.length} máy` : 'Tất cả máy';
    const kho = applied.warehouses.length ? `${applied.warehouses.length} kho` : 'Tất cả kho';
    const dotDisplay = !applied.dot
      ? 'Tất cả đợt'
      : dotOptions.find(option => option.id === applied.dot)?.label ||
        (applied.dot.startsWith('legacy:') ? `Đợt ${applied.dot.slice(7)}` : `Đợt ${applied.dot.slice(0, 8)}`);
    return `${may} · ${kho} · ${dotDisplay}`;
  }, [applied, dotOptions]);

  async function loadReport() {
    if (!isIsoDate(from) || !isIsoDate(to)) {
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
      const snapshot = { from, to, machines, warehouses, dot };
      const fetchPages = async <T,>(path: string, params: URLSearchParams, field: string) => {
        const rows: T[] = [];
        const cursors = new Set<string>();
        for (;;) {
          const response = await fetch(path + '?' + params);
          const data = await response.json();
          if (!response.ok || !Array.isArray(data[field]) || !('next_cursor' in data)) {
            throw new Error(data.error || 'Không tải được đầy đủ dữ liệu thống kê NVL.');
          }
          rows.push(...data[field]);
          if (!data.next_cursor) return rows;
          if (cursors.has(data.next_cursor)) throw new Error('Máy chủ lặp trang dữ liệu thống kê.');
          cursors.add(data.next_cursor);
          params.set('cursor', data.next_cursor);
        }
      };
      const fetchKind = (loai: string) => fetchPages<SlipRecord>('/api/xuat-nhap-tong-hop',
        new URLSearchParams({ to, loai, paged: '1', limit: '500' }), 'records');
      const [nhapRecords, xuatRecords, usageRecords] = await Promise.all([
        fetchKind('nhap'), fetchKind('xuat'), fetchPages<UsageReport>('/api/so-tron',
          new URLSearchParams({ den_ngay: to, usage: '1', limit: '500' }), 'reports')
      ]);
      const merged = new Map<string, SlipRecord>();
      for (const slip of [...nhapRecords, ...xuatRecords]) {
        const key = text(slip.id) || `${text(slip.ma_phieu_chung)}|${text(slip.loai)}`;
        if (key && !merged.has(key)) merged.set(key, slip);
      }
      setApplied(snapshot);
      setUsage(usageRecords);
      setRecords([...merged.values()]);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được phiếu xuất nhập NVL.');
      setLoaded(false);
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

  const balances = useMemo(() => {
    const machineAliases = new Map<string, string>();
    for (const option of machineOptions) {
      for (const alias of [option.id, option.label, ...option.label.split('—')]) {
        const key = foldPartyKey(alias);
        if (key) machineAliases.set(key, foldPartyKey(option.id));
      }
    }
    const machineKey = (id: string) => machineAliases.get(foldPartyKey(id)) || foldPartyKey(id);
    const scoped = maySet.size > 0 || khoSet.size > 0;
    const dotFilter = applied.dot;
    const movements = records
      .filter(slip => slip.trang_thai !== 'huy')
      .flatMap(slip =>
        (Array.isArray(slip.chi_tiet) ? slip.chi_tiet : [])
          .map(line => movementOf(slip, line))
          .filter(item => item.code && (!dotFilter || item.dot === dotFilter))
      );
    // Lọc đợt: sổ trộn không gắn đợt → chỉ tính tồn theo chứng từ liên kết đợt đó.
    return scopeBalance(
      movements,
      usage,
      applied.from,
      party => {
        if (!party.id) return false;
        const id = foldPartyKey(party.id);
        const kind = party.kind || aliasKind.get(id);
        return (
          (kind === 'may' && (!scoped || maySet.has(id) || maySet.has(machineKey(id)))) ||
          (kind === 'kho' && (!scoped || khoSet.has(id)))
        );
      },
      machineKey,
      applied.to,
      { excludeUsage: Boolean(dotFilter) }
    );
  }, [records, usage, applied.from, applied.to, applied.dot, maySet, khoSet, machineOptions, aliasKind]);

  const rows = useMemo<ReportRow[]>(() => {
    const out: ReportRow[] = [];
    for (const slip of records) {
      if (text(slip.trang_thai) === 'huy') continue;
      const ngay = text(slip.ngay).slice(0, 10);
      if (!ngay || ngay < applied.from || ngay > applied.to) continue;
      const detail = Array.isArray(slip.chi_tiet) ? slip.chi_tiet : [];
      const dotLabel = text(slip.dot_so);
      if (applied.dot && (text(slip.dot_san_xuat_id) || (slip.dot_so == null ? '' : `legacy:${slip.dot_so}`)) !== applied.dot) continue;
      const totalKem = detail.reduce((sum, line) => sum + sumKemStored(line.chi_phi_kem_theo), 0);
      const totalKg = detail.reduce((sum, line) => sum + num(line.quy_doi_kg), 0);
      const kemPerKg = totalKg > 0 ? totalKem / totalKg : 0;
      detail.forEach((line, index) => {
        const maHang = text(line.ma_hang);
        if (!maHang) return;
        if (!matchTokenFilter(collectLineTokens(slip, line), maySet, khoSet, aliasKind)) return;
        const movement = movementOf(slip, line);
        const isReturn = movement.from.kind === 'may' && movement.to.kind === 'kho';
        const isNhap = slip.loai === 'nhap' || isReturn;
        const source = isReturn ? (line.so_tron_id ? 'Nhập lại · Sổ trộn' : 'Nhập lại từ máy') : '';
        const unit = movement.unit;
        const qty = num(line.so_luong);
        const price = num(line.don_gia);
        const amount = num(line.thanh_tien) || Math.round(qty * price * 1000) / 1000;
        const tenHang = text(line.ten_hang);
        const tenSx = text(line.ten_nvl_sx) || tenHang;
        const parties = collectLineParties(slip, line);
        const kho = (isReturn ? movement.to.id : '') || text(line.kho_dong_ten) || text(line.kho_dong_id) || (movement.from.kind === 'kho' ? movement.from.id : '') || text(slip.kho_dich);
        const may =
          (isReturn ? movement.from.id : '') || text(line.may) ||
          (text(line.dich_dong_loai) === 'may' ? text(line.dich_dong_id) : '') ||
          (text(slip.dich_loai) === 'may' ? text(slip.dich_id) : '') ||
          (text(line.src_loai) === 'may' ? text(line.src_id) : '') ||
          parties.mays[0] ||
          '';
        if (isNhap) {
          const importPrice = Math.round((price + kemPerKg) * 1000) / 1000;
          const importAmount = Math.round(qty * (price + kemPerKg) * 1000) / 1000;
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
            source, dot: dotLabel, unit,
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
            source, dot: dotLabel, unit,
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
  }, [records, applied, maySet, khoSet, aliasKind]);

  const totals = useMemo(() => {
    const totalsByUnit = new Map<string, { nhap: number; xuat: number }>();
    for (const item of rows) {
      const unit = totalsByUnit.get(item.unit) || { nhap: 0, xuat: 0 };
      unit.nhap += item.slNhap;
      unit.xuat += item.slXuat;
      totalsByUnit.set(item.unit, unit);
    }
    return {
      totalsByUnit,
      thanhTienNhap: rows.reduce((sum, item) => sum + item.thanhTienNhap, 0),
      thanhTienNhapKho: rows.reduce((sum, item) => sum + item.thanhTienNhapKho, 0),
      thanhTienXuat: rows.reduce((sum, item) => sum + item.thanhTienXuat, 0)
    };
  }, [rows]);

  const filtersChanged = from !== applied.from || to !== applied.to || dot !== applied.dot ||
    machines.map(item => item.id).join('|') !== applied.machines.map(item => item.id).join('|') ||
    warehouses.map(item => item.id).join('|') !== applied.warehouses.map(item => item.id).join('|');

  const quantityLabel = (side: 'nhap' | 'xuat') =>
    [...totals.totalsByUnit]
      .filter(([, qty]) => qty[side] !== 0)
      .map(([unit, qty]) => `${formatQty(qty[side])} ${unit || 'đơn vị'}`)
      .join(' · ') || '0';

  function balanceQuantityLabel(field: 'used' | 'closing') {
    if (balances.usageExcluded && field === 'used') return 'Chưa trừ (lọc đợt)';
    if (balances.rows.some(row => row[field] === null)) return 'Chưa xác định';
    const byUnit = new Map<string, number>();
    for (const row of balances.rows) {
      byUnit.set(row.unit, (byUnit.get(row.unit) ?? 0) + (row[field] ?? 0));
    }
    return [...byUnit].map(([unit, quantity]) => formatQty(quantity) + ' ' + (unit || 'đơn vị')).join(' · ') || '0';
  }

  const summary = [
    { label: 'Nhập', value: quantityLabel('nhap'), amounts: [
      { label: 'Thành tiền', value: totals.thanhTienNhap },
      { label: 'Theo giá nhập kho', value: totals.thanhTienNhapKho }
    ] },
    { label: 'Xuất', value: quantityLabel('xuat'), amounts: [{ label: 'Thành tiền', value: totals.thanhTienXuat }] },
    { label: 'Sử dụng', value: balanceQuantityLabel('used') },
    { label: 'Tồn cuối', value: balanceQuantityLabel('closing') }
  ];

  function exportCsv() {
    const header = [
      'Ngày',
      'Phieu',
      'Loai phieu',
      'Ten NVL',
      'Ten NVL san xuat',
      'Kho',
      'Máy', 'Đợt', 'Nguồn', 'Đơn vị',
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
        item.kind === 'nhap' ? 'Phieu nhap' : 'Phieu xuat',
        esc(item.tenHang),
        esc(item.tenSx),
        esc(item.kho),
        esc(item.may), esc(item.dot), esc(item.source), esc(item.unit),
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
    const stockLines = balances.rows.map(row =>
      [esc(row.code), esc(row.name), esc(row.unit), row.opening, row.inbound, row.outbound,
        balances.usageExcluded ? 'Chưa trừ (lọc đợt)' : (row.used ?? 'Chưa có dữ liệu'),
        row.closing ?? 'Chưa xác định'].join(','));
    const warnings = [
      ...(balances.duplicateShifts > 0
        ? [esc('Cảnh báo: có sổ trùng máy, ngày, ca — báo cáo dùng bản cập nhật mới nhất.')]
        : []),
      ...(balances.usageExcluded
        ? [esc('Tồn theo đợt chỉ tính chứng từ liên kết đợt; sổ trộn không gắn đợt nên chưa trừ sử dụng.')]
        : [])
    ];
    const csv = ['﻿' + esc(formatDateVN(applied.from) + ' – ' + formatDateVN(applied.to) + ' · ' + filterLabel),
      ...warnings,
      header.join(','), ...lines, '', 'Mã NVL,Tên SX,Đơn vị,Tồn đầu,Nhập phạm vi,Xuất phạm vi,Sử dụng,Tồn cuối theo chứng từ',
      ...stockLines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `thong-ke-nvl-${applied.from}-${applied.to}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const stockSection = (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white" aria-label="Tồn và sử dụng theo chứng từ">
      {balances.duplicateShifts > 0 && <p className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Có sổ trùng máy, ngày, ca.</p>}
      {balances.usageExcluded && (
        <p className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          Tồn theo đợt tính từ chứng từ gắn đợt đã chọn. Sổ trộn không gắn đợt nên cột Sử dụng chưa trừ; Tồn cuối = Tồn đầu + Nhập − Xuất.
        </p>
      )}
      <div className="overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-600"><tr>
            {['Mã NVL', 'Tên sản xuất', 'ĐVT', 'Tồn đầu', 'Nhập', 'Xuất', 'Sử dụng', 'Tồn cuối'].map((label, index) => <th scope="col" key={label} className={'whitespace-nowrap border-b border-zinc-200 px-3 py-2 font-semibold ' + (index >= 3 ? 'text-right' : 'text-left')}>{label}</th>)}
          </tr></thead>
          <tbody>{balances.rows.length ? balances.rows.map(row => <tr key={JSON.stringify([row.code, row.name, row.unit])} className="border-b border-zinc-100 hover:bg-zinc-50">
            <td className="px-3 py-2 font-bold">{row.code}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.unit || '—'}</td>
            {[row.opening, row.inbound, row.outbound].map((value, index) => <td key={index} className="px-3 py-2 text-right tabular-nums">{formatQty(value)}</td>)}
            <td className="px-3 py-2 text-right tabular-nums">{
              balances.usageExcluded ? 'Chưa trừ (lọc đợt)' : row.used === null ? 'Chưa có dữ liệu' : formatQty(row.used)
            }</td>
            <td className="px-3 py-2 text-right font-bold tabular-nums">{row.closing === null ? 'Chưa xác định' : formatQty(row.closing)}</td>
          </tr>) : <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-500">Chưa có dòng tồn trong phạm vi đã chọn.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-xs font-bold text-[#ef1b2d] hover:underline">
            ← Kho
          </button>
          <h2 className="mt-2 text-xl font-black tracking-tight text-zinc-950 sm:text-2xl">Thống kê nguyên vật liệu</h2>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-zinc-200" role="tablist" aria-label="Các phần thống kê NVL">
        <div className="flex min-w-max gap-1">
          {([
            { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
            { id: 'movements', label: 'Chứng từ nhập–xuất' },
            { id: 'balance', label: 'Tồn & sử dụng', icon: Boxes },
            { id: 'machine-stock', label: 'Kiểm tra theo máy', icon: Search }
          ] as const).map(tab => {
            const Icon = 'icon' in tab ? tab.icon : null;
            return <button
              key={tab.id}
              type="button"
              role="tab"
              id={`nvl-tab-${tab.id}`}
              aria-controls={`nvl-panel-${tab.id}`}
              aria-selected={viewMode === tab.id}
              onClick={() => setViewMode(tab.id)}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const ids = ['overview', 'movements', 'balance', 'machine-stock'] as const;
                const current = ids.indexOf(tab.id);
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 :
                  (current + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
                setViewMode(ids[next]);
                document.getElementById(`nvl-tab-${ids[next]}`)?.focus();
              }}
              tabIndex={viewMode === tab.id ? 0 : -1}
              className={`flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600 ${viewMode === tab.id ? 'border-[#ef1b2d] text-[#b91521]' : 'border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'}`}
            >{Icon ? <Icon className="h-4 w-4" /> : null}{tab.label}</button>;
          })}
        </div>
      </div>

      {viewMode !== 'machine-stock' ? <div role="tabpanel" id={`nvl-panel-${viewMode}`} aria-labelledby={`nvl-tab-${viewMode}`} className="space-y-4">
      <section aria-label="Bộ lọc báo cáo" className="rounded-lg border border-zinc-200 bg-white p-3">
        <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_repeat(2,minmax(0,1.25fr))_auto]">
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-zinc-700">Từ ngày</span>
            <VnCalendarPicker value={from} onChange={setFrom} triggerClassName="min-h-10" />
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-zinc-700">Đến ngày</span>
            <VnCalendarPicker value={to} onChange={setTo} triggerClassName="min-h-10" />
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-zinc-700">Đợt</span>
            <select className="min-h-10 w-full rounded-lg border border-zinc-200 px-2" value={dot} onChange={event => setDot(event.target.value)}>
              <option value="">Tất cả đợt</option>
              {dotOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <div className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-zinc-700">Máy</span>
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
            <span className="text-xs font-medium text-zinc-700">Kho</span>
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
          <div className="col-span-2 flex items-center gap-2 md:col-span-1">
            <button
              type="button"
              onClick={() => void loadReport()}
              disabled={loading}
              className="flex min-h-10 items-center gap-2 rounded-lg bg-[#ef1b2d] px-4 text-sm font-bold text-white hover:bg-[#d71926] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Xem
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!loaded || loading}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              Excel
            </button>
          </div>
        </div>
        {filtersChanged && loaded && <p role="status" className="mt-2 text-xs text-amber-800">Chưa áp dụng · Đang xem {formatDateVN(applied.from)} – {formatDateVN(applied.to)} · {filterLabel}</p>}
      </section>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>
      ) : null}

      {viewMode === 'movements' && (
        <div className="flex gap-1 border-b border-zinc-200" role="tablist" aria-label="Loại chứng từ">
          {(['xuat', 'nhap'] as const).map(side => (
            <button key={side} type="button" role="tab" id={`nvl-movement-tab-${side}`}
              aria-controls={`nvl-movement-panel-${side}`} aria-selected={movementSide === side}
              tabIndex={movementSide === side ? 0 : -1}
              onClick={() => setMovementSide(side)}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 'xuat' : event.key === 'End' ? 'nhap' : movementSide === 'xuat' ? 'nhap' : 'xuat';
                setMovementSide(next);
                document.getElementById(`nvl-movement-tab-${next}`)?.focus();
              }}
              className={`min-h-10 border-b-2 px-5 text-sm font-bold ${movementSide === side
                ? 'border-[#ef1b2d] text-[#b91521]' : 'border-transparent text-zinc-600 hover:bg-zinc-50'}`}
            >{side === 'xuat' ? 'Xuất' : 'Nhập'}</button>
          ))}
        </div>
      )}

      {loaded ? (
        <>
          {viewMode === 'overview' && (
            <dl data-testid="thong-ke-nvl-summary-tren" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {summary.map(({ label, value, amounts }) => (
                <div key={label} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3">
                  <dt className="text-sm font-medium text-zinc-600">{label}</dt>
                  <dd className="mt-1 break-words text-lg font-semibold tabular-nums text-zinc-950">{value}</dd>
                  {amounts?.map(amount => (
                    <dd key={amount.label} className="mt-1 text-xs tabular-nums text-zinc-600">{amount.label} · {formatMoney(amount.value, 0)}</dd>
                  ))}
                </div>
              ))}
            </dl>
          )}
          {viewMode === 'balance' && stockSection}
          {viewMode === 'movements' && <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-base font-black text-zinc-900">Chi tiết chứng từ {movementSide === 'xuat' ? 'xuất' : 'nhập'}</h3>
              <span className="text-xs text-zinc-600">{formatNumber(rows.filter(row => row.kind === movementSide).length, 0)} dòng</span>
            </div>
          <div role="tabpanel" id={`nvl-movement-panel-${movementSide}`} aria-labelledby={`nvl-movement-tab-${movementSide}`} className="min-w-0">
            {([movementSide] as const).map(side => {
              const nhapTable = side === 'nhap';
              const sideRows = rows.filter(row => row.kind === side);
              const columnCount = nhapTable ? 11 : 10;
              return <section key={side} aria-label={`Chứng từ ${nhapTable ? 'nhập' : 'xuất'}`} className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="max-h-[min(70vh,52rem)] overflow-auto">
              <table className="w-max min-w-full border-collapse text-xs text-zinc-900">
              <thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgb(212_212_216)]">
                <tr>
                  {['Ngày', 'Phiếu', 'Loại phiếu', 'Tên NVL', 'Tên NVL sản xuất', 'Kho', 'Máy'].map(label => (
                    <th key={label} scope="col" className="whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-2.5 py-2 text-left text-[11px] font-bold">{label}</th>
                  ))}
                  {nhapTable && ['SL nhập', 'Đơn giá', 'Giá nhập kho', 'Thành tiền'].map(label => (
                    <th key={label} className="whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-right text-[11px] font-bold text-zinc-700">
                      {label}
                    </th>
                  ))}
                  {!nhapTable && ['SL xuất', 'Đơn giá', 'Thành tiền'].map(label => (
                    <th key={`xuat-${label}`} className="whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-right text-[11px] font-bold text-zinc-700">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sideRows.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="border border-zinc-200 px-3 py-8 text-center font-semibold text-zinc-400">
                      Chưa có chứng từ {nhapTable ? 'nhập' : 'xuất'} trong kỳ.
                    </td>
                  </tr>
                ) : (
                  sideRows.map(row => {
                    const cell = 'border-b border-zinc-100 px-2 py-1.5 align-middle';
                    const numberCell = `${cell} whitespace-nowrap text-right tabular-nums`;
                    return (
                      <tr key={row.key} className="bg-white hover:bg-zinc-50">
                        <td className={`${cell} whitespace-nowrap text-center`}>{formatDateVN(row.ngay)}</td>
                        <td className={`${cell} whitespace-nowrap`}>
                          <button
                            type="button"
                            title="Sửa phiếu"
                            onClick={() => openSlip(row.slipId)}
                            className="cursor-pointer font-semibold text-[#ef1b2d] hover:underline"
                          >
                            {row.maPhieu}
                          </button>
                        </td>
                        <td className={`${cell} whitespace-nowrap text-center font-semibold ${nhapTable ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {row.source || (nhapTable ? 'Phiếu nhập' : 'Phiếu xuất')}{row.dot ? ' · Đợt ' + row.dot : ''}
                        </td>
                        <td className={`${cell} max-w-[16rem] truncate`} title={row.tenHang}>{row.tenHang}</td>
                        <td className={`${cell} max-w-[16rem] truncate`} title={row.tenSx}>{row.tenSx}</td>
                        <td className={`${cell} whitespace-nowrap`}>{row.kho || '—'}</td>
                        <td className={`${cell} whitespace-nowrap`}>{row.may || '—'}</td>
                        {nhapTable ? <>
                          <td className={numberCell}>{formatQty(row.slNhap)}</td>
                          <td className={numberCell}>{formatMoney(row.donGiaNhap, 0)}</td>
                          <td className={numberCell}>{formatMoney(row.giaNhapKho, 0)}</td>
                          <td className={numberCell}>{formatMoney(row.thanhTienNhap, 0)}</td>
                        </> : <>
                          <td className={numberCell}>{formatQty(row.slXuat)}</td>
                          <td className={numberCell}>{formatMoney(row.donGiaXuat, 0)}</td>
                          <td className={numberCell}>{formatMoney(row.thanhTienXuat, 0)}</td>
                        </>}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
              </div>
              </section>;
            })}
          </div>
          </>}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center">
          {loading && <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#ef1b2d]" />}
          <p className="text-sm font-bold text-zinc-700">{loading ? 'Đang tải…' : error ? 'Không thể hiển thị số liệu' : 'Chưa có số liệu'}</p>
        </div>
      )}
      </div> : <div role="tabpanel" id="nvl-panel-machine-stock" aria-labelledby="nvl-tab-machine-stock"><MachineStockTab machines={machineOptions} shifts={shiftOptions} /></div>}
    </div>
  );
}
