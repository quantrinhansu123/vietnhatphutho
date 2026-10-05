import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronDown, Loader2, Plus, Printer, Search, Trash2 } from 'lucide-react';
import WarehouseSlipPrintModal, { type WarehouseSlipPrintData } from '../../components/WarehouseSlipPrintModal';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { VnCalendarPicker } from '../so-che-do-may';
import {
  formatWarehouseShiftSelection,
  lenhSxInstanceKey,
  normalizeWarehouseProductionOrders,
  parseWarehouseShiftSelection,
  toggleWarehouseShiftSelection
} from '../phieu-xuat-nhap-kho';
import { resolveDefaultTonDauRef, validateWarehouseShiftsSameLoaiCa } from '../phieu-xuat-nhap-kho/nvlSlipLogic';
import { getProductionShiftOptions, normalizeShiftSettings, shiftNamesMatch } from '../../utils/shiftSettings';
import { formatMixingNormSlipName } from '../../utils/mixingNormAuxiliary';
import { mergeNormMaterialLines, normalizeMaterialKey } from '../../utils/warehouseNormMerge';
import { convertWarehouseQuantityToKg, formatWarehouseWeightKg, isWarehouseKgUnit } from '../../utils/warehouseWeight';
import { fetchSoTronTonCuoiCaSlot, lookupSoTronPrevTon } from '../../utils/soTronPrevShiftTon';
import type { MaterialOption } from '../san-pham/types';
import { normalizeWarehouseName } from '../kho-hang';
import {
  formatTongHopDate,
  isNhapCoreWarehouse,
  isNvlWarehouseName,
  LOAI_NHAP_OPTIONS,
  LOAI_XUAT_OPTIONS,
  pickNhapCoreWarehouses,
  takePendingTongHopEdit,
  takePendingTongHopView,
  xuatDenKind,
  type TongHopHeader,
  type TongHopMode
} from './model';
import { emptyXuatNvlFields, ChiPhiKemTheoPanel, XuatNvlDetail, type XuatNvlLine } from './xuatNvlDetail';
import { kemDraftError, kemDraftFromStored, kemStoredFromDraft, roundKem, sumKemDraft } from './chiPhiKemTheo';
import { formatMoney, formatNumber, parseLocalizedNumber } from '../../utils';

type Mode = TongHopMode;
type Option = { id: string; label: string; kind: 'kho' | 'may' | 'ncc'; vatTu?: boolean; maKho?: string };

type KhoNvlOption = MaterialOption & { tenKho: string; loaiKho: string };

type Line = XuatNvlLine & {
  /** Nhập: kho hoặc nhà cung cấp (nguồn header). Xuất: loại nơi XUẤT ĐẾN của dòng. */
  sourceLoai: 'kho' | 'ncc' | 'may';
  /** Nhập: kho nhập. Xuất: kho/máy/nhà cung cấp xuất đến. */
  khoId: string;
  /** Xuất: loại nguồn riêng từng dòng. */
  srcLoai: 'kho' | 'may';
  /** Xuất: kho/máy nguồn riêng từng dòng. */
  srcId: string;
  ton: number | null;
};

const emptyLine = (): Line => ({
  ...emptyXuatNvlFields(),
  sourceLoai: 'kho',
  khoId: '',
  srcLoai: 'kho',
  srcId: '',
  ton: null
});

function mapKhoNvlRows(rows: Array<Record<string, unknown>>): KhoNvlOption[] {
  return rows
    .map(row => ({
      id: String(row.id ?? '').trim(),
      code: String(row.ma_npl ?? '').trim(),
      name: String(row.ten_npl ?? '').trim(),
      unit: String(row.don_vi ?? '').trim(),
      totalWeight: String(row.tong_trong_luong ?? '').trim(),
      productionName: String(row.ten_nvl_sx ?? '').trim(),
      phanLoai: String(row.phan_loai ?? '').trim(),
      nhomVatTuPhu: String(row.nhom_vat_tu_phu ?? row.nhomVatTuPhu ?? '').trim(),
      tenKho: String(row.ten_kho ?? row.warehouse ?? '').trim(),
      loaiKho: String(row.loai_kho ?? '').trim()
    }))
    .filter(row => row.code);
}

/** Chuẩn hóa để so trùng NVL trong phiên: trim + gộp khoảng trắng + không phân biệt hoa thường. */
function normNvlIdentityText(value: string) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

/** Đúng một kho: tên kho khớp, hoặc ten_kho trống và loai_kho = mã kho. Không lấy cả bảng kho_nvl. */
function materialInWarehouse(item: { tenKho?: string; loaiKho?: string }, ten: string, maKho: string) {
  const rowTen = normalizeWarehouseName(item.tenKho || '');
  const wantTen = normalizeWarehouseName(ten);
  if (!wantTen) return false;
  if (rowTen) return rowTen === wantTen;
  return Boolean(maKho && item.loaiKho && item.loaiKho === maKho);
}

type WarehouseMaterialRef = {
  id?: string;
  code: string;
  name: string;
  productionName?: string;
  unit?: string;
};

function sameWarehouseText(left: string, right: string) {
  return left.trim().toLocaleLowerCase('vi') === right.trim().toLocaleLowerCase('vi');
}

/**
 * Id trên phiếu trộn có thể thuộc kho khác kho đang xuất.
 * Giữ id nếu đúng kho; không thì gắn dòng cùng mã + tên + tên SX trong kho xuất.
 * Không khớp thì bỏ id — ô hiện mã và tên SX, không hiện UUID.
 */
function bindMaterialInWarehouse<T extends {
  materialId: string;
  maHang: string;
  tenHang: string;
  tenSanXuat: string;
  donVi: string;
}>(line: T, pool: WarehouseMaterialRef[]): T {
  const id = line.materialId.trim();
  if (id && pool.some(item => String(item.id || '').trim() === id)) return line;
  const code = line.maHang.trim();
  if (!code || !pool.length) return id ? { ...line, materialId: '' } : line;
  const name = line.tenHang.trim();
  const sx = line.tenSanXuat.trim();
  const matches = pool.filter(item => {
    if (!sameWarehouseText(item.code, code)) return false;
    if (name && !sameWarehouseText(item.name, name)) return false;
    if (sx && !sameWarehouseText(String(item.productionName || ''), sx)) return false;
    return true;
  });
  if (matches.length !== 1) return { ...line, materialId: '' };
  const hit = matches[0];
  const nextId = String(hit.id || '').trim();
  if (!nextId) return { ...line, materialId: '' };
  return {
    ...line,
    materialId: nextId,
    maHang: hit.code || line.maHang,
    tenHang: hit.name || line.tenHang,
    tenSanXuat: String(hit.productionName || line.tenSanXuat).trim(),
    donVi: String(hit.unit || line.donVi).trim() || line.donVi
  };
}

function warehouseClassFromPhanLoai(value: string): 'nvl_chinh' | 'nvl_phu' | 'chua_phan_loai' {
  const normalized = value
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  if (normalized === 'nvl_phu' || normalized.includes('phu')) return 'nvl_phu';
  if (normalized === 'nvl_chinh' || normalized.includes('chinh')) return 'nvl_chinh';
  return 'chua_phan_loai';
}

function doneOrderStatus(status: string) {
  const normalized = status.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  return normalized === 'hoan thanh' || normalized === 'huy';
}

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function TongHopPanel({ onBack, onOpenList, viewOnly }: { onBack: () => void; onOpenList: () => void; viewOnly?: boolean }) {
  const [mode, setMode] = useState<Mode>('nhap');
  const [ngay, setNgay] = useState(todayIso());
  const [cas, setCas] = useState<string[]>([]);
  const [shiftSettings, setShiftSettings] = useState<ReturnType<typeof normalizeShiftSettings>>([]);
  const fieldClass = viewOnly
    ? 'h-9 w-full rounded-lg border border-zinc-200 px-2.5 text-xs font-semibold text-zinc-600 bg-zinc-50'
    : 'h-9 w-full rounded-lg border border-zinc-200 px-2.5 text-xs font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [machines, setMachines] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<KhoNvlOption[]>([]);
  const [products, setProducts] = useState<Array<{ code: string; name: string; unit: string; tenKho: string; totalWeight: string }>>([]);
  const [nguonLoai, setNguonLoai] = useState<'kho' | 'ncc'>('kho');
  const [nguonId, setNguonId] = useState('');
  const [loaiNhap, setLoaiNhap] = useState('');
  const [loaiXuat, setLoaiXuat] = useState('');
  const [xuatDenLoai, setXuatDenLoai] = useState<'kho' | 'may'>('kho');
  const [xuatDenId, setXuatDenId] = useState('');
  /** Xuất trả NCC: nhà cung cấp nhận hàng (chọn dưới danh sách chi tiết). */
  const [xuatNccId, setXuatNccId] = useState('');
  const [ptdmKeys, setPtdmKeys] = useState<string[]>([]);
  const [ptdmOpen, setPtdmOpen] = useState(false);
  const [ptdmSearch, setPtdmSearch] = useState('');
  const [mixingNorms, setMixingNorms] = useState<Array<Record<string, unknown>>>([]);
  const [productionOrders, setProductionOrders] = useState<ReturnType<typeof normalizeWarehouseProductionOrders>>([]);
  const [loadingNorms, setLoadingNorms] = useState(false);
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
  const ptdmTriggerRef = useRef<HTMLButtonElement | null>(null);
  const ptdmPanelRef = useRef<HTMLDivElement | null>(null);
  const [ptdmMenu, setPtdmMenu] = useState<{ top: number; left: number; width: number } | null>(null);
  const [ghiChu, setGhiChu] = useState('');
  const [nguoiLap, setNguoiLap] = useState('');
  const [nguoiGiao, setNguoiGiao] = useState('');
  const [diaDiem, setDiaDiem] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [staff, setStaff] = useState<Array<{ id: string; label: string }>>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);
  const [printSlips, setPrintSlips] = useState<WarehouseSlipPrintData[] | null>(null);

  /** Tên SX theo mã (ưu tiên snapshot dòng, fallback kho_nvl). */
  function resolveTenSx(maHang: string, snap: string, materialId = '') {
    const direct = String(snap || '').trim();
    if (direct) return direct;
    const id = materialId.trim();
    if (id) {
      const byId = materials.find(item => String(item.id || '').trim() === id);
      if (byId) return String(byId.productionName || '').trim();
    }
    const code = String(maHang || '').trim().toLowerCase();
    if (!code) return '';
    const sameCode = materials.filter(item => String(item.code || '').trim().toLowerCase() === code);
    return sameCode.length === 1 ? String(sameCode[0].productionName || '').trim() : '';
  }

  function srcIsNvl(srcLoai: string, srcId: string) {
    if (srcLoai === 'may') return true;
    const kho = warehouses.find(item => item.id === srcId);
    return kho ? Boolean(kho.vatTu) : true;
  }

  function srcLabel(srcLoai: string, srcId: string) {
    if (!srcId) return '';
    if (srcLoai === 'may') return machines.find(item => item.id === srcId)?.label || srcId;
    return srcId;
  }

  useEffect(() => {
    const load = async () => {
      const [khoRes, mayRes, nccRes, caRes, nvlRes, spRes, nsRes] = await Promise.all([
        fetch('/api/quan-ly-kho').then(r => r.json()).catch(() => ({})),
        fetch('/api/danh-sach-may').then(r => r.json()).catch(() => ({})),
        fetch('/api/nha-cung-cap').then(r => r.json()).catch(() => ({})),
        fetch('/api/cai-dat').then(r => r.json()).catch(() => ({})),
        fetch('/api/kho-nvl').then(r => r.json()).catch(() => ({})),
        fetch('/api/nhap-kho').then(r => r.json()).catch(() => ({})),
        fetch('/api/nhan-su?format=groups&scope=all').then(r => r.json()).catch(() => ({}))
      ]);
      const khoRows = Array.isArray(khoRes.records) ? khoRes.records : [];
      setWarehouses(
        khoRows
          .map((row: Record<string, unknown>) => {
            const ten = String(row.ten_kho ?? '').trim();
            return ten ? { id: ten, label: ten, kind: 'kho' as const, vatTu: isNvlWarehouseName(ten) || isNhapCoreWarehouse(ten), maKho: String(row.ma_kho ?? '').trim() } : null;
          })
          .filter(Boolean) as Option[]
      );
      const mayRows = Array.isArray(mayRes.machines) ? mayRes.machines : [];
      setMachines(
        mayRows
          .map((row: Record<string, unknown>) => {
            const id = String(row.ma_may ?? '').trim();
            const ten = String(row.ten_may ?? '').trim();
            return id ? { id, label: ten ? `${id} — ${ten}` : id, kind: 'may' as const, vatTu: true } : null;
          })
          .filter(Boolean) as Option[]
      );
      const nccRows = Array.isArray(nccRes.suppliers) ? nccRes.suppliers : Array.isArray(nccRes.records) ? nccRes.records : [];
      setSuppliers(
        nccRows
          .map((row: Record<string, unknown>) => {
            const id = String(row.ma_nha_cung_cap ?? row.id ?? '').trim();
            const ten = String(row.ten_nha_cung_cap ?? '').trim();
            return id ? { id, label: ten ? `${id} — ${ten}` : id, kind: 'ncc' as const } : null;
          })
          .filter(Boolean) as Option[]
      );
      setShiftSettings(normalizeShiftSettings(caRes));
      const nvlRows = Array.isArray(nvlRes.materials) ? nvlRes.materials : Array.isArray(nvlRes.records) ? nvlRes.records : [];
      setMaterials(mapKhoNvlRows(nvlRows));
      const spRows = Array.isArray(spRes.records) ? spRes.records : [];
      setProducts(
        spRows
          .filter((row: Record<string, unknown>) => !String(row.ma_may ?? '').trim())
          .map((row: Record<string, unknown>) => ({
            code: String(row.ma_sp ?? '').trim(),
            name: String(row.ten_sp ?? '').trim(),
            unit: String(row.don_vi ?? '').trim(),
            tenKho: String(row.ten_kho ?? '').trim(),
            totalWeight: String(row.trong_luong_kg_mot_sp ?? row.tong_trong_luong ?? '').trim()
          }))
          .filter((row: { code: string }) => row.code)
      );
      const branches = Array.isArray(nsRes.branches) ? nsRes.branches : [];
      const people = new Map<string, { id: string; label: string }>();
      for (const branch of branches) {
        const departments = Array.isArray(branch?.departments) ? branch.departments : [];
        for (const department of departments) {
          const members = Array.isArray(department?.members) ? department.members : [];
          for (const member of members) {
            const name = String(member?.name || '').trim();
            const status = String(member?.status || '').trim();
            if (!name || status !== 'Đang làm') continue;
            const code = String(member?.code || name).trim();
            people.set(code, { id: name, label: code && code !== name ? `${code} — ${name}` : name });
          }
        }
      }
      setStaff([...people.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi')));
    };
    void load();
  }, []);

  function patchLine(index: number, patch: Partial<Line>) {
    setLines(current => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function refreshTon(index: number, line: Line) {
    // Tồn theo NGUỒN từng dòng (xuất) hoặc nguồn header (nhập).
    const srcLoai = mode === 'xuat' ? line.srcLoai : nguonLoai === 'ncc' ? '' : 'kho';
    const srcId = mode === 'xuat' ? line.srcId : nguonId;
    if (!line.maHang || !srcId) {
      patchLine(index, { ton: null });
      return;
    }
    const nvl = srcLoai === 'may' || srcIsNvl(srcLoai, srcId);
    const params = new URLSearchParams({ ma_hang: line.maHang, catalog: nvl ? 'nvl' : 'san_pham' });
    if (srcLoai === 'may') params.set('ma_may', srcId);
    else params.set('ten_kho', srcId);
    const res = await fetch(`/api/xuat-nhap-tong-hop/ton?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const ton = Number(data.ton) || 0;
      // Nguồn kho: mirror tồn sổ sang tồn đầu khi chưa sửa tay (đích máy lấy từ sổ trộn).
      const patch: Partial<Line> = { ton };
      const destKindNow = xuatDenKind(loaiXuat);
      const destMay = destKindNow === 'may' || destKindNow === 'may-ptdm' || (destKindNow === 'flex' && xuatDenLoai === 'may');
      if (mode === 'xuat' && srcLoai === 'kho' && !destMay && !line.tonDauDirty && line.tonDau === null) {
        patch.tonDau = ton;
      }
      patchLine(index, patch);
    }
  }

  const allShifts = [...cas, ...lines.map(line => line.caDong).filter(Boolean)];
  const shiftError = validateWarehouseShiftsSameLoaiCa(allShifts, shiftSettings);
  const destKind = xuatDenKind(loaiXuat);
  const headerMay = mode === 'xuat' && (destKind === 'may' || destKind === 'may-ptdm' || (destKind === 'flex' && xuatDenLoai === 'may'))
    ? xuatDenId
    : '';
  const lineMayDest = Boolean(headerMay);
  const warning = !shiftError && cas.length === 0 && mode === 'xuat' && destKind === 'may-ptdm'
    ? 'Xuất NVL cho máy nên có ca để sổ trộn tính Nhập Trong Ngày. Vẫn lưu được nếu để trống.'
    : '';

  // Tồn đầu ca từng dòng: nguồn máy → tồn cuối đúng ô (ngày dòng, ca dòng, máy nguồn) trong sổ trộn.
  const tonDauFingerprint = mode === 'xuat'
    ? `${headerMay}|${lines.map(line => `${line.key}|${line.maHang}|${line.materialId}|${line.ngayDong}|${line.caDong}|${line.srcId}|${ngay}|${cas.join(',')}`).join(';;')}`
    : '';
  useEffect(() => {
    if (mode !== 'xuat' || !lineMayDest) return;
    const shiftRows = getProductionShiftOptions(shiftSettings);
    const tonDefault = resolveDefaultTonDauRef(ngay, cas[0] || '', shiftRows, shiftSettings);
    const jobs: Array<{ key: string; maHang: string; materialId: string; may: string; ngay: string; ca: string }> = [];
    for (const line of lines) {
      const may = headerMay;
      if (!may || !line.maHang.trim() || line.tonDauDirty) continue;
      const lineNgay = line.ngayDong || tonDefault.ngay || ngay;
      const lineCa = line.caDong || tonDefault.ca || cas[0] || '';
      if (!lineNgay || !lineCa) continue;
      jobs.push({ key: line.key, maHang: line.maHang.trim(), materialId: line.materialId, may, ngay: lineNgay, ca: lineCa });
    }
    if (jobs.length === 0) return;
    let alive = true;
    const controller = new AbortController();
    void (async () => {
      const slotCache = new Map<string, Map<string, number>>();
      const fetchSlot = async (ngayV: string, caV: string, may: string) => {
        const cacheKey = `${ngayV}||${caV}||${may}`.toLowerCase();
        const cached = slotCache.get(cacheKey);
        if (cached) return cached;
        try {
          const result = await fetchSoTronTonCuoiCaSlot({
            ngay: ngayV,
            ca: caV,
            maMay: may,
            tenMay: may,
            shiftOptions: [],
            signal: controller.signal
          });
          slotCache.set(cacheKey, result.tonByMaterialKey);
          return result.tonByMaterialKey;
        } catch {
          const empty = new Map<string, number>();
          slotCache.set(cacheKey, empty);
          return empty;
        }
      };
      const tonByKey = new Map<string, number | undefined>();
      for (const job of jobs) {
        const map = await fetchSlot(job.ngay, job.ca, job.may);
        tonByKey.set(job.key, lookupSoTronPrevTon(map, job.materialId, job.maHang));
      }
      if (!alive) return;
      setLines(current => {
        let changed = false;
        const next = current.map(line => {
          if (!tonByKey.has(line.key) || line.tonDauDirty) return line;
          const ton = tonByKey.get(line.key);
          if (ton === undefined || line.tonDau === ton) return line;
          changed = true;
          return { ...line, tonDau: ton };
        });
        return changed ? next : current;
      });
    })();
    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lineMayDest, ngay, tonDauFingerprint, shiftSettings]);

  function resetLines() {
    setLines([emptyLine()]);
    setEditingId(null);
    setEditingCode('');
    setNguonId('');
    setCas([]);
    setLoaiNhap('');
    setLoaiXuat('');
    setXuatDenLoai('kho');
    setXuatDenId('');
    setXuatNccId('');
    setPtdmKeys([]);
    setNguoiLap('');
    setNguoiGiao('');
    setDiaDiem('');
    setLyDo('');
    setGhiChu('');
    setError('');
  }

  function exportDestination() {
    const kind = xuatDenKind(loaiXuat);
    if (kind === 'ncc') return { loai: 'ncc' as const, id: xuatNccId };
    if (kind === 'may' || kind === 'may-ptdm') return { loai: 'may' as const, id: xuatDenId };
    return { loai: xuatDenLoai, id: xuatDenId };
  }

  function buildPayload() {
    const tonRef = resolveDefaultTonDauRef(ngay, cas[0] || '', getProductionShiftOptions(shiftSettings), shiftSettings);
    const payloadLines = mode === 'xuat' ? lines.filter(line => line.maHang.trim()) : lines;
    const dest = mode === 'xuat' ? exportDestination() : { loai: '' as const, id: '' };
    return {
      loai: mode,
      ngay,
      ca: mode === 'xuat' ? formatWarehouseShiftSelection(cas) : '',
      ca_list: mode === 'xuat' ? cas : [],
      // Xuất: nguồn nằm trên từng dòng (src_*), header để trống, BE tự suy nguồn chung.
      nguon_loai: mode === 'nhap' && nguonId ? nguonLoai : null,
      nguon_id: mode === 'nhap' && nguonId ? nguonId : null,
      dich_loai: null,
      dich_id: null,
      loai_nhap: mode === 'nhap' ? loaiNhap : null,
      loai_xuat: mode === 'xuat' ? loaiXuat : null,
      nguoi_lap: nguoiLap,
      nguoi_giao: nguoiGiao,
      dia_diem: diaDiem,
      ly_do: lyDo,
      ghi_chu: ghiChu,
      lines: payloadLines.map(line => ({
        ma_hang: line.maHang,
        ten_hang: line.tenHang,
        ten_nvl_sx: resolveTenSx(line.maHang, line.tenSanXuat, line.materialId),
        don_vi: line.donVi,
        so_luong: line.soLuong,
        don_gia: line.donGia,
        quy_doi_kg: lineWeight(line),
        phan_loai_nvl: line.warehouseClass,
        ...(mode === 'xuat'
          ? {
            src_loai: line.srcLoai === 'may' ? 'may' : 'kho',
            src_id: line.srcId,
            src_ten: line.srcLoai === 'may'
              ? (machines.find(item => item.id === line.srcId)?.label || line.srcId)
              : line.srcId,
            ngay_dong: line.ngayDong || tonRef.ngay || ngay,
            ca_dong: line.caDong || tonRef.ca || cas[0] || '',
            ...(line.tonDau !== null ? { ton_dau_ca: line.tonDau } : {}),
            so_luong_ct: line.slCt,
            nhom_vthh: line.nhomVthh,
            ...(line.normPerKg ? { norm_kg_per_unit: line.normPerKg } : {}),
            ...(line.imageUrl ? { link_anh_can_thuc_te: line.imageUrl } : {}),
            ...(line.imagePublicId ? { link_anh_can_thuc_te_public_id: line.imagePublicId } : {})
          }
          : {}),
        kho_dong: mode === 'xuat' ? (dest.loai === 'kho' ? dest.id : '') : line.khoId,
        dich_dong_loai: mode === 'xuat' ? dest.loai : '',
        dich_dong_id: mode === 'xuat' ? dest.id : '',
        chi_phi_kem_theo: kemStoredFromDraft(line.chiPhiKemTheo)
      }))
    };
  }

  async function onSave() {
    setError('');
    setInfo('');
    if (shiftError) {
      setError(shiftError);
      return;
    }
    if (mode === 'nhap' && lines.some(line => !line.khoId)) {
      setError('Mỗi dòng cần chọn kho nhập.');
      return;
    }
    if (mode === 'xuat') {
      if (!loaiXuat.trim()) {
        setError('Chọn loại xuất.');
        return;
      }
      const dest = exportDestination();
      if (!dest.id) {
        setError(
          destKind === 'may-ptdm'
            ? 'Tick phiếu trộn định mức để lấy máy xuất đến.'
            : destKind === 'ncc'
              ? 'Chọn nhà cung cấp xuất đến.'
              : 'Chọn xuất đến.'
        );
        return;
      }
      const filled = lines.filter(line => line.maHang.trim());
      if (filled.some(line => !line.srcId)) {
        setError('Mỗi dòng cần chọn xuất từ.');
        return;
      }
      if (filled.some(line => (line.srcLoai === 'may' ? 'may' : 'kho') === dest.loai && line.srcId === dest.id)) {
        setError('Xuất từ và xuất đến phải khác nhau.');
        return;
      }
      if (!filled.length) {
        setError('Nhập ít nhất một dòng NVL.');
        return;
      }
      for (let i = 0; i < filled.length; i += 1) {
        const line = filled[i];
        const qty = parseLocalizedNumber(line.soLuong);
        if (!Number.isFinite(qty) || qty <= 0) {
          setError(`Dòng ${line.maHang}: nhập SL thực lớn hơn 0.`);
          return;
        }
        // Tạm thời không bắt buộc ảnh số cân thực tế. Bật lại khi cần chụp trước khi lưu.
      }
    }
    if (mode === 'xuat' || mode === 'nhap') {
      for (const line of lines) {
        const qty = parseLocalizedNumber(line.soLuong);
        if (mode === 'nhap' && (nguonLoai === 'ncc' || !nguonId)) continue;
        if (line.ton !== null && qty > line.ton + 1e-9) {
          setError(`${line.maHang || 'Dòng'}: số lượng ${formatNumber(qty, 3)} vượt tồn ${line.ton === null ? '—' : formatNumber(line.ton, 3)}.`);
          return;
        }
      }
    }
    const costLines = mode === 'xuat' ? lines.filter(line => line.maHang.trim()) : lines;
    for (const line of costLines) {
      const kemError = kemDraftError(line.maHang || 'Dòng', line.chiPhiKemTheo);
      if (kemError) {
        setError(kemError);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/xuat-nhap-tong-hop/${editingId}` : '/api/xuat-nhap-tong-hop', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Không lưu được phiếu.');
        return;
      }
      const saved = data.record as TongHopHeader | null | undefined;
      const code = String(saved?.ma_phieu_chung || editingCode || '').trim();
      if (editingId) {
        if (saved?.id) setEditingId(saved.id);
        if (code) setEditingCode(code);
        setInfo(`Đã cập nhật phiếu ${code || 'này'}.`);
      } else {
        setInfo(code ? `Đã ghi phiếu ${code}.` : 'Đã ghi phiếu.');
        resetLines();
      }
    } finally {
      setSaving(false);
    }
  }

  function loadRecord(row: TongHopHeader) {
    setMode(row.loai);
    setEditingId(row.id);
    setEditingCode(row.ma_phieu_chung || '');
    setNgay(String(row.ngay || '').slice(0, 10));
    setCas(parseWarehouseShiftSelection(row.ca || ''));
    setNguonLoai(row.loai === 'nhap' && row.nguon_loai === 'ncc' ? 'ncc' : 'kho');
    setNguonId(row.loai === 'nhap' ? row.nguon_id || '' : '');
    setLoaiNhap(row.loai_nhap || '');
    setLoaiXuat(row.loai_xuat || '');
    const detail = Array.isArray(row.chi_tiet) ? row.chi_tiet : [];
    const first = (detail[0] || {}) as Record<string, unknown>;
    const firstDestKind = String(first.dich_dong_loai || (first.nguon_dong_loai === 'may' ? 'may' : 'kho'));
    const firstDestId = String(first.dich_dong_id || first.kho_dong_id || first.kho_dong_ten || first.nguon_dong_id || '');
    setXuatDenLoai(firstDestKind === 'may' ? 'may' : 'kho');
    setXuatDenId(row.loai === 'xuat' && firstDestKind !== 'ncc' ? firstDestId : '');
    setXuatNccId(
      row.loai === 'xuat' && (firstDestKind === 'ncc' || String(row.dich_loai || '') === 'ncc')
        ? String(firstDestKind === 'ncc' ? firstDestId : row.dich_id || '')
        : ''
    );
    setPtdmKeys([]);
    setNguoiLap(row.nguoi_lap || '');
    setNguoiGiao(row.nguoi_giao || '');
    setDiaDiem(row.dia_diem || '');
    setLyDo(row.ly_do || '');
    setGhiChu(row.ghi_chu || '');
    // Phiếu cũ: nguồn chung ở header (nguon_loai/nguon_id), đích-may nằm trong hack nguon_dong_*.
    const legacySrcLoai = row.nguon_loai === 'may' ? 'may' : 'kho';
    const legacySrcId = String(row.nguon_id || '');
    setLines(
      detail.length
        ? detail.map(item => {
          const lineMay = String(item.dich_dong_loai || '') === 'may'
            || (!item.dich_dong_loai && item.nguon_dong_loai === 'may');
          const destId = lineMay
            ? String(item.dich_dong_id || item.nguon_dong_id || '')
            : row.loai === 'nhap'
              ? String(item.kho_dong_id || item.kho_dong_ten || '')
              : String(item.kho_dong_id || item.kho_dong_ten || (String(item.dich_dong_loai || '') === 'kho' ? item.dich_dong_id : '') || '');
          const hasSrc = String(item.src_loai || '') === 'kho' || String(item.src_loai || '') === 'may';
          const tonDauRaw = Number(String(item.ton_dau_ca ?? ''));
          return {
            ...emptyLine(),
            sourceLoai: lineMay ? 'may' : 'kho',
            khoLoai: lineMay ? 'may' : 'kho',
            khoId: destId,
            srcLoai: hasSrc ? (String(item.src_loai) as 'kho' | 'may') : legacySrcLoai,
            srcId: hasSrc ? String(item.src_id || '') : legacySrcId,
            ngayDong: String(item.ngay_dong || ''),
            caDong: String(item.ca_dong || ''),
            tonDau: Number.isFinite(tonDauRaw) ? tonDauRaw : null,
            // Dòng đã có tồn đầu thì giữ, không cho auto ghi đè khi sửa.
            tonDauDirty: Number.isFinite(tonDauRaw),
            tenSanXuat: String(item.ten_nvl_sx || ''),
            maHang: String(item.ma_hang || ''),
            tenHang: String(item.ten_hang || ''),
            donVi: String(item.don_vi || ''),
            soLuong: fmtQtyLoad(item.so_luong),
            donGia: fmtMoneyLoad(item.don_gia),
            warehouseClass: String(item.phan_loai_nvl || '') === 'nvl_chinh' || String(item.phan_loai_nvl || '') === 'nvl_phu'
              ? String(item.phan_loai_nvl) as 'nvl_chinh' | 'nvl_phu'
              : 'chua_phan_loai',
            slCt: fmtQtyLoad(item.so_luong_ct),
            nhomVthh: String(item.nhom_vthh || ''),
            normPerKg: Number(item.norm_kg_per_unit) > 0 ? Number(item.norm_kg_per_unit) : undefined,
            imageUrl: String(item.link_anh_can_thuc_te || ''),
            imagePublicId: String(item.link_anh_can_thuc_te_public_id || ''),
            chiPhiKemTheo: kemDraftFromStored(item.chi_phi_kem_theo)
          };
        })
        : [emptyLine()]
    );
  }

  /** Nạp Sửa/Xem: hiện số đã ngăn cách trong ô input (rỗng giữ rỗng). */
  function fmtQtyLoad(value: unknown): string {
    if (value === null || value === undefined || String(value).trim() === '') return '';
    const parsed = parseLocalizedNumber(value);
    return Number.isFinite(parsed) ? formatNumber(parsed, 3) : String(value);
  }

  function fmtMoneyLoad(value: unknown): string {
    if (value === null || value === undefined || String(value).trim() === '') return '';
    const parsed = parseLocalizedNumber(value);
    return Number.isFinite(parsed) ? formatMoney(parsed, 0) : String(value);
  }

  const openedEdit = useRef(false);
  useEffect(() => {
    if (openedEdit.current) return;
    openedEdit.current = true;
    const row = takePendingTongHopEdit();
    if (row) loadRecord(row);
  }, []);

  const openedView = useRef(false);
  useEffect(() => {
    if (!viewOnly || openedView.current) return;
    openedView.current = true;
    const row = takePendingTongHopView();
    if (row) loadRecord(row);
  }, [viewOnly]);

  const nhapKho = warehouses.find(item => item.id === nguonId) || null;

  function lineKind(line: Line): 'nvl' | 'san_pham' {
    if (mode === 'nhap') return !nguonId || nguonLoai === 'ncc' || Boolean(nhapKho?.vatTu) ? 'nvl' : 'san_pham';
    // Xuất: loại hàng theo NGUỒN từng dòng (máy luôn là NVL).
    if (line.srcLoai === 'may') return 'nvl';
    const kho = warehouses.find(item => item.id === line.srcId);
    return !kho || kho.vatTu ? 'nvl' : 'san_pham';
  }

  function lineWeight(line: Line) {
    const qty = parseLocalizedNumber(line.soLuong);
    if (isWarehouseKgUnit(line.donVi) && Number.isFinite(qty) && qty > 0) {
      return Math.round(qty * 1000) / 1000;
    }
    if (line.normPerKg && line.normPerKg > 0 && Number.isFinite(qty) && qty > 0) {
      return Math.round(qty * line.normPerKg * 1000) / 1000;
    }
    return convertWarehouseQuantityToKg({
      quantity: qty,
      unit: line.donVi,
      itemCode: line.maHang,
      warehouseKind: lineKind(line),
      materials,
      products
    });
  }

  function lineAmount(line: Line) {
    const qty = parseLocalizedNumber(line.soLuong);
    const price = parseLocalizedNumber(line.donGia);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
    return Math.round(qty * price * 1000) / 1000;
  }

  /** Nhập: chi phí kèm phân bổ trên 1 kg = tổng chi phí kèm / tổng trọng lượng. */
  const filledCostLines = lines.filter(line => line.maHang.trim());
  const tongKemAll = roundKem(filledCostLines.reduce((sum, line) => sum + sumKemDraft(line.chiPhiKemTheo), 0));
  const tongKgAll = roundKem(filledCostLines.reduce((sum, line) => sum + (lineWeight(line) || 0), 0));
  const kemPerKgAll = tongKgAll > 0 ? tongKemAll / tongKgAll : 0;

  /** Nhập: giá nhập kho của dòng = giá mua + chi phí kèm/1kg. */
  function lineImportPrice(line: Line) {
    const price = parseLocalizedNumber(line.donGia);
    if (!Number.isFinite(price)) return null;
    return price + kemPerKgAll;
  }

  /** Nhập: thành tiền nhập kho của dòng = SL × giá nhập kho. */
  function lineImportAmount(line: Line) {
    const qty = parseLocalizedNumber(line.soLuong);
    const unit = lineImportPrice(line);
    if (!Number.isFinite(qty) || unit === null) return null;
    return Math.round(qty * unit * 1000) / 1000;
  }

  function toPrintLines(group: Line[]): WarehouseSlipPrintData['lines'] {
    return group.map(line => ({
      code: line.maHang,
      name: line.tenHang,
      unit: line.donVi,
      quantity: parseLocalizedNumber(line.soLuong) || 0,
      unitPrice: parseLocalizedNumber(line.donGia) || 0,
      lineAmount: lineAmount(line) || 0,
      weightKg: lineWeight(line),
      chiPhiKemTheo: kemStoredFromDraft(line.chiPhiKemTheo).map(item => ({
        ten: item.ten,
        donGia: item.don_gia,
        thanhTien: item.thanh_tien
      }))
    }));
  }

  function printCostTotals(group: Line[]) {
    const totalAmount = group.reduce((sum, line) => sum + (lineAmount(line) || 0), 0);
    const totalKem = roundKem(group.reduce((sum, line) => sum + sumKemDraft(line.chiPhiKemTheo), 0));
    const totalKg = roundKem(group.reduce((sum, line) => sum + (lineWeight(line) || 0), 0));
    return {
      totalAmount,
      totalKem,
      totalCong: roundKem(totalAmount + totalKem),
      totalKg
    };
  }

  function previewDraft() {
    setError('');
    const usable = lines.filter(line => line.maHang.trim() && parseLocalizedNumber(line.soLuong) > 0);
    if (!usable.length) {
      setError('Nhập ít nhất một dòng có mã và số lượng để xem trước.');
      return;
    }
    if (mode === 'xuat' && !exportDestination().id) {
      setError(destKind === 'may-ptdm' ? 'Tick phiếu trộn định mức để lấy máy xuất đến.' : 'Chọn xuất đến trước khi xem trước.');
      return;
    }
    if (mode === 'xuat' && usable.some(line => !line.srcId)) {
      setError('Mỗi dòng cần chọn xuất từ.');
      return;
    }
    if (mode === 'nhap' && usable.some(line => !line.khoId)) {
      setError('Mỗi dòng cần chọn kho nhập.');
      return;
    }
    const date = formatTongHopDate(ngay);
    const reason = mode === 'nhap' ? loaiNhap : loaiXuat;
    const shift = mode === 'xuat' ? formatWarehouseShiftSelection(cas) : '';
    const slips: WarehouseSlipPrintData[] = [];
    const pushSlip = (slip: Omit<WarehouseSlipPrintData, 'slipDate' | 'reason' | 'note' | 'createdBy' | 'isTemporary' | 'useWarehouseNameInTitle' | 'shift'> & { shift?: string; slipDate?: string }) => {
      slips.push({
        ...slip,
        slipDate: slip.slipDate ?? date,
        reason: lyDo || reason,
        note: ghiChu,
        createdBy: nguoiLap,
        deliverer: nguoiGiao,
        warehouseLocation: diaDiem,
        shift: slip.shift ?? shift,
        useWarehouseNameInTitle: true,
        isTemporary: true
      });
    };
    if (mode === 'nhap') {
      const sourceName = nguonId
        ? (nguonLoai === 'ncc' ? (suppliers.find(item => item.id === nguonId)?.label || nguonId) : nguonId)
        : 'Kho NVL';
      if (nguonLoai === 'kho' && nguonId) {
        pushSlip({
          slipCode: 'XEM-XH',
          slipType: 'xuat',
          warehouseKind: nhapKho?.vatTu ? 'nvl' : 'san_pham',
          ...printCostTotals(usable),
          warehouseName: nguonId,
          deliverer: sourceName,
          lines: toPrintLines(usable)
        });
      }
      const byDest = new Map<string, Line[]>();
      for (const line of usable) byDest.set(line.khoId, [...(byDest.get(line.khoId) || []), line]);
      for (const [kho, group] of byDest) {
        const khoOpt = warehouses.find(item => item.id === kho);
        pushSlip({
          slipCode: 'XEM-NH',
          slipType: 'nhap',
          warehouseKind: khoOpt?.vatTu ? 'nvl' : 'san_pham',
          ...printCostTotals(group),
          warehouseName: kho,
          deliverer: sourceName,
          lines: toPrintLines(group)
        });
      }
    } else {
      const dest = exportDestination();
      const bySrc = new Map<string, Line[]>();
      for (const line of usable) {
        const key = `${line.srcLoai === 'may' ? 'may' : 'kho'}|${line.srcId}`;
        bySrc.set(key, [...(bySrc.get(key) || []), line]);
      }
      for (const [key, group] of bySrc) {
        const splitAt = key.indexOf('|');
        const srcLoai = key.slice(0, splitAt);
        const srcId = key.slice(splitAt + 1);
        const sourceLabel = srcLabel(srcLoai, srcId);
        const sourceKind = srcLoai === 'may' || srcIsNvl(srcLoai, srcId) ? 'nvl' as const : 'san_pham' as const;
        const destKho = dest.loai === 'kho' ? warehouses.find(item => item.id === dest.id) : null;
        const lineDate = group[0]?.ngayDong || ngay;
        const lineShift = group[0]?.caDong || shift;
        pushSlip({
          slipCode: 'XEM-XH',
          slipType: 'xuat',
          warehouseKind: sourceKind,
          ...printCostTotals(group),
          warehouseName: sourceLabel,
          machine: dest.loai === 'may' ? dest.id : '',
          shift: lineShift,
          slipDate: formatTongHopDate(lineDate),
          lines: toPrintLines(group)
        });
        if (dest.loai === 'kho') {
          pushSlip({
            slipCode: 'XEM-NH',
            slipType: 'nhap',
            warehouseKind: destKho?.vatTu ? 'nvl' : 'san_pham',
            ...printCostTotals(group),
            warehouseName: dest.id,
            deliverer: sourceLabel,
            shift: lineShift,
            slipDate: formatTongHopDate(lineDate),
            lines: toPrintLines(group)
          });
        }
      }
    }
    setPrintSlips(slips);
  }
  const shiftOptionRows = getProductionShiftOptions(shiftSettings);
  const shiftOptions = shiftOptionRows.map(item => item.value);
  const tonDefault = resolveDefaultTonDauRef(ngay, cas[0] || '', shiftOptionRows, shiftSettings);
  const nvlWarehouses = warehouses.filter(item => item.vatTu);
  const nhapCoreWarehouses = pickNhapCoreWarehouses(warehouses);
  /** NVL của đúng kho nguồn trên từng dòng xuất. */
  function materialsForSource(srcId: string) {
    const want = normalizeWarehouseName(srcId);
    if (!want) return [];
    const maKho = warehouses.find(item => item.id === srcId)?.maKho || '';
    if (srcIsNvl('kho', srcId)) {
      return materials.filter(item => materialInWarehouse(item, srcId, maKho));
    }
    return products
      .filter(item => normalizeWarehouseName(item.tenKho) === want)
      .map(item => ({
        id: item.code,
        code: item.code,
        name: item.name,
        unit: item.unit,
        totalWeight: item.totalWeight,
        productionName: '',
        tenKho: item.tenKho,
        loaiKho: ''
      }));
  }

  useEffect(() => {
    if (!materials.length && !products.length) return;
    setLines(current => {
      let changed = false;
      const next = current.map(line => {
        const pool = mode === 'xuat'
          ? (line.srcLoai === 'may'
            ? (line.srcId ? materials : [])
            : (line.srcId ? materialsForSource(line.srcId) : []))
          : materials.filter(item => materialInWarehouse(item, line.khoId, warehouses.find(kho => kho.id === line.khoId)?.maKho || ''));
        if (!pool.length) return line;
        const bound = bindMaterialInWarehouse(line, pool);
        if (
          bound.materialId === line.materialId &&
          bound.maHang === line.maHang &&
          bound.tenHang === line.tenHang &&
          bound.tenSanXuat === line.tenSanXuat &&
          bound.donVi === line.donVi
        ) return line;
        changed = true;
        return bound;
      });
      return changed ? next : current;
    });
  }, [materials, mode, products, warehouses]);

  useEffect(() => {
    if (mode !== 'xuat' || destKind !== 'may-ptdm') return;
    let alive = true;
    setLoadingNorms(true);
    void Promise.all([
      fetch('/api/bang-tron-vat-tu-dinh-muc?limit=500').then(r => r.json()).catch(() => ({})),
      fetch('/api/lenh-sx').then(r => r.json()).catch(() => ({}))
    ]).then(([normRes, orderRes]) => {
      if (!alive) return;
      const rows = Array.isArray(normRes.records) ? normRes.records : Array.isArray(normRes.norms) ? normRes.norms : [];
      setMixingNorms(rows);
      setProductionOrders(normalizeWarehouseProductionOrders(orderRes));
    }).finally(() => {
      if (alive) setLoadingNorms(false);
    });
    return () => {
      alive = false;
    };
  }, [mode, destKind]);

  useEffect(() => {
    if (!ptdmOpen) return;
    const update = () => {
      const el = ptdmTriggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPtdmMenu({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [ptdmOpen]);

  function resolveMachineId(raw: string) {
    const value = raw.trim();
    if (!value) return '';
    const key = value.toLocaleLowerCase('vi');
    const hit = machines.find(item => {
      const id = item.id.toLocaleLowerCase('vi');
      const label = item.label.toLocaleLowerCase('vi');
      return id === key || label === key || label.startsWith(`${key} —`) || label.endsWith(`— ${key}`) || label.startsWith(`${id} — ${key}`);
    });
    return hit?.id || value;
  }

  const ptdmOptions = useMemo(() => {
    const orders = new Map(productionOrders.map(order => [normalizeMaterialKey(order.orderCode), order]));
    return mixingNorms.flatMap(record => {
      const normId = String(record.id ?? '').trim();
      const orderCode = String(record.ma_lenh_sx ?? '').trim();
      const ngayNorm = String(record.ngay ?? '').trim().slice(0, 10);
      if (!normId || !ngayNorm) return [];
      const linked = orderCode.split(/[,;|/]+/).map(part => normalizeMaterialKey(part.trim())).filter(Boolean);
      const linkedOrders = linked.map(code => orders.get(code)).filter(Boolean);
      if (linked.length > 0 && linkedOrders.length > 0 && linkedOrders.every(order => doneOrderStatus(String(order?.status || '')))) {
        return [];
      }
      const slipMachine = String(record.may ?? '').trim();
      const orderMachine = linked.map(code => String(orders.get(code)?.machine || '').trim()).find(Boolean) || slipMachine;
      const machineId = resolveMachineId(orderMachine);
      const name = String(record.ten_phieu ?? '').trim() || formatMixingNormSlipName(orderMachine, orderCode);
      return [{ key: lenhSxInstanceKey({ dinh_muc_id: normId, ma_lenh_sx: orderCode, ngay: ngayNorm, ca: String(record.ca ?? '') }), name, machineId, record, ca: String(record.ca ?? '') }];
    });
  }, [mixingNorms, productionOrders, machines]);

  function applyPtdm(keys: string[]) {
    setPtdmKeys(keys);
    const selected = ptdmOptions.filter(item => keys.includes(item.key));
    if (!selected.length) {
      setXuatDenId('');
      setLines([emptyLine()]);
      return;
    }
    const machineIds = [...new Set(selected.map(item => item.machineId).filter(Boolean))];
    if (!machineIds.length) {
      setError('Phiếu trộn đã chọn chưa có máy trên lệnh sản xuất.');
      setLines([emptyLine()]);
      return;
    }
    if (machineIds[0]) {
      setXuatDenLoai('may');
      setXuatDenId(machineIds[0]);
    }
    const matchedShifts = new Set<string>();
    for (const item of selected) {
      if (!item.ca) continue;
      const matched = shiftOptions.find(option => shiftNamesMatch(option, item.ca));
      matchedShifts.add(matched || item.ca);
    }
    const firstShift = [...matchedShifts][0];
    if (firstShift) setCas(current => (current.length > 0 ? current : [firstShift]));
    const merged = mergeNormMaterialLines(
      selected.map(item => ({ record: item.record, machine: item.machineId })),
      materials
    );
    if (!merged.length) {
      setInfo('');
      setError('Phiếu trộn định mức đã chọn chưa có dòng NVL hợp lệ.');
      setLines([emptyLine()]);
      return;
    }
    setError('');
    const nextLines = merged.map(line => {
      const matched = materials.find(item => String(item.id || '').trim() === line.materialId.trim());
      const srcId = String(matched?.tenKho || '').trim();
      return bindMaterialInWarehouse({
        ...emptyLine(),
        srcLoai: 'kho' as const,
        srcId,
        sourceLoai: 'kho' as const,
        khoLoai: 'kho' as const,
        khoId: '',
        materialId: line.materialId,
        maHang: line.code,
        tenHang: line.name,
        tenSanXuat: line.productionName,
        donVi: line.unit,
        slCt: String(line.documentQuantity),
        warehouseClass: line.warehouseClass,
        nhomVthh: line.nhomVthh || '',
        auxiliaryGroup: line.auxiliaryGroup || '',
        normPerKg: isWarehouseKgUnit(line.unit) ? 1 : line.normWeightPerUnitKg
      }, srcId ? materialsForSource(srcId) : materials);
    });
    const unbound = nextLines.filter(line => line.maHang.trim() && !line.materialId.trim()).length;
    setInfo(
      unbound
        ? `Đã điền ${nextLines.length} dòng NVL từ ${selected.length} phiếu trộn định mức. ${unbound} dòng chưa khớp kho — chọn Xuất từ rồi chọn lại NVL.`
        : `Đã điền ${nextLines.length} dòng NVL từ ${selected.length} phiếu trộn định mức.`
    );
    setLines(nextLines);
  }

  async function refreshCatalog() {
    setRefreshingCatalog(true);
    try {
      const res = await fetch('/api/kho-nvl');
      const data = await res.json().catch(() => ({}));
      const rows = Array.isArray(data.materials) ? data.materials : Array.isArray(data.records) ? data.records : [];
      setMaterials(mapKhoNvlRows(rows));
    } finally {
      setRefreshingCatalog(false);
    }
  }

  function machineChoiceLabel(item: Option) {
    const split = item.label.split(' — ');
    if (split.length < 2) return item.label;
    const code = split[0].trim();
    const name = split.slice(1).join(' — ').trim();
    return name ? `${name} (${code})` : item.label;
  }

  const xuatDenChoices = destKind === 'ncc'
    ? suppliers.map(item => ({ value: `ncc|${item.id}`, label: item.label }))
    : destKind === 'may' || destKind === 'may-ptdm'
      ? machines.map(item => ({ value: `may|${item.id}`, label: machineChoiceLabel(item) }))
      : [
          ...warehouses.map(item => ({ value: `kho|${item.id}`, label: item.label })),
          ...machines.map(item => ({ value: `may|${item.id}`, label: `Máy · ${machineChoiceLabel(item)}` }))
        ];
  const xuatDenValue = destKind === 'ncc'
    ? (xuatNccId ? `ncc|${xuatNccId}` : '')
    : destKind === 'may' || destKind === 'may-ptdm'
      ? (xuatDenId ? `may|${xuatDenId}` : '')
      : (xuatDenId ? `${xuatDenLoai}|${xuatDenId}` : '');

  function bindXuatLines(next: XuatNvlLine[]) {
    setLines(next.map(line => {
      const srcLoai = line.srcLoai === 'may' ? 'may' : 'kho';
      return {
        ...emptyLine(),
        ...line,
        srcLoai,
        srcId: String(line.srcId || ''),
        sourceLoai: srcLoai,
        khoLoai: srcLoai,
        khoId: ''
      };
    }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-xs font-extrabold text-[#ef1b2d]">← Kho</button>
        <h1 className="text-sm font-black uppercase tracking-wide text-zinc-950">Xuất nhập kho NVL</h1>
        <button type="button" onClick={onOpenList} className="text-xs font-extrabold text-[#ef1b2d]">Danh sách</button>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-700">Loại phiếu</p>
        <div className="grid grid-cols-2 gap-2">
          {(['nhap', 'xuat'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={viewOnly ? undefined : () => {
                setMode(tab);
                resetLines();
              }}
              disabled={viewOnly}
              className={`flex h-9 items-center justify-center rounded-lg border px-2 text-xs font-extrabold transition ${
                viewOnly
                  ? 'border-zinc-200 bg-zinc-50 text-zinc-600 cursor-not-allowed'
                  : mode === tab
                    ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
              }`}
            >
              {tab === 'nhap' ? 'Phiếu nhập' : 'Phiếu xuất'}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-2">
          <p className="text-sm font-black text-zinc-950">Thông tin phiếu</p>
          <p className="text-xs font-semibold text-zinc-400">{mode === 'nhap' ? 'Nhập kho' : 'Xuất kho'}</p>
          <p className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
            viewOnly ? 'bg-blue-50 text-blue-800' : editingId ? 'bg-amber-50 text-amber-800' : 'bg-zinc-100 text-zinc-600'
          }`}>
            {viewOnly ? `Xem phiếu ${editingCode || editingId}` : editingId ? `Đang sửa phiếu ${editingCode || editingId}` : 'Đang thêm phiếu mới'}
          </p>
          {!viewOnly && editingId ? (
            <button type="button" onClick={resetLines} className="ml-auto text-[11px] font-extrabold text-[#ef1b2d]">Thêm phiếu mới</button>
          ) : null}
        </div>
        <div className="grid gap-x-2 gap-y-1.5 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ngày phiếu</span>
            <VnCalendarPicker value={ngay} onChange={setNgay} disabled={viewOnly} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">{mode === 'nhap' ? 'Loại nhập' : 'Loại xuất'}</span>
            {mode === 'nhap' ? (
              <SearchableSelect
                value={loaiNhap}
                onChange={setLoaiNhap}
                options={LOAI_NHAP_OPTIONS.map(item => ({ id: item, label: item }))}
                getValue={(item: unknown) => String((item as { id: string }).id)}
                getLabel={(item: unknown) => String((item as { label: string }).label)}
                placeholder="Chọn loại nhập"
                inputClassName={fieldClass}
                comboboxMode
                comboboxSearchable
                allowCustomValue
                disabled={viewOnly}
              />
            ) : (
              <SearchableSelect
                value={loaiXuat}
                onChange={value => {
                  setLoaiXuat(value);
                  setXuatDenId('');
                  setXuatNccId('');
                  setPtdmKeys([]);
                  const kind = xuatDenKind(value);
                  setXuatDenLoai(kind === 'may' || kind === 'may-ptdm' ? 'may' : 'kho');
                  if (kind !== 'may-ptdm') setCas([]);
                }}
                options={LOAI_XUAT_OPTIONS.map(item => ({ id: item, label: item }))}
                getValue={(item: unknown) => String((item as { id: string }).id)}
                getLabel={(item: unknown) => String((item as { label: string }).label)}
                placeholder="Chọn loại xuất"
                inputClassName={fieldClass}
                comboboxMode
                comboboxSearchable
                allowCustomValue
                disabled={viewOnly}
              />
            )}
          </label>
          {mode === 'xuat' && destKind === 'may-ptdm' ? <div className="block space-y-1 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Ca <span className="font-semibold normal-case tracking-normal text-zinc-400">(không bắt buộc, chọn nhiều ca cùng loại ca)</span>
            </span>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
              {shiftOptions.length === 0 ? (
                <p className="text-xs font-semibold text-zinc-400">Chưa có ca trong cài đặt.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {shiftOptions.map(option => {
                    const checked = cas.includes(option);
                    return (
                      <label
                        key={option}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                          checked ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setCas(current => toggleWarehouseShiftSelection(current, option))}
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-[#ef1b2d] focus:ring-[#ef1b2d]/20"
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-1.5 text-[11px] font-semibold text-zinc-500">
                {cas.length ? `Đã chọn: ${formatWarehouseShiftSelection(cas)}` : 'Có thể bỏ trống ca.'}
              </p>
            </div>
          </div> : null}
          {mode === 'nhap' ? (
            <div className="space-y-1 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Nguồn nhập</span>
              <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)]">
                <select
                  value={nguonLoai}
                  onChange={viewOnly ? undefined : event => {
                    setNguonLoai(event.target.value === 'ncc' ? 'ncc' : 'kho');
                    setNguonId('');
                    setLines(current => current.map(line => ({ ...line, maHang: '', tenHang: '', tenSanXuat: '', donVi: '', ton: null })));
                  }}
                  disabled={viewOnly}
                  className={fieldClass}
                >
                  <option value="kho">Kho</option>
                  <option value="ncc">Nhà cung cấp</option>
                </select>
                <SearchableSelect
                  value={nguonId}
                  onChange={viewOnly ? undefined : value => {
                    setNguonId(value);
                    setLines(current => current.map(line => ({ ...line, maHang: '', tenHang: '', tenSanXuat: '', donVi: '', ton: null })));
                  }}
                  options={(nguonLoai === 'ncc' ? suppliers : nhapCoreWarehouses) as Option[]}
                  getValue={(item: Option) => item.id}
                  getLabel={(item: Option) => item.label}
                  placeholder={nguonLoai === 'ncc' ? 'Chọn nhà cung cấp (không bắt buộc)' : 'Không chọn thì lấy toàn bộ kho NVL'}
                  inputClassName={fieldClass}
                  comboboxMode
                  comboboxSearchable
                  disabled={viewOnly}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <label className="block space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Xuất đến</span>
                <SearchableSelect
                  value={xuatDenValue}
                  onChange={viewOnly ? undefined : value => {
                    const splitAt = value.indexOf('|');
                    const kind = splitAt >= 0 ? value.slice(0, splitAt) : '';
                    const id = splitAt >= 0 ? value.slice(splitAt + 1) : value;
                    if (kind === 'ncc') {
                      setXuatNccId(id);
                      return;
                    }
                    setXuatDenLoai(kind === 'may' ? 'may' : 'kho');
                    setXuatDenId(id);
                  }}
                  options={xuatDenChoices}
                  getValue={(item: { value: string }) => item.value}
                  getLabel={(item: { label: string }) => item.label}
                  getSearchText={(item: { label: string }) => item.label}
                  placeholder={
                    destKind === 'may-ptdm'
                      ? 'Máy theo phiếu trộn định mức'
                      : destKind === 'ncc'
                        ? 'Chọn nhà cung cấp'
                        : destKind === 'may'
                          ? 'Chọn máy'
                          : 'Chọn kho hoặc máy'
                  }
                  inputClassName={fieldClass}
                  comboboxMode
                  comboboxSearchable
                  disabled={viewOnly}
                />
              </label>
              {destKind === 'may-ptdm' ? (
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    Phiếu trộn định mức <span className="font-semibold normal-case tracking-normal text-zinc-400">(tick để tự điền NVL)</span>
                  </span>
                  <button
                    type="button"
                    ref={ptdmTriggerRef}
                    onClick={viewOnly ? undefined : () => setPtdmOpen(open => !open)}
                    disabled={viewOnly}
                    className={`${fieldClass} flex items-center justify-between gap-2 text-left ${viewOnly ? 'cursor-not-allowed' : ''}`}
                  >
                    <span className={`truncate ${ptdmKeys.length ? 'text-zinc-800' : 'text-zinc-400'}`}>
                      {ptdmKeys.length ? `Đã chọn (${ptdmKeys.length}) phiếu trộn định mức` : 'Chọn phiếu trộn định mức...'}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 ${ptdmOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {ptdmOpen && ptdmMenu && !viewOnly ? createPortal(
                    <div ref={ptdmPanelRef} className="fixed z-[200] space-y-2 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-lg" style={ptdmMenu}>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                        <input value={ptdmSearch} onChange={viewOnly ? undefined : event => setPtdmSearch(event.target.value)} disabled={viewOnly} className={`${fieldClass} pl-8`} placeholder="Gõ để lọc tên phiếu trộn..." />
                      </div>
                      {loadingNorms ? (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang tải phiếu trộn định mức...</p>
                      ) : ptdmOptions.filter(item => item.name.toLocaleLowerCase('vi').includes(ptdmSearch.trim().toLocaleLowerCase('vi'))).length === 0 ? (
                        <p className="text-xs font-semibold text-zinc-400">Chưa có phiếu trộn định mức (hoặc các PTĐM đều thuộc lệnh đã hoàn thành).</p>
                      ) : (
                        <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">
                          {ptdmOptions.filter(item => item.name.toLocaleLowerCase('vi').includes(ptdmSearch.trim().toLocaleLowerCase('vi'))).map(option => {
                            const checked = ptdmKeys.includes(option.key);
                            return (
                              <label key={option.key} className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${checked ? 'border-[#ef1b2d] bg-red-50 text-[#ef1b2d]' : 'border-zinc-200 bg-white text-zinc-700'}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => applyPtdm(checked ? ptdmKeys.filter(key => key !== option.key) : [...ptdmKeys, option.key])}
                                  className="h-3.5 w-3.5 shrink-0 rounded border-zinc-300 text-[#ef1b2d]"
                                />
                                <span className="truncate">{option.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex justify-end border-t border-zinc-100 pt-2">
                        <button type="button" onClick={() => setPtdmOpen(false)} className="h-7 rounded-lg border border-zinc-200 px-2.5 text-[11px] font-bold text-zinc-600">Xong</button>
                      </div>
                    </div>,
                    document.body
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Người lập</span>
            <SearchableSelect
              value={nguoiLap}
              onChange={viewOnly ? undefined : setNguoiLap}
              options={staff}
              getValue={(item: { id: string }) => item.id}
              getLabel={(item: { label: string }) => item.label}
              placeholder="Chọn người lập"
              inputClassName={fieldClass}
              comboboxMode
              comboboxSearchable
              disabled={viewOnly}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Người giao hàng</span>
            <input value={nguoiGiao} onChange={viewOnly ? undefined : event => setNguoiGiao(event.target.value)} disabled={viewOnly} className={fieldClass} placeholder="Họ tên người giao hàng" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Địa điểm</span>
            <input value={diaDiem} onChange={viewOnly ? undefined : event => setDiaDiem(event.target.value)} disabled={viewOnly} className={fieldClass} placeholder="VD: Phú Thọ" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Lý do</span>
            <input value={lyDo} onChange={viewOnly ? undefined : event => setLyDo(event.target.value)} disabled={viewOnly} className={fieldClass} placeholder={mode === 'nhap' ? 'VD: Nhập mua ngoài...' : 'VD: Xuất sản xuất...'} />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ghi chú</span>
            <input value={ghiChu} onChange={viewOnly ? undefined : event => setGhiChu(event.target.value)} disabled={viewOnly} className={fieldClass} placeholder="Số chứng từ gốc kèm theo..." />
          </label>
        </div>

        {mode === 'xuat' ? (
          <>
            <XuatNvlDetail
              lines={lines}
              sourceWarehouses={(nvlWarehouses.length ? nvlWarehouses : warehouses) as Option[]}
              machines={machines}
              materials={materials}
              materialsForSource={materialsForSource}
              shiftOptions={shiftOptions}
              defaultTonNgay={tonDefault.ngay || ngay}
              onChange={bindXuatLines}
              onRefreshCatalog={() => { void refreshCatalog(); }}
              refreshing={refreshingCatalog}
              viewOnly={viewOnly}
            />
          </>
        ) : null}
        {mode === 'nhap' ? <><div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-max min-w-full text-xs">
            <thead>
              <tr className="bg-[#ef1b2d] text-left text-white">
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Kho nhập</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Mã</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Tên</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Tên sản xuất</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Tồn</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">SL</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Quy đổi kg</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Giá mua</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Thành tiền</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Giá nhập kho</th>
                <th className="whitespace-nowrap px-2 py-2 text-[10px] font-black uppercase tracking-wide">Tổng giá nhập kho</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const khoMa = warehouses.find(item => item.id === line.khoId)?.maKho || '';
                const khoMaterials = line.khoId
                  ? materials.filter(item => materialInWarehouse(item, line.khoId, khoMa))
                  : [];
                const sxOptions = khoMaterials.filter(item =>
                  item.code.trim().toLocaleLowerCase('vi') === line.maHang.trim().toLocaleLowerCase('vi')
                  && String(item.productionName || '').trim()
                );
                const sxText = String(line.tenSanXuat || '').trim();
                function applyNhapMaterial(item: MaterialOption) {
                  const next = {
                    ...line,
                    materialId: String(item.id || '').trim(),
                    maHang: item.code,
                    tenHang: item.name,
                    donVi: String(item.unit || '').trim(),
                    tenSanXuat: String(item.productionName || '').trim(),
                    warehouseClass: warehouseClassFromPhanLoai(String(item.phanLoai || '')),
                    tonDau: null,
                    tonDauDirty: false
                  };
                  patchLine(index, next);
                  void refreshTon(index, next);
                }
                return (
                  <React.Fragment key={line.key}>
                  <tr className="border-b border-zinc-100">
                    <td className="px-2 py-2 align-middle">
                      <div className="w-56">
                        <SearchableSelect
                          value={line.khoId}
                          onChange={value => {
                            if (value === line.khoId) return;
                            patchLine(index, {
                            ...line,
                            khoId: value,
                            materialId: '',
                            maHang: '',
                            tenHang: '',
                            tenSanXuat: '',
                            donVi: '',
                            ton: null
                          });
                          }}
                          options={nhapCoreWarehouses}
                          getValue={(item: Option) => item.id}
                          getLabel={(item: Option) => item.label}
                          placeholder="Chọn kho nhập"
                          inputClassName={fieldClass}
                          comboboxMode
                          comboboxSearchable
                          openUpward
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="w-56 shrink-0">
                          <SearchableSelect
                            value={line.materialId || line.maHang}
                            onChange={value => {
                              const found = khoMaterials.find(item => String(item.id || '').trim() === value);
                              if (found) applyNhapMaterial(found);
                            }}
                            options={khoMaterials}
                            getValue={item => String((item as MaterialOption).id || '').trim()}
                            getLabel={item => (item as MaterialOption).code}
                            getOptionLabel={item => {
                              const row = item as MaterialOption;
                              const sxName = String(row.productionName || '').trim();
                              return sxName && sxName.toLocaleLowerCase('vi') !== row.name.toLocaleLowerCase('vi')
                                ? `${row.code} · ${row.name} · ${sxName}`
                                : `${row.code} · ${row.name}`;
                            }}
                            getSearchText={item => {
                              const row = item as MaterialOption;
                              return `${row.code} ${row.name} ${row.productionName || ''}`;
                            }}
                            placeholder={line.khoId ? 'Mã NVL' : 'Chọn kho nhập trước'}
                            disabled={!line.khoId}
                            inputClassName={fieldClass}
                            comboboxMode
                            comboboxSearchable
                            openUpward
                          />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle">{line.tenHang || '—'}</td>
                    <td className="px-2 py-2 align-middle">
                      <div
                        className="w-56"
                        title={!line.materialId.trim() && line.tenSanXuat.trim() ? 'Tên SX mới — lưu phiếu sẽ tạo dòng NVL mới (mã + tên + tên SX + kho)' : undefined}
                      >
                        <SearchableSelect
                          value={sxText ? (line.materialId || sxText) : ''}
                          onChange={value => {
                            const v = String(value || '').trim();
                            const match = khoMaterials.find(option => String(option.id || '').trim() === v)
                              ?? sxOptions.find(option => normNvlIdentityText(option.productionName || '') === normNvlIdentityText(v));
                            if (match) {
                              applyNhapMaterial(match);
                              return;
                            }
                            if (!v) {
                              // Xóa trắng khi đang gắn id có sẵn thì giữ nguyên (tránh rớt thành SX rỗng ngoài ý muốn).
                              if (line.materialId.trim()) return;
                              patchLine(index, { tenSanXuat: '' });
                              return;
                            }
                            // Trùng dòng khác trong cùng phiên (cùng mã + tên + kho, khác hoa thường/khoảng trắng)
                            // thì dùng đúng chữ dòng kia để không sinh 2 dòng kho_nvl khi lưu.
                            const sibling = lines.find((other, otherIndex) => otherIndex !== index
                              && other.khoId === line.khoId
                              && normNvlIdentityText(other.maHang) === normNvlIdentityText(line.maHang)
                              && normNvlIdentityText(other.tenHang) === normNvlIdentityText(line.tenHang)
                              && normNvlIdentityText(other.tenSanXuat) === normNvlIdentityText(v)
                              && String(other.tenSanXuat || '').trim() !== '');
                            if (sibling) {
                              const siblingMatch = khoMaterials.find(option => String(option.id || '').trim() === String(sibling.materialId || '').trim());
                              if (siblingMatch) {
                                applyNhapMaterial(siblingMatch);
                                return;
                              }
                              patchLine(index, {
                                materialId: '',
                                tenHang: sibling.tenHang,
                                donVi: sibling.donVi || line.donVi,
                                warehouseClass: sibling.warehouseClass,
                                tenSanXuat: String(sibling.tenSanXuat || '').trim()
                              });
                              return;
                            }
                            // Tên SX mới cho mã hiện tại — giữ mã/tên/ĐVT/phân loại, lưu phiếu tự tạo dòng kho_nvl.
                            patchLine(index, { materialId: '', tenSanXuat: v });
                          }}
                          options={sxOptions}
                          getValue={item => String((item as MaterialOption).id || '').trim()}
                          getLabel={item => String((item as MaterialOption).productionName || '').trim()}
                          placeholder={line.maHang ? (line.materialId ? 'Không có dữ liệu' : 'Gõ tên SX mới hoặc chọn') : 'Chọn mã trước'}
                          disabled={!line.maHang.trim()}
                          inputClassName={`${fieldClass} ${!line.materialId.trim() && line.tenSanXuat.trim() ? 'border-amber-400 bg-amber-50' : ''}`}
                          allowEmpty
                          allowCustomValue
                          showAllWhenQueryMatchesSelection
                          revertOnBlurMismatch
                          openUpward
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle tabular-nums">{line.ton === null ? '—' : formatNumber(line.ton, 3)}</td>
                    <td className="px-2 py-2 align-middle"><input value={line.soLuong} onChange={event => patchLine(index, { soLuong: event.target.value })} onBlur={event => {
                      if (!event.target.value.trim()) return;
                      const parsed = parseLocalizedNumber(event.target.value);
                      if (Number.isFinite(parsed)) patchLine(index, { soLuong: formatNumber(parsed, 3) });
                    }} className={`${fieldClass} w-24`} /></td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle font-mono font-bold text-emerald-800">{formatWarehouseWeightKg(lineWeight(line))}</td>
                    <td className="px-2 py-2 align-middle"><input value={line.donGia} onChange={event => patchLine(index, { donGia: event.target.value })} onBlur={event => {
                      if (!event.target.value.trim()) return;
                      const parsed = parseLocalizedNumber(event.target.value);
                      if (Number.isFinite(parsed)) patchLine(index, { donGia: formatMoney(parsed, 0) });
                    }} className={`${fieldClass} w-28`} /></td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle text-right font-mono font-bold tabular-nums">{lineAmount(line) === null ? '—' : formatMoney(lineAmount(line) as number, 0)}</td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle text-right font-mono font-bold tabular-nums text-sky-800" title={`Giá mua + Chi phí đi kèm/1kg (${formatMoney(kemPerKgAll, 0)})`}>{lineImportPrice(line) === null ? '—' : formatMoney(lineImportPrice(line) as number, 0)}</td>
                    <td className="whitespace-nowrap px-2 py-2 align-middle text-right font-mono font-bold tabular-nums text-sky-800">{lineImportAmount(line) === null ? '—' : formatMoney(lineImportAmount(line) as number, 0)}</td>
                    <td className="px-2 py-2 align-middle">
                      <button type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))} className="text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-100">
                    <td colSpan={10} className="px-2 pb-2">
                      <ChiPhiKemTheoPanel
                        items={line.chiPhiKemTheo || []}
                        lineAmount={lineAmount(line) || 0}
                        onChange={viewOnly ? undefined : next => patchLine(index, { ...line, chiPhiKemTheo: next })}
                        disabled={viewOnly}
                      />
                    </td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => setLines(current => [...current, emptyLine()])} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#ef1b2d]">
          <Plus className="h-4 w-4" /> Thêm dòng
        </button>
        <p className="text-[11px] font-semibold text-zinc-500">Nguồn nhập không bắt buộc. Để trống thì không trừ kho nguồn. Mã chỉ lấy dòng kho NVL của đúng kho nhập (mỗi dòng một id). Nếu chọn kho nguồn thì chỉ Kho NVL Chính, Kho NVL Phụ, Kho PC. Kho nhập cũng chỉ ba kho đó.</p>
        </> : (
          <p className="text-[11px] font-semibold text-zinc-500">
            {destKind === 'ncc'
              ? 'Xuất đến là nhà cung cấp nhận hàng trả. Mỗi dòng chọn Xuất từ là kho hoặc máy. Chọn kho thì danh sách NVL là NVL của kho đó.'
              : destKind === 'may-ptdm'
                ? 'Xuất đến là máy nhận hàng, tự điền từ phiếu trộn định mức đã tick. Mỗi dòng vẫn chọn Xuất từ là kho hoặc máy.'
                : 'Xuất đến là nơi nhận (kho hoặc máy). Mỗi dòng chọn Xuất từ là kho hoặc máy. Chọn kho thì danh sách NVL là NVL của kho đó.'}
          </p>
        )}
        {warning ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{warning}
          </p>
        ) : null}
        {(() => {
          const filled = lines.filter(line => line.maHang.trim());
          const tongKl = tongKgAll;
          const tongHang = roundKem(filled.reduce((sum, line) => sum + (lineAmount(line) || 0), 0));
          const tongKem = tongKemAll;
          const tongCong = roundKem(tongHang + tongKem);
          const tongNhapKho = roundKem(filled.reduce((sum, line) => sum + (lineImportAmount(line) || 0), 0));
          return (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-800 sm:grid-cols-3">
              <span>Tổng trọng lượng <strong className="font-mono">{formatNumber(tongKl, 3)}</strong></span>
              <span>Tổng chi phí đi kèm <strong className="font-mono">{formatMoney(tongKem, 0)}</strong></span>
              <span>Chi phí đi kèm/1 kg <strong className="font-mono">{formatMoney(kemPerKgAll, 0)}</strong></span>
              <span>Tổng thành tiền <strong className="font-mono">{formatMoney(tongCong, 0)}</strong></span>
              <span>Tổng giá nhập kho <strong className="font-mono">{formatMoney(tongNhapKho, 0)}</strong></span>
            </div>
          );
        })()}
        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
        {info ? <p className="text-sm font-semibold text-emerald-700">{info}</p> : null}
        <div className="flex flex-wrap gap-2">
          {!viewOnly && (
            <button type="button" onClick={previewDraft} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#ef1b2d] px-4 text-xs font-extrabold text-[#ef1b2d]">
              <Printer className="h-4 w-4" /> Xem trước
            </button>
          )}
          <button
            type="button"
            disabled={viewOnly ? false : saving}
            onClick={viewOnly ? onBack : () => void onSave()}
            className={`h-9 rounded-lg px-4 text-xs font-extrabold text-white ${
              viewOnly ? 'bg-zinc-400' : 'bg-[#ef1b2d] disabled:opacity-60'
            }`}
          >
            {viewOnly ? 'Đóng' : saving ? 'Đang lưu…' : editingId ? 'Cập nhật' : 'Lưu phiếu'}
          </button>
        </div>
      </section>

      <WarehouseSlipPrintModal open={Boolean(printSlips)} slips={printSlips} onClose={() => setPrintSlips(null)} />
    </div>
  );
}

export { TongHopListPanel } from './list';
export { TongHopViewModal } from './ViewModal';
