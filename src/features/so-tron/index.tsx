import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, ExternalLink, Loader2, Minus, Plus, Printer, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { pathFromTab } from '../../routes';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import {
  findMachineByRef,
  machineSelectValue,
  normalizeMachines,
  type MachineRow
} from '../danh-sach-may';
import { normalizeMaterialsInventory, type MaterialRow } from '../kho-nvl';
import { normalizeProducts } from '../san-pham';
import { parseProductionNameParts } from '../../utils/productProductionName';
import { computeSoTronSummary, normalizeMang, SO_TRON_CHI_TIEU_MAU } from './summary';
import { PhieuGiaoCaModal } from './PhieuGiaoCaModal';
import { SoTronDatePicker, formatNgayVN } from './SoTronDatePicker';
import { printPhieuGiaoCaSlip } from './printPhieuGiaoCa';
import { normalizeProductionOrders, type ProductionOrderRow } from '../ke-hoach-san-xuat';
import type { OrderProductLine } from '../_shared/productionProductHelpers';
import { findShiftChainMeta, getProductionShiftOptions, normalizeShiftSettings, resolveLogicalNextShiftSlot, resolveLogicalPreviousShiftSlot, resolveShiftName, type ShiftSetting } from '../../utils/shiftSettings';
import { STANDARD_SHIFTS } from '../../types';
import { normalizeWarehouseMovements } from '../phieu-xuat-nhap-kho';


const CHI_NHANH_MAC_DINH = 'Phú Thọ';
const SO_LAN_TRON_MAC_DINH = 5;
const SO_LAN_TRON_TOI_DA = 20;

type CoiMauNvl = {
  material_id: string;
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_sx: string;
  dvt: string;
  gia_tri: string;
};
type CoiMauItem = {
  ma_lenh_sx: string;
  ten_phieu: string;
  ma_sp: string;
  ten_sp: string;
  dinh_luong_coi: string;
  tong_trong_luong: string;
  ghi_chu: string;
  nvl: CoiMauNvl[];
};

/** Tách chuỗi mã lệnh (nhiều lệnh ngăn nhau bằng , ; | /) thành từng mã. */
function splitLenhCodes(value: string) {
  return str(value)
    .split(/[,;|/]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

type NvlRow = {
  key: string;
  /** Id NVL trong kho (gộp theo id, fallback mã) */
  material_id: string;
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_sx: string;
  dvt: string;
  /** Định mức vật tư (nhập trên phiếu giao ca; sổ trộn giữ nguyên khi lưu) */
  dinh_muc: string;
  lan: string[];
  /** Các lệnh SX mà NVL này thuộc về (gộp khi trùng mã giữa nhiều lệnh) */
  nguon: string[];
};
type SanPhamRow = {
  key: string;
  ma_lenh_sx: string;
  /** Id danh mục SP (từ lệnh SX) — dùng để tra cứu, không hiển thị */
  san_pham_id: string;
  ma_sp: string;
  ten_sp: string;
  /** Màng SP (ECO/STD/...) — tự tra theo mã SP từ danh mục; không cho chọn/sửa tay */
  mang: string;
  so_luong: string;
  dinh_muc: string;
  trong_luong: string;
  /** Snapshot quy đổi 1 SP: tự fill từ lệnh SX khi chọn gợi ý, cho phép sửa tay */
  kg_1_sp: string;
  m2_1_sp: string;
  m_dai_1_sp: string;
  /** Nguồn quy đổi: 'lenh-sx' (tự fill) | 'tay' (người dùng sửa tay) */
  nguon_quy_doi: string;
  ghi_chu: string;
};
type HangLoiRow = { key: string; ten_loi: string; so_luong: string };
type BanGiaoRow = {
  key: string;
  material_id: string;
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_sx: string;
  lay_trong_kho: string;
  ton_dau_ca: string;
  /** true = cho phép effect xuất kho ghi đè Nhập Trong Ngày; false = giữ giá trị đã lưu/sửa tay */
  lay_kho_tu_dong: boolean;
  ton_dau_tu_dong: boolean;
};
type PhanCongItem = { ma_nhan_su: string; ten: string; vai_tro: string };

export type SoTronSavedReport = {
  id: string;
  chi_nhanh: string;
  ngay: string;
  ma_may: string;
  ten_may: string;
  ca: string;
  nhan_su: string;
  nhan_su_chi_tiet: unknown[];
  lenh_sx: { id: string; ma_lenh: string }[];
  coi_tron_mau: CoiMauItem[];
  bang_nvl: {
    material_id: string;
    ma_nvl: string;
    ten_nvl: string;
    ten_nvl_sx: string;
    dvt: string;
    lan: number[];
    tong: number;
    lenh_sx: string[];
    /** Định mức vật tư (người dùng nhập tay trên phiếu giao ca) */
    dinh_muc?: string;
  }[];
  bang_san_pham: {
    ma_lenh_sx: string;
    san_pham_id?: string;
    ma_sp: string;
    ten_sp: string;
    mang: string;
    so_luong: string;
    dinh_muc: string;
    trong_luong: string;
    /** Snapshot quy đổi 1 SP (kg/m2/m dài) — tự fill từ lệnh SX, cho sửa tay */
    kg_1_sp?: number;
    m2_1_sp?: number;
    m_dai_1_sp?: number;
    nguon_quy_doi?: string;
    ghi_chu: string;
  }[];
  bang_hang_loi: { ten_loi: string; so_luong: string }[];
  bang_ban_giao: {
    material_id: string;
    ma_nvl: string;
    ten_nvl: string;
    ten_nvl_sx: string;
    lay_trong_kho: number;
    ton_dau_ca: number;
    tong_su_dung: number;
    ton_cuoi_ca: number;
  }[];
  ghi_chu: string;
  /** 5 số tổng hợp lưu cùng phiếu (tự tính khi lưu, xem summary.ts) */
  tong_nvl: number;
  /** Tổng Nhập Trong Ngày = Σ lay_trong_kho (Nhập Trong Ngày) trong bảng bàn giao */
  tong_nhap_nvl: number;
  tong_sp_co_mang: number;
  tong_sp_khong_mang: number;
  tong_loi_hong: number;
  chi_tieu_phan_tram: number;
  created_at?: string;
  updated_at?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayLocal() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function str(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseNum(value: unknown) {
  const parsed = Number(str(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatQty(value: number) {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** Số dương làm tròn 2 chữ số — dùng cho snapshot quy đổi (undefined nếu trống/không hợp lệ). */
function parsePositiveOrUndefined(value: unknown): number | undefined {
  const text = str(value).replace(',', '.');
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : undefined;
}

/**
 * Quy đổi 1 SP = tổng cả dòng trong lệnh / số lượng đặt của dòng đó.
 * (Trong `lenh_sx.san_pham[]`, `m2`/`m_dai` là TỔNG cả dòng — xem đơn hàng
 * `convertProductQuantity(qty, ...)`; chỉ `kg_1_sp` mới là đơn vị 1 SP.)
 */
function perUnitFromOrderTotal(total: unknown, quantity: unknown): string {
  const totalNum = Number(str(total).replace(',', '.'));
  const qtyNum = Number(str(quantity).replace(',', '.'));
  if (!Number.isFinite(totalNum) || totalNum <= 0 || !Number.isFinite(qtyNum) || qtyNum <= 0) return '';
  return String(round2(totalNum / qtyNum));
}

/** Tự tính Trọng lượng = Số lượng × KG/1 SP khi ô Trọng lượng đang trống. */
function withAutoTrongLuong(row: SanPhamRow, soLuong: string): SanPhamRow {
  const next: SanPhamRow = { ...row, so_luong: soLuong };
  if (str(row.trong_luong)) return next;
  const qtyNum = Number(str(soLuong).replace(',', '.'));
  const kgNum = Number(str(row.kg_1_sp).replace(',', '.'));
  if (Number.isFinite(qtyNum) && qtyNum > 0 && Number.isFinite(kgNum) && kgNum > 0) {
    next.trong_luong = String(round2(qtyNum * kgNum));
  }
  return next;
}

type SpMetricKey = 'kg_1_sp' | 'm2_1_sp' | 'm_dai_1_sp';

/** Sửa tay 1 chỉ số quy đổi → đánh dấu nguồn 'tay'; đổi KG/1 SP thì tính lại Trọng lượng nếu đang trống. */
function updateSpMetric(row: SanPhamRow, key: SpMetricKey, value: string): SanPhamRow {
  const next: SanPhamRow = { ...row, [key]: value, nguon_quy_doi: 'tay' };
  if (key === 'kg_1_sp' && !str(row.trong_luong)) {
    const qtyNum = Number(str(row.so_luong).replace(',', '.'));
    const kgNum = Number(str(value).replace(',', '.'));
    if (Number.isFinite(qtyNum) && qtyNum > 0 && Number.isFinite(kgNum) && kgNum > 0) {
      next.trong_luong = String(round2(qtyNum * kgNum));
    }
  }
  return next;
}

/** Map 1 dòng SP form → JSON lưu DB (kèm snapshot quy đổi 1 SP). */
function toBangSanPhamLine(row: SanPhamRow) {
  const kg = parsePositiveOrUndefined(row.kg_1_sp);
  const m2 = parsePositiveOrUndefined(row.m2_1_sp);
  const mDai = parsePositiveOrUndefined(row.m_dai_1_sp);
  return {
    ma_lenh_sx: row.ma_lenh_sx,
    ...(str(row.san_pham_id) ? { san_pham_id: str(row.san_pham_id) } : {}),
    ma_sp: row.ma_sp.trim(),
    ten_sp: row.ten_sp.trim(),
    mang: normalizeMang(row.mang),
    so_luong: row.so_luong.trim(),
    dinh_muc: row.dinh_muc.trim(),
    trong_luong: row.trong_luong.trim(),
    ...(kg !== undefined ? { kg_1_sp: kg } : {}),
    ...(m2 !== undefined ? { m2_1_sp: m2 } : {}),
    ...(mDai !== undefined ? { m_dai_1_sp: mDai } : {}),
    ...(str(row.nguon_quy_doi) && (kg !== undefined || m2 !== undefined || mDai !== undefined)
      ? { nguon_quy_doi: str(row.nguon_quy_doi) }
      : {}),
    ghi_chu: row.ghi_chu.trim()
  };
}

function splitShifts(raw: string) {
  return str(raw)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function normalizeShiftKey(value: string) {
  return str(value).toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function machineMatches(orderMachine: string, code: string, name: string) {
  const ref = str(orderMachine).toLowerCase();
  if (!ref || ref === '-') return true;
  const keys = [code, name].map(v => str(v).toLowerCase()).filter(Boolean);
  if (keys.length === 0) return true;
  return keys.some(key => ref.includes(key) || key.includes(ref));
}

/** Lệnh khớp ca đã chọn (chuỗi ca của lệnh nối bằng ","). Rỗng = tất cả. */
function shiftMatchesSingle(orderShift: string, selectedCa: string) {
  if (!str(selectedCa)) return true;
  const parts = splitShifts(orderShift).map(p => normalizeShiftKey(p));
  if (parts.length === 0 || parts.every(p => !p)) return true;
  const target = normalizeShiftKey(selectedCa);
  if (!target) return true;
  return parts.some(part => part && (part === target || part.includes(target) || target.includes(part)));
}

function pickRecordText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = str(record[key]);
    if (value && value !== '-') return value;
  }
  return '';
}

function normalizeStaffDirectory(data: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const visitMember = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    const code = pickRecordText(record, ['ma_nhan_su', 'ma_nv', 'code', 'id']);
    const name = pickRecordText(record, ['ten_nhan_su', 'ho_ten', 'ten', 'name']);
    if (code && name && !map.has(code)) map.set(code, name);
    if (name && !map.has(name)) map.set(name, name);
  };
  const visitUnknown = (value: unknown, depth: number) => {
    if (depth > 4 || !value) return;
    if (typeof value === 'string') {
      const name = value.trim();
      if (name && !map.has(name)) map.set(name, name);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => visitUnknown(item, depth + 1));
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (Array.isArray(record.branches) || Array.isArray(record.departments) || Array.isArray(record.members)) {
        visitUnknown(record.branches ?? record.departments ?? record.members, depth + 1);
        return;
      }
      if (Array.isArray(record.staff) || Array.isArray(record.data) || Array.isArray(record.items)) {
        visitUnknown(record.staff ?? record.data ?? record.items, depth + 1);
        return;
      }
      visitMember(value);
    }
  };
  visitUnknown(data, 0);
  return map;
}

function normalizePhanCong(data: unknown, staffMap: Map<string, string>): PhanCongItem[] {
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? (data as Record<string, unknown>).items
      : [];
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const ma = pickRecordText(record, ['ma_nhan_su', 'ma_nv', 'code']);
      const tenTrucTiep = pickRecordText(record, ['ten_nhan_su', 'ho_ten', 'ten', 'name']);
      const ten = tenTrucTiep || (ma ? staffMap.get(ma) || '' : '') || ma;
      const vaiTro = pickRecordText(record, ['vai_tro', 'role', 'chuc_vu']);
      if (!ma && !ten) return null;
      return { ma_nhan_su: ma || ten, ten, vai_tro: vaiTro };
    })
    .filter((item): item is PhanCongItem => Boolean(item));
}

function normalizeCoiMauNvl(raw: unknown): CoiMauNvl[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map(rawLine => {
      if (!rawLine || typeof rawLine !== 'object') return null;
      const line = rawLine as Record<string, unknown>;
      // Bỏ dòng NVL phụ — chỉ lấy NVL cối chính.
      if (String(line.loai ?? '').trim() === 'nvl_phu') return null;
      const ma = pickRecordText(line, ['ma_nvl', 'materialCode', 'code']);
      const sx = pickRecordText(line, ['ten_nvl_san_xuat', 'tenNvlSanXuat']);
      const ten = pickRecordText(line, ['ten_nvl', 'materialName', 'name']) || sx;
      if (!ma && !ten) return null;
      const dvtRaw = pickRecordText(line, ['don_vi', 'dvt', 'unit', 'don_vi_dinh_muc']) || 'kg';
      return {
        material_id: str(line.material_id ?? line.materialId ?? ''),
        ma_nvl: ma || ten,
        ten_nvl: ten || ma,
        ten_nvl_sx: sx,
        dvt: dvtRaw === '%' ? '%' : 'kg',
        gia_tri: str(line.gia_tri ?? line.dinh_muc ?? '')
      };
    })
    .filter((line): line is CoiMauNvl => Boolean(line));
}

/** Block sản phẩm trong chi_tiet: { ma_sp, nvl|chi_tiet } — không phải dòng NVL phẳng. */
function isCoiMauProductBlock(item: Record<string, unknown>) {
  if (Array.isArray(item.nvl)) return true;
  if (Array.isArray(item.chi_tiet) && (item.ma_sp || item.ten_sp)) return true;
  return Boolean(str(item.ma_sp)) && !str(item.ma_nvl);
}

/** Chuẩn hóa mọi dạng ngày (ISO YYYY-MM-DD, DD/MM/YYYY) về key YYYYMMDD để so sánh. */
function toSortableDateKey(value: unknown) {
  const s = str(value);
  if (!s || s === '-') return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  const vn = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vn) return `${vn[3]}${vn[2].padStart(2, '0')}${vn[1].padStart(2, '0')}`;
  return '';
}

/** Ngày bắt đầu / kết thúc của lệnh (ưu tiên field thô ISO, fallback field đã format). */
function orderDateKey(order: ProductionOrderRow, kind: 'start' | 'end') {
  const candidates =
    kind === 'start'
      ? [order.ngay_gio_bat_dau, order.ngay_bat_dau, order.startDate]
      : [order.ngay_gio_ket_thuc, order.endDate];
  for (const c of candidates) {
    const key = toSortableDateKey(c);
    if (key) return key;
  }
  return '';
}

function normalizeCoiMau(data: unknown): { products: CoiMauItem[] } {
  const container =
    data && typeof data === 'object' && Array.isArray((data as { records?: unknown }).records)
      ? (data as { records: unknown[] }).records
      : [];
  const products: CoiMauItem[] = [];
  const pushBlock = (maLenh: string, tenPhieu: string, prod: Record<string, unknown>, nvl: CoiMauNvl[]) => {
    // Bỏ cả block NVL phụ — chỉ lấy NVL cối chính.
    if (String(prod.loai ?? '').trim() === 'nvl_phu') return;
    const ma_sp = pickRecordText(prod, ['ma_sp', 'productCode']);
    const ten_sp = pickRecordText(prod, ['ten_ghep', 'ten_sp', 'productName']) || ma_sp;
    if (!ma_sp && !ten_sp && nvl.length === 0) return;
    products.push({
      ma_lenh_sx: maLenh,
      ten_phieu: tenPhieu,
      ma_sp,
      ten_sp,
      dinh_luong_coi: str(prod.dinh_luong_coi ?? ''),
      tong_trong_luong: str(prod.tong_trong_luong ?? ''),
      ghi_chu: str(prod.ghi_chu ?? ''),
      nvl
    });
  };
  for (const raw of container) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const maLenh = pickRecordText(record, ['ma_lenh_sx', 'maLenhSx']);
    const tenPhieu = pickRecordText(record, ['ten_phieu', 'tenPhieu']);
    // 1) products[] nếu có (kể cả khi các block đều là NVL phụ và bị bỏ qua)
    if (Array.isArray(record.products) && (record.products as unknown[]).length > 0) {
      for (const rawProd of record.products as unknown[]) {
        if (!rawProd || typeof rawProd !== 'object') continue;
        const prod = rawProd as Record<string, unknown>;
        pushBlock(maLenh, tenPhieu, prod, normalizeCoiMauNvl(prod.nvl ?? prod.chi_tiet));
      }
      continue;
    }
    const chiTiet = record.chi_tiet;
    if (Array.isArray(chiTiet) && chiTiet.length > 0) {
      const first = chiTiet[0];
      if (first && typeof first === 'object' && isCoiMauProductBlock(first as Record<string, unknown>)) {
        // 2) NEW: chi_tiet = các block sản phẩm { ma_sp, nvl|chi_tiet }
        for (const entry of chiTiet as unknown[]) {
          if (!entry || typeof entry !== 'object') continue;
          const prod = entry as Record<string, unknown>;
          pushBlock(maLenh, tenPhieu, prod, normalizeCoiMauNvl(prod.nvl ?? prod.chi_tiet));
        }
      } else {
        // 3) LEGACY: chi_tiet = các dòng NVL phẳng + SP ở cấp phiếu
        pushBlock(maLenh, tenPhieu, record, normalizeCoiMauNvl(chiTiet));
      }
    } else {
      // 4) Phiếu chỉ có cột SP/NVL cấp phiếu
      const ma = pickRecordText(record, ['ma_nvl']);
      const ten = pickRecordText(record, ['ten_nvl']);
      const hasSp = Boolean(pickRecordText(record, ['ma_sp', 'ten_sp']));
      if (ma || ten || hasSp) {
        const fallbackLines: unknown[] =
          ma || ten
            ? [
                {
                  ma_nvl: ma,
                  ten_nvl: ten,
                  don_vi: pickRecordText(record, ['don_vi_dinh_muc']),
                  dinh_muc: record.dinh_muc
                }
              ]
            : [];
        pushBlock(maLenh, tenPhieu, record, normalizeCoiMauNvl(fallbackLines));
      }
    }
  }
  return { products };
}

/** Combo Máy-Ca rút từ lệnh SX đã chọn (1 lệnh có thể gồm nhiều ca nối ","). */
type MayCaCombo = { machine: string; ca: string };

function combosFromOrders(ordersList: ProductionOrderRow[]): MayCaCombo[] {
  const map = new Map<string, MayCaCombo>();
  for (const order of ordersList) {
    const rawMachine = str(order.machine);
    const machine = rawMachine === '-' ? '' : rawMachine;
    const rawParts = splitShifts(order.shift);
    const parts = (rawParts.length > 0 ? rawParts : ['']).map(p => (p === '-' ? '' : p));
    for (const ca of parts) {
      const key = `${machine}|||${ca}`;
      if (!map.has(key)) map.set(key, { machine, ca });
    }
  }
  return [...map.values()];
}

function phanCongItemMay(item: unknown) {
  if (!item || typeof item !== 'object') return '';
  const rec = item as Record<string, unknown>;
  return `${str(rec.ma_may)} ${str(rec.may)}`.trim();
}

function formatMayCa(machine: string, shift: string) {
  const may = str(machine) && str(machine) !== '-' ? str(machine) : '—';
  const ca = str(shift) && str(shift) !== '-' ? str(shift) : '—';
  return `${may} - ${ca}`;
}

function normalizeSoTronReports(data: unknown): SoTronSavedReport[] {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>).reports : data;
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      const asArray = (value: unknown) => (Array.isArray(value) ? value : []);
      const asNum = (value: unknown) => {
        const parsed = Number(str(value).replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
      };
      return {
        id: str(r.id),
        chi_nhanh: str(r.chi_nhanh) || CHI_NHANH_MAC_DINH,
        ngay: str(r.ngay).slice(0, 10),
        ma_may: str(r.ma_may),
        ten_may: str(r.ten_may),
        ca: str(r.ca),
        nhan_su: str(r.nhan_su),
        nhan_su_chi_tiet: asArray(r.nhan_su_chi_tiet),
        lenh_sx: asArray(r.lenh_sx) as { id: string; ma_lenh: string }[],
        coi_tron_mau: asArray(r.coi_tron_mau) as CoiMauItem[],
        bang_nvl: asArray(r.bang_nvl) as SoTronSavedReport['bang_nvl'],
        bang_san_pham: asArray(r.bang_san_pham) as SoTronSavedReport['bang_san_pham'],
        bang_hang_loi: asArray(r.bang_hang_loi) as SoTronSavedReport['bang_hang_loi'],
        bang_ban_giao: asArray(r.bang_ban_giao) as SoTronSavedReport['bang_ban_giao'],
        ghi_chu: str(r.ghi_chu),
        tong_nvl: asNum(r.tong_nvl),
        tong_nhap_nvl: asNum(r.tong_nhap_nvl),
        tong_sp_co_mang: asNum(r.tong_sp_co_mang),
        tong_sp_khong_mang: asNum(r.tong_sp_khong_mang),
        tong_loi_hong: asNum(r.tong_loi_hong),
        chi_tieu_phan_tram: asNum(r.chi_tieu_phan_tram),
        created_at: str(r.created_at),
        updated_at: str(r.updated_at)
      } as SoTronSavedReport;
    })
    .filter((item): item is SoTronSavedReport => Boolean(item && item.id));
}

/** Cụm nút thao tác inline cho 1 dòng sổ trộn (không dùng three-dots): tự xuống dòng, không chen lấn.
 *  Theo yêu cầu: CHỈ giữ `In phiếu giao ca` (đã bỏ nút `In A4`). */
function SoTronRowActions({
  onEdit,
  onDelete,
  onPrintGiaoCa
}: {
  onEdit: () => void;
  onDelete: () => void;
  onPrintGiaoCa: () => void;
}) {
  const btnClass =
    'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-bold transition';
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={onPrintGiaoCa}
        title="In phiếu giao ca (cho xem và sửa trước khi in)"
        className={`${btnClass} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
      >
        <Printer className="h-3.5 w-3.5" /> In phiếu giao ca
      </button>
      <button
        type="button"
        onClick={onEdit}
        className={`${btnClass} border-slate-200 text-slate-600 hover:bg-slate-50`}
      >
        Sửa
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={`${btnClass} border-rose-200 text-rose-600 hover:bg-rose-50`}
      >
        Xóa
      </button>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20';
const numInputClass = `${inputClass} text-right tabular-nums`;
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500';
const cardClass = 'rounded-xl border border-slate-200 bg-white shadow-card';
const sectionTitleClass = 'font-display text-[14px] font-semibold tracking-tight text-slate-900';

function SectionHeader({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">
        {index}
      </span>
      <span className="min-w-0">
        <span className={`block ${sectionTitleClass}`}>{title}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">{desc}</span>
      </span>
    </div>
  );
}

export function SoTronPanel({
  onBack,
  onOpenList,
  editReport,
  onEditConsumed
}: {
  onBack: () => void;
  onOpenList: () => void;
  editReport?: SoTronSavedReport | null;
  onEditConsumed?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [shiftOptions, setShiftOptions] = useState<{ value: string; label: string }[]>([]);
  /** Raw settings ca (giu nhom Loai ca + thu tu) — de giai chuoi ca truoc theo vong lap. */
  const [shiftSettingsRaw, setShiftSettingsRaw] = useState<ShiftSetting[]>([]);
  const [orders, setOrders] = useState<ProductionOrderRow[]>([]);
  // Tổng số lệnh tải được (null = chưa tải xong / tải lỗi) — để chẩn đoán lọc
  const [ordersTotal, setOrdersTotal] = useState<number | null>(null);
  const [staffMap, setStaffMap] = useState<Map<string, string>>(new Map());
  const [savedReports, setSavedReports] = useState<SoTronSavedReport[]>([]);
  // Map mã SP (thường) → màng (ECO/STD/...) từ danh mục, để tự điền cột Màng
  const [mangByCode, setMangByCode] = useState<Map<string, string>>(new Map());

  const [ngay, setNgay] = useState(todayLocal());
  // Máy (chọn 1) + Ca (chọn 1) để lọc lệnh SX
  const [machineRef, setMachineRef] = useState('');
  const [selectedCa, setSelectedCa] = useState('');
  const [phanCong, setPhanCong] = useState<PhanCongItem[]>([]);
  // Nhân sự gom theo từng combo Máy-Ca (để hiển thị theo máy và ca)
  const [staffGroups, setStaffGroups] = useState<{ key: string; label: string; staff: PhanCongItem[] }[]>([]);
  // true khi người dùng đã sửa tay ô Nhân sự ca (không tự ghi đè nữa)
  const [nhanSuTouched, setNhanSuTouched] = useState(false);
  // Tăng để đồng bộ lại nhân sự sau khi sắp xếp lịch mới xong
  const [staffTick, setStaffTick] = useState(0);

  // Đồng bộ: tải lại danh mục nhân viên (mã → tên) rồi tải lại phân công
  const handleSyncStaff = async () => {
    setIsLoadingStaff(true);
    try {
      const res = await fetch('/api/nhan-su?format=groups&scope=all');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStaffMap(normalizeStaffDirectory(data));
    } catch {
      /* bỏ qua, vẫn đồng bộ phân công bên dưới */
    }
    setStaffTick(t => t + 1);
  };
  const [nhanSuText, setNhanSuText] = useState('');
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  const [selectedLenh, setSelectedLenh] = useState<string[]>([]);
  const [coiMau, setCoiMau] = useState<CoiMauItem[]>([]);
  const [isLoadingCoi, setIsLoadingCoi] = useState(false);

  const [numLan, setNumLan] = useState(SO_LAN_TRON_MAC_DINH);
  const [nvlRows, setNvlRows] = useState<NvlRow[]>([]);
  const [spRows, setSpRows] = useState<SanPhamRow[]>([]);
  const [loiRows, setLoiRows] = useState<HangLoiRow[]>([]);
  const [banGiaoRows, setBanGiaoRows] = useState<BanGiaoRow[]>([]);
  const [ghiChu, setGhiChu] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewPhieuGiaoCaReport, setPreviewPhieuGiaoCaReport] = useState<SoTronSavedReport | null>(null);
  const [prevTonMap, setPrevTonMap] = useState<Map<string, number>>(new Map());
  const [hasPrevReport, setHasPrevReport] = useState<boolean | null>(null);
  /** O ca truoc da dong bo (ngay + ca cua phieu nguon) — chi set sau khi bam Dong bo. */
  const [prevSource, setPrevSource] = useState<{ ngay: string; ca: string } | null>(null);
  /** Chon tay ca truoc de lay Nhap Ca Truoc (mac dinh = o logic, doi khi bam Dong bo moi fill). */
  const [prevDatePick, setPrevDatePick] = useState('');
  const [prevCaPick, setPrevCaPick] = useState('');
  const [prevPickTouched, setPrevPickTouched] = useState(false);
  const [isSyncingPrev, setIsSyncingPrev] = useState(false);
  const [prevSyncNote, setPrevSyncNote] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list');
  const [listFilterDate, setListFilterDate] = useState('');
  const [listFilterMachine, setListFilterMachine] = useState('');
  const [listFilterCa, setListFilterCa] = useState('');

  const hasPrevTon = useMemo(() => {
    if (hasPrevReport === false) return false;
    if (prevTonMap.size > 0 && Array.from(prevTonMap.values()).some(v => v > 0)) return true;
    if (banGiaoRows.some(r => parseNum(r.ton_dau_ca) > 0)) return true;
    if (hasPrevReport === true && prevTonMap.size > 0) return true;
    return false;
  }, [hasPrevReport, prevTonMap, banGiaoRows]);
  // Tổng xuất kho NVL theo ngày-máy-ca (Nhập Trong Ngày trong bảng Bàn Giao Ca Sau)
  const [nhapTrongNgayMap, setNhapTrongNgayMap] = useState<Map<string, number>>(new Map());

  const selectedOrders = useMemo(
    () => selectedLenh.map(code => orders.find(o => o.code === code)).filter((o): o is ProductionOrderRow => Boolean(o)),
    [selectedLenh, orders]
  );

  // Combo Máy-Ca rút từ các lệnh đã chọn
  const orderCombos = useMemo(() => combosFromOrders(selectedOrders), [selectedOrders]);

  /**
   * Combo Máy-Ca sẽ LƯU phiếu: khi đã chọn Ca ở mục 1 (Lọc theo ca) thì CHỈ giữ
   * combo khớp ca đó — tránh tạo phiếu cho tất cả các ca trong lệnh
   * (vd lệnh ghi "HC1,HC2" mà lọc HC1 thì chỉ lưu HC1). Chưa chọn ca = giữ tất cả.
   */
  const saveCombos = useMemo(() => {
    const caVal = selectedCa.trim();
    if (!caVal) return orderCombos;
    return orderCombos.filter(c => shiftMatchesSingle(c.ca, caVal));
  }, [orderCombos, selectedCa]);

  // Ca hien tai de xac dinh ca truoc / ca sau logic (uu tien ca da chon o muc 1).
  const currentCaForChain = (selectedCa.trim() || orderCombos[0]?.ca || '').trim();
  /** O ca truoc LOGIC theo vong lap loai ca (Ca8H: HC1→HC2→HC3, Ca12H: 12C1→12C2; ca dem tinh theo ngay bat dau). */
  const prevSlotLogic = useMemo(() => {
    if (!ngay || !currentCaForChain || shiftOptions.length === 0) return null;
    try {
      return resolveLogicalPreviousShiftSlot(ngay, currentCaForChain, shiftOptions, shiftSettingsRaw);
    } catch {
      return null;
    }
  }, [ngay, currentCaForChain, shiftOptions, shiftSettingsRaw]);
  /** O ca sau LOGIC (doi xung ca truoc) — ton cuoi ca nay se la Nhap Ca Truoc cua ca sau. */
  const nextSlotLogic = useMemo(() => {
    if (!ngay || !currentCaForChain || shiftOptions.length === 0) return null;
    try {
      return resolveLogicalNextShiftSlot(ngay, currentCaForChain, shiftOptions, shiftSettingsRaw);
    } catch {
      return null;
    }
  }, [ngay, currentCaForChain, shiftOptions, shiftSettingsRaw]);
  /** Ca hien tai co thuoc chuoi loai ca nao khong (da xep loai ca + thu tu o /cai-dat). */
  const inChainForDisplay = useMemo(() => {
    if (!currentCaForChain || shiftOptions.length === 0) return null;
    try {
      return findShiftChainMeta(currentCaForChain, shiftOptions, shiftSettingsRaw);
    } catch {
      return null;
    }
  }, [currentCaForChain, shiftOptions, shiftSettingsRaw]);
  /**
   * Tooltip (!) cot Nhap Ca Truoc:
   * - Co phieu ca truoc: ton cuoi ca truoc (o ngay + ca nguon) = Nhap Ca Truoc.
   * - Chua co phieu: hien ro o ca truoc logic dang cho (de biet vi sao trong).
   */
  const prevSourceText = prevSource
    ? `Tồn cuối ca ${prevSource.ca || '—'} ngày ${formatNgayVN(prevSource.ngay) || prevSource.ngay} = Nhập Ca Trước ca hiện tại`
    : prevSlotLogic
      ? `Ca trước logic: ca ${prevSlotLogic.shift} ngày ${formatNgayVN(prevSlotLogic.ngay) || prevSlotLogic.ngay} — chưa có phiếu (Nhập Ca Trước đang trống)`
      : 'Chưa có bàn giao ca trước';

  // O "Chon ca truoc" an theo Ngay + Ca + May o muc 1 phia tren (doi muc 1 thi reset).
  useEffect(() => {
    setPrevPickTouched(false);
    setPrevSyncNote('');
  }, [ngay, currentCaForChain, machineRef]);
  // Mac dinh o chon = o ca truoc logic suy tu Ngay + Ca + May o muc 1 phia tren. Chi fill sau khi bam.
  useEffect(() => {
    if (prevPickTouched) return;
    if (prevSlotLogic) {
      setPrevDatePick(prevSlotLogic.ngay);
      setPrevCaPick(prevSlotLogic.shift);
    }
  }, [prevSlotLogic, prevPickTouched]);

  // ---- Resolve máy theo danh mục (phục vụ nhân sự / tồn / lưu phiếu) ----
  const resolveComboMachine = (machineRaw: string) => {
    const found = findMachineByRef(machines, machineRaw);
    return {
      code: found?.code || machineRaw,
      name: found?.name || machineRaw,
      display: found ? machineSelectValue(found) : machineRaw
    };
  };

  const resolveComboIdentity = (combo: MayCaCombo) => {
    const resolved = resolveComboMachine(combo.machine);
    return { ma_may: resolved.code, ten_may: resolved.name, ca: combo.ca };
  };

  /** Chuẩn hoá tên ca về key so sánh (khớp cả phiếu ghi tay). */
  const canonCaKey = (value: string) => {
    const v = str(value);
    if (!v) return '';
    if (shiftOptions.length > 0) {
      try {
        return resolveShiftName(v, shiftOptions).trim().toLowerCase();
      } catch {
        return v.toLowerCase();
      }
    }
    return v.toLowerCase();
  };

  /**
   * Ca đã có sổ trộn theo Ngày + Máy đang chọn ở mục 1 (trừ phiếu đang sửa).
   * Ô Ca ở Thêm mới chỉ hiện ca chưa tạo.
   */
  const usedCaKeysForDateMachine = useMemo(() => {
    const set = new Set<string>();
    const machineRaw = machineRef.trim();
    if (!ngay || !machineRaw) return set;
    const resolved = resolveComboMachine(machineRaw);
    for (const r of savedReports) {
      if (r.id === editingId) continue;
      if (r.ngay !== ngay) continue;
      if (!machineMatches(r.ma_may || r.ten_may, resolved.code, resolved.name)) continue;
      const key = canonCaKey(r.ca || '');
      if (key) set.add(key);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedReports, ngay, machineRef, machines, shiftOptions, editingId]);

  /** Option Ca ở Thêm mới: loại ca đã có sổ trộn của ngày + máy đang chọn. */
  const caCreateOptions = useMemo(() => {
    if (usedCaKeysForDateMachine.size === 0) return shiftOptions;
    return shiftOptions.filter(o => !usedCaKeysForDateMachine.has(canonCaKey(o.value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftOptions, usedCaKeysForDateMachine]);

  /** Ca đang chọn đã có sổ trộn của ngày + máy này (lưu sẽ cập nhật phiếu cũ). */
  const selectedCaAlreadyCreated = useMemo(() => {
    const caVal = selectedCa.trim();
    if (!caVal || usedCaKeysForDateMachine.size === 0) return false;
    return usedCaKeysForDateMachine.has(canonCaKey(caVal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCa, usedCaKeysForDateMachine, shiftOptions]);

  // Danh mục kho NVL: tra id + tên sản xuất theo id/mã (gộp NVL theo id)
  const materialById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);
  const materialByCode = useMemo(() => {
    const map = new Map<string, MaterialRow>();
    for (const m of materials) {
      const key = str(m.code).toLowerCase();
      if (key && !map.has(key)) map.set(key, m);
    }
    return map;
  }, [materials]);

  const resolveNvlDisplay = (materialId: string, ma: string, ten: string, sx: string) => {
    const dir =
      (str(materialId) && materialById.get(str(materialId))) ||
      materialByCode.get(str(ma).toLowerCase());
    if (!dir) {
      return { material_id: str(materialId), ma_nvl: str(ma), ten_nvl: str(ten), ten_nvl_sx: str(sx) };
    }
    return {
      material_id: dir.id,
      ma_nvl: dir.code || str(ma),
      ten_nvl: dir.name || str(ten),
      ten_nvl_sx: dir.productionName || str(sx)
    };
  };

  const nvlRowKey = (materialId: string, ma: string) => {
    const disp = resolveNvlDisplay(materialId, ma, '', '');
    return (disp.material_id || disp.ma_nvl).toLowerCase();
  };

  // Nạp danh mục dùng chung 1 lần
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [machineRes, materialRes, settingRes, orderRes, staffRes, reportRes, productRes] = await Promise.all([
          fetch('/api/danh-sach-may'),
          fetch('/api/kho-nvl'),
          fetch('/api/cai-dat'),
          fetch('/api/lenh-sx'),
          // format=groups để có cả mã + tên nhân viên (API thường chỉ trả tên)
          fetch('/api/nhan-su?format=groups&scope=all'),
          fetch('/api/so-tron?limit=100'),
          // Danh mục SP để tự tra màng theo mã SP
          fetch('/api/san-pham?limit=5000')
        ]);
        const [machineData, materialData, settingData, orderData, staffData, reportData, productData] = await Promise.all([
          machineRes.json().catch(() => ({})),
          materialRes.json().catch(() => ({})),
          settingRes.json().catch(() => ({})),
          orderRes.json().catch(() => ({})),
          staffRes.json().catch(() => ({})),
          reportRes.json().catch(() => ({})),
          productRes.json().catch(() => ({}))
        ]);
        if (!alive) return;
        if (machineRes.ok) {
          const list = normalizeMachines(machineData).filter(
            m => !m.branch || m.branch === '-' || /phú thọ/i.test(m.branch)
          );
          setMachines(list.length > 0 ? list : normalizeMachines(machineData));
        }
        if (materialRes.ok) {
          try {
            setMaterials(normalizeMaterialsInventory(materialData));
          } catch {
            setMaterials([]);
          }
        }
        if (settingRes.ok) {
          const rawSettings = normalizeShiftSettings(settingData);
          setShiftSettingsRaw(rawSettings);
          const options = getProductionShiftOptions(rawSettings);
          setShiftOptions(options.length > 0 ? options : STANDARD_SHIFTS.map(s => ({ value: s, label: s })));
        } else {
          setShiftOptions(STANDARD_SHIFTS.map(s => ({ value: s, label: s })));
        }
        if (orderRes.ok) {
          try {
            const list = normalizeProductionOrders(orderData);
            setOrders(list);
            setOrdersTotal(list.length);
          } catch {
            setOrders([]);
            setOrdersTotal(0);
          }
        }
        if (staffRes.ok) setStaffMap(normalizeStaffDirectory(staffData));
        if (reportRes.ok) setSavedReports(normalizeSoTronReports(reportData));
        if (productRes.ok) {
          try {
            const map = new Map<string, string>();
            for (const p of normalizeProducts(productData)) {
              const mang = normalizeMang(p.mang || '');
              if (!mang) continue;
              for (const code of [p.code, p.amisCode, p.newCode]) {
                const key = str(code).toLowerCase();
                if (key && !map.has(key)) map.set(key, mang);
              }
            }
            setMangByCode(map);
          } catch {
            setMangByCode(new Map());
          }
        }
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  // Lệnh SX bắt buộc có cả ngày bắt đầu và ngày kết thúc,
  // ngày chọn phải nằm trong khoảng ngay_bat_dau → ngay_ket_thuc
  const dateMatchedOrders = useMemo(() => {
    if (!ngay) return [];
    const dayKey = ngay.replace(/-/g, '');
    return orders
      .filter(order => {
        const start = orderDateKey(order, 'start');
        const end = orderDateKey(order, 'end');
        if (!start || !end) return false;
        if (start > dayKey || dayKey > end) return false;
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code, 'vi'));
  }, [orders, ngay]);

  const orderHasRef = (order: ProductionOrderRow) =>
    (str(order.machine) && str(order.machine) !== '-') ||
    (str(order.shift) && str(order.shift) !== '-');

  // Lệnh thiếu ngày bắt đầu hoặc ngày kết thúc (hiện kèm để kiểm tra lại)
  const datelessOrders = useMemo(() => {
    if (!ngay) return [];
    return orders
      .filter(order => (!orderDateKey(order, 'start') || !orderDateKey(order, 'end')) && orderHasRef(order))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi'));
  }, [orders, ngay]);

  /** Nhãn 1 lệnh trong ô chọn nhiều lệnh (kiểu phiếu trộn định mức): `<mã> - <máy> · <ngày> · <ca>`. */
  const lenhOptionLabel = (order: ProductionOrderRow) => {
    const machine = str(order.machine) && str(order.machine) !== '-' ? str(order.machine) : '';
    const base = machine ? `${order.code} - ${machine}` : order.code;
    const dispDay = (k: string) => (k ? `${k.slice(6, 8)}/${k.slice(4, 6)}/${k.slice(0, 4)}` : '');
    const start = orderDateKey(order, 'start');
    const end = orderDateKey(order, 'end');
    const range = start || end ? ` · ${dispDay(start) || '—'} → ${dispDay(end) || '—'}` : ' · thiếu ngày';
    const shift = str(order.shift) && str(order.shift) !== '-' ? ` · ${str(order.shift)}` : '';
    return `${base}${range}${shift}`;
  };

  const lenhOptionSearchText = (order: ProductionOrderRow) => {
    const products = Array.isArray(order.products)
      ? (order.products as OrderProductLine[])
          .map(p => `${str(p.productCode)} ${str(p.tenGhep || p.productName)}`)
          .join(' ')
      : '';
    return `${order.code} ${str(order.machine)} ${str(order.shift)} ${products}`;
  };

  // Lọc lệnh theo máy (chọn 1) + ca (chọn 1) đã chọn ở mục 1 (trống = tất cả).
  // Options ô chọn lệnh: lệnh trong ngày + lệnh thiếu ngày, đã lọc máy/ca.
  const lenhOptions = useMemo(() => {
    const machine = machineRef.trim();
    const resolved = machine ? resolveComboMachine(machine) : null;
    const passRef = (order: ProductionOrderRow) => {
      if (resolved && !machineMatches(order.machine, resolved.code, resolved.name)) return false;
      if (!shiftMatchesSingle(order.shift, selectedCa)) return false;
      return true;
    };
    const dated = dateMatchedOrders.filter(passRef);
    const seen = new Set(dated.map(o => o.code));
    return [...dated, ...datelessOrders.filter(o => !seen.has(o.code) && passRef(o))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMatchedOrders, datelessOrders, machineRef, selectedCa, machines]);

  const lenhValues = useMemo(
    () => lenhOptions.filter(o => selectedLenh.includes(o.code)),
    [lenhOptions, selectedLenh]
  );

  // Mã lệnh đã chọn nhưng không còn trong danh sách tải về (chip cảnh báo kiểu định mức)
  const unresolvedLenhCodes = useMemo(() => {
    const known = new Set(orders.map(o => o.code));
    return selectedLenh.filter(code => !known.has(code));
  }, [selectedLenh, orders]);

  // Luôn hiển thị TÊN nhân viên: tra mã → tên (khớp cả hoa thường),
  // rớt lại tên đã lưu, cuối cùng mới hiện mã
  const lookupStaffName = (map: Map<string, string>, ma: string, fallback: string) => {
    const code = str(ma);
    if (!code) return str(fallback);
    return map.get(code) || map.get(code.toLowerCase()) || str(fallback) || code;
  };
  const staffDisplayName = (p: PhanCongItem) => lookupStaffName(staffMap, p.ma_nhan_su, p.ten);

  const staffTextFrom = (map: Map<string, string>, list: PhanCongItem[]) =>
    list.map(p => lookupStaffName(map, p.ma_nhan_su, p.ten)).filter(Boolean).join(', ');

  // Danh mục nhân viên về sau (vd bấm Đồng bộ) mà ô chưa sửa tay → dựng lại tên
  useEffect(() => {
    if (nhanSuTouched || phanCong.length === 0) return;
    setNhanSuText(staffTextFrom(staffMap, phanCong));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffMap]);
  // Tự động fill nhân sự CHỈ theo ngày + máy + ca đã chọn ở mục 1
  // (không fill theo lệnh SX)
  useEffect(() => {
    if (isLoading || !ngay) {
      setPhanCong([]);
      setStaffGroups([]);
      return;
    }
    const machine = machineRef.trim();
    if (!machine) {
      setPhanCong([]);
      setStaffGroups([]);
      return;
    }
    const combos = [{ machine, ca: selectedCa.trim() }];
    let alive = true;
    setIsLoadingStaff(true);
    const timer = setTimeout(() => {
      (async () => {
        try {
          const perCombo = await Promise.all(
            combos.map(async combo => {
              try {
                const params = new URLSearchParams({ ngay_lam_viec: ngay });
                if (combo.ca) params.set('ca', combo.ca);
                const res = await fetch(`/api/phan-cong-nhan-su?${params.toString()}`);
                const data = await res.json().catch(() => ({}));
                if (!alive || !res.ok) return [];
                const itemsRaw =
                  data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)
                    ? (data as { items: unknown[] }).items
                    : [];
                const found = findMachineByRef(machines, combo.machine);
                const code = found?.code || combo.machine;
                const name = found?.name || combo.machine;
                const filtered = itemsRaw.filter(item => machineMatches(phanCongItemMay(item), code, name));
                return normalizePhanCong(filtered, staffMap);
              } catch {
                return [];
              }
            })
          );
          if (!alive) return;
          const merged = new Map<string, PhanCongItem>();
          for (const person of perCombo.flat()) {
            if (!merged.has(person.ma_nhan_su)) merged.set(person.ma_nhan_su, person);
          }
          const list = [...merged.values()];
          // Truy vấn trực tiếp bảng nhan_su theo mã để lấy tên
          const nameMap = new Map(staffMap);
          const codes = [...new Set(list.map(p => p.ma_nhan_su).filter(Boolean))];
          const missing = codes.filter(
            code => !nameMap.has(code) && !nameMap.has(code.toLowerCase())
          );
          if (missing.length > 0) {
            try {
              const nameRes = await fetch(
                `/api/nhan-su/by-code?codes=${encodeURIComponent(missing.join(','))}`
              );
              const nameData = await nameRes.json().catch(() => ({}));
              if (alive && nameRes.ok && nameData && typeof nameData.names === 'object') {
                for (const [code, name] of Object.entries(nameData.names as Record<string, unknown>)) {
                  const text = str(name);
                  if (!text) continue;
                  nameMap.set(code, text);
                  nameMap.set(code.toLowerCase(), text);
                }
                setStaffMap(nameMap);
              }
            } catch {
              /* bỏ qua, dùng tên đã có */
            }
          }
          if (!alive) return;
          setPhanCong(list);
          setNhanSuTouched(false);
          setStaffGroups(
            combos.map((combo, i) => ({
              key: `${combo.machine}|||${combo.ca}`,
              label: formatMayCa(combo.machine, combo.ca),
              staff: perCombo[i] || []
            }))
          );
          setNhanSuText(staffTextFrom(nameMap, list));
        } catch {
          if (alive) {
            setPhanCong([]);
            setStaffGroups([]);
            setNhanSuText('');
          }
        } finally {
          if (alive) setIsLoadingStaff(false);
        }
      })();
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ngay, machineRef, selectedCa, machines, staffMap, staffTick, isLoading]);

  // Lấy phiếu trộn định mức theo các lệnh SX đã chọn.
  // Nhiều mã lệnh ngăn nhau bằng dấu phẩy trong 1 request;
  // server tách token [,;|/] và khớp từng mã trong ma_lenh_sx của phiếu
  // (1 phiếu có thể gộp nhiều lệnh, 1 lệnh có thể có nhiều phiếu).
  useEffect(() => {
    if (selectedLenh.length === 0) {
      setCoiMau([]);
      return;
    }
    let alive = true;
    setIsLoadingCoi(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/bang-tron-vat-tu-dinh-muc?ma_lenh_sx=${encodeURIComponent(selectedLenh.join(','))}&limit=200`
        );
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) {
          const { products } = normalizeCoiMau(data);
          setCoiMau(products);
        } else {
          setCoiMau([]);
        }
      } catch {
        if (alive) setCoiMau([]);
      } finally {
        if (alive) setIsLoadingCoi(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedLenh]);

  // Gộp NVL từ cối mẫu vào bảng 1 (giữ số đã nhập).
  // Fill toàn bộ NVL của mọi lệnh đã chọn; gộp theo ID kho NVL
  // (fallback mã khi chưa khớp danh mục); trùng thì gộp 1 dòng,
  // cộng dồn nguồn lệnh vào cột Lệnh SX.
  useEffect(() => {
    const selectedSet = new Set(selectedLenh.map(c => c.trim().toLowerCase()));
    const desired = new Map<
      string,
      { material_id: string; ma: string; ten: string; sx: string; dvt: string; nguon: Set<string> }
    >();
    for (const item of coiMau) {
      const tokens = splitLenhCodes(item.ma_lenh_sx);
      const matched = tokens.filter(t => selectedSet.has(t.toLowerCase()));
      const owners = matched.length > 0 ? matched : [...selectedLenh];
      for (const line of item.nvl) {
        if (!line.ma_nvl) continue;
        const disp = resolveNvlDisplay(line.material_id, line.ma_nvl, line.ten_nvl, line.ten_nvl_sx);
        const key = (disp.material_id || disp.ma_nvl).toLowerCase();
        if (!key) continue;
        const entry = desired.get(key) || {
          material_id: disp.material_id,
          ma: disp.ma_nvl,
          ten: disp.ten_nvl,
          sx: disp.ten_nvl_sx,
          dvt: line.dvt,
          nguon: new Set<string>()
        };
        if (disp.ten_nvl && !entry.ten) entry.ten = disp.ten_nvl;
        if (disp.ten_nvl_sx && !entry.sx) entry.sx = disp.ten_nvl_sx;
        if (line.dvt && (!entry.dvt || entry.dvt === 'kg')) entry.dvt = line.dvt;
        for (const code of owners) {
          const original = selectedLenh.find(c => c.trim().toLowerCase() === code.trim().toLowerCase()) || code;
          entry.nguon.add(original);
        }
        desired.set(key, entry);
      }
    }
    const foldRow = (map: Map<string, NvlRow>, row: NvlRow) => {
      const disp = resolveNvlDisplay(row.material_id, row.ma_nvl, row.ten_nvl, row.ten_nvl_sx);
      const key = (disp.material_id || disp.ma_nvl || row.key).toLowerCase();
      const normalized: NvlRow = { ...row, ...disp };
      const cur = map.get(key);
      if (!cur) {
        map.set(key, normalized);
        return;
      }
      const curHas = cur.lan.some(v => str(v) !== '');
      const rowHas = normalized.lan.some(v => str(v) !== '');
      const keep = rowHas && !curHas ? normalized : cur;
      const other = keep === normalized ? cur : normalized;
      map.set(key, { ...keep, nguon: [...new Set([...keep.nguon, ...other.nguon])] });
    };
    setNvlRows(prev => {
      const map = new Map<string, NvlRow>();
      for (const row of prev) foldRow(map, row);
      for (const [key, meta] of desired) {
        const cur = map.get(key);
        const nguon = [...meta.nguon];
        if (cur) {
          map.set(key, {
            ...cur,
            material_id: meta.material_id || cur.material_id,
            ten_nvl: cur.ten_nvl || meta.ten,
            ten_nvl_sx: cur.ten_nvl_sx || meta.sx,
            dvt: cur.dvt || meta.dvt,
            nguon: [...new Set([...cur.nguon, ...nguon])]
          });
        } else {
          map.set(key, {
            key: uid(),
            material_id: meta.material_id,
            ma_nvl: meta.ma,
            ten_nvl: meta.ten,
            ten_nvl_sx: meta.sx,
            dvt: meta.dvt,
            dinh_muc: '',
            lan: Array(numLan).fill(''),
            nguon
          });
        }
      }
      // Giữ dòng đã nhập số hoặc dòng mới thêm tay (chưa có mã), dù không còn trong cối mẫu
      return [...map.values()].filter(
        row => desired.has((row.material_id || row.ma_nvl).toLowerCase()) || row.lan.some(v => str(v) !== '') || !row.ma_nvl.trim()
      );
    });
    setBanGiaoRows(prev => {
      // Cối mẫu đang tải / trống nhưng vẫn còn lệnh → giữ bàn giao đã lưu, tránh xóa mất.
      if (desired.size === 0) {
        return selectedLenh.length === 0 ? [] : prev;
      }
      const prevMap = new Map(
        prev.map(row => {
          const disp = resolveNvlDisplay(row.material_id, row.ma_nvl, row.ten_nvl, row.ten_nvl_sx);
          return [(disp.material_id || disp.ma_nvl || row.key).toLowerCase(), { ...row, ...disp }] as const;
        })
      );
      const next: BanGiaoRow[] = [];
      const used = new Set<string>();
      for (const [key, meta] of desired) {
        const old = prevMap.get(key);
        if (old) {
          used.add(key);
          next.push({
            ...old,
            material_id: meta.material_id || old.material_id,
            ten_nvl: old.ten_nvl || meta.ten,
            ten_nvl_sx: old.ten_nvl_sx || meta.sx,
            lay_kho_tu_dong: old.lay_kho_tu_dong !== false,
            ton_dau_tu_dong: old.ton_dau_tu_dong !== false
          });
        } else {
          used.add(key);
          next.push({
            key: uid(),
            material_id: meta.material_id,
            ma_nvl: meta.ma,
            ten_nvl: meta.ten,
            ten_nvl_sx: meta.sx,
            lay_trong_kho: nhapTrongNgayMap.has(key) ? formatQty(nhapTrongNgayMap.get(key) || 0) : '',
            // Nhap Ca Truoc de trong — chi fill sau khi bam Dong bo o khoi Chon ca truoc.
            ton_dau_ca: '',
            lay_kho_tu_dong: true,
            ton_dau_tu_dong: true
          });
        }
      }
      // Giữ dòng bàn giao đã lưu / thêm tay không còn trong cối mẫu (tránh mất Nhựa Bàn Giao Ca Sau).
      for (const [key, old] of prevMap) {
        if (used.has(key)) continue;
        if (!old.ma_nvl.trim() && !old.ten_nvl.trim()) continue;
        next.push(old);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coiMau, materials, selectedLenh, numLan]);

  // Nhập Ca Trước = tồn cuối ĐÚNG ô ca trước logic (ngày + ca + máy, không tự lùi).
  useEffect(() => {
    const machineRaw = machineRef.trim() || orderCombos[0]?.machine || '';
    const resolved = machineRaw ? resolveComboMachine(machineRaw) : null;
    const maMay = resolved?.code || machineRaw;
    const tenMay = resolved?.name || machineRaw;
    if (!maMay) {
      setPrevTonMap(new Map());
      setHasPrevReport(null);
      setPrevSource(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/so-tron?ma_may=${encodeURIComponent(maMay)}&limit=300`);
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok) return;
        const allReports = normalizeSoTronReports(data);

        // Ca chuẩn hoá: khớp phiếu lịch sử (ghi tay) với value trong /cai-dat.
        const canonShift = (value: string) => {
          if (!value) return '';
          if (shiftOptions.length > 0) {
            try {
              return resolveShiftName(value, shiftOptions);
            } catch {
              return value.trim();
            }
          }
          return value.trim();
        };
        const slotKey = (ngayVal: string, caRaw: string) =>
          `${ngayVal}||${canonShift(caRaw).trim().toLowerCase()}`;

        // Index phiếu cùng máy theo (ngày, ca chuẩn) — bỏ phiếu tương lai.
        const bySlot = new Map<string, (typeof allReports)[number]>();
        for (const r of allReports) {
          if (!machineMatches(r.ma_may || r.ten_may, maMay, tenMay)) continue;
          if (r.ngay > ngay) continue;
          const key = slotKey(r.ngay, r.ca || '');
          if (!bySlot.has(key)) bySlot.set(key, r);
        }

        // Chi lay ĐÚNG o ca truoc logic (khong tu lui ve qua khu).
        let prev: (typeof allReports)[number] | undefined;
        if (prevSlotLogic) {
          prev = bySlot.get(slotKey(prevSlotLogic.ngay, prevSlotLogic.shift));
        }

        setHasPrevReport(Boolean(prev));
        setPrevSource(prev ? { ngay: prev.ngay, ca: prev.ca } : null);
        const map = new Map<string, number>();
        if (prev) {
          for (const line of prev.bang_ban_giao) {
            const value = Number(line.ton_cuoi_ca) || 0;
            // Index cả key thô (tương thích phiếu cũ) lẫn key chuẩn id kho
            const rawKey = (str(line.material_id) || str(line.ma_nvl)).toLowerCase();
            if (rawKey) map.set(rawKey, value);
            const disp = resolveNvlDisplay(str(line.material_id), str(line.ma_nvl), '', '');
            const canonKey = (disp.material_id || disp.ma_nvl).toLowerCase();
            if (canonKey) map.set(canonKey, value);
          }
        }
        if (!alive) return;
        // Chi luu map tham khao — KHONG tu fill Nhap Ca Truoc.
        // Nguoi dung chon ngay + ca o khoi "Chon ca truoc" roi bam Dong bo moi fill.
        setPrevTonMap(map);
      } catch {
        /* bỏ qua */
      }
    })();
    return () => {
      alive = false;
    };
  }, [machineRef, selectedCa, orderCombos, machines, materials, ngay, shiftOptions, shiftSettingsRaw, prevSlotLogic]);

  // Nhập Trong Ngày = tổng xuất kho NVL (loại xuat, kho nvl) theo ngày + máy + ca hiện tại
  useEffect(() => {
    const machineRaw = machineRef.trim() || orderCombos[0]?.machine || '';
    const caVal = selectedCa.trim() || orderCombos[0]?.ca || '';
    if (!ngay || !machineRaw) {
      setNhapTrongNgayMap(new Map());
      return;
    }
    const resolved = resolveComboMachine(machineRaw);
    const maMay = resolved.code || machineRaw;
    const tenMay = resolved.name || machineRaw;
    let alive = true;
    (async () => {
      try {
        const params = new URLSearchParams({
          ngay_phieu: ngay,
          loai_phieu: 'xuat',
          loai_kho: 'nvl'
        });
        const res = await fetch(`/api/phieu-xuat-nhap-kho?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok) return;
        const rows = normalizeWarehouseMovements(data);
        // Lọc theo ngày - máy - ca
        const filtered = rows.filter(row => {
          if (row.slipType !== 'xuat' || row.warehouseKind !== 'nvl') return false;
          if (row.slipDate && row.slipDate !== ngay) return false;
          // Kiểm tra máy khớp
          if (!machineMatches(row.machine, maMay, tenMay)) return false;
          // Kiểm tra ca (nếu đã chọn ca)
          if (caVal && !shiftMatchesSingle(row.shift, caVal)) return false;
          return true;
        });
        // Gộp số lượng theo mã NVL (itemCode = ma_npl), index thêm canonical key từ kho NVL
        const map = new Map<string, number>();
        for (const row of filtered) {
          const rawKey = (row.itemCode || '').toLowerCase();
          if (!rawKey) continue;
          const qty = Number(row.quantity) || 0;
          map.set(rawKey, round2((map.get(rawKey) || 0) + qty));
          // Index thêm bằng canonical id từ kho NVL (nếu có)
          const matEntry = materialByCode.get(rawKey);
          if (matEntry && matEntry.id) {
            const idKey = matEntry.id.toLowerCase();
            if (idKey && idKey !== rawKey) {
              map.set(idKey, round2((map.get(idKey) || 0) + qty));
            }
          }
        }
        if (!alive) return;
        setNhapTrongNgayMap(map);
        // Chỉ tự điền Nhập Trong Ngày khi dòng còn cho phép (phiếu mới / chưa sửa tay).
        // Phiếu đã lưu hoặc người dùng sửa tay: giữ nguyên để không mất dữ liệu bàn giao.
        setBanGiaoRows(rows =>
          rows.map(row => {
            if (!row.lay_kho_tu_dong) return row;
            const key = (row.material_id || row.ma_nvl).toLowerCase();
            const val = map.get(key);
            if (val === undefined) return row;
            return { ...row, lay_trong_kho: formatQty(val) };
          })
        );
      } catch {
        /* bỏ qua */
      }
    })();
    return () => {
      alive = false;
    };
  }, [ngay, machineRef, selectedCa, orderCombos, machines, materials, materialByCode]);

  // Tổng sử dụng theo NVL (key = id kho, fallback mã, chữ thường) — cộng dồn khi trùng
  const nvlTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of nvlRows) {
      const key = (row.material_id || row.ma_nvl).toLowerCase();
      if (!key) continue;
      const total = round2(row.lan.reduce((sum, v) => sum + parseNum(v), 0));
      map.set(key, round2((map.get(key) || 0) + total));
    }
    return map;
  }, [nvlRows]);
  const nvlUsageOf = (materialId: string, ma: string) =>
    round2(nvlTotals.get((materialId || ma).toLowerCase()) || 0);

  // NVL chính trong kho = NVL không thuộc nhóm vật tư phụ (để picker "Thêm NVL khác")
  const mainMaterials = useMemo(() => {
    return materials
      .filter(m => {
        const g = str(m.auxiliaryMaterialGroup);
        return (!g || g === '-') && (str(m.code) || str(m.name));
      })
      .sort((a, b) => str(a.code || a.name).localeCompare(str(b.code || b.name), 'vi'));
  }, [materials]);

  const materialOptionLabel = (m: MaterialRow) =>
    `${m.code || '—'} — ${m.name || m.productionName || m.code}`;

  const materialOptionSearch = (m: MaterialRow) =>
    `${m.code} ${m.name} ${m.productionName}`;

  // Thêm NVL khác từ picker (chỉ NVL chính): thêm đồng thời vào bảng 1 và bảng 4
  const addExtraNvls = (mats: MaterialRow[]) => {
    const norm = mats
      .map(m => ({
        key: `${str(m.id) || str(m.code)}`.toLowerCase(),
        material_id: str(m.id),
        ma_nvl: str(m.code),
        ten_nvl: str(m.name),
        ten_nvl_sx: str(m.productionName),
        dvt: str(m.unit) && str(m.unit) !== '-' ? str(m.unit) : 'kg'
      }))
      .filter(m => m.key);
    if (norm.length === 0) return;
    setNvlRows(rows => {
      const keys = new Set(rows.map(r => (r.material_id || r.ma_nvl).toLowerCase()));
      const adds = norm.filter(m => !keys.has(m.key));
      if (adds.length === 0) return rows;
      return [
        ...rows,
        ...adds.map(m => ({
          key: uid(),
          material_id: m.material_id,
          ma_nvl: m.ma_nvl,
          ten_nvl: m.ten_nvl,
          ten_nvl_sx: m.ten_nvl_sx,
          dvt: m.dvt,
          dinh_muc: '',
          lan: Array(numLan).fill('') as string[],
          nguon: [] as string[]
        }))
      ];
    });
    setBanGiaoRows(rows => {
      const keys = new Set(rows.map(r => (r.material_id || r.ma_nvl).toLowerCase()));
      const adds = norm.filter(m => !keys.has(m.key));
      if (adds.length === 0) return rows;
      return [
        ...rows,
        ...adds.map(m => ({
          key: uid(),
          material_id: m.material_id,
          ma_nvl: m.ma_nvl,
          ten_nvl: m.ten_nvl,
          ten_nvl_sx: m.ten_nvl_sx,
          lay_trong_kho: nhapTrongNgayMap.has(m.key) ? formatQty(nhapTrongNgayMap.get(m.key) || 0) : '',
          // Nhap Ca Truoc de trong — chi fill sau khi bam Dong bo o khoi Chon ca truoc.
          ton_dau_ca: '',
          lay_kho_tu_dong: true,
          ton_dau_tu_dong: true
        }))
      ];
    });
  };

  const tongSuDungChung = useMemo(
    () => round2([...nvlTotals.values()].reduce((sum, v) => sum + v, 0)),
    [nvlTotals]
  );

  /** Tổng Nhập Trong Ngày (tong_nhap_nvl) = Σ Nhập Trong Ngày (lay_trong_kho) bảng bàn giao */
  const tongNhapTrongNgay = useMemo(
    () => round2(banGiaoRows.reduce((sum, row) => sum + parseNum(row.lay_trong_kho), 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [banGiaoRows]
  );

  // Gom cối mẫu theo SẢN PHẨM (tên hiển thị cho công nhân trộn, không hiện tên phiếu
  // trộn định mức). Chỉ lấy NVL cối chính — NVL phụ (nvl_phu) không đọc vào.
  const coiMauGroups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; ma_sp: string; ten_sp: string; lenh: Set<string>; blocks: CoiMauItem[] }
    >();
    for (const b of coiMau) {
      const key = b.ma_sp || b.ten_sp || 'san-pham';
      const g = map.get(key) || {
        key,
        ma_sp: b.ma_sp,
        ten_sp: b.ten_sp,
        lenh: new Set<string>(),
        blocks: [] as CoiMauItem[]
      };
      g.blocks.push(b);
      if (!g.ten_sp && b.ten_sp) g.ten_sp = b.ten_sp;
      if (!g.ma_sp && b.ma_sp) g.ma_sp = b.ma_sp;
      for (const token of splitLenhCodes(b.ma_lenh_sx)) g.lenh.add(token);
      map.set(key, g);
    }
    return [...map.values()];
  }, [coiMau]);

  // Lệnh đã chọn nhưng không phiếu nào chứa mã đó (tách token , ; | / để so)
  const uncoveredLenh = useMemo(() => {
    const covered = new Set<string>();
    for (const b of coiMau) {
      for (const token of splitLenhCodes(b.ma_lenh_sx)) covered.add(token.toLowerCase());
    }
    return selectedLenh.filter(code => !covered.has(code.trim().toLowerCase()));
  }, [coiMau, selectedLenh]);

  /** Màng của 1 SP: ưu tiên tra danh mục theo mã, rớt lại tách từ tên hàng (ECO/STD/...),
   *  cuối cùng là rỗng (= không màng). */
  const resolveMang = (maSp: string, tenSp: string) => {
    const byCode = mangByCode.get(str(maSp).toLowerCase());
    if (byCode) return byCode;
    try {
      const parsed = parseProductionNameParts(str(tenSp), '');
      return normalizeMang(parsed.mang || '');
    } catch {
      return '';
    }
  };

  const productSuggestions = useMemo(() => {
    const list: {
      value: string;
      label: string;
      maLenh: string;
      sanPhamId: string;
      maSp: string;
      tenSp: string;
      mang: string;
      /** Snapshot quy đổi 1 SP lấy từ dòng lệnh SX (kg_1_sp có sẵn; m2/m dài = tổng dòng / SL đặt) */
      kg1Sp: string;
      m2MotSp: string;
      mDaiMotSp: string;
      nguonQuyDoi: string;
    }[] = [];
    for (const order of selectedOrders) {
      const products: OrderProductLine[] = Array.isArray(order.products) ? order.products : [];
      for (const p of products) {
        const maSp = str(p.productCode);
        const tenSp = str(p.tenGhep || p.productName) || maSp;
        if (!maSp && !tenSp) continue;
        list.push({
          value: `${maSp} — ${tenSp}`,
          label: `${maSp} — ${tenSp} (${order.code})`,
          maLenh: order.code,
          sanPhamId: str(p.productId),
          maSp,
          tenSp,
          mang: resolveMang(maSp, str(p.productionName) || tenSp),
          kg1Sp: str(p.kg1Sp) || perUnitFromOrderTotal(p.tongKg, p.quantity),
          m2MotSp: perUnitFromOrderTotal(p.m2, p.quantity),
          mDaiMotSp: perUnitFromOrderTotal(p.mDai, p.quantity),
          nguonQuyDoi: str(p.conversionSource) || 'lenh-sx'
        });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrders, mangByCode]);

  /** Điền SP từ gợi ý lệnh SX kèm snapshot quy đổi 1 SP (kg/m2/m dài). */
  const applySpSuggestion = (row: SanPhamRow, value: string): SanPhamRow => {
    const hit = productSuggestions.find(s => s.value === value || s.label === value);
    if (!hit) {
      return { ...row, ten_sp: value, mang: row.mang || resolveMang(row.ma_sp, value) };
    }
    const next: SanPhamRow = {
      ...row,
      ten_sp: value,
      ma_sp: hit.maSp || row.ma_sp,
      san_pham_id: hit.sanPhamId || row.san_pham_id,
      ma_lenh_sx: row.ma_lenh_sx || hit.maLenh,
      mang: hit.mang || resolveMang(hit.maSp, value),
      kg_1_sp: hit.kg1Sp || row.kg_1_sp,
      m2_1_sp: hit.m2MotSp || row.m2_1_sp,
      m_dai_1_sp: hit.mDaiMotSp || row.m_dai_1_sp,
      nguon_quy_doi: hit.nguonQuyDoi || row.nguon_quy_doi
    };
    if (!str(row.trong_luong)) return withAutoTrongLuong(next, next.so_luong);
    return next;
  };

  // Các combo sẽ lưu mà ngày này đã có sổ trộn (trừ phiếu đang sửa) — theo ca đã lọc
  const existingForCombos = useMemo(() => {
    if (!ngay || saveCombos.length === 0) return [];
    return saveCombos
      .map(combo => {
        const id = resolveComboIdentity(combo);
        const hit = savedReports.find(
          r => r.ngay === ngay && r.ma_may === id.ma_may && r.ca === id.ca && r.id !== editingId
        );
        return hit ? { combo, report: hit } : null;
      })
      .filter((x): x is { combo: MayCaCombo; report: SoTronSavedReport } => Boolean(x));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedReports, ngay, saveCombos, machines, editingId]);

  const resizeLan = (next: number) => {
    const clamped = Math.max(1, Math.min(SO_LAN_TRON_TOI_DA, next));
    setNumLan(clamped);
    setNvlRows(rows =>
      rows.map(row => {
        const lan = [...row.lan];
        while (lan.length < clamped) lan.push('');
        return { ...row, lan: lan.slice(0, clamped) };
      })
    );
  };

  const applyPrevTon = () => {
    setBanGiaoRows(rows =>
      rows.map(row => {
        const key = (row.material_id || row.ma_nvl).toLowerCase();
        return {
          ...row,
          lay_trong_kho: nhapTrongNgayMap.has(key) ? formatQty(nhapTrongNgayMap.get(key) || 0) : row.lay_trong_kho,
          ton_dau_ca: prevTonMap.has(key) ? formatQty(prevTonMap.get(key) || 0) : row.ton_dau_ca,
          lay_kho_tu_dong: true,
          ton_dau_tu_dong: true
        };
      })
    );
  };

  /** Dong bo Nhap Ca Truoc DUNG o ngay + ca da chon + may o muc 1 phia tren (khong tu tinh lui).
   *  Chi fill sau khi bam nut. */
  const handleSyncPrevTon = async () => {
    const machineRaw = machineRef.trim() || orderCombos[0]?.machine || '';
    if (!machineRaw) {
      setPrevSyncNote('Chọn máy ở mục 1 trước khi đồng bộ ca trước.');
      return;
    }
    if (!prevDatePick || !prevCaPick) {
      setPrevSyncNote('Ngày, ca lấy theo mục 1 phía trên — chọn ngày và ca ở mục 1 rồi bấm Đồng bộ.');
      return;
    }
    if (banGiaoRows.length === 0) {
      setPrevSyncNote('Chưa có loại nhựa — chọn lệnh SX để hiện bảng rồi mới đồng bộ.');
      return;
    }
    const resolved = resolveComboMachine(machineRaw);
    const maMay = resolved.code || machineRaw;
    const tenMay = resolved.name || machineRaw;
    setIsSyncingPrev(true);
    setPrevSyncNote('');
    try {
      const res = await fetch(`/api/so-tron?ma_may=${encodeURIComponent(maMay)}&limit=300`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPrevSyncNote('Không tải được phiếu ca trước — thử lại.');
        return;
      }
      const allReports = normalizeSoTronReports(data);
      const canonShift = (value: string) => {
        if (!value) return '';
        if (shiftOptions.length > 0) {
          try {
            return resolveShiftName(value, shiftOptions);
          } catch {
            return value.trim();
          }
        }
        return value.trim();
      };
      const slotKey = (ngayVal: string, caRaw: string) =>
        `${ngayVal}||${canonShift(caRaw).trim().toLowerCase()}`;
      const bySlot = new Map<string, (typeof allReports)[number]>();
      for (const r of allReports) {
        if (r.id === editingId) continue;
        if (!machineMatches(r.ma_may || r.ten_may, maMay, tenMay)) continue;
        if (r.ngay > prevDatePick) continue;
        const key = slotKey(r.ngay, r.ca || '');
        if (!bySlot.has(key)) bySlot.set(key, r);
      }
      // Lay DUNG o ngay + ca da chon cua dung may (khong tu tinh lui).
      const prev = bySlot.get(slotKey(prevDatePick, prevCaPick));
      if (!prev) {
        setHasPrevReport(false);
        setPrevSyncNote(
          `Ca ${prevCaPick} ngày ${formatNgayVN(prevDatePick) || prevDatePick} chưa có phiếu — Nhập Ca Trước đang trống.`
        );
        return;
      }
      const map = new Map<string, number>();
      for (const line of prev.bang_ban_giao) {
        const value = Number(line.ton_cuoi_ca) || 0;
        const rawKey = (str(line.material_id) || str(line.ma_nvl)).toLowerCase();
        if (rawKey) map.set(rawKey, value);
        const disp = resolveNvlDisplay(str(line.material_id), str(line.ma_nvl), '', '');
        const canonKey = (disp.material_id || disp.ma_nvl).toLowerCase();
        if (canonKey) map.set(canonKey, value);
      }
      setPrevTonMap(map);
      setPrevSource({ ngay: prev.ngay, ca: prev.ca });
      setHasPrevReport(true);
      setBanGiaoRows(rows =>
        rows.map(row => {
          const key = (row.material_id || row.ma_nvl).toLowerCase();
          if (map.has(key)) return { ...row, ton_dau_ca: formatQty(map.get(key) || 0), ton_dau_tu_dong: true };
          return row;
        })
      );
      setPrevSyncNote(
        `Đã đồng bộ tồn cuối ca ${prev.ca} ngày ${formatNgayVN(prev.ngay) || prev.ngay} → Nhập Ca Trước.`
      );
    } catch {
      setPrevSyncNote('Không đồng bộ được ca trước — thử lại.');
    } finally {
      setIsSyncingPrev(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setMachineRef('');
    setSelectedCa('');
    setSelectedLenh([]);
    setPhanCong([]);
    setNhanSuText('');
    setNhanSuTouched(false);
    setStaffGroups([]);
    setCoiMau([]);
    setNvlRows([]);
    setSpRows([]);
    setLoiRows([]);
    setBanGiaoRows([]);
    setPrevSource(null);
    setPrevDatePick('');
    setPrevCaPick('');
    setPrevPickTouched(false);
    setPrevSyncNote('');
    setGhiChu('');
    setNumLan(SO_LAN_TRON_MAC_DINH);
    setMessage(null);
  };

  const loadReportToForm = (report: SoTronSavedReport) => {
    setEditingId(report.id);
    setNgay(report.ngay);
    const found =
      findMachineByRef(machines, report.ma_may) ?? findMachineByRef(machines, report.ten_may);
    setMachineRef(found ? machineSelectValue(found) : report.ten_may || report.ma_may);
    setSelectedCa(report.ca || '');
    setStaffGroups([]);
    setNhanSuText(report.nhan_su);
    setNhanSuTouched(true);
    setPhanCong(
      (Array.isArray(report.nhan_su_chi_tiet) ? report.nhan_su_chi_tiet : [])
        .map(item => {
          if (!item || typeof item !== 'object') return null;
          const rec = item as Record<string, unknown>;
          return {
            ma_nhan_su: str(rec.ma_nhan_su),
            ten: str(rec.ten) || str(rec.ma_nhan_su),
            vai_tro: str(rec.vai_tro)
          };
        })
        .filter((x): x is PhanCongItem => Boolean(x))
    );
    const codes = report.lenh_sx.map(l => str(l.ma_lenh)).filter(Boolean);
    setSelectedLenh(codes);
    setCoiMau(report.coi_tron_mau || []);
    const maxLan = Math.max(
      SO_LAN_TRON_MAC_DINH,
      ...report.bang_nvl.map(l => (Array.isArray(l.lan) ? l.lan.length : 0))
    );
    setNumLan(Math.min(SO_LAN_TRON_TOI_DA, maxLan));
    setNvlRows(
      report.bang_nvl.map(line => ({
        key: uid(),
        material_id: str((line as { material_id?: unknown }).material_id),
        ma_nvl: str(line.ma_nvl),
        ten_nvl: str(line.ten_nvl),
        ten_nvl_sx: str((line as { ten_nvl_sx?: unknown }).ten_nvl_sx),
        dvt: str(line.dvt) || 'kg',
        dinh_muc: str((line as { dinh_muc?: unknown }).dinh_muc),
        lan: Array.from({ length: Math.min(SO_LAN_TRON_TOI_DA, maxLan) }, (_, i) =>
          Array.isArray(line.lan) && line.lan[i] !== undefined && line.lan[i] !== null
            ? String(line.lan[i])
            : ''
        ),
        nguon: Array.isArray(line.lenh_sx) ? line.lenh_sx.map((c: unknown) => str(c)).filter(Boolean) : []
      }))
    );
    setSpRows(
      report.bang_san_pham.map(line => ({
        key: uid(),
        ma_lenh_sx: str(line.ma_lenh_sx),
        san_pham_id: str((line as { san_pham_id?: unknown }).san_pham_id),
        ma_sp: str(line.ma_sp),
        ten_sp: str(line.ten_sp),
        mang: normalizeMang(str((line as { mang?: unknown }).mang)) || resolveMang(str(line.ma_sp), str(line.ten_sp)),
        so_luong: str(line.so_luong),
        dinh_muc: str(line.dinh_muc),
        trong_luong: str(line.trong_luong),
        kg_1_sp: str((line as { kg_1_sp?: unknown }).kg_1_sp),
        m2_1_sp: str((line as { m2_1_sp?: unknown }).m2_1_sp),
        m_dai_1_sp: str((line as { m_dai_1_sp?: unknown }).m_dai_1_sp),
        nguon_quy_doi: str((line as { nguon_quy_doi?: unknown }).nguon_quy_doi),
        ghi_chu: str(line.ghi_chu)
      }))
    );
    setLoiRows(
      report.bang_hang_loi.map(line => ({
        key: uid(),
        ten_loi: str(line.ten_loi),
        so_luong: str(line.so_luong)
      }))
    );
    setBanGiaoRows(
      report.bang_ban_giao.map(line => ({
        key: uid(),
        material_id: str(line.material_id),
        ma_nvl: str(line.ma_nvl),
        ten_nvl: str(line.ten_nvl),
        ten_nvl_sx: str(line.ten_nvl_sx),
        lay_trong_kho: line.lay_trong_kho !== undefined && line.lay_trong_kho !== null ? String(line.lay_trong_kho) : '',
        ton_dau_ca: line.ton_dau_ca !== undefined && line.ton_dau_ca !== null ? String(line.ton_dau_ca) : '',
        // Phiếu đã lưu: khóa không để effect xuất kho / ca trước ghi đè mất dữ liệu bàn giao.
        lay_kho_tu_dong: false,
        ton_dau_tu_dong: false
      }))
    );
    setGhiChu(report.ghi_chu);
    setMessage(null);
    // Mo lai chon ca truoc theo logic cho phieu dang sua (chi fill khi bam Dong bo).
    setPrevPickTouched(false);
    setPrevSyncNote('');
  };

  const handleSave = async () => {
    if (!ngay) {
      setMessage({ text: 'Vui lòng chọn Ngày.', type: 'error' });
      return;
    }
    if (selectedLenh.length === 0) {
      setMessage({ text: 'Vui lòng chọn ít nhất 1 lệnh sản xuất.', type: 'error' });
      return;
    }
    if (orderCombos.length === 0) {
      setMessage({ text: 'Lệnh đã chọn chưa có thông tin máy-ca.', type: 'error' });
      return;
    }
    // Chi tao phieu cho ca da chon o muc 1 (Loc theo ca) — saveCombos da loc san.
    const caLoc = selectedCa.trim();
    if (caLoc && saveCombos.length === 0) {
      setMessage({
        text: `Ca đã chọn (${caLoc}) không khớp với ca của lệnh đã chọn (${orderCombos.map(c => c.ca || '—').join(', ')}). Phiếu chỉ được tạo cho ca ${caLoc} — kiểm tra lại lệnh SX hoặc chọn ca khác.`,
        type: 'error'
      });
      return;
    }
    const identities = saveCombos
      .map(resolveComboIdentity)
      .filter(id => id.ma_may && id.ma_may !== '-' && id.ca && id.ca !== '-');
    const skipped = saveCombos.length - identities.length;
    if (identities.length === 0) {
      setMessage({ text: 'Lệnh đã chọn thiếu máy hoặc ca. Bổ sung máy/ca cho lệnh SX rồi thử lại.', type: 'error' });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const bangNvl = nvlRows
        .filter(row => row.ma_nvl.trim() !== '')
        .map(row => {
          const lan = row.lan.map(parseNum).map(round2);
          return {
            material_id: row.material_id,
            ma_nvl: row.ma_nvl.trim(),
            ten_nvl: row.ten_nvl.trim(),
            ten_nvl_sx: row.ten_nvl_sx.trim(),
            dvt: row.dvt.trim() || 'kg',
            dinh_muc: row.dinh_muc.trim(),
            lan,
            tong: round2(lan.reduce((s, v) => s + v, 0)),
            lenh_sx: row.nguon
          };
        });
      const bangBanGiao = banGiaoRows
        .filter(row => row.ma_nvl.trim() !== '')
        .map(row => {
          const lay = parseNum(row.lay_trong_kho);
          const dau = parseNum(row.ton_dau_ca);
          const suDung = nvlUsageOf(row.material_id, row.ma_nvl);
          return {
            material_id: row.material_id,
            ma_nvl: row.ma_nvl.trim(),
            ten_nvl: row.ten_nvl.trim(),
            ten_nvl_sx: row.ten_nvl_sx.trim(),
            lay_trong_kho: round2(lay),
            ton_dau_ca: round2(dau),
            tong_su_dung: suDung,
            ton_cuoi_ca: round2(lay + dau - suDung)
          };
        });
      const basePayload = {
        chi_nhanh: CHI_NHANH_MAC_DINH,
        ngay,
        nhan_su: nhanSuText.trim(),
        nhan_su_chi_tiet: phanCong,
        lenh_sx: selectedOrders.map(o => ({ id: o.id, ma_lenh: o.code })),
        coi_tron_mau: coiMau,
        bang_nvl: bangNvl,
        bang_san_pham: spRows
          .filter(row => row.ten_sp.trim() !== '' || row.ma_sp.trim() !== '')
          .map(toBangSanPhamLine),
        bang_hang_loi: loiRows
          .filter(row => row.ten_loi.trim() !== '')
          .map(row => ({ ten_loi: row.ten_loi.trim(), so_luong: row.so_luong.trim() })),
        bang_ban_giao: bangBanGiao,
        tong_nvl: soTronSummary.tong_nvl,
        tong_nhap_nvl: round2(bangBanGiao.reduce((s, line) => s + (Number(line.lay_trong_kho) || 0), 0)),
        tong_sp_co_mang: soTronSummary.tong_sp_co_mang,
        tong_sp_khong_mang: soTronSummary.tong_sp_khong_mang,
        tong_loi_hong: soTronSummary.tong_loi_hong,
        chi_tieu_phan_tram: soTronSummary.chi_tieu_phan_tram,
        ghi_chu: ghiChu.trim()
      };
      const sendOne = async (idn: { ma_may: string; ten_may: string; ca: string }) => {
        const dup = editingId
          ? null
          : savedReports.find(r => r.ngay === ngay && r.ma_may === idn.ma_may && r.ca === idn.ca);
        const url = editingId
          ? `/api/so-tron/${encodeURIComponent(editingId)}`
          : dup
            ? `/api/so-tron/${encodeURIComponent(dup.id)}`
            : '/api/so-tron';
        const res = await fetch(url, {
          method: editingId || dup ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePayload, ma_may: idn.ma_may, ten_may: idn.ten_may, ca: idn.ca })
        });
        const data = await res.json().catch(() => ({}));
        return { idn, ok: res.ok, updated: Boolean(editingId || dup), error: str(data.error), id: str(data?.report?.id || dup?.id) };
      };
      const targets = editingId ? [identities[0]] : identities;
      const results = [];
      for (const idn of targets) {
        // eslint-disable-next-line no-await-in-loop
        results.push(await sendOne(idn));
      }
      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) {
        setMessage({
          text: `Lưu lỗi ${failed.length}/${results.length} phiếu: ${failed.map(f => `${f.idn.ten_may || f.idn.ma_may} - ${f.idn.ca} (${f.error || 'lỗi'})`).join('; ')}`,
          type: 'error'
        });
      } else {
        const label = results
          .map(r => `${r.idn.ten_may || r.idn.ma_may} - ${r.idn.ca}`)
          .join('; ');
        const skipNote = skipped > 0 ? ` (bỏ qua ${skipped} combo thiếu máy/ca)` : '';
        const caNote =
          caLoc && orderCombos.length > saveCombos.length
            ? ` (chỉ tạo cho ca ${caLoc}; bỏ qua ${orderCombos.length - saveCombos.length} combo ca khác trong lệnh)`
            : '';
        setMessage({
          text:
            results.length > 1
              ? `Đã lưu ${results.length} sổ trộn (${label})${skipNote}${caNote}.`
              : `${results[0].updated ? 'Đã cập nhật sổ trộn.' : 'Đã lưu sổ trộn.'}${skipNote}${caNote}`,
          type: 'success'
        });
        if (results.length === 1 && results[0].id) setEditingId(results[0].id);
      }
      const listRes = await fetch('/api/so-tron?limit=100');
      const listData = await listRes.json().catch(() => ({}));
      if (listRes.ok) setSavedReports(normalizeSoTronReports(listData));
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Không thể lưu sổ trộn.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!editReport || isLoading || machines.length === 0) return;
    loadReportToForm(editReport);
    setActiveTab('form');
    onEditConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editReport, isLoading, machines]);

  // Tổng + style dùng cho tờ phiếu nhập liệu kiểu sổ giấy (giống mẫu hình)
  const paperSpTotalSoLuong = spRows.reduce((s, r) => s + parseNum(r.so_luong), 0);
  const paperSpTotalTrongLuong = spRows.reduce((s, r) => s + parseNum(r.trong_luong), 0);
  const paperLoiTotal = loiRows.reduce((s, r) => s + parseNum(r.so_luong), 0);
  // 5 số tổng hợp lưu cùng phiếu: Tổng NVL (kg) / SP có màng (kg) / SP không màng (kg) /
  // Tổng lỗi hỏng (kg) / Chỉ tiêu % = tổng SP / 3100 * 100 (xem summary.ts)
  const soTronSummary = useMemo(
    () =>
      computeSoTronSummary({
        spLines: spRows.map(r => ({ trong_luong: r.trong_luong, mang: r.mang })),
        tongNvl: tongSuDungChung,
        tongLoi: paperLoiTotal
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spRows, tongSuDungChung, paperLoiTotal]
  );
  const paperCellInput =
    'w-full bg-transparent px-1 py-1 text-center text-[12.5px] font-semibold tabular-nums text-slate-900 outline-none focus:bg-brand-50';
  const paperCellInputLeft =
    'w-full bg-transparent px-1 py-1 text-left text-[12.5px] font-semibold text-slate-900 outline-none focus:bg-brand-50';
  const paperTh =
    'border border-slate-800 bg-slate-100 px-1 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700';
  const paperTd = 'border border-slate-700 px-0.5 py-0.5';

  const filteredSavedReports = useMemo(() => {
    // Chưa chọn ngày thì không hiển thị gì (đúng yêu cầu: chọn ngày mới hiện danh sách).
    if (!listFilterDate) return [];
    return savedReports.filter(r => {
      if (r.ngay !== listFilterDate) return false;
      if (listFilterMachine) {
        const m = listFilterMachine.toLowerCase();
        if (!(r.ma_may?.toLowerCase().includes(m) || r.ten_may?.toLowerCase().includes(m))) return false;
      }
      if (listFilterCa && r.ca !== listFilterCa) return false;
      return true;
    });
  }, [savedReports, listFilterDate, listFilterMachine, listFilterCa]);

  const handleDeleteSavedReport = async (id: string) => {
    if (!window.confirm('Xóa sổ trộn này?')) return;
    try {
      const res = await fetch(`/api/so-tron/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setSavedReports(prev => prev.filter(r => r.id !== id));
        if (editingId === id) resetForm();
      } else {
        alert('Không thể xóa sổ trộn.');
      }
    } catch {
      alert('Không thể xóa sổ trộn.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Đang tải sổ trộn...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 2 Tabs ở đầu: 1. Danh sách, 2. Thêm sổ trộn */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 pt-2 rounded-xl shadow-2xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition -mb-[1px] ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Danh sách
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'list' && !editingId) {
                resetForm();
              }
              setActiveTab('form');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition -mb-[1px] ${
              activeTab === 'form'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="h-4 w-4" />
            {editingId ? 'Sửa sổ trộn' : 'Thêm sổ trộn'}
          </button>
        </div>

        {activeTab === 'list' && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setActiveTab('form');
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm sổ trộn mới
          </button>
        )}
      </div>

      {message && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : message.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-sky-200 bg-sky-50 text-sky-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* TAB 1: DANH SÁCH */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* Bộ lọc cho danh sách */}
          <div className={`${cardClass} p-3`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Chọn Ngày:</label>
                <SoTronDatePicker value={listFilterDate} onChange={setListFilterDate} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lọc theo máy:</label>
                <select
                  value={listFilterMachine}
                  onChange={e => setListFilterMachine(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Tất cả máy --</option>
                  {machines.map(m => {
                    const value = m.code || m.name;
                    const label =
                      m.name && m.code && m.name !== m.code ? `${m.name} (${m.code})` : m.name || m.code;
                    return (
                      <option key={m.id || value} value={value}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lọc theo ca:</label>
                <select
                  value={listFilterCa}
                  onChange={e => setListFilterCa(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Tất cả ca --</option>
                  {shiftOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2.5 border-t border-slate-100 pt-2.5">
              <p className="text-[11.5px] font-semibold text-slate-500">
                {!listFilterDate
                  ? 'Chọn ngày để xem danh sách sổ trộn'
                  : `Ngày ${formatNgayVN(listFilterDate)}`}
              </p>
            </div>
          </div>

          {/* Bảng danh sách */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="w-12 px-3 py-2.5 text-center">STT</th>
                    <th className="w-24 px-3 py-2.5">Ngày</th>
                    <th className="w-28 px-3 py-2.5">Máy</th>
                    <th className="w-20 px-3 py-2.5">Ca</th>
                    <th className="px-3 py-2.5">Lệnh SX</th>
                    <th className="px-3 py-2.5">Nhân sự</th>
                    <th className="w-[300px] px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSavedReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center font-semibold text-slate-400">
                        {!listFilterDate
                          ? 'Vui lòng chọn ngày để xem danh sách sổ trộn.'
                          : `Ngày ${formatNgayVN(listFilterDate)} chưa có sổ trộn nào phù hợp.`}
                      </td>
                    </tr>
                  ) : (
                    filteredSavedReports.map((report, idx) => (
                      <tr key={report.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition last:border-0">
                        <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold tabular-nums text-slate-800">{report.ngay}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">{report.ten_may || report.ma_may}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {report.ca}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-slate-700">
                          {report.lenh_sx.map(l => l.ma_lenh).join(', ') || '—'}
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-600" title={report.nhan_su}>
                          {report.nhan_su || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <SoTronRowActions
                            onEdit={() => {
                              loadReportToForm(report);
                              setActiveTab('form');
                            }}
                            onDelete={() => void handleDeleteSavedReport(report.id)}
                            onPrintGiaoCa={() => setPreviewPhieuGiaoCaReport(report)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NHẬP / SỬA SỔ TRỘN */}
      {activeTab === 'form' && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">
                {editingId ? 'Chỉnh sửa sổ trộn' : 'Báo cáo theo ngày - máy - ca - lệnh sản xuất'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 flex items-center gap-1"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Xem danh sách
            </button>
          </div>

          {/* 1. Header: ngày + máy + ca */}
          <section className={`${cardClass} space-y-3 p-4`}>
            <SectionHeader
              index="1"
              title="Ngày — Máy — Ca"
              desc="Chọn ngày + máy + 1 ca. Lệnh SX bên dưới lọc theo máy + ngày trong khoảng ngay_bat_dau → ngay_ket_thuc + ca. Khi lưu, chỉ tạo phiếu cho ca đã chọn ở đây (không tạo cho các ca khác trong lệnh)."
            />
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <div>
                <label className={labelClass}>Chi nhánh</label>
                <input value={CHI_NHANH_MAC_DINH} disabled className={`${inputClass} bg-slate-50 text-slate-500`} />
              </div>
              <div>
                <label className={labelClass}>Ngày</label>
                <input
                  type="date"
                  value={ngay}
                  onChange={e => setNgay(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className={labelClass}>Máy</label>
                <SearchableSelect
                  value={machineRef}
                  onChange={setMachineRef}
                  options={machines as unknown[]}
                  placeholder="Chọn máy..."
                  inputClassName={inputClass}
                  getLabel={item => {
                    const m = item as MachineRow;
                    return m.code && m.name && m.code !== m.name ? `${m.code} · ${m.name}` : m.name || m.code;
                  }}
                  getValue={item => machineSelectValue(item as MachineRow)}
                  getSearchText={item => {
                    const m = item as MachineRow;
                    return `${m.code} ${m.name}`;
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>Ca (chọn 1)</label>
                <SearchableSelect
                  value={selectedCa}
                  onChange={setSelectedCa}
                  options={caCreateOptions as unknown[]}
                  placeholder="Tất cả ca..."
                  inputClassName={inputClass}
                  getLabel={item => (item as { label: string }).label || (item as { value: string }).value}
                  getValue={item => (item as { value: string }).value}
                  getSearchText={item =>
                    `${(item as { value: string }).value} ${(item as { label: string }).label}`
                  }
                />
                {ngay && machineRef.trim() ? (
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {shiftOptions.length > 0 && caCreateOptions.length === 0
                      ? 'Máy này ngày này đã tạo đủ các ca — chọn ngày/máy khác hoặc sửa phiếu cũ.'
                      : 'Chỉ hiện ca chưa tạo sổ trộn cho máy này ngày này.'}
                  </p>
                ) : null}
                {selectedCaAlreadyCreated ? (
                  <p className="mt-1 text-[11px] font-bold text-amber-700">
                    Ca {selectedCa.trim()} ngày {formatNgayVN(ngay) || ngay} của máy này đã có sổ trộn — lưu sẽ cập nhật phiếu cũ.
                  </p>
                ) : null}
              </div>
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <label className={`${labelClass} !mb-0`}>
                  Nhân sự trong ca {isLoadingStaff ? '(đang fill...)' : '(tự động từ lịch phân công)'}
                </label>
                <a
                  href={pathFromTab('sap-xep-lich-lam-viec')}
                  target="_blank"
                  rel="noreferrer"
                  title="Mở trang sắp xếp lịch làm việc trong tab mới"
                  className="inline-flex items-center gap-0.5 text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  Sắp xếp lịch
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={() => void handleSyncStaff()}
                  disabled={isLoadingStaff}
                  title="Đồng bộ lại nhân sự sau khi sắp xếp lịch mới xong"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingStaff ? 'animate-spin' : ''}`} />
                  Đồng bộ
                </button>
              </div>
              {staffGroups.length > 0 ? (
                <div className="mb-1.5 space-y-1.5">
                  {staffGroups.map(group => (
                    <div key={group.key} className="flex flex-wrap items-center gap-1.5">
                      <span className="min-w-[140px] text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {group.label}
                      </span>
                      {group.staff.length > 0 ? (
                        group.staff.map((p, i) => (
                          <span
                            key={`${p.ma_nhan_su}-${i}`}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-bold text-slate-700"
                          >
                            {staffDisplayName(p)}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11.5px] font-semibold text-slate-400">Chưa phân công</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : phanCong.length > 0 ? (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {phanCong.map((p, i) => (
                    <span
                      key={`${p.ma_nhan_su}-${i}`}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-bold text-slate-700"
                    >
                      {staffDisplayName(p)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mb-1.5 text-[11.5px] text-slate-400">
                  {ngay && (machineRef || selectedLenh.length > 0)
                    ? 'Không tìm thấy lịch phân công — nhập tay bên dưới hoặc mở sắp xếp lịch.'
                    : 'Chọn ngày, máy, ca để tự động fill nhân sự.'}
                </p>
              )}
              <input
                value={nhanSuText}
                onChange={e => {
                  setNhanSuTouched(true);
                  setNhanSuText(e.target.value);
                }}
                placeholder="Nhân sự ca (có thể sửa tay)"
                className={inputClass}
              />
            </div>
            {existingForCombos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                <span>Ngày này đã có sổ trộn — bấm để mở:</span>
                {existingForCombos.map(({ combo, report }) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => loadReportToForm(report)}
                    className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11.5px] font-bold text-white hover:bg-amber-700"
                  >
                    {formatMayCa(combo.machine, combo.ca)}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 2. Lệnh sản xuất */}
          <section className={`${cardClass} space-y-3 p-4`}>
            <SectionHeader
              index="2"
              title="Lệnh sản xuất"
              desc="Lọc theo máy + ngày trong khoảng ngay_bat_dau → ngay_ket_thuc + ca đã chọn. Mỗi lệnh hiển thị lệnh - máy · ngày · ca, chọn nhiều (gõ để tìm)."
            />
            <div>
              <label className={labelClass}>
                Lệnh SX (chọn nhiều) <span className="text-rose-500">*</span>
              </label>
              <SearchableMultiSelect<ProductionOrderRow>
                values={lenhValues}
                onChange={sel => setSelectedLenh(sel.map(o => o.code))}
                options={lenhOptions}
                placeholder={
                  lenhOptions.length > 0
                    ? 'Gõ để tìm lệnh SX...'
                    : 'Chưa có lệnh SX phù hợp ngày chọn'
                }
                getValue={item => item.code}
                getLabel={lenhOptionLabel}
                getSearchText={lenhOptionSearchText}
                allowCustomValues={false}
                hideSelectedFromList
                keepOptionsOrder
                maxResults={200}
                inputClassName={inputClass}
              />
              {unresolvedLenhCodes.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                  {unresolvedLenhCodes.map(code => (
                    <span
                      key={code}
                      title="Không tìm thấy trong danh sách lệnh SX (có thể đã xóa/đổi mã)"
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800"
                    >
                      <span className="truncate">{code}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedLenh(prev => prev.filter(c => c !== code))}
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-amber-800 transition hover:bg-amber-100"
                        title="Bỏ mã này"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <span className="text-[11px] font-semibold text-amber-700">
                    Không tìm thấy trong danh sách lệnh — kiểm tra lại mã lệnh.
                  </span>
                </div>
              ) : null}
            </div>
            {ordersTotal === null ? (
              <p className="text-[12px] font-semibold text-rose-500">
                Không tải được danh sách lệnh SX — kiểm tra mạng hoặc tab Lệnh sản xuất.
              </p>
            ) : (
              <p className="text-[11.5px] font-semibold text-slate-500">
                Đã tải {ordersTotal} lệnh · {dateMatchedOrders.length} lệnh trong khoảng ngày
                {datelessOrders.length > 0 ? ` · ${datelessOrders.length} lệnh thiếu ngày` : ''}
                {(machineRef || selectedCa) ? ` · ${lenhOptions.length} lệnh sau lọc máy-ca` : ''}
                .
              </p>
            )}
            {isLoadingCoi && (
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang lấy phiếu trộn mẫu...
              </p>
            )}
            {(coiMau.length > 0 || uncoveredLenh.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  Cối trộn mẫu của các lệnh
                </h4>
                {coiMauGroups.map(group => {
                  return (
                    <div key={group.key} className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="bg-slate-50 px-3 py-1.5 text-[14px] font-bold text-slate-800">
                        {group.ten_sp || group.ma_sp || 'Sản phẩm'}
                      </div>
                      {group.blocks.map((block, bi) => (
                        <div key={`${group.key}-${bi}`} className="overflow-x-auto border-t border-slate-100">
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 pt-1.5 text-[13px] font-semibold text-slate-500">
                            {block.ma_lenh_sx ? <span>Lệnh SX: {block.ma_lenh_sx}</span> : null}
                            {block.tong_trong_luong ? (
                              <span>Tổng trọng lượng: <span className="tabular-nums text-slate-700">{block.tong_trong_luong} kg</span></span>
                            ) : null}
                            {block.dinh_luong_coi ? (
                              <span>Định lượng cối: <span className="tabular-nums text-slate-700">{block.dinh_luong_coi} kg</span></span>
                            ) : null}
                          </div>
                          <table className="w-full min-w-[480px] text-left text-[12px]">
                            <thead>
                              <tr className="border-y border-slate-100 text-[10.5px] uppercase tracking-wider text-slate-400">
                                <th className="px-3 py-1.5">Mã NVL</th>
                                <th className="px-3 py-1.5">Tên NVL</th>
                                <th className="px-3 py-1.5">ĐVT</th>
                                <th className="px-3 py-1.5 text-right">Giá trị</th>
                              </tr>
                            </thead>
                            <tbody>
                              {block.nvl.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-3 py-4 text-center text-[13px] font-semibold text-slate-400">
                                    Không có NVL chính.
                                  </td>
                                </tr>
                              ) : (
                                block.nvl.map((line, li) => (
                                  <tr key={li} className="border-b border-slate-50 last:border-0">
                                    <td className="px-3 py-1.5 font-bold">{line.ma_nvl}</td>
                                    <td className="px-3 py-1.5">
                                      <div>{line.ten_nvl_sx || line.ten_nvl}</div>
                                    </td>
                                    <td className="px-3 py-1.5">{line.dvt}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{line.gia_tri}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {uncoveredLenh.map(code => (
                  <p key={code} className="text-[13px] font-semibold text-slate-400">
                    {code}: chưa có phiếu trộn định mức.
                  </p>
                ))}
              </div>
            )}
          </section>

          {/* Chưa chọn lệnh SX — chỉ hiện gợi ý, ẩn toàn bộ phần nhập liệu */}
          {selectedLenh.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
              Chọn ít nhất 1 lệnh SX ở mục 2 để nhập dữ liệu sổ trộn.
            </div>
          )}
          {/* Giao diện cũ (không dùng — giữ lại để tham khảo) */}
          {false && (<>
          {/* 3.1 Bảng NVL thực tế */}
          <section className={`${cardClass} space-y-3 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <SectionHeader
                index="3.1"
                title="NVL trộn thực tế"
                desc="Fill toàn bộ NVL của các lệnh đã chọn (mã + tên + tên SX theo kho NVL). Trùng NVL được gộp theo id kho thành 1 dòng và cộng dồn vào tổng sử dụng."
              />
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => resizeLan(numLan - 1)}
                  disabled={numLan <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  title="Bớt 1 lần trộn"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[52px] text-center text-[12px] font-bold tabular-nums">{numLan} lần</span>
                <button
                  type="button"
                  onClick={() => resizeLan(numLan + 1)}
                  disabled={numLan >= SO_LAN_TRON_TOI_DA}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  title="Thêm 1 lần trộn"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2">Nguyên liệu</th>
                    <th className="px-2 py-2">Lệnh SX</th>
                    <th className="w-[70px] px-2 py-2">ĐVT</th>
                    {Array.from({ length: numLan }, (_, i) => (
                      <th key={i} className="w-[72px] px-1 py-2 text-center">L{i + 1}</th>
                    ))}
                    <th className="w-[84px] px-2 py-2 text-right">Tổng</th>
                    <th className="w-[36px] px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {nvlRows.length === 0 && (
                    <tr>
                      <td colSpan={numLan + 5} className="px-3 py-5 text-center font-semibold text-slate-400">
                        Chọn lệnh SX để tự fill NVL theo phiếu trộn.
                      </td>
                    </tr>
                  )}
                  {nvlRows.map((row, ri) => (
                    <tr key={row.key} className="border-b border-slate-100 last:border-0">
                      <td className="px-2 py-1.5">
                        <div className="text-[12.5px] font-bold text-slate-800">{row.ma_nvl}</div>
                        <div className="text-[11px] text-slate-500">{row.ten_nvl}</div>
                        {row.ten_nvl_sx ? (
                          <div className="text-[11px] italic text-slate-400">{row.ten_nvl_sx}</div>
                        ) : null}
                      </td>
                      <td className="max-w-[140px] px-2 py-1.5 text-[11.5px] font-semibold text-slate-600">
                        {row.nguon.length > 0 ? row.nguon.join(', ') : '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.dvt}
                          onChange={e =>
                            setNvlRows(rows => rows.map((r, i) => (i === ri ? { ...r, dvt: e.target.value } : r)))
                          }
                          className={inputClass}
                        />
                      </td>
                      {row.lan.map((cell, li) => (
                        <td key={li} className="px-1 py-1.5">
                          <input
                            inputMode="decimal"
                            value={cell}
                            onChange={e =>
                              setNvlRows(rows =>
                                rows.map((r, i) =>
                                  i === ri ? { ...r, lan: r.lan.map((c, j) => (j === li ? e.target.value : c)) } : r
                                )
                              )
                            }
                            className={numInputClass}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right text-[13px] font-bold tabular-nums">
                        {formatQty(round2(row.lan.reduce((sum, v) => sum + parseNum(v), 0)))}
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => setNvlRows(rows => rows.filter((_, i) => i !== ri))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-[220px] flex-1">
                <SearchableMultiSelect<MaterialRow>
                  values={[]}
                  onChange={sel => addExtraNvls(sel)}
                  options={mainMaterials}
                  placeholder="Thêm NVL khác (chỉ NVL chính, gõ để tìm)..."
                  getValue={m => m.id || m.code}
                  getLabel={materialOptionLabel}
                  getSearchText={materialOptionSearch}
                  allowCustomValues={false}
                  hideSelectedFromList
                  keepOptionsOrder
                  maxResults={100}
                  inputClassName={inputClass}
                />
              </div>
              <span className="text-[12.5px] font-bold text-slate-700">
                Tổng sử dụng: <span className="tabular-nums text-brand-600">{formatQty(tongSuDungChung)} kg</span>
                <span className="ml-2">
                  Tổng Nhập Trong Ngày: <span className="tabular-nums text-indigo-600">{formatQty(tongNhapTrongNgay)} kg</span>
                </span>
              </span>
            </div>
          </section>

          {/* 3.2 Bảng sản phẩm */}
          <section className={`${cardClass} space-y-3 p-4`}>
            <SectionHeader
              index="3.2"
              title="Sản phẩm"
              desc="Nhập các sản phẩm trong lệnh và số lượng. Cột lệnh SX cho biết SP thuộc lệnh nào."
            />
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[1020px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="w-[130px] px-2 py-2">Lệnh SX</th>
                    <th className="px-2 py-2">Tên hàng hóa</th>
                    <th className="w-[80px] px-2 py-2">Số lượng</th>
                    <th className="w-[90px] px-2 py-2">Định mức</th>
                    <th className="w-[90px] px-2 py-2">Trọng lượng</th>
                    <th className="w-[80px] px-2 py-2" title="KG / 1 sản phẩm — tự fill từ lệnh SX, sửa tay được">KG/1 SP</th>
                    <th className="w-[80px] px-2 py-2" title="M2 / 1 sản phẩm — tự fill từ lệnh SX, sửa tay được">M2/1 SP</th>
                    <th className="w-[80px] px-2 py-2" title="M dài / 1 sản phẩm — tự fill từ lệnh SX, sửa tay được">M dài/1 SP</th>
                    <th className="w-[110px] px-2 py-2">Ghi chú</th>
                    <th className="w-[36px] px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {spRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-5 text-center font-semibold text-slate-400">
                        Chưa có sản phẩm — bấm “Thêm sản phẩm”.
                      </td>
                    </tr>
                  )}
                  {spRows.map((row, ri) => (
                    <tr key={row.key} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-2 py-1.5">
                        <select
                          value={row.ma_lenh_sx}
                          onChange={e =>
                            setSpRows(rows => rows.map((r, i) => (i === ri ? { ...r, ma_lenh_sx: e.target.value } : r)))
                          }
                          className={inputClass}
                        >
                          <option value="">—</option>
                          {selectedLenh.map(code => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.ten_sp}
                          list={`so-tron-sp-suggest-${row.key}`}
                          onChange={e => {
                            const value = e.target.value;
                            setSpRows(rows => rows.map((r, i) => (i === ri ? applySpSuggestion(r, value) : r)));
                          }}
                          placeholder="Tên hàng / mã SP"
                          className={inputClass}
                        />
                        <datalist id={`so-tron-sp-suggest-${row.key}`}>
                          {productSuggestions.map(s => (
                            <option key={`${s.maLenh}-${s.maSp}`} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </datalist>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.so_luong}
                          onChange={e =>
                            setSpRows(rows =>
                              rows.map((r, i) => (i === ri ? withAutoTrongLuong(r, e.target.value) : r))
                            )
                          }
                          className={numInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.dinh_muc}
                          onChange={e =>
                            setSpRows(rows => rows.map((r, i) => (i === ri ? { ...r, dinh_muc: e.target.value } : r)))
                          }
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.trong_luong}
                          onChange={e =>
                            setSpRows(rows => rows.map((r, i) => (i === ri ? { ...r, trong_luong: e.target.value } : r)))
                          }
                          className={numInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.kg_1_sp}
                          title={row.nguon_quy_doi === 'tay' ? 'Sửa tay' : 'Từ lệnh SX'}
                          onChange={e =>
                            setSpRows(rows =>
                              rows.map((r, i) => (i === ri ? updateSpMetric(r, 'kg_1_sp', e.target.value) : r))
                            )
                          }
                          className={numInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.m2_1_sp}
                          title={row.nguon_quy_doi === 'tay' ? 'Sửa tay' : 'Từ lệnh SX'}
                          onChange={e =>
                            setSpRows(rows =>
                              rows.map((r, i) => (i === ri ? updateSpMetric(r, 'm2_1_sp', e.target.value) : r))
                            )
                          }
                          className={numInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.m_dai_1_sp}
                          title={row.nguon_quy_doi === 'tay' ? 'Sửa tay' : 'Từ lệnh SX'}
                          onChange={e =>
                            setSpRows(rows =>
                              rows.map((r, i) => (i === ri ? updateSpMetric(r, 'm_dai_1_sp', e.target.value) : r))
                            )
                          }
                          className={numInputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.ghi_chu}
                          onChange={e =>
                            setSpRows(rows => rows.map((r, i) => (i === ri ? { ...r, ghi_chu: e.target.value } : r)))
                          }
                          className={inputClass}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => setSpRows(rows => rows.filter((_, i) => i !== ri))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                setSpRows(rows => [
                  ...rows,
                  {
                    key: uid(),
                    ma_lenh_sx: selectedLenh[0] || '',
                    san_pham_id: '',
                    ma_sp: '',
                    ten_sp: '',
                    mang: '',
                    so_luong: '',
                    dinh_muc: '',
                    trong_luong: '',
                    kg_1_sp: '',
                    m2_1_sp: '',
                    m_dai_1_sp: '',
                    nguon_quy_doi: '',
                    ghi_chu: ''
                  }
                ])
              }
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Thêm sản phẩm
            </button>
          </section>

          {/* 3.3 Hàng lỗi hỏng */}
          <section className={`${cardClass} space-y-3 p-4`}>
            <SectionHeader index="3.3" title="Hàng lỗi hỏng" desc="Tên lỗi và số lượng (kg)." />
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[420px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2">Tên lỗi</th>
                    <th className="w-[140px] px-2 py-2">Số lượng (kg)</th>
                    <th className="w-[36px] px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {loiRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-5 text-center font-semibold text-slate-400">
                        Không có hàng lỗi — bấm “Thêm lỗi” nếu phát sinh.
                      </td>
                    </tr>
                  )}
                  {loiRows.map((row, ri) => (
                    <tr key={row.key} className="border-b border-slate-100 last:border-0">
                      <td className="px-2 py-1.5">
                        <input
                          value={row.ten_loi}
                          onChange={e =>
                            setLoiRows(rows => rows.map((r, i) => (i === ri ? { ...r, ten_loi: e.target.value } : r)))
                          }
                          placeholder="VD: PDK, P-02(D)..."
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          inputMode="decimal"
                          value={row.so_luong}
                          onChange={e =>
                            setLoiRows(rows => rows.map((r, i) => (i === ri ? { ...r, so_luong: e.target.value } : r)))
                          }
                          className={numInputClass}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => setLoiRows(rows => rows.filter((_, i) => i !== ri))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setLoiRows(rows => [...rows, { key: uid(), ten_loi: '', so_luong: '' }])}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Thêm lỗi
            </button>
          </section>

          {/* 3.4 Bàn giao ca sau — Nhập Ca Trước = tồn cuối ca trước logic */}
          <section className={`${cardClass} space-y-3 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <SectionHeader
                index="3.4"
                title="Nhựa bàn giao ca sau"
                desc="Loại nhựa tự fill theo phiếu trộn. Nhập Trong Ngày = tự lấy từ phiếu xuất kho NVL theo ngày-máy-ca. Nhập Ca Trước = tồn cuối ca trước logic theo vòng lặp Loại ca (Ca8H: HC1→HC2→HC3, Ca12H: 12C1→12C2 — xem /cai-dat, ca đêm tính theo ngày bắt đầu), thiếu phiếu thì lùi tiếp về quá khứ. Tồn cuối = Nhập Trong Ngày + Nhập Ca Trước − tổng sử dụng."
              />
              {!hasPrevTon && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">
                  Chưa có bàn giao ca trước
                </div>
              )}
              <button
                type="button"
                onClick={applyPrevTon}
                disabled={prevTonMap.size === 0 && nhapTrongNgayMap.size === 0}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Đồng bộ xuất kho & tồn ca trước
              </button>
            </div>
            {/* Xac dinh ca truoc / ca sau logic (lay tu /cai-dat) + nguon ton dang dung */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold leading-5 text-slate-600">
              {currentCaForChain ? (
                inChainForDisplay ? (
                  <>
                    <span>
                      Ca trước logic:{' '}
                      <span className="font-bold text-slate-800">
                        {prevSlotLogic ? `${prevSlotLogic.shift} · ${formatNgayVN(prevSlotLogic.ngay) || prevSlotLogic.ngay}` : '—'}
                      </span>
                      {' '}· Ca sau logic:{' '}
                      <span className="font-bold text-slate-800">
                        {nextSlotLogic ? `${nextSlotLogic.shift} · ${formatNgayVN(nextSlotLogic.ngay) || nextSlotLogic.ngay}` : '—'}
                      </span>
                      <span className="text-slate-400"> (chuỗi {inChainForDisplay.meta.group}: {inChainForDisplay.list.map(m => m.value).join(' → ')} ↺)</span>
                    </span>
                    <br />
                    <span title={prevSourceText}>
                      {prevSource
                        ? `Tồn cuối ca ${prevSource.ca} ngày ${formatNgayVN(prevSource.ngay) || prevSource.ngay} = Nhập Ca Trước ca hiện tại.`
                        : `Ô ca trước logic${prevSlotLogic ? ` (${prevSlotLogic.shift} · ${formatNgayVN(prevSlotLogic.ngay) || prevSlotLogic.ngay})` : ''} chưa có phiếu — Nhập Ca Trước đang trống.`}
                      {' '}Tồn cuối ca này sẽ là Nhập Ca Trước của ca sau{nextSlotLogic ? ` (${nextSlotLogic.shift} · ${formatNgayVN(nextSlotLogic.ngay) || nextSlotLogic.ngay})` : ''}.
                    </span>
                  </>
                ) : (
                  <span title={prevSourceText}>
                    Ca {currentCaForChain} chưa xếp Loại ca / thứ tự ở /cai-dat nên dùng phiếu gần nhất cùng máy làm ca trước
                    {prevSource ? `: đang lấy tồn cuối ca ${prevSource.ca} ngày ${formatNgayVN(prevSource.ngay) || prevSource.ngay} = Nhập Ca Trước.` : ': chưa có phiếu phù hợp.'}
                  </span>
                )
              ) : (
                <span>Chọn ca ở mục 1 để xác định ca trước / ca sau logic.</span>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[680px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2">Loại nhựa</th>
                    <th className="w-[110px] px-2 py-2">Nhập Trong Ngày</th>
                    <th className="w-[130px] px-2 py-2">
                      Nhập Ca Trước
                    </th>
                    <th className="w-[100px] px-2 py-2 text-right">Tổng sử dụng</th>
                    <th className="w-[110px] px-2 py-2 text-right">Tồn cuối ca</th>
                  </tr>
                </thead>
                <tbody>
                  {banGiaoRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-5 text-center font-semibold text-slate-400">
                        Chọn lệnh SX để tự fill loại nhựa.
                      </td>
                    </tr>
                  )}
                  {banGiaoRows.map((row, ri) => {
                    const suDung = nvlUsageOf(row.material_id, row.ma_nvl);
                    const tonCuoi = round2(parseNum(row.lay_trong_kho) + parseNum(row.ton_dau_ca) - suDung);
                    return (
                      <tr key={row.key} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1.5">
                          <div className="text-[12.5px] font-bold text-slate-800">{row.ma_nvl}</div>
                          <div className="text-[11px] text-slate-500">{row.ten_nvl}</div>
                          {row.ten_nvl_sx ? (
                            <div className="text-[11px] italic text-slate-400">{row.ten_nvl_sx}</div>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            inputMode="decimal"
                            value={row.lay_trong_kho}
                            onChange={e =>
                              setBanGiaoRows(rows =>
                                rows.map((r, i) =>
                                  i === ri ? { ...r, lay_trong_kho: e.target.value, lay_kho_tu_dong: false } : r
                                )
                              )
                            }
                            className={numInputClass}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            inputMode="decimal"
                            value={row.ton_dau_ca}
                            onChange={e =>
                              setBanGiaoRows(rows =>
                                rows.map((r, i) =>
                                  i === ri ? { ...r, ton_dau_ca: e.target.value, ton_dau_tu_dong: false } : r
                                )
                              )
                            }
                            className={numInputClass}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-600">
                          {formatQty(suDung)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[13px] font-bold tabular-nums text-brand-700">
                          {formatQty(tonCuoi)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          </>)}
          {/* 3. Tờ phiếu nhập liệu kiểu sổ giấy (hiện sau khi chọn lệnh SX — giống mẫu hình) */}
          {selectedLenh.length > 0 && (
            <section className="overflow-x-auto rounded-xl border-2 border-slate-800 bg-white shadow-card">
              <div className="min-w-[1310px]">
                {/* Đầu phiếu: Ngày + Nhân sự chạy máy */}
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b-2 border-slate-800 px-3 py-2 text-[13px] font-semibold text-slate-900">
                  <span>
                    Ngày{' '}
                    <span className="inline-block min-w-[28px] border-b border-dotted border-slate-400 px-1 text-center font-bold tabular-nums">
                      {ngay.slice(8, 10) || '...'}
                    </span>{' '}
                    Tháng{' '}
                    <span className="inline-block min-w-[28px] border-b border-dotted border-slate-400 px-1 text-center font-bold tabular-nums">
                      {ngay.slice(5, 7) || '...'}
                    </span>{' '}
                    Năm{' '}
                    <span className="inline-block min-w-[48px] border-b border-dotted border-slate-400 px-1 text-center font-bold tabular-nums">
                      {ngay.slice(0, 4) || '...'}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 text-right">
                    Nhân sự chạy máy:{' '}
                    <span className="font-bold text-slate-900">{nhanSuText.trim() || '...'}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-3 py-1.5 text-[11.5px] font-semibold text-slate-600">
                  <span className="min-w-0">
                    Máy-Ca sẽ lưu: <span className="font-bold text-slate-800" title={selectedCa.trim() ? `Chỉ tạo phiếu cho ca ${selectedCa.trim()} (Lọc theo ca ở mục 1)` : 'Chưa lọc ca — sẽ tạo cho tất cả combo máy-ca của lệnh'}>{saveCombos.map(c => formatMayCa(c.machine, c.ca)).join(' · ') || '...'}</span>
                    {' '}· Lệnh: <span className="font-bold text-slate-800">{selectedLenh.join(', ')}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => resizeLan(numLan - 1)}
                      disabled={numLan <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      title="Bớt 1 lần trộn"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[52px] text-center text-[12px] font-bold tabular-nums">{numLan} lần</span>
                    <button
                      type="button"
                      onClick={() => resizeLan(numLan + 1)}
                      disabled={numLan >= SO_LAN_TRON_TOI_DA}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      title="Thêm 1 lần trộn"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>

                {/* Bảng NVL trộn thực tế: Nguyên liệu | ĐVT | L1..Ln | Tổng */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center" style={{ minWidth: 426 + numLan * 64 }}>
                    <colgroup>
                      <col style={{ width: '260px', minWidth: '260px' }} />
                      <col style={{ width: '56px', minWidth: '56px' }} />
                      {Array.from({ length: numLan }, (_, i) => (
                        <col key={i} style={{ width: '64px', minWidth: '64px' }} />
                      ))}
                      <col style={{ width: '76px', minWidth: '76px' }} />
                      <col style={{ width: '34px', minWidth: '34px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2} className={`${paperTh} w-[260px] min-w-[260px] max-w-[280px]`}>Nguyên Liệu</th>
                        <th rowSpan={2} className={`${paperTh} w-[56px] min-w-[56px]`}>ĐVT</th>
                        <th colSpan={numLan} className={paperTh}>Trọng Lượng</th>
                        <th rowSpan={2} className={`${paperTh} w-[76px] min-w-[76px]`}>Tổng</th>
                        <th rowSpan={2} className={`${paperTh} w-[34px] min-w-[34px]`} />
                      </tr>
                      <tr>
                        {Array.from({ length: numLan }, (_, i) => (
                          <th key={i} className="border border-slate-800 bg-slate-50 px-0 py-1 text-[11px] font-bold tabular-nums text-slate-700 w-[64px] min-w-[64px]">
                            L{i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {nvlRows.length === 0 && (
                        <tr>
                          <td colSpan={numLan + 4} className="border border-slate-700 px-3 py-5 text-center font-semibold text-slate-400">
                            Chưa có NVL — kiểm tra cối trộn mẫu của lệnh hoặc thêm NVL khác bên dưới.
                          </td>
                        </tr>
                      )}
                      {nvlRows.map((row, ri) => (
                        <tr key={row.key}>
                          <td className="border border-slate-700 px-2 py-1 text-left w-[260px] min-w-[260px] max-w-[280px] break-words">
                            <div className="text-[12.5px] font-bold text-slate-800">{row.ma_nvl || '—'}</div>
                            {row.ten_nvl ? <div className="text-[11px] text-slate-500">{row.ten_nvl}</div> : null}
                            {row.ten_nvl_sx ? (
                              <div className="text-[11px] italic text-slate-400">{row.ten_nvl_sx}</div>
                            ) : null}
                            {row.nguon.length > 0 ? (
                              <div className="text-[10.5px] font-semibold text-slate-400">{row.nguon.join(', ')}</div>
                            ) : null}
                          </td>
                          <td className={`${paperTd} w-[56px] min-w-[56px]`}>
                            <input
                              value={row.dvt}
                              onChange={e =>
                                setNvlRows(rows => rows.map((r, i) => (i === ri ? { ...r, dvt: e.target.value } : r)))
                              }
                              className={paperCellInput}
                            />
                          </td>
                          {row.lan.map((cell, li) => (
                            <td key={li} className={`${paperTd} w-[64px] min-w-[64px]`}>
                              <input
                                inputMode="decimal"
                                value={cell}
                                onChange={e =>
                                  setNvlRows(rows =>
                                    rows.map((r, i) =>
                                      i === ri ? { ...r, lan: r.lan.map((c, j) => (j === li ? e.target.value : c)) } : r
                                    )
                                  )
                                }
                                className={paperCellInput}
                              />
                            </td>
                          ))}
                          <td className="border border-slate-700 px-1 py-0.5 text-right text-[13px] font-bold tabular-nums w-[76px] min-w-[76px]">
                            {formatQty(round2(row.lan.reduce((sum, v) => sum + parseNum(v), 0)))}
                          </td>
                          <td className="border border-slate-700 px-0.5 py-0.5 w-[34px] min-w-[34px]">
                            <button
                              type="button"
                              onClick={() => setNvlRows(rows => rows.filter((_, i) => i !== ri))}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 px-3 py-1.5">
                  <div className="min-w-[220px] flex-1">
                    <SearchableMultiSelect<MaterialRow>
                      values={[]}
                      onChange={sel => addExtraNvls(sel)}
                      options={mainMaterials}
                      placeholder="Thêm NVL khác (chỉ NVL chính, gõ để tìm)..."
                      getValue={m => m.id || m.code}
                      getLabel={materialOptionLabel}
                      getSearchText={materialOptionSearch}
                      allowCustomValues={false}
                      hideSelectedFromList
                      keepOptionsOrder
                      maxResults={100}
                      inputClassName={inputClass}
                    />
                  </div>
                  <span className="text-[12.5px] font-bold text-slate-700">
                    Tổng sử dụng: <span className="tabular-nums text-brand-600">{formatQty(tongSuDungChung)} kg</span>
                    <span className="ml-2">
                      Tổng Nhập Trong Ngày: <span className="tabular-nums text-indigo-600">{formatQty(tongNhapTrongNgay)} kg</span>
                    </span>
                  </span>
                </div>

                {/* 3 bảng cạnh nhau: Sản phẩm | Hàng lỗi hỏng | Nhựa bàn giao ca sau */}
                <div className="border-t-2 border-slate-800 flex flex-col lg:flex-row divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-slate-800">
                  {/* Sản phẩm */}
                  <div className="min-w-[880px] flex-1 flex flex-col justify-between">
                    <div>
                      <p className="border-b border-slate-800 bg-slate-100 py-1 text-center text-[12px] font-bold uppercase tracking-wide">
                        Sản Phẩm
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[880px] border-collapse text-center">
                          <thead>
                            <tr>
                              <th className={`${paperTh} w-[140px] min-w-[130px]`}>Lệnh SX</th>
                              <th className={`${paperTh} min-w-[180px]`}>Tên hàng hóa</th>
                              <th className={`${paperTh} w-[92px] min-w-[86px]`} title="Màng SP: tự tra theo mã SP từ danh mục (không chọn/sửa tay)">Màng</th>
                              <th className={`${paperTh} w-[56px] min-w-[50px]`}>Số Lượng</th>
                              <th className={`${paperTh} w-[62px] min-w-[56px]`}>Định mức</th>
                              <th className={`${paperTh} w-[68px] min-w-[60px]`}>Trọng lượng</th>
                              <th className={`${paperTh} w-[62px] min-w-[56px]`} title="KG / 1 sản phẩm — tự fill từ lệnh SX, sửa tay được">KG/1 SP</th>
                              <th className={`${paperTh} w-[62px] min-w-[56px]`} title="M2 / 1 sản phẩm — tự fill từ lệnh SX, sửa tay được">M2/1 SP</th>
                              <th className={`${paperTh} w-[62px] min-w-[56px]`} title="M dài / 1 sản phẩm — tự fill từ lệnh SX, sửa tay được">M dài/1 SP</th>
                              <th className={`${paperTh} w-[70px] min-w-[64px]`}>Ghi chú</th>
                              <th className={`${paperTh} w-[28px] min-w-[28px]`} />
                            </tr>
                          </thead>
                          <tbody>
                            {spRows.length === 0 && (
                              <tr>
                                <td colSpan={11} className="border border-slate-700 px-3 py-5 text-center font-semibold text-slate-400">
                                  Chưa có sản phẩm — bấm “Thêm sản phẩm”.
                                </td>
                              </tr>
                            )}
                            {spRows.map((row, ri) => (
                              <tr key={row.key}>
                                <td className={`${paperTd} w-[140px] min-w-[130px]`}>
                                  <select
                                    value={row.ma_lenh_sx}
                                    onChange={e =>
                                      setSpRows(rows => rows.map((r, i) => (i === ri ? { ...r, ma_lenh_sx: e.target.value } : r)))
                                    }
                                    className={`${paperCellInput} font-mono text-[12px] truncate`}
                                    title={row.ma_lenh_sx}
                                  >
                                    <option value="">—</option>
                                    {selectedLenh.map(code => (
                                      <option key={code} value={code}>
                                        {code}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className={`${paperTd} min-w-[180px]`}>
                                  <input
                                    value={row.ten_sp}
                                    list={`so-tron-paper-sp-${row.key}`}
                                    onChange={e => {
                                      const value = e.target.value;
                                      setSpRows(rows =>
                                        rows.map((r, i) => (i === ri ? applySpSuggestion(r, value) : r))
                                      );
                                    }}
                                    placeholder="Tên hàng / mã SP"
                                    className={paperCellInputLeft}
                                    title={row.ten_sp}
                                  />
                                  <datalist id={`so-tron-paper-sp-${row.key}`}>
                                    {productSuggestions.map(s => (
                                      <option key={`${s.maLenh}-${s.maSp}`} value={s.value}>
                                        {s.label}
                                      </option>
                                    ))}
                                  </datalist>
                                </td>
                                <td className={`${paperTd} w-[92px] min-w-[86px]`}>
                                  <span
                                    className={`block px-1 py-1 text-center text-[12.5px] font-semibold ${
                                      row.mang ? 'text-emerald-700' : 'text-slate-400'
                                    }`}
                                    title={row.mang ? `Có màng ${row.mang}` : 'Không màng'}
                                  >
                                    {row.mang || '—'}
                                  </span>
                                </td>
                                <td className={`${paperTd} w-[56px] min-w-[50px]`}>
                                  <input
                                    value={row.so_luong}
                                    onChange={e =>
                                      setSpRows(rows =>
                                        rows.map((r, i) => (i === ri ? withAutoTrongLuong(r, e.target.value) : r))
                                      )
                                    }
                                    className={paperCellInput}
                                  />
                                </td>
                                <td className={`${paperTd} w-[62px] min-w-[56px]`}>
                                  <input
                                    value={row.dinh_muc}
                                    onChange={e =>
                                      setSpRows(rows => rows.map((r, i) => (i === ri ? { ...r, dinh_muc: e.target.value } : r)))
                                    }
                                    className={paperCellInput}
                                  />
                                </td>
                                <td className={`${paperTd} w-[68px] min-w-[60px]`}>
                                  <input
                                    value={row.trong_luong}
                                    onChange={e =>
                                      setSpRows(rows => rows.map((r, i) => (i === ri ? { ...r, trong_luong: e.target.value } : r)))
                                    }
                                    className={paperCellInput}
                                  />
                                </td>
                                <td className={`${paperTd} w-[62px] min-w-[56px]`}>
                                  <input
                                    value={row.kg_1_sp}
                                    title={row.nguon_quy_doi === 'tay' ? 'Sửa tay' : 'Từ lệnh SX'}
                                    onChange={e =>
                                      setSpRows(rows =>
                                        rows.map((r, i) => (i === ri ? updateSpMetric(r, 'kg_1_sp', e.target.value) : r))
                                      )
                                    }
                                    className={paperCellInput}
                                  />
                                </td>
                                <td className={`${paperTd} w-[62px] min-w-[56px]`}>
                                  <input
                                    value={row.m2_1_sp}
                                    title={row.nguon_quy_doi === 'tay' ? 'Sửa tay' : 'Từ lệnh SX'}
                                    onChange={e =>
                                      setSpRows(rows =>
                                        rows.map((r, i) => (i === ri ? updateSpMetric(r, 'm2_1_sp', e.target.value) : r))
                                      )
                                    }
                                    className={paperCellInput}
                                  />
                                </td>
                                <td className={`${paperTd} w-[62px] min-w-[56px]`}>
                                  <input
                                    value={row.m_dai_1_sp}
                                    title={row.nguon_quy_doi === 'tay' ? 'Sửa tay' : 'Từ lệnh SX'}
                                    onChange={e =>
                                      setSpRows(rows =>
                                        rows.map((r, i) => (i === ri ? updateSpMetric(r, 'm_dai_1_sp', e.target.value) : r))
                                      )
                                    }
                                    className={paperCellInput}
                                  />
                                </td>
                                <td className={`${paperTd} w-[70px] min-w-[64px]`}>
                                  <input
                                    value={row.ghi_chu}
                                    onChange={e =>
                                      setSpRows(rows => rows.map((r, i) => (i === ri ? { ...r, ghi_chu: e.target.value } : r)))
                                    }
                                    className={paperCellInputLeft}
                                  />
                                </td>
                                <td className="border border-slate-700 px-0.5 py-0.5 w-[28px] min-w-[28px]">
                                  <button
                                    type="button"
                                    onClick={() => setSpRows(rows => rows.filter((_, i) => i !== ri))}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {spRows.length > 0 && (
                              <tr className="bg-slate-50 font-bold">
                                <td colSpan={3} className="border border-slate-700 px-1 py-1 text-left text-[12px]">Cộng</td>
                                <td className="border border-slate-700 px-1 py-1 text-right tabular-nums">{formatQty(round2(paperSpTotalSoLuong))}</td>
                                <td className="border border-slate-700" />
                                <td className="border border-slate-700 px-1 py-1 text-right tabular-nums">{formatQty(round2(paperSpTotalTrongLuong))}</td>
                                <td colSpan={5} className="border border-slate-700" />
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSpRows(rows => [
                            ...rows,
                            {
                              key: uid(),
                              ma_lenh_sx: selectedLenh[0] || '',
                              san_pham_id: '',
                              ma_sp: '',
                              ten_sp: '',
                              mang: '',
                              so_luong: '',
                              dinh_muc: '',
                              trong_luong: '',
                              kg_1_sp: '',
                              m2_1_sp: '',
                              m_dai_1_sp: '',
                              nguon_quy_doi: '',
                              ghi_chu: ''
                            }
                          ])
                        }
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm sản phẩm
                      </button>
                    </div>
                  </div>

                  {/* Hàng lỗi hỏng */}
                  <div className="w-[280px] shrink-0 flex flex-col justify-between">
                    <div>
                      <p className="border-b border-slate-800 bg-slate-100 py-1 text-center text-[12px] font-bold uppercase tracking-wide">
                        Hàng Lỗi Hỏng
                      </p>
                      <table className="w-full border-collapse text-center">
                        <thead>
                          <tr>
                            <th className={`${paperTh} w-[36px] min-w-[36px]`}>Stt</th>
                            <th className={`${paperTh} min-w-[140px]`}>Tên Lỗi</th>
                            <th className={`${paperTh} w-[76px] min-w-[70px]`}>Số lượng</th>
                            <th className={`${paperTh} w-[28px] min-w-[28px]`} />
                          </tr>
                        </thead>
                        <tbody>
                          {loiRows.length === 0 && (
                            <tr>
                              <td colSpan={4} className="border border-slate-700 px-3 py-5 text-center font-semibold text-slate-400">
                                Không có hàng lỗi.
                              </td>
                            </tr>
                          )}
                          {loiRows.map((row, ri) => (
                            <tr key={row.key}>
                              <td className="border border-slate-700 px-1 py-1 tabular-nums text-slate-500 w-[36px]">{ri + 1}</td>
                              <td className={`${paperTd} min-w-[140px]`}>
                                <input
                                  value={row.ten_loi}
                                  onChange={e =>
                                    setLoiRows(rows => rows.map((r, i) => (i === ri ? { ...r, ten_loi: e.target.value } : r)))
                                  }
                                  placeholder="VD: PDK..."
                                  className={paperCellInputLeft}
                                  title={row.ten_loi}
                                />
                              </td>
                              <td className={`${paperTd} w-[76px] min-w-[70px]`}>
                                <input
                                  inputMode="decimal"
                                  value={row.so_luong}
                                  onChange={e =>
                                    setLoiRows(rows => rows.map((r, i) => (i === ri ? { ...r, so_luong: e.target.value } : r)))
                                  }
                                  className={paperCellInput}
                                />
                              </td>
                              <td className="border border-slate-700 px-0.5 py-0.5 w-[28px] min-w-[28px]">
                                <button
                                  type="button"
                                  onClick={() => setLoiRows(rows => rows.filter((_, i) => i !== ri))}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {loiRows.length > 0 && (
                            <tr className="bg-slate-50 font-bold">
                              <td colSpan={2} className="border border-slate-700 px-1 py-1 text-left text-[12px]">Cộng tổng</td>
                              <td className="border border-slate-700 px-1 py-1 text-right tabular-nums">{formatQty(round2(paperLoiTotal))}</td>
                              <td className="border border-slate-700" />
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() => setLoiRows(rows => [...rows, { key: uid(), ten_loi: '', so_luong: '' }])}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm lỗi
                      </button>
                    </div>
                  </div>

                  {/* Nhựa bàn giao ca sau — Nhập Ca Trước = tồn cuối ca trước logic */}
                  <div className="w-[360px] shrink-0 flex flex-col justify-between">
                    <div>
                      <p className="border-b border-slate-800 bg-slate-100 py-1 text-center text-[12px] font-bold uppercase tracking-wide">
                        Nhựa Bàn Giao Ca Sau
                      </p>
                      <div className="border-b border-slate-300 bg-slate-50 px-2 py-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Chọn ca trước
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-400">
                          Ngày, ca, máy lấy theo mục 1 phía trên
                          {(machineRef.trim() || orderCombos[0]?.machine)
                            ? `: ${machineRef.trim() || orderCombos[0]?.machine || ''}`
                            : ''}
                          .
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <div className="min-w-[128px] flex-1">
                            <SoTronDatePicker
                              value={prevDatePick}
                              onChange={v => {
                                setPrevPickTouched(true);
                                setPrevDatePick(v);
                                setPrevSyncNote('');
                              }}
                              placeholder="Chọn ngày"
                            />
                          </div>
                          <select
                            value={prevCaPick}
                            onChange={e => {
                              setPrevPickTouched(true);
                              setPrevCaPick(e.target.value);
                              setPrevSyncNote('');
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[12.5px] font-bold text-slate-800 outline-none focus:border-brand-400"
                            aria-label="Chọn ca (theo mục 1 phía trên)"
                          >
                            <option value="">Chọn ca</option>
                            {shiftOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleSyncPrevTon()}
                            disabled={isSyncingPrev || !prevDatePick || !prevCaPick}
                            title="Đồng bộ tồn cuối đúng ô ngày/ca đã chọn (máy ở mục 1) vào Nhập Ca Trước"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isSyncingPrev ? 'animate-spin' : ''}`} />
                            Đồng bộ
                          </button>
                        </div>
                        {prevSyncNote ? (
                          <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-600">{prevSyncNote}</p>
                        ) : (
                          <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-400">
                            Bấm Đồng bộ để fill Nhập Ca Trước đúng ô ngày/ca đã chọn.
                          </p>
                        )}
                      </div>
                      {!hasPrevTon && (
                        <p className="border-b border-slate-800 bg-red-50 py-1 text-center text-[11.5px] font-bold text-red-600">
                          Chưa có bàn giao ca trước
                        </p>
                      )}
                      <table className="w-full border-collapse text-center">
                        <thead>
                          <tr>
                            <th className={`${paperTh} min-w-[110px]`}>Loại Nhựa</th>
                            <th className={`${paperTh} w-[76px] min-w-[70px]`}>Nhập Trong Ngày</th>
                            <th className={`${paperTh} w-[76px] min-w-[70px]`}>Nhập Ca Trước</th>
                            <th className={`${paperTh} w-[76px] min-w-[70px]`}>Tồn Cuối Ca</th>
                          </tr>
                        </thead>
                        <tbody>
                          {banGiaoRows.length === 0 && (
                            <tr>
                              <td colSpan={4} className="border border-slate-700 px-3 py-5 text-center font-semibold text-slate-400">
                                Chưa có loại nhựa.
                              </td>
                            </tr>
                          )}
                          {banGiaoRows.map((row, ri) => {
                            const suDung = nvlUsageOf(row.material_id, row.ma_nvl);
                            const tonCuoi = round2(parseNum(row.lay_trong_kho) + parseNum(row.ton_dau_ca) - suDung);
                            return (
                              <tr key={row.key}>
                                <td className="border border-slate-700 px-1 py-0.5 text-left min-w-[110px]">
                                  <div className="text-[12.5px] font-bold text-slate-800">{row.ma_nvl || '—'}</div>
                                  {row.ten_nvl ? <div className="text-[11px] text-slate-500">{row.ten_nvl}</div> : null}
                                  {row.ten_nvl_sx ? (
                                    <div className="text-[11px] italic text-slate-400">{row.ten_nvl_sx}</div>
                                  ) : null}
                                </td>
                                <td className={`${paperTd} w-[76px] min-w-[70px]`}>
                                  <input
                                    inputMode="decimal"
                                    value={row.lay_trong_kho}
                                    onChange={e =>
                                      setBanGiaoRows(rows =>
                                        rows.map((r, i) =>
                                          i === ri ? { ...r, lay_trong_kho: e.target.value, lay_kho_tu_dong: false } : r
                                        )
                                      )
                                    }
                                    className={paperCellInput}
                                  />
                                </td>
                                <td className={`${paperTd} w-[76px] min-w-[70px]`}>
                                  <input
                                    inputMode="decimal"
                                    value={row.ton_dau_ca}
                                    onChange={e =>
                                      setBanGiaoRows(rows =>
                                        rows.map((r, i) =>
                                          i === ri ? { ...r, ton_dau_ca: e.target.value, ton_dau_tu_dong: false } : r
                                        )
                                      )
                                    }
                                    className={paperCellInput}
                                  />
                                </td>
                                <td className="border border-slate-700 px-1 py-0.5 text-right text-[13px] font-bold tabular-nums text-brand-700 w-[76px] min-w-[70px]">
                                  {formatQty(tonCuoi)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={applyPrevTon}
                        disabled={prevTonMap.size === 0 && nhapTrongNgayMap.size === 0}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Đồng bộ xuất kho & tồn ca trước
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
          {/* Ghi chú + Lưu (chỉ hiện sau khi chọn lệnh SX) */}
          {selectedLenh.length > 0 && (
          <section className={`${cardClass} space-y-3 p-4`}>
            <div>
              <label className={labelClass}>Ghi chú</label>
              <textarea
                value={ghiChu}
                onChange={e => setGhiChu(e.target.value)}
                rows={2}
                className={`${inputClass} resize-y`}
                placeholder="Ghi chú thêm của ca..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'Cập nhật sổ trộn' : 'Lưu sổ trộn'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstCombo = orderCombos[0];
                  const machineIdn = firstCombo ? resolveComboMachine(firstCombo.machine) : null;
                  const reportSnapshot: SoTronSavedReport = {
                    id: editingId || '',
                    chi_nhanh: CHI_NHANH_MAC_DINH,
                    ngay,
                    ma_may: machineIdn?.code || (firstCombo?.machine ?? ''),
                    ten_may: machineIdn?.name || (firstCombo?.machine ?? ''),
                    ca: selectedCa || (firstCombo?.ca ?? ''),
                    nhan_su: nhanSuText.trim(),
                    nhan_su_chi_tiet: phanCong,
                    lenh_sx: selectedOrders.map(o => ({ id: o.id, ma_lenh: o.code })),
                    coi_tron_mau: coiMau,
                    bang_nvl: nvlRows.map(row => {
                      const lan = row.lan.map(parseNum).map(round2);
                      return {
                        material_id: row.material_id,
                        ma_nvl: row.ma_nvl.trim(),
                        ten_nvl: row.ten_nvl.trim(),
                        ten_nvl_sx: row.ten_nvl_sx.trim(),
                        dvt: row.dvt.trim() || 'kg',
                        dinh_muc: row.dinh_muc.trim(),
                        lan,
                        tong: round2(lan.reduce((s, v) => s + v, 0)),
                        lenh_sx: row.nguon
                      };
                    }),
                    bang_san_pham: spRows.map(toBangSanPhamLine),
                    bang_hang_loi: loiRows.map(row => ({ ten_loi: row.ten_loi.trim(), so_luong: row.so_luong.trim() })),
                    bang_ban_giao: banGiaoRows.map(row => {
                      const lay = parseNum(row.lay_trong_kho);
                      const dau = parseNum(row.ton_dau_ca);
                      const suDung = nvlUsageOf(row.material_id, row.ma_nvl);
                      return {
                        material_id: row.material_id,
                        ma_nvl: row.ma_nvl.trim(),
                        ten_nvl: row.ten_nvl.trim(),
                        ten_nvl_sx: row.ten_nvl_sx.trim(),
                        lay_trong_kho: round2(lay),
                        ton_dau_ca: round2(dau),
                        tong_su_dung: suDung,
                        ton_cuoi_ca: round2(lay + dau - suDung)
                      };
                    }),
                    tong_nvl: soTronSummary.tong_nvl,
                    tong_nhap_nvl: tongNhapTrongNgay,
                    tong_sp_co_mang: soTronSummary.tong_sp_co_mang,
                    tong_sp_khong_mang: soTronSummary.tong_sp_khong_mang,
                    tong_loi_hong: soTronSummary.tong_loi_hong,
                    chi_tieu_phan_tram: soTronSummary.chi_tieu_phan_tram,
                    ghi_chu: ghiChu.trim()
                  };
                  setPreviewPhieuGiaoCaReport(reportSnapshot);
                }}
                disabled={nvlRows.length === 0 && spRows.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
              >
                <Printer className="h-4 w-4" /> In phiếu giao ca
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50"
              >
                Phiếu mới
              </button>
            </div>
          </section>
          )}
        </div>
      )}

      {previewPhieuGiaoCaReport && (
        <PhieuGiaoCaModal
          open={!!previewPhieuGiaoCaReport}
          report={previewPhieuGiaoCaReport}
          onClose={() => setPreviewPhieuGiaoCaReport(null)}
          onSaved={updated => {
            setPreviewPhieuGiaoCaReport(null);
            loadReportToForm(updated);
          }}
        />
      )}
    </div>
  );
}

export default SoTronPanel;

export function SoTronListView({
  onBack,
  onCreate,
  onEdit
}: {
  onBack: () => void;
  onCreate: () => void;
  onEdit: (report: SoTronSavedReport) => void;
}) {
  const [reports, setReports] = useState<SoTronSavedReport[]>([]);
  const [selectedPhieuGiaoCa, setSelectedPhieuGiaoCa] = useState<SoTronSavedReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [shiftOptions, setShiftOptions] = useState<{ value: string; label: string }[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterCa, setFilterCa] = useState('');

  const load = async () => {
    setIsLoading(true);
    setMessage('');
    // Tải danh sách phiếu trước để trang hiển thị ngay khi vào (không chờ danh mục phụ).
    try {
      const reportRes = await fetch('/api/so-tron?limit=100');
      const reportData = await reportRes.json().catch(() => ({}));
      if (reportRes.ok) {
        setReports(normalizeSoTronReports(reportData));
      } else {
        setMessage(str(reportData.error) || 'Không thể tải danh sách sổ trộn.');
      }
    } catch {
      setMessage('Không thể tải danh sách sổ trộn.');
    } finally {
      setIsLoading(false);
    }
    // Danh mục máy + ca tải riêng, lỗi thì bỏ qua (không làm trắng danh sách).
    try {
      const [machineRes, settingRes] = await Promise.all([
        fetch('/api/danh-sach-may'),
        fetch('/api/cai-dat')
      ]);
      const [machineData, settingData] = await Promise.all([
        machineRes.json().catch(() => ({})),
        settingRes.json().catch(() => ({}))
      ]);
      if (machineRes.ok) {
        try {
          const list = normalizeMachines(machineData).filter(
            m => !m.branch || m.branch === '-' || /phú thọ/i.test(m.branch)
          );
          setMachines(list.length > 0 ? list : normalizeMachines(machineData));
        } catch {
          setMachines([]);
        }
      }
      if (settingRes.ok) {
        try {
          const options = getProductionShiftOptions(normalizeShiftSettings(settingData));
          setShiftOptions(options.length > 0 ? options : STANDARD_SHIFTS.map(s => ({ value: s, label: s })));
        } catch {
          setShiftOptions(STANDARD_SHIFTS.map(s => ({ value: s, label: s })));
        }
      } else {
        setShiftOptions(STANDARD_SHIFTS.map(s => ({ value: s, label: s })));
      }
    } catch {
      setShiftOptions(prev => (prev.length > 0 ? prev : STANDARD_SHIFTS.map(s => ({ value: s, label: s }))));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredReports = useMemo(() => {
    // Chưa chọn ngày thì không hiển thị gì (đúng yêu cầu: chọn ngày mới hiện danh sách).
    if (!filterDate) return [];
    return reports.filter(r => {
      if (r.ngay !== filterDate) return false;
      if (filterMachine) {
        const m = filterMachine.toLowerCase();
        if (!(r.ma_may?.toLowerCase().includes(m) || r.ten_may?.toLowerCase().includes(m))) return false;
      }
      if (filterCa && r.ca !== filterCa) return false;
      return true;
    });
  }, [reports, filterDate, filterMachine, filterCa]);

  const hasExtraFilter = Boolean(filterMachine || filterCa);
  const clearFilters = () => {
    setFilterMachine('');
    setFilterCa('');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa sổ trộn này?')) return;
    const res = await fetch(`/api/so-tron/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(str(data.error) || 'Không thể xóa sổ trộn.');
      return;
    }
    setReports(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">
            Danh sách sổ trộn
          </h2>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Nhập sổ trộn
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12.5px] font-semibold text-rose-700">
          {message}
        </div>
      )}

      <div className={`${cardClass} p-3`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Chọn Ngày:</label>
            <SoTronDatePicker value={filterDate} onChange={setFilterDate} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lọc theo máy:</label>
            <select value={filterMachine} onChange={e => setFilterMachine(e.target.value)} className={inputClass}>
              <option value="">-- Tất cả máy --</option>
              {machines.map(m => {
                const value = m.code || m.name;
                const label =
                  m.name && m.code && m.name !== m.code ? `${m.name} (${m.code})` : m.name || m.code;
                return (
                  <option key={m.id || value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lọc theo ca:</label>
            <select value={filterCa} onChange={e => setFilterCa(e.target.value)} className={inputClass}>
              <option value="">-- Tất cả ca --</option>
              {shiftOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <p className="text-[11.5px] font-semibold text-slate-500">
            {isLoading
              ? 'Đang tải...'
              : !filterDate
                ? 'Chọn ngày để xem danh sách sổ trộn'
                : `Ngày ${formatNgayVN(filterDate)}: ${filteredReports.length} phiếu`}
          </p>
          {hasExtraFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 transition hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" /> Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Đang tải danh sách...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="w-24 px-3 py-2">Ngày</th>
                  <th className="w-32 px-3 py-2">Máy</th>
                  <th className="w-20 px-3 py-2">Ca</th>
                  <th className="px-3 py-2">Lệnh SX</th>
                  <th className="px-3 py-2">Nhân sự</th>
                  <th className="w-[300px] px-3 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center font-semibold text-slate-400">
                      {!filterDate
                        ? 'Vui lòng chọn ngày để xem danh sách sổ trộn.'
                        : `Ngày ${formatNgayVN(filterDate)} chưa có sổ trộn nào phù hợp.`}
                    </td>
                  </tr>
                )}
                {filteredReports.map(report => (
                  <tr key={report.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 font-bold tabular-nums">{report.ngay}</td>
                    <td className="px-3 py-2 font-semibold">{report.ten_may || report.ma_may}</td>
                    <td className="px-3 py-2">{report.ca}</td>
                    <td className="px-3 py-2 text-slate-600">{report.lenh_sx.map(l => l.ma_lenh).join(', ')}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-600">{report.nhan_su}</td>
                    <td className="px-3 py-2">
                      <SoTronRowActions
                        onEdit={() => onEdit(report)}
                        onDelete={() => void handleDelete(report.id)}
                        onPrintGiaoCa={() => setSelectedPhieuGiaoCa(report)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPhieuGiaoCa && (
        <PhieuGiaoCaModal
          open={!!selectedPhieuGiaoCa}
          report={selectedPhieuGiaoCa}
          onClose={() => setSelectedPhieuGiaoCa(null)}
          onSaved={updated => {
            setReports(prev => prev.map(r => (r.id === updated.id ? updated : r)));
            setSelectedPhieuGiaoCa(updated);
          }}
        />
      )}
    </div>
  );
}

export { PhieuGiaoCaModal } from './PhieuGiaoCaModal';
export { printPhieuGiaoCaSlip } from './printPhieuGiaoCa';

