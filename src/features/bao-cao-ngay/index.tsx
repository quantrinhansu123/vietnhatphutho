import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Eye, Loader2, Pencil, Plus, Printer, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { BackButton } from '../../components/layout/NavButtons';
import { SoTronDatePicker, formatNgayVN } from '../so-tron/SoTronDatePicker';
import { SearchableSelect } from '../../components/shared/SearchableSelect';
import { normalizeProducts } from '../san-pham';
import type { ProductRow } from '../san-pham/types';
import { normalizeMaterialsInventory, type MaterialRow } from '../kho-nvl';

// =========================================================================
// BÁO CÁO NGÀY — tổng hợp từ sổ trộn, 1 ngày = 1 báo cáo, soft delete.
// UI đồng nhất các trang khác: card trắng + SectionHeader + bảng slate 표준.
// =========================================================================

export interface BaoCaoNgayThanhPhamLine {
  /** Id sản phẩm trong danh mục `san_pham` (search theo mã AMIS + ten_ghep) */
  san_pham_id: string;
  /** Tên hiển thị (ten_ghep) */
  ma_hang: string;
  so_luong: number;
  trong_luong: number;
}

export interface BaoCaoNgayPheLine {
  loai_phe: string;
  so_luong: number;
  dot: string;
}

export interface BaoCaoNgayVatTuLine {
  /** Id vật tư trong kho NVL (`kho_nvl`, search theo mã + tên SX/tên SP) */
  material_id: string;
  ma_nvl: string;
  ten_nvl: string;
  ton_dau_ngay: number;
  nhap_vt: number;
  ton_trong_ngay: number;
  hao_hut: number;
  /** Tổng sử dụng trong ngày theo sổ trộn (Σ tong_su_dung) — dùng tính lại tồn/hao */
  su_dung?: number;
}

/** 1 dòng ca trong bảng Hao hụt thống kê (theo máy + ca, tổng hợp từ sổ trộn). */
export interface BaoCaoNgayHaoHutCaLine {
  ca: string;
  truong_ca: string;
  /** Ứng viên Trưởng ca từ sổ trộn (vai trò Trưởng ca trước, rồi tới cả tổ) — chọn lại bằng dropdown */
  truong_ca_options: string[];
  /** Số kg hao hụt âm trong ca (tự tổng hợp, cho sửa tay) */
  hao_hut_am: string;
  /** Số kg TP đạt trong ca = Σ trọng lượng SP (tự tổng hợp, cho sửa tay) */
  tp_dat: string;
  /** Số kg Phế trong ca = Σ hàng lỗi (tự tổng hợp, cho sửa tay) */
  phe_kg: string;
  /** Các dòng ghi chép còn lại (NKSX, Trong ca, tự thêm) — cho thêm/xóa tay */
  ghi_chep: string[];
  /** Chỉ 'Đạt' | 'Không đạt' */
  danh_gia: string;
}

/** 1 máy trong bảng Hao hụt thống kê (SL mục tiêu nhập tay). */
export interface BaoCaoNgayHaoHutMayGroup {
  ma_may: string;
  ten_may: string;
  muc_tieu: string;
  rows: BaoCaoNgayHaoHutCaLine[];
}

export interface BaoCaoNgaySavedReport {
  id: string;
  chi_nhanh: string;
  ngay: string;
  /** Giữ tương thích bản ghi cũ (đã bỏ khỏi UI) */
  nhan_su_c1?: string;
  thanh_pham: BaoCaoNgayThanhPhamLine[];
  phe_hong: BaoCaoNgayPheLine[];
  vat_tu: BaoCaoNgayVatTuLine[];
  tong_thanh_pham_so_luong: number;
  tong_thanh_pham_trong_luong: number;
  tong_phe: number;
  tong_nhap_vt: number;
  tong_ton_trong_ngay: number;
  tong_hao_hut: number;
  ghi_chu: string;
  /** Hao hụt thống kê theo máy/ca (tab 2, tổng hợp từ sổ trộn, SL mục tiêu + ghi chép nhập tay) */
  hao_hut_thong_ke: BaoCaoNgayHaoHutMayGroup[];
  /** Ghi chú chung dưới bảng Hao hụt thống kê (tab 2) */
  hao_hut_ghi_chu: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

type EditThanhPhamRow = { key: string; san_pham_id: string; ma_hang: string; so_luong: string; trong_luong: string };
type EditPheRow = { key: string; loai_phe: string; so_luong: string; dot: string };
type EditVatTuRow = {
  key: string;
  material_id: string;
  ma_nvl: string;
  ten_nvl: string;
  ton_dau_ngay: string;
  nhap_vt: string;
  su_dung: number;
  ton_trong_ngay: string;
  hao_hut: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function fmtInput(value: number) {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  return String(round2(value));
}

function fmtVN(value: number) {
  if (!Number.isFinite(value)) return '0';
  return round2(value).toLocaleString('vi-VN');
}

function normalizeCaKey(ca: string) {
  return str(ca).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Ca đầu ngày dùng lấy tồn đầu: 12C1 / HC1 (chuẩn hóa bỏ ký tự đặc biệt) */
function isCaDauNgay(ca: string) {
  const key = normalizeCaKey(ca);
  if (!key) return false;
  return key.includes('12c1') || key.includes('hc1');
}

// --- Tìm kiếm SP / NVL trong bảng nhập (lưu đúng id danh mục) ---

/** Nhãn SP: ưu tiên ten_ghep, kèm mã AMIS để phân biệt */
function productDisplayLabel(p: ProductRow) {
  const tenGhep = str(p.tenGhep) || str(p.productionName) || str(p.name);
  const amis = str(p.amisCode) || str(p.code);
  if (tenGhep && amis && !tenGhep.toLowerCase().includes(amis.toLowerCase())) return `${amis} — ${tenGhep}`;
  return tenGhep || amis || str(p.code);
}

/** Search SP theo mã AMIS + ten_ghep (+ các mã khác) */
function productSearchText(p: ProductRow) {
  return `${p.amisCode || ''} ${p.tenGhep || ''} ${p.code || ''} ${p.newCode || ''} ${p.name || ''} ${p.productionName || ''}`;
}

function resolveProductByText(list: ProductRow[], raw: string): ProductRow | null {
  const byId = list.find(p => p.id === raw);
  if (byId) return byId;
  const norm = str(raw).toLowerCase();
  if (!norm) return null;
  return list.find(p =>
    str(p.tenGhep).toLowerCase() === norm ||
    str(p.amisCode).toLowerCase() === norm ||
    str(p.code).toLowerCase() === norm ||
    str(p.newCode).toLowerCase() === norm
  ) ?? null;
}

/** Nhãn NVL: mã + tên SX (fallback tên SP) */
function materialDisplayLabel(m: MaterialRow) {
  const ten = str(m.productionName) || str(m.name);
  if (str(m.code) && ten && ten !== m.code) return `${m.code} — ${ten}`;
  return ten || str(m.code);
}

/** Search NVL theo mã + tên SX/tên SP */
function materialSearchText(m: MaterialRow) {
  return `${m.code || ''} ${m.name || ''} ${m.productionName || ''}`;
}

function resolveMaterialByText(list: MaterialRow[], raw: string): MaterialRow | null {
  const byId = list.find(m => m.id === raw);
  if (byId) return byId;
  const norm = str(raw).toLowerCase();
  if (!norm) return null;
  return list.find(m =>
    str(m.code).toLowerCase() === norm ||
    str(m.productionName).toLowerCase() === norm ||
    str(m.name).toLowerCase() === norm
  ) ?? null;
}

// --- UI dùng chung (đồng nhất so-tron / báo cáo tuần) ---
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20';
const numInputClass = `${inputClass} text-right tabular-nums`;
const labelClass = 'mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500';
const cardClass = 'rounded-xl border border-slate-200 bg-white shadow-card';
const sectionTitleClass = 'font-display text-[14px] font-semibold tracking-tight text-slate-900';
const thClass =
  'border-b border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500';
const tdClass = 'border-b border-slate-100 px-2 py-1.5 last:border-b-0';
const totalCellClass = 'px-2 py-2 text-right font-bold tabular-nums text-slate-900';

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

export function normalizeBaoCaoNgayReports(data: unknown): BaoCaoNgaySavedReport[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? ((data as Record<string, unknown>).reports as unknown)
      : [];
  if (!Array.isArray(list)) return [];
  return list.map((item): BaoCaoNgaySavedReport => {
    const r = (item || {}) as Record<string, unknown>;
    const asNumField = (v: unknown) => {
      const n = Number(String(v ?? '').trim().replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const tp = Array.isArray(r.thanh_pham) ? (r.thanh_pham as Record<string, unknown>[]).map(x => ({
      san_pham_id: str(x.san_pham_id ?? x.sanPhamId),
      ma_hang: str(x.ma_hang ?? x.maHang),
      so_luong: asNumField(x.so_luong ?? x.soLuong),
      trong_luong: asNumField(x.trong_luong ?? x.trongLuong)
    })) : [];
    const phe = Array.isArray(r.phe_hong) ? (r.phe_hong as Record<string, unknown>[]).map(x => ({
      loai_phe: str(x.loai_phe ?? x.loaiPhe),
      so_luong: asNumField(x.so_luong ?? x.soLuong),
      dot: str(x.dot ?? x.dot_batch ?? x.v4nd)
    })) : [];
    const vt = Array.isArray(r.vat_tu) ? (r.vat_tu as Record<string, unknown>[]).map(x => ({
      material_id: str(x.material_id ?? x.materialId),
      ma_nvl: str(x.ma_nvl ?? x.maNvl),
      ten_nvl: str(x.ten_nvl ?? x.tenNvl),
      ton_dau_ngay: asNumField(x.ton_dau_ngay ?? x.tonDauNgay),
      nhap_vt: asNumField(x.nhap_vt ?? x.nhapVt),
      ton_trong_ngay: asNumField(x.ton_trong_ngay ?? x.tonTrongNgay),
      hao_hut: asNumField(x.hao_hut ?? x.haoHut),
      su_dung: asNumField(x.su_dung ?? x.suDung)
    })) : [];
    const rawHaoHut = r.hao_hut_thong_ke ?? (r as unknown as Record<string, unknown>).haoHutThongKe;
    const haoHutParsed: unknown[] = Array.isArray(rawHaoHut)
      ? rawHaoHut
      : typeof rawHaoHut === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(rawHaoHut);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [];
    const hao_hut_thong_ke: BaoCaoNgayHaoHutMayGroup[] = haoHutParsed.map(g => {
      const gg = (g || {}) as Record<string, unknown>;
      const rowsRaw = Array.isArray(gg.rows) ? (gg.rows as Record<string, unknown>[]) : [];
      return {
        ma_may: str(gg.ma_may ?? gg.maMay),
        ten_may: str(gg.ten_may ?? gg.tenMay),
        muc_tieu: str(gg.muc_tieu ?? gg.mucTieu),
        rows: rowsRaw.map(rr => {
          const gcRaw = Array.isArray(rr.ghi_chep ?? rr.ghiChep)
            ? ((rr.ghi_chep ?? rr.ghiChep) as unknown[])
            : [];
          const leftovers: string[] = [];
          let haoAm = str(rr.hao_hut_am ?? rr.haoHutAm);
          let tpDat = str(rr.tp_dat ?? rr.tpDat);
          let pheKg = str(rr.phe_kg ?? rr.pheKg);
          // Tương thích bản ghi cũ: bóc số từ dòng text "Hao hụt âm Xkg" / "TP đạt Ykg. Phế Zkg".
          for (const raw of gcRaw) {
            const line = str(raw);
            if (!line) continue;
            if (haoAm === '') {
              const m = /hao\s*hụt\s*âm\s*(-?[\d.,]+)\s*kg/i.exec(line);
              if (m) {
                haoAm = m[1].replace(',', '.');
                continue;
              }
            }
            if (tpDat === '' || pheKg === '') {
              const m = /TP\s*đạt\s*([\d.,]+)\s*kg.*Phế\s*([\d.,]+)\s*kg/i.exec(line);
              if (m) {
                if (tpDat === '') tpDat = m[1].replace(',', '.');
                if (pheKg === '') pheKg = m[2].replace(',', '.');
                continue;
              }
            }
            leftovers.push(line);
          }
          const optsRaw = rr.truong_ca_options ?? rr.truongCaOptions;
          return {
            ca: str(rr.ca),
            truong_ca: str(rr.truong_ca ?? rr.truongCa),
            truong_ca_options: Array.isArray(optsRaw)
              ? (optsRaw as unknown[]).map(x => str(x)).filter(x => x !== '')
              : [],
            hao_hut_am: haoAm === '' ? '0' : haoAm,
            tp_dat: tpDat === '' ? '0' : tpDat,
            phe_kg: pheKg === '' ? '0' : pheKg,
            ghi_chep: leftovers,
            danh_gia: normalizeDanhGia(rr.danh_gia ?? rr.danhGia)
          };
        }).filter(rr => rr.ca || rr.truong_ca || rr.ghi_chep.length > 0 || rr.danh_gia || rr.tp_dat !== '0' || rr.phe_kg !== '0')
      };
    }).filter(g => g.ma_may || g.ten_may || g.rows.length > 0);
    return {
      id: str(r.id),
      chi_nhanh: str(r.chi_nhanh) || 'Phú Thọ',
      ngay: str(r.ngay).slice(0, 10),
      nhan_su_c1: str(r.nhan_su_c1),
      thanh_pham: tp,
      phe_hong: phe,
      vat_tu: vt,
      tong_thanh_pham_so_luong: asNumField(r.tong_thanh_pham_so_luong),
      tong_thanh_pham_trong_luong: asNumField(r.tong_thanh_pham_trong_luong),
      tong_phe: asNumField(r.tong_phe),
      tong_nhap_vt: asNumField(r.tong_nhap_vt),
      tong_ton_trong_ngay: asNumField(r.tong_ton_trong_ngay),
      tong_hao_hut: asNumField(r.tong_hao_hut),
      ghi_chu: str(r.ghi_chu),
      hao_hut_thong_ke,
      hao_hut_ghi_chu: str(r.hao_hut_ghi_chu ?? (r as Record<string, unknown>).haoHutGhiChu),
      deleted_at: (r.deleted_at as string | null) ?? null,
      created_at: str(r.created_at),
      updated_at: str(r.updated_at)
    };
  }).filter(r => r.id && r.ngay);
}

export interface SoTronDayRecord {
  id: string;
  ngay: string;
  ma_may: string;
  ten_may: string;
  ca: string;
  nhan_su?: unknown;
  nhan_su_chi_tiet?: unknown;
  ghi_chu?: unknown;
  tong_nvl: number;
  tong_nhap_nvl?: number;
  tong_loi_hong?: unknown;
  bang_nvl?: { lan?: unknown[]; tong?: unknown }[];
  bang_san_pham?: { ma_sp?: unknown; ten_sp?: unknown; ten_ghep?: unknown; tenGhep?: unknown; so_luong?: unknown; trong_luong?: unknown }[];
  bang_hang_loi?: { ten_loi?: unknown; so_luong?: unknown }[];
  bang_ban_giao?: {
    material_id?: unknown;
    ma_nvl?: unknown;
    ten_nvl?: unknown;
    ten_nvl_sx?: unknown;
    lay_trong_kho?: unknown;
    ton_dau_ca?: unknown;
    tong_su_dung?: unknown;
    ton_cuoi_ca?: unknown;
  }[];
}

/**
 * Suy luận mapping sổ trộn → báo cáo ngày (theo logic đã chốt):
 *
 * - Danh sách sản phẩm: gom `bang_san_pham` mọi phiếu trong ngày theo mã SP
 *   (`ma_sp` fallback `ten_sp`), Σ `so_luong` + Σ `trong_luong`. Cột Mã hàng
 *   hiển thị **`ten_ghep`** danh mục SP (tra theo mã SP), thiếu mới fallback
 *   `ten_sp` trong phiếu rồi tới mã SP.
 * - Danh sách phế hỏng trong ca: gom `bang_hang_loi` theo `ten_loi`, Σ `so_luong`
 *   (cột Đợt không có trong sổ trộn → để trống, nhập tay sau).
 * - Vật tư theo từng NVL (gộp theo `material_id` fallback `ma_nvl`):
 *   + Tồn đầu ngày = Σ `ton_dau_ca` của các phiếu ca 12C1/HC1 trong ngày
 *     (không thấy ca này thì Σ `ton_dau_ca` toàn ngày).
 *   + Nhập VT (kg) = Σ `lay_trong_kho` (Nhập Trong Ngày) toàn ngày.
 *   + Sử dụng (kg) = Σ `tong_su_dung` toàn ngày (tổng Σ này đối chiếu với Σ `tong_nvl`).
 *   + Tồn trong ngày = Tồn đầu + Nhập − Sử dụng.
 *   + Hao hụt = Tồn đầu + Nhập − Tồn trong (= Sử dụng khi để tự động).
 */
export interface BaoCaoNgaySoTronCatalogs {
  /** mã SP (lowercase, gồm code/amis/newCode) → ten_ghep hiển thị */
  tenGhepByCode?: Map<string, string>;
  /** mã SP (lowercase) → id `san_pham` */
  productIdByCode?: Map<string, string>;
  /** mã NVL (lowercase) → id `kho_nvl` */
  materialIdByCode?: Map<string, string>;
}

export function buildBaoCaoNgayFromSoTron(records: SoTronDayRecord[], catalogs?: BaoCaoNgaySoTronCatalogs) {
  const tenGhepMap = catalogs?.tenGhepByCode;
  const productIdByCode = catalogs?.productIdByCode;
  const materialIdByCode = catalogs?.materialIdByCode;
  const tpMap = new Map<string, { san_pham_id: string; ma_hang: string; so_luong: number; trong_luong: number }>();
  const pheMap = new Map<string, { loai_phe: string; so_luong: number }>();
  const vtMap = new Map<string, {
    material_id: string;
    ma_nvl: string;
    ten_nvl: string;
    ton_dau_ngay: number;
    nhap_vt: number;
    su_dung: number;
  }>();

  const hasCaDau = records.some(r => isCaDauNgay(r.ca || ''));

  for (const r of records) {
    // --- Thành phẩm: bang_san_pham (hiển thị ten_ghep, gộp theo mã SP) ---
    if (Array.isArray(r.bang_san_pham)) {
      for (const line of r.bang_san_pham) {
        const maSp = str(line.ma_sp);
        const tenSp = str(line.ten_sp);
        const key = (maSp || tenSp).toLowerCase();
        if (!key) continue;
        const tenGhep = str(line.ten_ghep ?? line.tenGhep)
          || (maSp ? (tenGhepMap?.get(maSp.toLowerCase()) ?? '') : '')
          || tenSp
          || maSp;
        const sanPhamId = maSp ? (productIdByCode?.get(maSp.toLowerCase()) ?? '') : '';
        const cur = tpMap.get(key) ?? { san_pham_id: sanPhamId, ma_hang: tenGhep, so_luong: 0, trong_luong: 0 };
        if (!cur.san_pham_id && sanPhamId) cur.san_pham_id = sanPhamId;
        if ((!cur.ma_hang || cur.ma_hang === maSp) && tenGhep) cur.ma_hang = tenGhep;
        cur.so_luong = round2(cur.so_luong + parseNum(line.so_luong));
        cur.trong_luong = round2(cur.trong_luong + parseNum(line.trong_luong));
        tpMap.set(key, cur);
      }
    }
    // --- Phế hỏng: bang_hang_loi ---
    if (Array.isArray(r.bang_hang_loi)) {
      for (const line of r.bang_hang_loi) {
        const loai = str(line.ten_loi);
        if (!loai) continue;
        const key = loai.toLowerCase();
        const cur = pheMap.get(key) ?? { loai_phe: loai, so_luong: 0 };
        cur.so_luong = round2(cur.so_luong + parseNum(line.so_luong));
        pheMap.set(key, cur);
      }
    }
    // --- Vật tư: bang_ban_giao ---
    if (Array.isArray(r.bang_ban_giao)) {
      const useTonDau = !hasCaDau || isCaDauNgay(r.ca || '');
      for (const line of r.bang_ban_giao) {
        const maNvl = str(line.ma_nvl) || str(line.material_id);
        const tenNvl = str(line.ten_nvl_sx) || str(line.ten_nvl) || maNvl;
        if (!maNvl && !tenNvl) continue;
        const key = (str(line.material_id) || maNvl || tenNvl).toLowerCase();
        const materialId = str(line.material_id)
          || (maNvl ? (materialIdByCode?.get(maNvl.toLowerCase()) ?? '') : '');
        const cur = vtMap.get(key) ?? { material_id: materialId, ma_nvl: maNvl, ten_nvl: tenNvl, ton_dau_ngay: 0, nhap_vt: 0, su_dung: 0 };
        if (!cur.material_id && materialId) cur.material_id = materialId;
        if (!cur.ma_nvl && maNvl) cur.ma_nvl = maNvl;
        if ((!cur.ten_nvl || cur.ten_nvl === cur.ma_nvl) && tenNvl) cur.ten_nvl = tenNvl;
        cur.nhap_vt = round2(cur.nhap_vt + parseNum(line.lay_trong_kho));
        if (useTonDau) cur.ton_dau_ngay = round2(cur.ton_dau_ngay + parseNum(line.ton_dau_ca));
        cur.su_dung = round2(cur.su_dung + parseNum(line.tong_su_dung));
        vtMap.set(key, cur);
      }
    }
  }

  const thanh_pham: BaoCaoNgayThanhPhamLine[] = [...tpMap.values()].sort((a, b) => a.ma_hang.localeCompare(b.ma_hang, 'vi'));
  const phe_hong: BaoCaoNgayPheLine[] = [...pheMap.values()]
    .sort((a, b) => a.loai_phe.localeCompare(b.loai_phe, 'vi'))
    .map(p => ({ ...p, dot: '' }));
  const vat_tu: BaoCaoNgayVatTuLine[] = [...vtMap.values()]
    .sort((a, b) => (a.ten_nvl || a.ma_nvl).localeCompare(b.ten_nvl || b.ma_nvl, 'vi'))
    .map(v => {
      const tonTrong = round2(v.ton_dau_ngay + v.nhap_vt - v.su_dung);
      const hao = round2(v.ton_dau_ngay + v.nhap_vt - tonTrong);
      return {
        material_id: v.material_id,
        ma_nvl: v.ma_nvl,
        ten_nvl: v.ten_nvl,
        ton_dau_ngay: v.ton_dau_ngay,
        nhap_vt: v.nhap_vt,
        ton_trong_ngay: tonTrong,
        hao_hut: hao,
        su_dung: v.su_dung
      };
    });
  const tongSuDung = round2(vat_tu.reduce((s, v) => s + (Number(v.su_dung) || 0), 0));

  return { thanh_pham, phe_hong, vat_tu, hasCaDau, tongSuDung };
}

// --- Hao hụt thống kê: tổng hợp từ sổ trộn theo máy, theo ca ---

export const DANH_GIA_OPTIONS = ['Đạt', 'Không đạt'] as const;

type EditHaoHutLine = { key: string; text: string };
type EditHaoHutCaRow = {
  key: string;
  ca: string;
  truong_ca: string;
  truong_ca_options: string[];
  hao_hut_am: string;
  tp_dat: string;
  phe_kg: string;
  ghi_chep: EditHaoHutLine[];
  danh_gia: string;
};
type EditHaoHutMayGroup = { key: string; ma_may: string; ten_may: string; muc_tieu: string; rows: EditHaoHutCaRow[] };

/** Kg hiển thị trong dòng ghi chép mặc định (2348, không phân cách hàng nghìn như mẫu giấy). */
function fmtKg(value: number) {
  const v = round2(value);
  return Number.isInteger(v) ? String(v) : String(v);
}

/** Chuẩn hóa đánh giá về 1 trong 2 giá trị 'Đạt' | 'Không đạt'. */
function normalizeDanhGia(value: unknown): string {
  const v = str(value);
  if (/không\s*đạt/i.test(v)) return 'Không đạt';
  return 'Đạt';
}

/** Ngày ISO → "27/8/2026" như tiêu đề mẫu giấy. */
function formatNgayGachCheo(iso: string) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${Number(parts[2])}/${Number(parts[1])}/${parts[0]}`;
}

// ---------------------------------------------------------------------------
// Trưởng ca: truy vấn lại từ lịch phân công theo ngày/máy/ca.
// Nguồn gốc nhân sự là bảng `phan_cong_nhan_su_chi_tiet` (tab Sắp xếp lịch làm
// việc). Sổ trộn cũng chỉ tra từ đó rồi nhúng vào phiếu (`nhan_su` là tên cả
// tổ gộp phẩy, `nhan_su_chi_tiet` có vai_tro) — phiếu cũ/ca chưa phân công thì
// cả hai đều rỗng nên tab Hao hụt không có gì để hiện. Vì vậy báo cáo ngày tự
// tra lại `GET /api/phan-cong-nhan-su?ngay_lam_viec&ca` (server đã lọc ca chuẩn
// hóa) + resolve tên qua `/api/nhan-su`, rồi hợp nhất với dữ liệu nhúng.
// ---------------------------------------------------------------------------

type PhanCongRecord = Record<string, unknown>;

function normMachineKey(value: unknown) {
  return str(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function staffComboKey(maMay: string, tenMay: string, ca: string) {
  return `${(str(maMay) || str(tenMay)).toLowerCase()}|||${str(ca).toLowerCase()}`;
}

/** Khớp dòng phân công với máy của phiếu (theo mã hoặc tên, nới lỏng chứa nhau như sổ trộn). */
function phanCongMatchesMachine(item: PhanCongRecord, maMay: string, tenMay: string) {
  const code = normMachineKey(maMay);
  const name = normMachineKey(tenMay);
  const iCode = normMachineKey(item.ma_may);
  const iName = normMachineKey(item.may);
  if (code && (iCode === code || iName === code)) return true;
  if (name && (iCode === name || iName === name)) return true;
  const rawCode = str(maMay).toLowerCase();
  const rawName = str(tenMay).toLowerCase();
  const rawICode = str(item.ma_may).toLowerCase();
  const rawIName = str(item.may).toLowerCase();
  for (const ref of [rawCode, rawName]) {
    if (!ref || ref === '-') continue;
    for (const key of [rawICode, rawIName]) {
      if (!key) continue;
      if (ref.includes(key) || key.includes(ref)) return true;
    }
  }
  return false;
}

function pickStaffText(record: PhanCongRecord, keys: string[]) {
  for (const key of keys) {
    const value = str(record[key]);
    if (value && value !== '-') return value;
  }
  return '';
}

/** Mã → tên nhân viên từ danh mục (giống sổ trộn: format=groups + by-code bù thiếu). */
function normalizeStaffDirectory(data: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const visitMember = (item: unknown) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    const code = pickStaffText(record, ['ma_nhan_su', 'ma_nv', 'code', 'id']);
    const name = pickStaffText(record, ['ten_nhan_su', 'ho_ten', 'ten', 'name']);
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

let staffDirPromise: Promise<Map<string, string>> | null = null;

/** Danh mục mã → tên nhân viên, tải 1 lần rồi cache (dùng chung các lần tra). */
function loadStaffDirectory(): Promise<Map<string, string>> {
  if (!staffDirPromise) {
    staffDirPromise = (async () => {
      try {
        const res = await fetch('/api/nhan-su?format=groups&scope=all');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return new Map<string, string>();
        return normalizeStaffDirectory(data);
      } catch {
        return new Map<string, string>();
      }
    })();
  }
  return staffDirPromise;
}

/** Bù tên cho các mã chưa có trong danh mục (tối đa 200 mã như sổ trộn). */
async function resolveStaffNames(dir: Map<string, string>, codes: string[]): Promise<Map<string, string>> {
  const merged = new Map(dir);
  const missing = [...new Set(codes.map(c => str(c)).filter(Boolean))].filter(
    code => !merged.has(code) && !merged.has(code.toLowerCase())
  );
  if (missing.length === 0) return merged;
  try {
    const res = await fetch(`/api/nhan-su/by-code?codes=${encodeURIComponent(missing.join(','))}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && typeof (data as { names?: unknown }).names === 'object') {
      for (const [code, name] of Object.entries((data as { names: Record<string, unknown> }).names)) {
        const text = str(name);
        if (!text) continue;
        merged.set(code, text);
        merged.set(code.toLowerCase(), text);
      }
    }
  } catch {
    /* bỏ qua, dùng mã thay tên */
  }
  return merged;
}

function staffNameOf(item: PhanCongRecord, dir: Map<string, string>) {
  const direct = pickStaffText(item, ['ten_nhan_su', 'ho_ten', 'ten', 'name']);
  if (direct) return direct;
  const ma = pickStaffText(item, ['ma_nhan_su', 'ma_nv', 'code']);
  if (!ma) return '';
  return dir.get(ma) ?? dir.get(ma.toLowerCase()) ?? ma;
}

function isTruongCaRole(item: PhanCongRecord) {
  return isTruongCaRoleText(pickStaffText(item, ['vai_tro', 'role', 'chuc_vu']));
}

/** Vai trò có phải Trưởng ca không (không dấu vẫn nhận: "Truong ca"). */
function isTruongCaRoleText(value: unknown) {
  const v = str(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  return v.includes('truong');
}

/**
 * Tra Trưởng ca từ lịch phân công cho các combo máy+ca trong ngày.
 * Trả về Map comboKey → danh sách tên (vai trò Trưởng ca trước, rồi tới cả tổ).
 * Lỗi mạng → Map rỗng (báo cáo vẫn dùng dữ liệu nhúng trong sổ trộn).
 */
async function fetchTruongCaOptions(
  ngay: string,
  combos: { ma_may: string; ten_may: string; ca: string }[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const target = str(ngay).slice(0, 10);
  const valid = combos.filter(c => str(c.ca));
  if (!target || valid.length === 0) return result;
  try {
    const cas = [...new Set(valid.map(c => str(c.ca)))];
    const settled = await Promise.all(cas.map(async ca => {
      try {
        const params = new URLSearchParams({ ngay_lam_viec: target, ca });
        const res = await fetch(`/api/phan-cong-nhan-su?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        const items = res.ok && data && Array.isArray((data as { items?: unknown }).items)
          ? ((data as { items: unknown[] }).items as PhanCongRecord[])
          : [];
        return { ca, items };
      } catch {
        return { ca, items: [] as PhanCongRecord[] };
      }
    }));
    const byCa = new Map(settled.map(s => [s.ca.toLowerCase(), s.items]));
    const dir = await loadStaffDirectory();
    const codes = settled.flatMap(s => s.items.map(it => pickStaffText(it, ['ma_nhan_su', 'ma_nv', 'code'])));
    const full = await resolveStaffNames(dir, codes);
    for (const combo of valid) {
      const items = byCa.get(str(combo.ca).toLowerCase()) ?? [];
      const leaders: string[] = [];
      const others: string[] = [];
      for (const item of items) {
        if (!phanCongMatchesMachine(item, combo.ma_may, combo.ten_may)) continue;
        const name = staffNameOf(item, full);
        if (!name) continue;
        (isTruongCaRole(item) ? leaders : others).push(name);
      }
      // Dropdown chỉ hiện vai trò Trưởng ca; chưa xếp ai làm trưởng ca thì
      // fallback cả tổ để không kẹt (vẫn chọn được tay).
      const picked = leaders.length > 0 ? leaders : others;
      const options: string[] = [];
      for (const name of picked) {
        if (!options.some(x => x.toLowerCase() === name.toLowerCase())) options.push(name);
      }
      if (options.length > 0) result.set(staffComboKey(combo.ma_may, combo.ten_may, combo.ca), options);
    }
  } catch {
    /* bỏ qua, dùng dữ liệu nhúng trong sổ trộn */
  }
  return result;
}

/** Hợp ứng viên tra lại vào danh sách có sẵn (tra lại lên trước vì đã xếp vai trò). */
function unionTruongCaOptions(existing: string[], fresh: string[]) {
  const merged = [...fresh];
  for (const name of existing) {
    if (!merged.some(x => x.toLowerCase() === name.toLowerCase())) merged.push(name);
  }
  return merged;
}

function truongCaFromSoTron(r: SoTronDayRecord): { name: string; options: string[] } {
  const raw = (r as unknown as Record<string, unknown>);
  // Tên trong chi tiết phân công — dropdown chỉ hiện vai trò Trưởng ca.
  const leaders: string[] = [];
  const others: string[] = [];
  const detail = raw.nhan_su_chi_tiet;
  if (Array.isArray(detail)) {
    for (const item of detail) {
      const o = (item || {}) as Record<string, unknown>;
      const name = str(o.ten ?? o.ten_nhan_su ?? o.ho_ten ?? o.ma_nhan_su);
      if (!name) continue;
      if (isTruongCaRoleText(o.vai_tro ?? o.role ?? o.chuc_vu)) leaders.push(name);
      else others.push(name);
    }
  }
  // `nhan_su` là tên đã resolve đủ cả tổ (VD "Quy, Luyên, ...") — không rõ vai
  // trò nên chỉ dùng fallback khi chưa tìm được trưởng ca nào.
  const extra = str(raw.nhan_su)
    .split(',')
    .map(part => str(part))
    .filter(Boolean);
  const picked = leaders.length > 0 ? leaders : [...others, ...extra];
  const options: string[] = [];
  for (const name of picked) {
    if (!options.some(x => x.toLowerCase() === name.toLowerCase())) options.push(name);
  }
  // Có 2 trưởng ca thì lấy người đầu tiên; người dùng chọn lại bằng dropdown.
  return { name: options[0] ?? '', options };
}

/**
 * Tổng hợp Hao hụt thống kê từ sổ trộn theo máy + ca:
 * - Mỗi máy (ma_may fallback ten_may) = 1 bảng; mỗi phiếu (ca) = 1 dòng.
 * - TP đạt = Σ trong_luong bang_san_pham trong ca; Phế = Σ so_luong bang_hang_loi
 *   (trống thì fallback tong_loi_hong của phiếu). Cả 2 đều là ô nhập tay.
 * - Hao hụt âm = Σ (ton_dau_ca + lay_trong_kho − tong_su_dung − ton_cuoi_ca) trong ca (ô nhập tay).
 * - Trưởng ca = trưởng ca của máy+ca+ngày (dropdown chỉ hiện vai trò Trưởng ca,
 *   chưa xếp thì fallback cả tổ để vẫn chọn được tay), chọn lại bằng dropdown.
 *   `staffOptions` (tra lại từ lịch phân công) được hợp nhất lên trước vì đã xếp vai trò mới nhất.
 */
export function buildHaoHutThongKeFromSoTron(
  records: SoTronDayRecord[],
  staffOptions?: Map<string, string[]>
): BaoCaoNgayHaoHutMayGroup[] {
  const byMay = new Map<string, { ma_may: string; ten_may: string; recs: SoTronDayRecord[] }>();
  for (const r of records) {
    const maMay = str(r.ma_may);
    const tenMay = str(r.ten_may);
    const key = (maMay || tenMay || str(r.id)).toLowerCase();
    if (!key) continue;
    const cur = byMay.get(key) ?? { ma_may: maMay, ten_may: tenMay, recs: [] };
    if (!cur.ma_may && maMay) cur.ma_may = maMay;
    if (!cur.ten_may && tenMay) cur.ten_may = tenMay;
    cur.recs.push(r);
    byMay.set(key, cur);
  }
  const groups: BaoCaoNgayHaoHutMayGroup[] = [...byMay.values()]
    .sort((a, b) => (a.ten_may || a.ma_may).localeCompare(b.ten_may || b.ma_may, 'vi'))
    .map(g => {
      const rows = [...g.recs]
        .sort((a, b) => str(a.ca).localeCompare(str(b.ca), 'vi'))
        .map((r): BaoCaoNgayHaoHutCaLine => {
          const tpKg = Array.isArray(r.bang_san_pham)
            ? round2(r.bang_san_pham.reduce((s, l) => s + parseNum(l.trong_luong), 0))
            : 0;
          let pheKg = Array.isArray(r.bang_hang_loi)
            ? round2(r.bang_hang_loi.reduce((s, l) => s + parseNum(l.so_luong), 0))
            : 0;
          if (pheKg === 0) {
            const fallback = parseNum((r as unknown as Record<string, unknown>).tong_loi_hong);
            if (fallback !== 0) pheKg = round2(fallback);
          }
          const haoAm = Array.isArray(r.bang_ban_giao)
            ? round2(r.bang_ban_giao.reduce((s, l) => {
                const dau = parseNum(l.ton_dau_ca);
                const nhap = parseNum(l.lay_trong_kho);
                const suDung = parseNum(l.tong_su_dung);
                const cuoi = parseNum(l.ton_cuoi_ca);
                return s + dau + nhap - suDung - cuoi;
              }, 0))
            : 0;
          const truongCa = truongCaFromSoTron(r);
          const maMay = str(r.ma_may);
          const tenMay = str(r.ten_may);
          const fresh = staffOptions?.get(staffComboKey(maMay, tenMay, str(r.ca))) ?? [];
          // Ưu tiên người tra lại từ lịch phân công đúng máy+ca+ngày (đã xếp vai
          // trò Trưởng ca lên trước); dữ liệu nhúng trong phiếu chỉ fallback.
          const options = unionTruongCaOptions(truongCa.options, fresh);
          return {
            ca: str(r.ca),
            truong_ca: options[0] ?? '',
            truong_ca_options: options,
            hao_hut_am: fmtKg(haoAm),
            tp_dat: fmtKg(tpKg),
            phe_kg: fmtKg(pheKg),
            // Không ghi chép mặc định — user tự bấm "Thêm dòng ghi chép".
            ghi_chep: [],
            danh_gia: 'Đạt'
          };
        });
      return { ma_may: g.ma_may, ten_may: g.ten_may, muc_tieu: '', rows };
    });
  return groups;
}

/** Hợp ứng viên tra lại vào nhóm đang sửa (giữ lựa chọn tay, chỉ mặc định khi trống). Trả về số dòng được bổ sung. */
function mergeStaffOptionsIntoEditGroups(
  groups: EditHaoHutMayGroup[],
  staffOpts: Map<string, string[]>
): { groups: EditHaoHutMayGroup[]; matched: number } {
  if (staffOpts.size === 0) return { groups, matched: 0 };
  let matched = 0;
  const next = groups.map(g => {
    const mayKey = (str(g.ma_may) || str(g.ten_may)).toLowerCase();
    return {
      ...g,
      rows: g.rows.map(r => {
        const fresh = staffOpts.get(`${mayKey}|||${str(r.ca).toLowerCase()}`) ?? [];
        if (fresh.length === 0) return r;
        const before = r.truong_ca_options.length;
        const options = unionTruongCaOptions(r.truong_ca_options, fresh);
        if (options.length > before) matched += 1;
        return {
          ...r,
          truong_ca_options: options,
          truong_ca: str(r.truong_ca) || options[0] || ''
        };
      })
    };
  });
  return { groups: next, matched };
}

function toEditHaoHut(groups: BaoCaoNgayHaoHutMayGroup[]): EditHaoHutMayGroup[] {  return groups.map(g => ({
    key: uid(),
    ma_may: g.ma_may || '',
    ten_may: g.ten_may || '',
    muc_tieu: g.muc_tieu || '',
    rows: (g.rows || []).map(r => ({
      key: uid(),
      ca: r.ca || '',
      truong_ca: r.truong_ca || '',
      truong_ca_options: [...(r.truong_ca_options || [])],
      hao_hut_am: r.hao_hut_am ?? '0',
      tp_dat: r.tp_dat ?? '0',
      phe_kg: r.phe_kg ?? '0',
      ghi_chep: (r.ghi_chep || []).map(t => ({ key: uid(), text: t })),
      danh_gia: normalizeDanhGia(r.danh_gia)
    }))
  }));
}

function fromEditHaoHut(groups: EditHaoHutMayGroup[]): BaoCaoNgayHaoHutMayGroup[] {
  return groups
    .map(g => ({
      ma_may: str(g.ma_may),
      ten_may: str(g.ten_may),
      muc_tieu: str(g.muc_tieu),
      rows: g.rows
        .map(r => {
          const truongCa = str(r.truong_ca);
          const opts = r.truong_ca_options.map(o => str(o)).filter(o => o !== '');
          if (truongCa && !opts.some(o => o.toLowerCase() === truongCa.toLowerCase())) opts.unshift(truongCa);
          return {
            ca: str(r.ca),
            truong_ca: truongCa,
            truong_ca_options: opts,
            hao_hut_am: fmtInput(round2(parseNum(r.hao_hut_am))),
            tp_dat: fmtInput(round2(parseNum(r.tp_dat))),
            phe_kg: fmtInput(round2(parseNum(r.phe_kg))),
            ghi_chep: r.ghi_chep.map(l => str(l.text)).filter(t => t !== ''),
            danh_gia: normalizeDanhGia(r.danh_gia)
          };
        })
        .filter(r => r.ca || r.truong_ca || r.ghi_chep.length > 0 || r.danh_gia || r.tp_dat !== '0' || r.phe_kg !== '0' || r.hao_hut_am !== '0')
    }))
    .filter(g => g.ma_may || g.ten_may || g.muc_tieu || g.rows.length > 0);
}

function toEditRows(report: BaoCaoNgaySavedReport | null): { tp: EditThanhPhamRow[]; phe: EditPheRow[]; vt: EditVatTuRow[] } {
  if (!report) return { tp: [], phe: [], vt: [] };
  return {
    tp: report.thanh_pham.map(l => ({
      key: uid(),
      san_pham_id: l.san_pham_id || '',
      ma_hang: l.ma_hang,
      so_luong: l.so_luong ? String(l.so_luong) : '',
      trong_luong: l.trong_luong ? String(l.trong_luong) : ''
    })),
    phe: report.phe_hong.map(l => ({
      key: uid(),
      loai_phe: l.loai_phe,
      so_luong: l.so_luong ? String(l.so_luong) : '',
      dot: l.dot || ''
    })),
    vt: report.vat_tu.map(l => ({
      key: uid(),
      material_id: l.material_id || '',
      ma_nvl: l.ma_nvl,
      ten_nvl: l.ten_nvl,
      ton_dau_ngay: l.ton_dau_ngay ? String(l.ton_dau_ngay) : '',
      nhap_vt: l.nhap_vt ? String(l.nhap_vt) : '',
      su_dung: Number(l.su_dung) || 0,
      ton_trong_ngay: String(l.ton_trong_ngay ?? ''),
      hao_hut: String(l.hao_hut ?? '')
    }))
  };
}

function recomputeVtRow(row: EditVatTuRow): EditVatTuRow {
  const dau = parseNum(row.ton_dau_ngay);
  const nhap = parseNum(row.nhap_vt);
  const ton = parseNum(row.ton_trong_ngay);
  if (str(row.ton_trong_ngay) === '') return { ...row, hao_hut: fmtInput(round2(dau + nhap)) };
  return { ...row, hao_hut: fmtInput(round2(dau + nhap - ton)) };
}

// ---------------------------------------------------------------------------
// 3 bảng thành phần (đồng nhất UI các trang khác)
// ---------------------------------------------------------------------------

function ThanhPhamTable({
  rows,
  editable,
  onChange,
  onRemove,
  products = []
}: {
  rows: EditThanhPhamRow[];
  editable: boolean;
  onChange?: (key: string, patch: Partial<EditThanhPhamRow>) => void;
  onRemove?: (key: string) => void;
  /** Danh mục SP để search theo mã AMIS + ten_ghep (lưu đúng id) */
  products?: ProductRow[];
}) {
  const tongSl = rows.reduce((s, r) => s + parseNum(r.so_luong), 0);
  const tongTl = rows.reduce((s, r) => s + parseNum(r.trong_luong), 0);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[720px] text-left text-[12.5px]">
          <thead>
            <tr>
              <th className={`${thClass} w-10 text-center`}>STT</th>
              <th className={thClass}>Sản phẩm (mã AMIS / tên ghép)</th>
              <th className={`${thClass} w-[130px] text-right`}>Số lượng</th>
              <th className={`${thClass} w-[150px] text-right`}>Trọng lượng (kg)</th>
              {editable && <th className={`${thClass} w-14 text-center`}>Xóa</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={editable ? 5 : 4} className="px-3 py-6 text-center font-semibold text-slate-400">
                  Chưa có dòng nào. Chọn ngày để tự động tổng hợp từ sổ trộn.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key} className="hover:bg-slate-50/60">
                <td className={`${tdClass} text-center font-bold text-slate-400`}>{i + 1}</td>
                <td className={tdClass}>
                  {editable ? (
                    <SearchableSelect
                      value={r.san_pham_id || r.ma_hang}
                      onChange={v => {
                        const found = products.find(p => p.id === v);
                        if (found) {
                          onChange?.(r.key, { san_pham_id: found.id, ma_hang: productDisplayLabel(found) });
                        } else {
                          onChange?.(r.key, { san_pham_id: '', ma_hang: v });
                        }
                      }}
                      onSelectOption={item => {
                        if (item && typeof item === 'object') {
                          const p = item as ProductRow;
                          onChange?.(r.key, { san_pham_id: str(p.id), ma_hang: productDisplayLabel(p) });
                        }
                      }}
                      options={products}
                      placeholder={products.length === 0 ? 'Đang tải danh mục…' : 'Gõ mã AMIS / tên ghép...'}
                      isLoading={products.length === 0}
                      getLabel={item => productDisplayLabel(item as ProductRow)}
                      getValue={item => (item as ProductRow).id}
                      getSearchText={item => productSearchText(item as ProductRow)}
                      resolveSelectedItem={(opts, raw) => {
                        const list = opts as ProductRow[];
                        const found = resolveProductByText(list, str(raw));
                        if (found) return found;
                        // Id đã lưu nhưng không còn trong danh mục → vẫn hiển thị tên đã lưu
                        if (str(raw) && r.san_pham_id && str(raw) === r.san_pham_id && r.ma_hang) {
                          return { id: str(raw), tenGhep: r.ma_hang } as ProductRow;
                        }
                        return null;
                      }}
                      allowCustomValue
                      inputClassName={inputClass}
                      maxResults={50}
                    />
                  ) : (
                    <span className="font-semibold text-slate-800">{r.ma_hang || '—'}</span>
                  )}
                </td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.so_luong} onChange={e => onChange?.(r.key, { so_luong: e.target.value })} className={numInputClass} inputMode="decimal" placeholder="0" />
                  ) : (
                    <span className="block text-right tabular-nums">{r.so_luong || '—'}</span>
                  )}
                </td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.trong_luong} onChange={e => onChange?.(r.key, { trong_luong: e.target.value })} className={numInputClass} inputMode="decimal" placeholder="0" />
                  ) : (
                    <span className="block text-right tabular-nums">{r.trong_luong || '—'}</span>
                  )}
                </td>
                {editable && (
                  <td className={`${tdClass} text-center`}>
                    <button type="button" onClick={() => onRemove?.(r.key)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50" title="Xóa dòng">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-2 py-2 text-right text-[12px] font-bold uppercase tracking-wide text-slate-500">Tổng</td>
                <td className={totalCellClass}>{fmtVN(tongSl)}</td>
                <td className={totalCellClass}>{fmtVN(tongTl)}</td>
                {editable && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function PheHongTable({
  rows,
  editable,
  onChange,
  onRemove
}: {
  rows: EditPheRow[];
  editable: boolean;
  onChange?: (key: string, patch: Partial<EditPheRow>) => void;
  onRemove?: (key: string) => void;
}) {
  const tong = rows.reduce((s, r) => s + parseNum(r.so_luong), 0);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] text-left text-[12.5px]">
          <thead>
            <tr>
              <th className={`${thClass} w-10 text-center`}>STT</th>
              <th className={thClass}>Loại phế</th>
              <th className={`${thClass} w-[140px] text-right`}>Số lượng (kg)</th>
              <th className={`${thClass} w-[160px]`}>Đợt</th>
              {editable && <th className={`${thClass} w-14 text-center`}>Xóa</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={editable ? 5 : 4} className="px-3 py-6 text-center font-semibold text-slate-400">
                  Chưa có dòng nào. Chọn ngày để tự động tổng hợp từ sổ trộn.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key} className="hover:bg-slate-50/60">
                <td className={`${tdClass} text-center font-bold text-slate-400`}>{i + 1}</td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.loai_phe} onChange={e => onChange?.(r.key, { loai_phe: e.target.value })} className={inputClass} placeholder="Loại phế" />
                  ) : (
                    <span className="font-semibold text-slate-800">{r.loai_phe || '—'}</span>
                  )}
                </td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.so_luong} onChange={e => onChange?.(r.key, { so_luong: e.target.value })} className={numInputClass} inputMode="decimal" placeholder="0" />
                  ) : (
                    <span className="block text-right tabular-nums">{r.so_luong || '—'}</span>
                  )}
                </td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.dot} onChange={e => onChange?.(r.key, { dot: e.target.value })} className={inputClass} placeholder="Đợt (nhập tay)" />
                  ) : (
                    <span className="text-slate-700">{r.dot || '—'}</span>
                  )}
                </td>
                {editable && (
                  <td className={`${tdClass} text-center`}>
                    <button type="button" onClick={() => onRemove?.(r.key)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50" title="Xóa dòng">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-2 py-2 text-right text-[12px] font-bold uppercase tracking-wide text-slate-500">Tổng</td>
                <td className={totalCellClass}>{fmtVN(tong)}</td>
                <td colSpan={editable ? 2 : 1} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function VatTuTable({
  rows,
  editable,
  onChange,
  onRemove,
  materials = []
}: {
  rows: EditVatTuRow[];
  editable: boolean;
  onChange?: (key: string, patch: Partial<EditVatTuRow>) => void;
  onRemove?: (key: string) => void;
  /** Danh mục kho NVL để search theo mã + tên SX/tên SP (lưu đúng id) */
  materials?: MaterialRow[];
}) {
  const tongDau = rows.reduce((s, r) => s + parseNum(r.ton_dau_ngay), 0);
  const tongNhap = rows.reduce((s, r) => s + parseNum(r.nhap_vt), 0);
  const tongSuDung = rows.reduce((s, r) => s + (Number(r.su_dung) || 0), 0);
  const tongTon = rows.reduce((s, r) => s + parseNum(r.ton_trong_ngay), 0);
  const tongHao = rows.reduce((s, r) => s + parseNum(r.hao_hut), 0);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[880px] text-left text-[12.5px]">
          <thead>
              <tr>
                <th className={`${thClass} w-10 text-center`}>STT</th>
                <th className={thClass}>Vật tư (mã / tên SX)</th>
              <th className={`${thClass} w-[120px] text-right`}>Tồn đầu ngày</th>
              <th className={`${thClass} w-[120px] text-right`}>Nhập VT (kg)</th>
              <th className={`${thClass} w-[120px] text-right`}>Sử dụng (kg)</th>
              <th className={`${thClass} w-[130px] text-right`}>Tồn trong ngày (kg)</th>
              <th className={`${thClass} w-[120px] text-right`}>Hao hụt (kg)</th>
              {editable && <th className={`${thClass} w-14 text-center`}>Xóa</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={editable ? 8 : 7} className="px-3 py-6 text-center font-semibold text-slate-400">
                  Chưa có dòng nào. Chọn ngày để tự động tổng hợp từ sổ trộn.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key} className="hover:bg-slate-50/60">
                <td className={`${tdClass} text-center font-bold text-slate-400`}>{i + 1}</td>
                <td className={tdClass}>
                  {editable ? (
                    <SearchableSelect
                      value={r.material_id || r.ten_nvl}
                      onChange={v => {
                        const found = materials.find(m => m.id === v);
                        if (found) {
                          onChange?.(r.key, {
                            material_id: found.id,
                            ma_nvl: str(found.code),
                            ten_nvl: str(found.productionName) || str(found.name)
                          });
                        } else {
                          onChange?.(r.key, { material_id: '', ten_nvl: v });
                        }
                      }}
                      onSelectOption={item => {
                        if (item && typeof item === 'object') {
                          const m = item as MaterialRow;
                          onChange?.(r.key, {
                            material_id: str(m.id),
                            ma_nvl: str(m.code),
                            ten_nvl: str(m.productionName) || str(m.name)
                          });
                        }
                      }}
                      options={materials}
                      placeholder={materials.length === 0 ? 'Đang tải danh mục…' : 'Gõ mã / tên SX...'}
                      isLoading={materials.length === 0}
                      getLabel={item => materialDisplayLabel(item as MaterialRow)}
                      getValue={item => (item as MaterialRow).id}
                      getSearchText={item => materialSearchText(item as MaterialRow)}
                      resolveSelectedItem={(opts, raw) => {
                        const list = opts as MaterialRow[];
                        const found = resolveMaterialByText(list, str(raw));
                        if (found) return found;
                        // Id đã lưu nhưng không còn trong danh mục → vẫn hiển thị tên đã lưu
                        if (str(raw) && r.material_id && str(raw) === r.material_id && r.ten_nvl) {
                          return { id: str(raw), code: r.ma_nvl, name: r.ten_nvl } as MaterialRow;
                        }
                        return null;
                      }}
                      allowCustomValue
                      inputClassName={inputClass}
                      maxResults={50}
                    />
                  ) : (
                    <span className="font-semibold text-slate-800">{r.ten_nvl || '—'}</span>
                  )}
                </td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.ton_dau_ngay} onChange={e => onChange?.(r.key, { ton_dau_ngay: e.target.value })} className={numInputClass} inputMode="decimal" placeholder="0" />
                  ) : (
                    <span className="block text-right tabular-nums">{r.ton_dau_ngay || '0'}</span>
                  )}
                </td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.nhap_vt} onChange={e => onChange?.(r.key, { nhap_vt: e.target.value })} className={numInputClass} inputMode="decimal" placeholder="0" />
                  ) : (
                    <span className="block text-right tabular-nums">{r.nhap_vt || '0'}</span>
                  )}
                </td>
                <td className={`${tdClass} text-right tabular-nums text-slate-500`}>{fmtVN(Number(r.su_dung) || 0)}</td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.ton_trong_ngay} onChange={e => onChange?.(r.key, { ton_trong_ngay: e.target.value })} className={numInputClass} inputMode="decimal" placeholder="0" />
                  ) : (
                    <span className="block text-right tabular-nums">{r.ton_trong_ngay || '0'}</span>
                  )}
                </td>
                <td className={tdClass}>
                  {editable ? (
                    <input value={r.hao_hut} onChange={e => onChange?.(r.key, { hao_hut: e.target.value })} className={numInputClass} inputMode="decimal" placeholder="0" />
                  ) : (
                    <span className="block text-right font-bold tabular-nums">{r.hao_hut || '0'}</span>
                  )}
                </td>
                {editable && (
                  <td className={`${tdClass} text-center`}>
                    <button type="button" onClick={() => onRemove?.(r.key)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50" title="Xóa dòng">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-2 py-2 text-right text-[12px] font-bold uppercase tracking-wide text-slate-500">Tổng</td>
                <td className={totalCellClass}>{fmtVN(tongDau)}</td>
                <td className={totalCellClass}>{fmtVN(tongNhap)}</td>
                <td className={totalCellClass}>{fmtVN(tongSuDung)}</td>
                <td className={totalCellClass}>{fmtVN(tongTon)}</td>
                <td className={totalCellClass}>{fmtVN(tongHao)}</td>
                {editable && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bảng xem trước phiếu (giống mẫu giấy: header vàng, dòng tổng xanh)
// ---------------------------------------------------------------------------

export interface BaoCaoNgayPreviewRows {
  tp: { ma_hang: string; so_luong: string; trong_luong: string }[];
  phe: { loai_phe: string; so_luong: string; dot: string }[];
  vt: { ten_nvl: string; ton_dau_ngay: string; nhap_vt: string; ton_trong_ngay: string; hao_hut: string }[];
}

/** Ngày ISO (YYYY-MM-DD) → "3/9" như mẫu giấy */
function formatNgayNgan(iso: string) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${Number(parts[2])}/${Number(parts[1])}`;
}

/** "Ngày 3 tháng 9 năm 2026" */
function formatNgayDai(iso: string) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `Ngày ${Number(parts[2])} tháng ${Number(parts[1])} năm ${parts[0]}`;
}

const PREVIEW_YELLOW = '#FFFF00';
const PREVIEW_GREEN = '#00B050';
const previewBorder: React.CSSProperties = { border: '1px solid #111' };

export function BaoCaoNgayPreviewTable({ ngay, rows }: { ngay: string; rows: BaoCaoNgayPreviewRows }) {
  const { tp, phe, vt } = rows;
  const rowCount = Math.max(tp.length, phe.length, vt.length, 1);

  const tongSl = tp.reduce((s, r) => s + parseNum(r.so_luong), 0);
  const tongTl = tp.reduce((s, r) => s + parseNum(r.trong_luong), 0);
  const tongPhe = phe.reduce((s, r) => s + parseNum(r.so_luong), 0);
  const tongTonDau = vt.reduce((s, r) => s + parseNum(r.ton_dau_ngay), 0);
  const tongNhap = vt.reduce((s, r) => s + parseNum(r.nhap_vt), 0);
  const tongTon = vt.reduce((s, r) => s + parseNum(r.ton_trong_ngay), 0);
  const tongHao = vt.reduce((s, r) => s + parseNum(r.hao_hut), 0);

  return (
    <div className="overflow-x-auto">
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100, fontSize: 12, background: '#fff' }}>
        <tbody>
          <tr>
            <td colSpan={12} style={{ ...previewBorder, fontWeight: 700, padding: '4px 6px' }}>
              {formatNgayDai(ngay)}
            </td>
          </tr>
          <tr style={{ background: PREVIEW_YELLOW, fontWeight: 700, textAlign: 'center' }}>
            <td rowSpan={2} style={{ ...previewBorder, padding: '4px 6px', minWidth: 56 }}>Ngày</td>
            <td colSpan={3} style={{ ...previewBorder, padding: '4px 6px' }}>Nhập Thành Phẩm</td>
            <td colSpan={2} style={{ ...previewBorder, padding: '4px 6px' }}>Phế Hồng trong ca</td>
            <td rowSpan={2} style={{ ...previewBorder, padding: '4px 6px', minWidth: 90 }}>V4ND/kg Đợt -T</td>
            <td colSpan={4} style={{ ...previewBorder, padding: '4px 6px' }}>Vật Tư</td>
            <td rowSpan={2} style={{ ...previewBorder, padding: '4px 6px', minWidth: 70 }}>Hao Hụt ( kg )</td>
          </tr>
          <tr style={{ background: PREVIEW_YELLOW, fontWeight: 700, textAlign: 'center' }}>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 150 }}>Mã Hàng</td>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 70 }}>Số Lượng</td>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 80 }}>Trọng lượng</td>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 120 }}>Loại Phế</td>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 70 }}>Số Lượng</td>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 90 }}>Tên NVL</td>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 80 }}>Tồn đầu ngày</td>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 80 }}>Nhập VT ( kg )</td>
            <td style={{ ...previewBorder, padding: '4px 6px', minWidth: 90 }}>Tồn trong ngày ( kg )</td>
          </tr>
          {Array.from({ length: rowCount }).map((_, i) => (
            <tr key={i}>
              <td style={{ ...previewBorder, padding: '3px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {ngay ? formatNgayNgan(ngay) : ''}
              </td>
              <td style={previewBorder}><span style={{ padding: '2px 4px', display: 'block' }}>{tp[i]?.ma_hang ?? ''}</span></td>
              <td style={{ ...previewBorder, textAlign: 'right' }}><span style={{ padding: '2px 4px', display: 'block', textAlign: 'right' }}>{tp[i]?.so_luong ?? ''}</span></td>
              <td style={{ ...previewBorder, textAlign: 'right' }}><span style={{ padding: '2px 4px', display: 'block', textAlign: 'right' }}>{tp[i]?.trong_luong ?? ''}</span></td>
              <td style={previewBorder}><span style={{ padding: '2px 4px', display: 'block' }}>{phe[i]?.loai_phe ?? ''}</span></td>
              <td style={{ ...previewBorder, textAlign: 'right' }}><span style={{ padding: '2px 4px', display: 'block', textAlign: 'right' }}>{phe[i]?.so_luong ?? ''}</span></td>
              <td style={previewBorder}><span style={{ padding: '2px 4px', display: 'block' }}>{phe[i]?.dot ?? ''}</span></td>
              <td style={previewBorder}><span style={{ padding: '2px 4px', display: 'block' }}>{vt[i]?.ten_nvl ?? ''}</span></td>
              <td style={{ ...previewBorder, textAlign: 'right' }}><span style={{ padding: '2px 4px', display: 'block', textAlign: 'right' }}>{vt[i]?.ton_dau_ngay ?? ''}</span></td>
              <td style={{ ...previewBorder, textAlign: 'right' }}><span style={{ padding: '2px 4px', display: 'block', textAlign: 'right' }}>{vt[i]?.nhap_vt ?? ''}</span></td>
              <td style={{ ...previewBorder, textAlign: 'right' }}><span style={{ padding: '2px 4px', display: 'block', textAlign: 'right' }}>{vt[i]?.ton_trong_ngay ?? ''}</span></td>
              <td style={{ ...previewBorder, textAlign: 'right' }}><span style={{ padding: '2px 4px', display: 'block', textAlign: 'right' }}>{vt[i]?.hao_hut ?? ''}</span></td>
            </tr>
          ))}
          <tr style={{ background: PREVIEW_GREEN, fontWeight: 800, color: '#111' }}>
            <td colSpan={2} style={{ ...previewBorder, padding: '4px 6px', textAlign: 'center' }}>Tổng</td>
            <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'right' }}>{fmtVN(tongSl)}</td>
            <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'right' }}>{fmtVN(tongTl)}</td>
            <td style={{ ...previewBorder, padding: '4px 6px' }} />
            <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'right' }}>{fmtVN(tongPhe)}</td>
            <td style={{ ...previewBorder, padding: '4px 6px' }} />
            <td style={{ ...previewBorder, padding: '4px 6px' }} />
            <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'right' }}>{fmtVN(tongTonDau)}</td>
            <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'right' }}>{fmtVN(tongNhap)}</td>
            <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'right' }}>{fmtVN(tongTon)}</td>
            <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'right' }}>{fmtVN(tongHao)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hao hụt thống kê — bảng giống mẫu giấy (theo máy, theo ca)
// ---------------------------------------------------------------------------

function HaoHutMayLabel(g: { ma_may: string; ten_may: string }) {
  const ten = str(g.ten_may);
  const ma = str(g.ma_may);
  if (ten && ma && ten.toLowerCase() !== ma.toLowerCase()) return `${ten} (${ma})`;
  return ten || ma || '—';
}

export function BaoCaoNgayHaoHutPreview({ ngay, groups, ghiChu }: { ngay: string; groups: BaoCaoNgayHaoHutMayGroup[]; ghiChu?: string }) {
  if (groups.length === 0) {
    return <p className="py-6 text-center text-[12.5px] font-semibold text-slate-400">Chưa có dữ liệu hao hụt. Chọn ngày để tự động tổng hợp từ sổ trộn theo máy/ca.</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <div key={gi} className="overflow-x-auto">
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860, fontSize: 13, background: '#fff' }}>
            <tbody>
              <tr>
                <td colSpan={4} style={{ ...previewBorder, fontWeight: 800, fontSize: 17, textAlign: 'center', padding: '6px' }}>
                  Hao Hụt Thống Kê Ngày {formatNgayGachCheo(ngay)}
                </td>
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={{ ...previewBorder, padding: '4px 6px', width: 60 }} />
                <td style={{ ...previewBorder, padding: '4px 6px', fontWeight: 800 }}>{HaoHutMayLabel(g)}</td>
                <td style={{ ...previewBorder, padding: '4px 6px', color: '#e11d48', fontWeight: 800, width: 150 }}>SL Mục Tiêu</td>
                <td style={{ ...previewBorder, padding: '4px 6px', color: '#e11d48', fontWeight: 800, width: 220 }}>{g.muc_tieu || ''}</td>
              </tr>
              <tr style={{ fontWeight: 700, textAlign: 'center' }}>
                <td style={{ ...previewBorder, padding: '4px 6px', width: 60 }}>Ca SX</td>
                <td style={{ ...previewBorder, padding: '4px 6px', width: 130 }}>Trưởng Ca</td>
                <td style={{ ...previewBorder, padding: '4px 6px' }}>Ghi Chép Trong Ca SX</td>
                <td style={{ ...previewBorder, padding: '4px 6px', width: 150 }}>Đánh Giá Sản Lượng</td>
              </tr>
              {g.rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...previewBorder, padding: '10px', textAlign: 'center', color: '#94a3b8' }}>Chưa có ca nào.</td>
                </tr>
              )}
              {g.rows.map((r, ri) => (
                <tr key={ri}>
                  <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'center', fontWeight: 800 }}>{r.ca || '—'}</td>
                  <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'center', fontWeight: 800 }}>{r.truong_ca || '—'}</td>
                  <td style={{ ...previewBorder, padding: '4px 6px', verticalAlign: 'top' }}>
                    <div style={{ padding: '1px 0' }}>- Hao hụt âm {r.hao_hut_am || '0'}kg</div>
                    <div style={{ padding: '1px 0' }}>- TP đạt {r.tp_dat || '0'}kg. Phế {r.phe_kg || '0'}kg</div>
                    {r.ghi_chep.map((line, li) => (
                      <div key={li} style={{ padding: '1px 0' }}>- {line}</div>
                    ))}
                  </td>
                  <td style={{ ...previewBorder, padding: '4px 6px', textAlign: 'center', color: '#2563eb' }}>{r.danh_gia || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {str(ghiChu) && (
        <p className="text-[12.5px] text-slate-700"><span className="font-bold">Ghi chú chung:</span> {str(ghiChu)}</p>
      )}
    </div>
  );
}

function HaoHutThongKeEditor({
  groups,
  onChangeMay,
  onChangeCa,
  onChangeLine,
  onAddLine,
  onRemoveLine
}: {
  groups: EditHaoHutMayGroup[];
  onChangeMay: (mayKey: string, patch: Partial<EditHaoHutMayGroup>) => void;
  onChangeCa: (mayKey: string, caKey: string, patch: Partial<EditHaoHutCaRow>) => void;
  onChangeLine: (mayKey: string, caKey: string, lineKey: string, text: string) => void;
  onAddLine: (mayKey: string, caKey: string) => void;
  onRemoveLine: (mayKey: string, caKey: string, lineKey: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center">
        <p className="text-[12.5px] font-semibold text-slate-500">Chưa có dữ liệu hao hụt. Chọn ngày để tự động tổng hợp từ sổ trộn theo máy/ca.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.key} className="overflow-hidden rounded-lg border border-slate-300">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="min-w-0 flex-1 text-[13px] font-extrabold text-slate-900">{HaoHutMayLabel(g)}</span>
            <label className="flex items-center gap-1.5 text-[12px] font-bold text-rose-600">
              SL Mục Tiêu
              <input
                value={g.muc_tieu}
                onChange={e => onChangeMay(g.key, { muc_tieu: e.target.value })}
                placeholder="VD: 2800kg/12h"
                className="h-8 w-44 rounded-lg border border-rose-200 bg-white px-2 text-[12.5px] font-bold text-rose-700 outline-none focus:border-rose-400"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="w-20 px-2 py-2 text-center">Ca SX</th>
                  <th className="w-36 px-2 py-2 text-center">Trưởng Ca</th>
                  <th className="px-2 py-2">Ghi Chép Trong Ca SX</th>
                  <th className="w-40 px-2 py-2 text-center">Đánh Giá Sản Lượng</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map(r => (
                  <tr key={r.key} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="px-2 py-1.5 text-center font-extrabold text-slate-800">{r.ca || '—'}</td>
                    <td className="px-2 py-1.5">
                      {r.truong_ca_options.length > 0 ? (
                        <select
                          value={r.truong_ca_options.some(o => o.toLowerCase() === str(r.truong_ca).toLowerCase()) ? r.truong_ca : ''}
                          onChange={e => onChangeCa(g.key, r.key, { truong_ca: e.target.value })}
                          className={`${inputClass} text-center font-bold`}
                        >
                          <option value="">— Chọn —</option>
                          {(r.truong_ca_options.some(o => o.toLowerCase() === str(r.truong_ca).toLowerCase())
                            ? r.truong_ca_options
                            : [...r.truong_ca_options, ...(str(r.truong_ca) ? [str(r.truong_ca)] : [])]
                          ).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input value={r.truong_ca} onChange={e => onChangeCa(g.key, r.key, { truong_ca: e.target.value })} placeholder="Trưởng ca" className={`${inputClass} text-center font-bold`} />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="shrink-0 font-bold text-slate-400">- Hao hụt âm</span>
                          <input
                            value={r.hao_hut_am}
                            onChange={e => onChangeCa(g.key, r.key, { hao_hut_am: e.target.value })}
                            inputMode="decimal"
                            placeholder="0"
                            className={`${numInputClass} max-w-[110px]`}
                          />
                          <span className="shrink-0 font-bold text-slate-500">kg</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="shrink-0 font-bold text-slate-400">- TP đạt</span>
                          <input
                            value={r.tp_dat}
                            onChange={e => onChangeCa(g.key, r.key, { tp_dat: e.target.value })}
                            inputMode="decimal"
                            placeholder="0"
                            className={`${numInputClass} max-w-[110px]`}
                          />
                          <span className="shrink-0 font-bold text-slate-500">kg. Phế</span>
                          <input
                            value={r.phe_kg}
                            onChange={e => onChangeCa(g.key, r.key, { phe_kg: e.target.value })}
                            inputMode="decimal"
                            placeholder="0"
                            className={`${numInputClass} max-w-[110px]`}
                          />
                          <span className="shrink-0 font-bold text-slate-500">kg</span>
                        </div>
                        {r.ghi_chep.map(line => (
                          <div key={line.key} className="flex items-start gap-1">
                            <span className="pt-2 font-bold text-slate-400">-</span>
                            <input
                              value={line.text}
                              onChange={e => onChangeLine(g.key, r.key, line.key, e.target.value)}
                              placeholder="Ghi chép trong ca"
                              className={inputClass}
                            />
                            <button type="button" onClick={() => onRemoveLine(g.key, r.key, line.key)} className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50" title="Xóa dòng">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => onAddLine(g.key, r.key)} className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50">
                          <Plus className="h-3 w-3" /> Thêm dòng ghi chép
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={DANH_GIA_OPTIONS.includes(r.danh_gia as 'Đạt' | 'Không đạt') ? r.danh_gia : 'Đạt'}
                        onChange={e => onChangeCa(g.key, r.key, { danh_gia: e.target.value })}
                        className={`${inputClass} text-center font-bold text-blue-600`}
                      >
                        {DANH_GIA_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel nhập / sửa (chọn ngày → tự động tổng hợp từ sổ trộn)
// ---------------------------------------------------------------------------

export function BaoCaoNgayPanel({
  onBack,
  onOpenList,
  editReport,
  onEditConsumed
}: {
  onBack: () => void;
  onOpenList?: () => void;
  editReport?: BaoCaoNgaySavedReport | null;
  onEditConsumed?: () => void;
}) {
  const isEditing = Boolean(editReport?.id);
  const editNgay = editReport?.ngay ?? '';
  const [ngay, setNgay] = useState(editNgay);
  const [ghiChu, setGhiChu] = useState(editReport?.ghi_chu ?? '');
  const initial = useMemo(() => toEditRows(editReport ?? null), [editReport]);
  const initialHaoHut = useMemo(() => toEditHaoHut(editReport?.hao_hut_thong_ke ?? []), [editReport]);
  const [tpRows, setTpRows] = useState<EditThanhPhamRow[]>(initial.tp);
  const [pheRows, setPheRows] = useState<EditPheRow[]>(initial.phe);
  const [vtRows, setVtRows] = useState<EditVatTuRow[]>(initial.vt);
  const [haoHutGroups, setHaoHutGroups] = useState<EditHaoHutMayGroup[]>(initialHaoHut);
  const [haoHutGhiChu, setHaoHutGhiChu] = useState(editReport?.hao_hut_ghi_chu ?? '');
  /** Tab chính sau khi chọn ngày: Báo cáo ngày | Hao hụt thống kê */
  const [mainTab, setMainTab] = useState<'bao-cao' | 'hao-hut'>('bao-cao');
  const [isLoadingSoTron, setIsLoadingSoTron] = useState(false);
  const [soTronInfo, setSoTronInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success' | 'info'>('info');
  const lastFetchedNgay = useRef('');
  const fetchedCatalogVersion = useRef(0);
  /** Chống tra lại Trưởng ca trùng lặp cho cùng phiếu + ngày (chế độ sửa). */
  const lastEnrichedStaffKey = useRef('');
  /** Các ô Trưởng ca user đã chọn tay (key ngay|||máy|||ca) — fill lại vẫn giữ, còn lại lấy đúng trưởng ca lịch mới nhất. */
  const truongCaTouchedRef = useRef<Set<string>>(new Set());
  const haoHutGroupsRef = useRef<EditHaoHutMayGroup[]>(initialHaoHut);
  useEffect(() => {
    haoHutGroupsRef.current = haoHutGroups;
  }, [haoHutGroups]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  /** Danh mục SP (search theo mã AMIS + ten_ghep, lưu đúng id) */
  const [products, setProducts] = useState<ProductRow[]>([]);
  /** Danh mục kho NVL (search theo mã + tên SX/tên SP, lưu đúng id) */
  const [materials, setMaterials] = useState<MaterialRow[]>([]);

  const tenGhepByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const tenGhep = str(p.tenGhep) || str(p.productionName) || str(p.name);
      if (!tenGhep) continue;
      for (const code of [p.code, p.amisCode, p.newCode]) {
        const key = str(code).toLowerCase();
        if (key && !map.has(key)) map.set(key, tenGhep);
      }
    }
    return map;
  }, [products]);

  const productIdByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (!str(p.id)) continue;
      for (const code of [p.code, p.amisCode, p.newCode]) {
        const key = str(code).toLowerCase();
        if (key && !map.has(key)) map.set(key, str(p.id));
      }
    }
    return map;
  }, [products]);

  const materialIdByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of materials) {
      if (!str(m.id)) continue;
      const key = str(m.code).toLowerCase();
      if (key && !map.has(key)) map.set(key, str(m.id));
    }
    return map;
  }, [materials]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [spRes, nvlRes] = await Promise.all([
          fetch('/api/san-pham?limit=5000'),
          fetch('/api/kho-nvl')
        ]);
        const [spData, nvlData] = await Promise.all([
          spRes.json().catch(() => ({})),
          nvlRes.json().catch(() => ({}))
        ]);
        if (!alive) return;
        let changed = false;
        if (spRes.ok) {
          try {
            setProducts(normalizeProducts(spData));
            changed = true;
          } catch {
            /* bỏ qua — vẫn fill được bằng ten_sp/mã SP trong phiếu */
          }
        }
        if (nvlRes.ok) {
          try {
            setMaterials(normalizeMaterialsInventory(nvlData));
            changed = true;
          } catch {
            /* bỏ qua — vẫn fill được bằng tên trong phiếu */
          }
        }
        if (changed) setCatalogVersion(v => v + 1);
      } catch {
        /* bỏ qua — vẫn fill được bằng dữ liệu trong phiếu */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const next = toEditRows(editReport ?? null);
    setTpRows(next.tp);
    setPheRows(next.phe);
    setVtRows(next.vt);
    setHaoHutGroups(toEditHaoHut(editReport?.hao_hut_thong_ke ?? []));
    setHaoHutGhiChu(editReport?.hao_hut_ghi_chu ?? '');
    setNgay(editReport?.ngay ?? '');
    setGhiChu(editReport?.ghi_chu ?? '');
    setMainTab('bao-cao');
    lastFetchedNgay.current = editReport?.ngay ?? '';
    lastEnrichedStaffKey.current = '';
    truongCaTouchedRef.current = new Set();
  }, [editReport?.id]);

  const applySoTronRecords = useCallback((records: SoTronDayRecord[], ngayValue: string, staffOpts?: Map<string, string[]>) => {
    const built = buildBaoCaoNgayFromSoTron(records, { tenGhepByCode, productIdByCode, materialIdByCode });
    setTpRows(
      built.thanh_pham.map(l => ({
        key: uid(),
        san_pham_id: l.san_pham_id || '',
        ma_hang: l.ma_hang,
        so_luong: l.so_luong ? String(l.so_luong) : '',
        trong_luong: l.trong_luong ? String(l.trong_luong) : ''
      }))
    );
    setPheRows(
      built.phe_hong.map(l => ({
        key: uid(),
        loai_phe: l.loai_phe,
        so_luong: l.so_luong ? String(l.so_luong) : '',
        dot: ''
      }))
    );
    setVtRows(
      built.vat_tu.map(l => ({
        key: uid(),
        material_id: l.material_id || '',
        ma_nvl: l.ma_nvl,
        ten_nvl: l.ten_nvl,
        ton_dau_ngay: l.ton_dau_ngay ? String(l.ton_dau_ngay) : '',
        nhap_vt: l.nhap_vt ? String(l.nhap_vt) : '',
        su_dung: l.su_dung ?? 0,
        ton_trong_ngay: String(l.ton_trong_ngay ?? ''),
        hao_hut: String(l.hao_hut ?? '')
      }))
    );
    const tongTongNvl = records.reduce((s, r) => s + (Number(r.tong_nvl) || 0), 0);
    // Fill lại từ sổ trộn nhưng giữ các ô nhập tay: SL mục tiêu theo máy,
    // Đánh giá theo từng máy/ca; Trưởng ca chỉ giữ khi user đã chọn tay
    // (còn lại lấy đúng trưởng ca của máy+ca+ngày từ lịch mới nhất).
    const targetNgay = str(ngayValue).slice(0, 10);
    const mucTieuByMay = new Map<string, string>();
    const tayByMayCa = new Map<string, { truong_ca: string; danh_gia: string }>();
    for (const g of haoHutGroupsRef.current) {
      const mayKey = (str(g.ma_may) || str(g.ten_may)).toLowerCase();
      if (str(g.muc_tieu)) mucTieuByMay.set(mayKey, str(g.muc_tieu));
      for (const row of g.rows) {
        const caKey = str(row.ca).toLowerCase();
        if (!caKey) continue;
        const touched = truongCaTouchedRef.current.has(`${targetNgay}|||${mayKey}|||${caKey}`);
        tayByMayCa.set(`${mayKey}|||${caKey}`, {
          truong_ca: touched ? str(row.truong_ca) : '',
          danh_gia: str(row.danh_gia)
        });
      }
    }
    const haoBuilt = buildHaoHutThongKeFromSoTron(records, staffOpts).map(g => {
      const mayKey = (str(g.ma_may) || str(g.ten_may)).toLowerCase();
      const keptMucTieu = mucTieuByMay.get(mayKey) ?? '';
      return {
        ...g,
        muc_tieu: keptMucTieu || g.muc_tieu,
        rows: g.rows.map(row => {
          const kept = tayByMayCa.get(`${mayKey}|||${str(row.ca).toLowerCase()}`);
          if (!kept) return row;
          const opts = [...row.truong_ca_options];
          if (kept.truong_ca && !opts.some(o => o.toLowerCase() === kept.truong_ca.toLowerCase())) opts.unshift(kept.truong_ca);
          return {
            ...row,
            truong_ca: kept.truong_ca || row.truong_ca,
            truong_ca_options: opts,
            danh_gia: kept.danh_gia || row.danh_gia
          };
        })
      };
    });
    setHaoHutGroups(toEditHaoHut(haoBuilt));
    setSoTronInfo(
      `Đã fill ${records.length} phiếu sổ trộn ngày ${formatNgayVN(ngayValue)}` +
        (built.hasCaDau
          ? ` (Tồn đầu ngày = Σ tồn ca 12C1/HC1; đối chiếu Σ tong_nvl = ${fmtVN(round2(tongTongNvl))} kg).`
          : ` (không thấy ca 12C1/HC1 nên Tồn đầu ngày = Σ tồn toàn ngày; đối chiếu Σ tong_nvl = ${fmtVN(round2(tongTongNvl))} kg).`) +
        (staffOpts && staffOpts.size > 0
          ? ` Trưởng ca đã tra lại từ lịch phân công (${staffOpts.size} lượt máy-ca).`
          : '')
    );
  }, [tenGhepByCode, productIdByCode, materialIdByCode]);

  // Chế độ sửa (giữ dữ liệu phiếu): chỉ tra lại Trưởng ca từ lịch phân công
  // để bổ sung dropdown, không đè số liệu đã lưu.
  const enrichSavedTruongCa = useCallback(async (target: string, reportId: string) => {
    const key = `${reportId}|||${target}`;
    if (!target || !reportId || lastEnrichedStaffKey.current === key) return;
    lastEnrichedStaffKey.current = key;
    const saved = editReport?.hao_hut_thong_ke ?? [];
    if (saved.length === 0) return;
    const combos = saved.flatMap(g =>
      (g.rows || []).map(r => ({ ma_may: str(g.ma_may), ten_may: str(g.ten_may), ca: str(r.ca) }))
    );
    const staffOpts = await fetchTruongCaOptions(target, combos);
    if (staffOpts.size === 0) return;
    setHaoHutGroups(prev => mergeStaffOptionsIntoEditGroups(prev, staffOpts).groups);
  }, [editReport]);

  const fetchSoTronByNgay = useCallback(async (ngayValue: string) => {
    const target = str(ngayValue).slice(0, 10);
    if (!target) return;
    setIsLoadingSoTron(true);
    setSoTronInfo('Đang lấy dữ liệu từ sổ trộn…');
    try {
      const res = await fetch(`/api/so-tron?ngay=${encodeURIComponent(target)}&limit=1000`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSoTronInfo(str((json as Record<string, unknown>)?.error) || 'Không thể tải sổ trộn.');
        return;
      }
      const records: SoTronDayRecord[] = Array.isArray((json as Record<string, unknown>).reports)
        ? ((json as Record<string, unknown>).reports as SoTronDayRecord[])
        : [];
      if (records.length === 0) {
        setTpRows([]);
        setPheRows([]);
        setVtRows([]);
        setHaoHutGroups([]);
        setSoTronInfo(`Ngày ${formatNgayVN(target)} chưa có sổ trộn nào.`);
        return;
      }
      // Tra lại Trưởng ca từ lịch phân công theo ngày/máy/ca (phiếu sổ trộn
      // cũ có thể chưa nhúng nhân sự nên dropdown mới trống).
      const staffOpts = await fetchTruongCaOptions(
        target,
        records.map(r => ({ ma_may: str(r.ma_may), ten_may: str(r.ten_may), ca: str(r.ca) }))
      );
      applySoTronRecords(records, target, staffOpts);
      setMessage('');
    } catch {
      setSoTronInfo('Lỗi kết nối khi tải sổ trộn.');
    } finally {
      setIsLoadingSoTron(false);
    }
  }, [applySoTronRecords]);

  // Khi chọn ngày → tự động lấy dữ liệu từ sổ trộn (thêm mới, hoặc đổi sang ngày khác khi sửa).
  // Khi danh mục SP (ten_ghep) tải xong sau mà ngày đã fill → fill lại để Mã hàng hiện ten_ghep.
  useEffect(() => {
    const target = str(ngay).slice(0, 10);
    if (!target) {
      lastFetchedNgay.current = '';
      fetchedCatalogVersion.current = catalogVersion;
      return;
    }
    // Chế độ sửa mà vẫn ở đúng ngày của phiếu → giữ dữ liệu phiếu, không đè bằng sổ trộn
    // (nhưng vẫn tra lại Trưởng ca từ lịch phân công để bổ sung dropdown).
    if (isEditing && target === str(editNgay).slice(0, 10)) {
      lastFetchedNgay.current = target;
      fetchedCatalogVersion.current = catalogVersion;
      void enrichSavedTruongCa(target, editReport?.id ?? '');
      return;
    }
    if (target === lastFetchedNgay.current && fetchedCatalogVersion.current === catalogVersion) return;
    lastFetchedNgay.current = target;
    fetchedCatalogVersion.current = catalogVersion;
    void fetchSoTronByNgay(target);
  }, [ngay, fetchSoTronByNgay, catalogVersion, isEditing, editNgay, enrichSavedTruongCa, editReport?.id]);

  const patchTp = (key: string, patch: Partial<EditThanhPhamRow>) =>
    setTpRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const patchPhe = (key: string, patch: Partial<EditPheRow>) =>
    setPheRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const patchVt = (key: string, patch: Partial<EditVatTuRow>) => {
    setVtRows(prev =>
      prev.map(r => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if ('ton_dau_ngay' in patch || 'nhap_vt' in patch || 'ton_trong_ngay' in patch) {
          return recomputeVtRow(next);
        }
        return next;
      })
    );
  };

  const patchHaoHutMay = (mayKey: string, patch: Partial<EditHaoHutMayGroup>) =>
    setHaoHutGroups(prev => prev.map(g => (g.key === mayKey ? { ...g, ...patch } : g)));
  const patchHaoHutCa = (mayKey: string, caKey: string, patch: Partial<EditHaoHutCaRow>) =>
    setHaoHutGroups(prev => prev.map(g => (g.key === mayKey
      ? { ...g, rows: g.rows.map(r => (r.key === caKey ? { ...r, ...patch } : r)) }
      : g)));
  /** User chọn tay ô Trưởng ca → đánh dấu để fill lại không đè bằng lịch. */
  const handleHaoHutCaChange = (mayKey: string, caKey: string, patch: Partial<EditHaoHutCaRow>) => {
    if ('truong_ca' in patch) {
      const g = haoHutGroupsRef.current.find(x => x.key === mayKey);
      const row = g?.rows.find(x => x.key === caKey);
      if (g && row) {
        const mayId = (str(g.ma_may) || str(g.ten_may)).toLowerCase();
        truongCaTouchedRef.current.add(
          `${str(ngay).slice(0, 10)}|||${mayId}|||${str(row.ca).toLowerCase()}`
        );
      }
    }
    patchHaoHutCa(mayKey, caKey, patch);
  };
  const patchHaoHutLine = (mayKey: string, caKey: string, lineKey: string, text: string) =>
    setHaoHutGroups(prev => prev.map(g => (g.key === mayKey
      ? {
          ...g,
          rows: g.rows.map(r => (r.key === caKey
            ? { ...r, ghi_chep: r.ghi_chep.map(l => (l.key === lineKey ? { ...l, text } : l)) }
            : r))
        }
      : g)));
  const addHaoHutLine = (mayKey: string, caKey: string) =>
    setHaoHutGroups(prev => prev.map(g => (g.key === mayKey
      ? {
          ...g,
          rows: g.rows.map(r => (r.key === caKey
            ? { ...r, ghi_chep: [...r.ghi_chep, { key: uid(), text: '' }] }
            : r))
        }
      : g)));
  const removeHaoHutLine = (mayKey: string, caKey: string, lineKey: string) =>
    setHaoHutGroups(prev => prev.map(g => (g.key === mayKey
      ? {
          ...g,
          rows: g.rows.map(r => (r.key === caKey
            ? { ...r, ghi_chep: r.ghi_chep.filter(l => l.key !== lineKey) }
            : r))
        }
      : g)));

  const handleSave = async () => {
    if (!ngay) {
      setMessage('Vui lòng chọn ngày.');
      setMessageType('error');
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      const thanh_pham = tpRows
        .filter(r => str(r.san_pham_id) || str(r.ma_hang) || str(r.so_luong) || str(r.trong_luong))
        .map(r => ({
          san_pham_id: str(r.san_pham_id),
          ma_hang: str(r.ma_hang),
          so_luong: round2(parseNum(r.so_luong)),
          trong_luong: round2(parseNum(r.trong_luong))
        }));
      const phe_hong = pheRows
        .filter(r => str(r.loai_phe) || str(r.so_luong) || str(r.dot))
        .map(r => ({
          loai_phe: str(r.loai_phe),
          so_luong: round2(parseNum(r.so_luong)),
          dot: str(r.dot)
        }));
      const vat_tu = vtRows
        .filter(r => str(r.material_id) || str(r.ten_nvl) || str(r.ma_nvl) || str(r.nhap_vt) || str(r.ton_trong_ngay) || str(r.ton_dau_ngay))
        .map(r => {
          const dau = round2(parseNum(r.ton_dau_ngay));
          const nhap = round2(parseNum(r.nhap_vt));
          const ton = round2(parseNum(r.ton_trong_ngay));
          const haoRaw = str(r.hao_hut);
          const hao = haoRaw === '' ? round2(dau + nhap - ton) : round2(parseNum(r.hao_hut));
          return {
            material_id: str(r.material_id),
            ma_nvl: str(r.ma_nvl),
            ten_nvl: str(r.ten_nvl),
            ton_dau_ngay: dau,
            nhap_vt: nhap,
            ton_trong_ngay: ton,
            hao_hut: hao,
            su_dung: round2(Number(r.su_dung) || 0)
          };
        });
      const hao_hut_thong_ke = fromEditHaoHut(haoHutGroups);

      const payload = {
        ngay,
        thanh_pham,
        phe_hong,
        vat_tu,
        tong_thanh_pham_so_luong: round2(thanh_pham.reduce((s, r) => s + r.so_luong, 0)),
        tong_thanh_pham_trong_luong: round2(thanh_pham.reduce((s, r) => s + r.trong_luong, 0)),
        tong_phe: round2(phe_hong.reduce((s, r) => s + r.so_luong, 0)),
        tong_nhap_vt: round2(vat_tu.reduce((s, r) => s + r.nhap_vt, 0)),
        tong_ton_trong_ngay: round2(vat_tu.reduce((s, r) => s + r.ton_trong_ngay, 0)),
        tong_hao_hut: round2(vat_tu.reduce((s, r) => s + r.hao_hut, 0)),
        ghi_chu: str(ghiChu),
        hao_hut_thong_ke,
        hao_hut_ghi_chu: str(haoHutGhiChu)
      };

      const url = isEditing ? `/api/bao-cao-ngay/${encodeURIComponent(editReport!.id)}` : '/api/bao-cao-ngay';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(str((data as Record<string, unknown>)?.error) || 'Không thể lưu báo cáo ngày.');
        setMessageType('error');
        return;
      }
      setMessage(isEditing ? 'Đã cập nhật báo cáo ngày.' : 'Đã lưu báo cáo ngày.');
      setMessageType('success');
      onEditConsumed?.();
      if (!isEditing && onOpenList) {
        setTimeout(() => onOpenList(), 600);
      }
    } catch {
      setMessage('Lỗi kết nối khi lưu báo cáo ngày.');
      setMessageType('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const esc = (v: string) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cell = 'border:1px solid #111;padding:4px 6px;font-size:12px;';
    const num = `${cell}text-align:right;`;
    const n = Math.max(tpRows.length, pheRows.length, vtRows.length, 1);
    let rowsHtml = '';
    for (let i = 0; i < n; i += 1) {
      const tp = tpRows[i];
      const phe = pheRows[i];
      const vt = vtRows[i];
      rowsHtml += `<tr><td style="${cell}text-align:center;">${esc(ngay ? formatNgayNgan(ngay) : '')}</td>`
        + `<td style="${cell}">${esc(tp?.ma_hang ?? '')}</td>`
        + `<td style="${num}">${esc(tp?.so_luong ?? '')}</td>`
        + `<td style="${num}">${esc(tp?.trong_luong ?? '')}</td>`
        + `<td style="${cell}">${esc(phe?.loai_phe ?? '')}</td>`
        + `<td style="${num}">${esc(phe?.so_luong ?? '')}</td>`
        + `<td style="${cell}">${esc(phe?.dot ?? '')}</td>`
        + `<td style="${cell}">${esc(vt?.ten_nvl ?? '')}</td>`
        + `<td style="${num}">${esc(vt?.ton_dau_ngay ?? '')}</td>`
        + `<td style="${num}">${esc(vt?.nhap_vt ?? '')}</td>`
        + `<td style="${num}">${esc(vt?.ton_trong_ngay ?? '')}</td>`
        + `<td style="${num}">${esc(vt?.hao_hut ?? '')}</td></tr>`;
    }
    const tongSl = fmtVN(tpRows.reduce((s, r) => s + parseNum(r.so_luong), 0));
    const tongTl = fmtVN(tpRows.reduce((s, r) => s + parseNum(r.trong_luong), 0));
    const tongPhe = fmtVN(pheRows.reduce((s, r) => s + parseNum(r.so_luong), 0));
    const tongTonDau = fmtVN(vtRows.reduce((s, r) => s + parseNum(r.ton_dau_ngay), 0));
    const tongNhap = fmtVN(vtRows.reduce((s, r) => s + parseNum(r.nhap_vt), 0));
    const tongTon = fmtVN(vtRows.reduce((s, r) => s + parseNum(r.ton_trong_ngay), 0));
    const tongHao = fmtVN(vtRows.reduce((s, r) => s + parseNum(r.hao_hut), 0));
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo ngày ${esc(formatNgayVN(ngay))}</title>` +
      `<style>@page{size:A4 landscape;margin:10mm;}body{font-family:Arial,Helvetica,sans-serif;color:#111;}h1{font-size:16px;text-align:center;margin:0 0 8px;}table{width:100%;border-collapse:collapse;}p{font-size:12px;}</style></head><body>` +
      `<h1>BÁO CÁO NGÀY — ${esc(formatNgayDai(ngay))}</h1>` +
      `<table><tr><td colspan="12" style="${cell}font-weight:bold;">${esc(formatNgayDai(ngay))}</td></tr>` +
      `<tr style="background:#FFFF00;font-weight:bold;text-align:center;"><td rowspan="2" style="${cell}">Ngày</td>` +
      `<td colspan="3" style="${cell}">Nhập Thành Phẩm</td>` +
      `<td colspan="2" style="${cell}">Phế Hồng trong ca</td>` +
      `<td rowspan="2" style="${cell}">V4ND/kg Đợt -T</td>` +
      `<td colspan="4" style="${cell}">Vật Tư</td>` +
      `<td rowspan="2" style="${cell}">Hao Hụt ( kg )</td></tr>` +
      `<tr style="background:#FFFF00;font-weight:bold;text-align:center;"><td style="${cell}">Mã Hàng</td>` +
      `<td style="${cell}">Số Lượng</td><td style="${cell}">Trọng lượng</td>` +
      `<td style="${cell}">Loại Phế</td><td style="${cell}">Số Lượng</td>` +
      `<td style="${cell}">Tên NVL</td><td style="${cell}">Tồn đầu ngày</td>` +
      `<td style="${cell}">Nhập VT ( kg )</td><td style="${cell}">Tồn trong ngày ( kg )</td></tr>` +
      rowsHtml +
      `<tr style="background:#00B050;font-weight:bold;"><td colspan="2" style="${cell}text-align:center;">Tổng</td>` +
      `<td style="${num}">${esc(tongSl)}</td><td style="${num}">${esc(tongTl)}</td><td style="${cell}"></td>` +
      `<td style="${num}">${esc(tongPhe)}</td><td style="${cell}"></td><td style="${cell}"></td>` +
      `<td style="${num}">${esc(tongTonDau)}</td><td style="${num}">${esc(tongNhap)}</td>` +
      `<td style="${num}">${esc(tongTon)}</td><td style="${num}">${esc(tongHao)}</td></tr></table>` +
      (ghiChu ? `<p><b>Ghi chú:</b> ${esc(ghiChu)}</p>` : '') +
      `<script>window.onload=function(){window.print();};</script></body></html>`;
    const w = window.open('', '_blank', 'width=1100,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const haoHutPreviewGroups: BaoCaoNgayHaoHutMayGroup[] = useMemo(() => fromEditHaoHut(haoHutGroups), [haoHutGroups]);

  const handlePrintHaoHut = () => {
    const esc = (v: string) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cell = 'border:1px solid #111;padding:4px 6px;font-size:13px;';
    const groups = fromEditHaoHut(haoHutGroups);
    const tables = groups.map(g => {
      const mayLabel = esc(
        g.ten_may && g.ma_may && g.ten_may.toLowerCase() !== g.ma_may.toLowerCase()
          ? `${g.ten_may} (${g.ma_may})`
          : (g.ten_may || g.ma_may || '')
      );
      const rowsHtml = g.rows.length === 0
        ? `<tr><td colspan="4" style="${cell}text-align:center;color:#64748b;">Chưa có ca nào.</td></tr>`
        : g.rows.map(r => {
            const extra = r.ghi_chep.length === 0
              ? ''
              : r.ghi_chep.map(line => `<div style="padding:1px 0;">- ${esc(line)}</div>`).join('');
            const lines = `<div style="padding:1px 0;">- Hao hụt âm ${esc(r.hao_hut_am || '0')}kg</div>`
              + `<div style="padding:1px 0;">- TP đạt ${esc(r.tp_dat || '0')}kg. Phế ${esc(r.phe_kg || '0')}kg</div>`
              + extra;
            return `<tr><td style="${cell}text-align:center;font-weight:bold;">${esc(r.ca || '')}</td>`
              + `<td style="${cell}text-align:center;font-weight:bold;">${esc(r.truong_ca || '')}</td>`
              + `<td style="${cell}">${lines}</td>`
              + `<td style="${cell}text-align:center;color:#1d4ed8;">${esc(r.danh_gia || '')}</td></tr>`;
          }).join('');
      return `<table style="margin-bottom:12px;"><tr><td colspan="4" style="${cell}font-weight:bold;font-size:17px;text-align:center;">Hao Hụt Thống Kê Ngày ${esc(formatNgayGachCheo(ngay))}</td></tr>`
        + `<tr style="font-weight:bold;"><td style="${cell}width:60px;"></td><td style="${cell}font-weight:bold;">${mayLabel}</td>`
        + `<td style="${cell}color:#e11d48;font-weight:bold;width:150px;">SL Mục Tiêu</td>`
        + `<td style="${cell}color:#e11d48;font-weight:bold;width:220px;">${esc(g.muc_tieu || '')}</td></tr>`
        + `<tr style="font-weight:bold;text-align:center;"><td style="${cell}">Ca SX</td><td style="${cell}">Trưởng Ca</td>`
        + `<td style="${cell}">Ghi Chép Trong Ca SX</td><td style="${cell}">Đánh Giá Sản Lượng</td></tr>`
        + rowsHtml + `</table>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Hao hụt thống kê ${esc(formatNgayVN(ngay))}</title>` +
      `<style>@page{size:A4 portrait;margin:10mm;}body{font-family:Arial,Helvetica,sans-serif;color:#111;}table{width:100%;border-collapse:collapse;}p{font-size:13px;}</style></head><body>` +
      (tables || '<p>Chưa có dữ liệu hao hụt.</p>') +
      (str(haoHutGhiChu) ? `<p><b>Ghi chú chung:</b> ${esc(str(haoHutGhiChu))}</p>` : '') +
      `<script>window.onload=function(){window.print();};</script></body></html>`;
    const w = window.open('', '_blank', 'width:900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">
              {isEditing ? 'Sửa báo cáo ngày' : 'Thêm báo cáo ngày'}
            </h2>
          </div>
          {onOpenList && (
            <button
              type="button"
              onClick={onOpenList}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Danh sách
            </button>
          )}
          <button
            type="button"
            onClick={mainTab === 'hao-hut' ? handlePrintHaoHut : handlePrint}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-bold text-slate-600 transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> {mainTab === 'hao-hut' ? 'In hao hụt' : 'In'}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[12.5px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEditing ? 'Cập nhật' : 'Lưu báo cáo'}
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-[12.5px] font-semibold ${messageType === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
            {message}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" /> Ngày báo cáo (1 ngày = 1 báo cáo)
            </span>
            <SoTronDatePicker value={ngay} onChange={setNgay} placeholder="Chọn ngày" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-slate-500">Ghi chú</span>
            <input
              value={ghiChu}
              onChange={e => setGhiChu(e.target.value)}
              placeholder="Ghi chú (không bắt buộc)"
              className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchSoTronByNgay(ngay)}
            disabled={isLoadingSoTron || !ngay}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingSoTron ? 'animate-spin' : ''}`} />
            {isLoadingSoTron ? 'Đang lấy từ sổ trộn…' : 'Lấy lại từ sổ trộn'}
          </button>
          {soTronInfo && <p className="text-[12px] font-medium text-slate-600">{soTronInfo}</p>}
        </div>
      </div>

      {ngay ? (
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMainTab('bao-cao')}
          className={`h-9 flex-1 rounded-lg text-[13px] font-extrabold transition ${
            mainTab === 'bao-cao' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Báo cáo ngày
        </button>
        <button
          type="button"
          onClick={() => setMainTab('hao-hut')}
          className={`h-9 flex-1 rounded-lg text-[13px] font-extrabold transition ${
            mainTab === 'hao-hut' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Hao hụt thống kê{haoHutGroups.length > 0 ? ` (${haoHutGroups.length} máy)` : ''}
        </button>
      </div>
      ) : (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-[12.5px] font-semibold text-slate-500">
        Chọn ngày báo cáo ở trên để tự động tổng hợp từ sổ trộn (Báo cáo ngày + Hao hụt thống kê theo máy/ca).
      </div>
      )}

      {mainTab === 'bao-cao' && (
      <section className={`${cardClass} space-y-3 p-4`}>
        <SectionHeader
          index="1"
          title="Nhập thành phẩm"
          desc="Tìm theo mã AMIS / tên ghép trong danh mục sản phẩm (lưu đúng id). Tự động fill từ sổ trộn khi chọn ngày, cho sửa tay."
        />
        <ThanhPhamTable
          rows={tpRows}
          editable
          onChange={patchTp}
          onRemove={key => setTpRows(prev => prev.filter(r => r.key !== key))}
          products={products}
        />
      </section>
      )}

      {mainTab === 'bao-cao' && (
      <section className={`${cardClass} space-y-3 p-4`}>
        <SectionHeader
          index="2"
          title="Phế hỏng trong ca"
          desc="Tự động gom từ sổ trộn (bang_hang_loi theo tên lỗi). Cột Đợt nhập tay."
        />
        <PheHongTable
          rows={pheRows}
          editable
          onChange={patchPhe}
          onRemove={key => setPheRows(prev => prev.filter(r => r.key !== key))}
        />
      </section>
      )}

      {mainTab === 'bao-cao' && (
      <section className={`${cardClass} space-y-3 p-4`}>
        <SectionHeader
          index="3"
          title="Vật tư"
          desc="Tìm theo mã / tên SX trong kho NVL (lưu đúng id). Tồn đầu ngày = Σ tồn ca 12C1/HC1; Nhập VT = Σ Nhập Trong Ngày; Tồn trong ngày = Tồn đầu + Nhập − Sử dụng; Hao hụt = Tồn đầu + Nhập − Tồn trong."
        />
        <VatTuTable
          rows={vtRows}
          editable
          onChange={patchVt}
          onRemove={key => setVtRows(prev => prev.filter(r => r.key !== key))}
          materials={materials}
        />
      </section>
      )}

      {mainTab === 'bao-cao' && (
      <section className={`${cardClass} space-y-3 p-4`}>
        <SectionHeader
          index="4"
          title="Xem trước phiếu (giống mẫu giấy)"
          desc="Tự động cập nhật theo 3 bảng trên."
        />
        <BaoCaoNgayPreviewTable
          ngay={ngay}
          rows={{
            tp: tpRows.map(r => ({ ma_hang: r.ma_hang, so_luong: r.so_luong, trong_luong: r.trong_luong })),
            phe: pheRows.map(r => ({ loai_phe: r.loai_phe, so_luong: r.so_luong, dot: r.dot })),
            vt: vtRows.map(r => ({
              ten_nvl: r.ten_nvl,
              ton_dau_ngay: r.ton_dau_ngay,
              nhap_vt: r.nhap_vt,
              ton_trong_ngay: r.ton_trong_ngay,
              hao_hut: r.hao_hut
            }))
          }}
        />
      </section>
      )}
      {mainTab === 'hao-hut' && (
      <section className={`${cardClass} space-y-3 p-4`}>
        <SectionHeader
          index="5"
          title={`Hao hụt thống kê ngày ${formatNgayGachCheo(ngay) || '…'}`}
          desc="Thống kê từ sổ trộn theo máy, theo ca (không thêm/bớt máy, ca). Trưởng ca lấy đúng người của máy+ca+ngày từ lịch phân công, dropdown chỉ hiện vai trò Trưởng ca — chọn tay thì giữ, fill lại không đè. Hao hụt âm, TP đạt, Phế là ô số nhập tay. Đánh giá chỉ Đạt/Không đạt. SL Mục tiêu nhập tay."
        />
        <HaoHutThongKeEditor
          groups={haoHutGroups}
          onChangeMay={patchHaoHutMay}
          onChangeCa={handleHaoHutCaChange}
          onChangeLine={patchHaoHutLine}
          onAddLine={addHaoHutLine}
          onRemoveLine={removeHaoHutLine}
        />
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Ghi chú chung (dưới bảng hao hụt)</span>
          <textarea
            value={haoHutGhiChu}
            onChange={e => setHaoHutGhiChu(e.target.value)}
            placeholder="Ghi chú chung cho hao hụt thống kê (không bắt buộc)"
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
      </section>
      )}
      {mainTab === 'hao-hut' && (
      <section className={`${cardClass} space-y-3 p-4`}>
        <SectionHeader
          index="6"
          title="Xem trước hao hụt (giống mẫu giấy)"
          desc="Tự động cập nhật theo bảng trên."
        />
        <BaoCaoNgayHaoHutPreview ngay={ngay} groups={haoHutPreviewGroups} ghiChu={haoHutGhiChu} />
      </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danh sách (Xem / Sửa / Xóa mềm)
// ---------------------------------------------------------------------------

function BaoCaoNgayViewModal({
  report,
  onClose,
  onEdit
}: {
  report: BaoCaoNgaySavedReport;
  onClose: () => void;
  onEdit: (report: BaoCaoNgaySavedReport) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const built = useMemo(() => toEditRows(report), [report]);
  const previewRows: BaoCaoNgayPreviewRows = useMemo(() => ({
    tp: built.tp.map(r => ({ ma_hang: r.ma_hang, so_luong: r.so_luong, trong_luong: r.trong_luong })),
    phe: built.phe.map(r => ({ loai_phe: r.loai_phe, so_luong: r.so_luong, dot: r.dot })),
    vt: built.vt.map(r => ({
      ten_nvl: r.ten_nvl,
      ton_dau_ngay: r.ton_dau_ngay,
      nhap_vt: r.nhap_vt,
      ton_trong_ngay: r.ton_trong_ngay,
      hao_hut: r.hao_hut
    }))
  }), [built]);
  const [viewTab, setViewTab] = useState<'bao-cao' | 'hao-hut'>('bao-cao');
  const haoHutGroups = useMemo(() => report.hao_hut_thong_ke ?? [], [report]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-950/45 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Đóng" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ef1b2d]">Báo cáo ngày</p>
            <h3 className="mt-0.5 text-base font-black text-zinc-900">
              Ngày {formatNgayVN(report.ngay)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
            title="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
          <div className="mb-3 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewTab('bao-cao')}
              className={`h-8 flex-1 rounded-lg text-[12px] font-extrabold transition ${viewTab === 'bao-cao' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
            >
              Báo cáo ngày
            </button>
            <button
              type="button"
              onClick={() => setViewTab('hao-hut')}
              className={`h-8 flex-1 rounded-lg text-[12px] font-extrabold transition ${viewTab === 'hao-hut' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
            >
              Hao hụt thống kê{haoHutGroups.length > 0 ? ` (${haoHutGroups.length} máy)` : ''}
            </button>
          </div>
          {viewTab === 'bao-cao' ? (
          <>
          <BaoCaoNgayPreviewTable ngay={report.ngay} rows={previewRows} />
          {report.ghi_chu && (
            <p className="mt-2 text-[12.5px] text-slate-600">
              <span className="font-bold">Ghi chú:</span> {report.ghi_chu}
            </p>
          )}
          </>
          ) : (
          <BaoCaoNgayHaoHutPreview ngay={report.ngay} groups={haoHutGroups} ghiChu={report.hao_hut_ghi_chu} />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onEdit(report);
              onClose();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
          >
            <Pencil className="h-3.5 w-3.5" /> Sửa
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white transition hover:bg-zinc-800"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export function BaoCaoNgayListView({
  onBack,
  onCreate,
  onEdit
}: {
  onBack: () => void;
  onCreate: () => void;
  onEdit: (report: BaoCaoNgaySavedReport) => void;
}) {
  const [reports, setReports] = useState<BaoCaoNgaySavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [viewReport, setViewReport] = useState<BaoCaoNgaySavedReport | null>(null);
  /** Lọc từ ngày => đến ngày (dùng lịch popup tiếng Việt, không dùng input date native). Trống = chưa xem. */
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  /** Phân trang 50 bản ghi/trang. */
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const load = async (tu?: string, den?: string) => {
    const tuValue = str(tu ?? tuNgayRef.current.tu).slice(0, 10);
    const denValue = str(den ?? tuNgayRef.current.den).slice(0, 10);
    // Vào trang danh sách thì trống — chỉ hiển thị khi chọn ngày.
    if (!tuValue && !denValue) {
      setReports([]);
      setMessage('');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ limit: '1000' });
      if (tuValue) params.set('tu_ngay', tuValue);
      if (denValue) params.set('den_ngay', denValue);
      const res = await fetch(`/api/bao-cao-ngay?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(str((data as Record<string, unknown>)?.error) || 'Không thể tải danh sách báo cáo ngày.');
        return;
      }
      const list = normalizeBaoCaoNgayReports(data);
      setReports(list);
      setPage(1);
      if (list.length === 0) {
        const range = tuValue && denValue
          ? `từ ${formatNgayVN(tuValue)} đến ${formatNgayVN(denValue)}`
          : `ngày ${formatNgayVN(tuValue || denValue)}`;
        setMessage(`Không có báo cáo ngày nào ${range}.`);
      }
    } catch {
      setMessage('Không thể tải danh sách báo cáo ngày.');
    } finally {
      setIsLoading(false);
    }
  };
  const tuNgayRef = useRef({ tu: tuNgay, den: denNgay });
  useEffect(() => {
    tuNgayRef.current = { tu: tuNgay, den: denNgay };
  }, [tuNgay, denNgay]);

  const handleDelete = async (report: BaoCaoNgaySavedReport) => {
    if (!window.confirm(`Xóa (ẩn) báo cáo ngày ${formatNgayVN(report.ngay)}? Dữ liệu vẫn giữ lại, có thể khôi phục.`)) return;
    const res = await fetch(`/api/bao-cao-ngay/${encodeURIComponent(report.id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(str((data as Record<string, unknown>)?.error) || 'Không thể xóa báo cáo ngày.');
      return;
    }
    setReports(prev => prev.filter(r => r.id !== report.id));
  };

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedReports = reports.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageWindow: number[] = [];
  for (let p = Math.max(1, safePage - 2); p <= Math.min(totalPages, safePage + 2); p += 1) pageWindow.push(p);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <BackButton onClick={onBack} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">Danh sách báo cáo ngày</h2>
          <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
            Mỗi ngày 1 báo cáo, tổng hợp từ sổ trộn. Xóa là xóa mềm (ẩn khỏi danh sách, không mất dữ liệu).
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Thêm báo cáo ngày
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12.5px] font-semibold text-rose-700">
          {message}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-card">
        <label className="block min-w-[190px] flex-1 sm:max-w-[240px]">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Từ ngày</span>
          <SoTronDatePicker
            value={tuNgay}
            onChange={v => {
              setTuNgay(v);
              setPage(1);
              void load(v, denNgay);
            }}
            placeholder="Chọn từ ngày"
            max={denNgay || undefined}
          />
        </label>
        <label className="block min-w-[190px] flex-1 sm:max-w-[240px]">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Đến ngày</span>
          <SoTronDatePicker
            value={denNgay}
            onChange={v => {
              setDenNgay(v);
              setPage(1);
              void load(tuNgay, v);
            }}
            placeholder="Chọn đến ngày"
            min={tuNgay || undefined}
          />
        </label>
        {(tuNgay || denNgay) && (
          <button
            type="button"
            onClick={() => {
              setTuNgay('');
              setDenNgay('');
              setPage(1);
              void load('', '');
            }}
            className="inline-flex h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" /> Xóa lọc
          </button>
        )}
        <span className="pb-2 text-[12px] font-semibold text-slate-500">
          {tuNgay || denNgay
            ? `${tuNgay && denNgay ? `Từ ${formatNgayVN(tuNgay)} đến ${formatNgayVN(denNgay)}` : `Ngày ${formatNgayVN(tuNgay || denNgay)}`}: ${reports.length} báo cáo`
            : 'Chọn ngày để xem danh sách báo cáo ngày'}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Đang tải danh sách...
          </div>
        ) : !(tuNgay || denNgay) ? (
          <div className="px-3 py-10 text-center text-[12.5px] font-semibold text-slate-400">
            Chọn từ ngày / đến ngày ở trên để xem danh sách báo cáo ngày.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="w-36 px-3 py-2">Ngày</th>
                  <th className="px-3 py-2 text-right">TP (SL / kg)</th>
                  <th className="px-3 py-2 text-right">Phế (kg)</th>
                  <th className="px-3 py-2 text-right">Nhập VT (kg)</th>
                  <th className="px-3 py-2 text-right">Tồn trong ngày (kg)</th>
                  <th className="px-3 py-2 text-right">Hao hụt (kg)</th>
                  <th className="w-[220px] px-3 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedReports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center font-semibold text-slate-400">
                      Không có báo cáo nào trong khoảng ngày đã chọn.
                    </td>
                  </tr>
                )}
                {pagedReports.map(report => (
                  <tr key={report.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 font-bold tabular-nums">{formatNgayVN(report.ngay)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtVN(report.tong_thanh_pham_so_luong)} / {fmtVN(report.tong_thanh_pham_trong_luong)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVN(report.tong_phe)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVN(report.tong_nhap_vt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVN(report.tong_ton_trong_ngay)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtVN(report.tong_hao_hut)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewReport(report)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50"
                          title="Xem"
                        >
                          <Eye className="h-3.5 w-3.5" /> Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(report)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[12px] font-bold text-amber-700 transition hover:bg-amber-100"
                          title="Sửa"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(report)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[12px] font-bold text-rose-600 transition hover:bg-rose-100"
                          title="Xóa mềm"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(tuNgay || denNgay) && !isLoading && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-card">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            ‹ Trước
          </button>
          {pageWindow[0] > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPage(1)}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 px-2 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                1
              </button>
              {pageWindow[0] > 2 && <span className="px-1 text-slate-400">…</span>}
            </>
          )}
          {pageWindow.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[12px] font-bold transition ${
                p === safePage ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
          {pageWindow[pageWindow.length - 1] < totalPages && (
            <>
              {pageWindow[pageWindow.length - 1] < totalPages - 1 && <span className="px-1 text-slate-400">…</span>}
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 px-2 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Sau ›
          </button>
          <span className="ml-1 text-[12px] font-semibold text-slate-500">
            Trang {safePage}/{totalPages} · {reports.length} báo cáo
          </span>
        </div>
      )}

      {viewReport && (
        <BaoCaoNgayViewModal report={viewReport} onClose={() => setViewReport(null)} onEdit={onEdit} />
      )}
    </div>
  );
}
