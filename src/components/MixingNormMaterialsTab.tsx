import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, Pencil, Plus, Printer, Save, Search, Trash2, X } from 'lucide-react';
import { useTabAccess } from '../app/useTabAccess';
import { RowActionsMenu } from './shared/table';
import { SearchableSelect } from './shared/SearchableSelect';
import SearchableMultiSelect from './SearchableMultiSelect';
import {
  normalizeMixingProductionOrders,
  parseMixingProductBom,
  type MixingBomItem,
  type MixingProductionOrder
} from '../utils/mixingOrderAutofill';
import { waitForPrintImagesReady } from '../utils/printReady';
import {
  MixingNormRatioPrintBatch,
  toPrintDoc,
  type MixingNormRatioPrintDoc
} from './MixingNormRatioPrintSheet';
import { getProductionShiftOptions, normalizeShiftSettings, resolveShiftName } from '../utils/shiftSettings';
import { convertProductQuantity, type ProductConversionFactors } from '../utils/productUnitConversion';

export type MixingNormLine = {
  ma_nvl: string;
  ten_nvl: string;
  ten_nvl_san_xuat?: string;
  kho_ngam_dinh?: string;
  gia_tri: number | null;
  don_vi: string;
  /** kg — %: tong_tl × giá trị / 100; đơn vị kg: = giá trị */
  khoi_luong: number | null;
  /** % so với Định lượng 1 cối trộn tiêu chuẩn = giá trị (kg) / dinh_luong_coi × 100 */
  ty_le_coi?: number | null;
  /** % so với Tổng SL cả phiếu — bằng ty_le_coi vì tỷ lệ phối trộn không đổi theo mẻ */
  ty_le_tong?: number | null;
  /** Tổng trọng lượng NVL này cần cho cả SP (kg) = ty_le_tong × tong_trong_luong / 100 */
  tong_khoi_luong?: number | null;
};

export type MixingNormProduct = {
  ma_sp: string;
  ten_sp: string;
  tong_trong_luong: number | null;
  ghi_chu: string;
  ty_le_hao_hut?: number | null;
  so_luong_goc?: number | null;
  dinh_luong_coi?: number | null;
  so_lan_tron?: number;
  lan_tron?: Array<{ lan: number; tong_trong_luong: number | null; nvl: MixingNormLine[] }>;
  chi_tiet: MixingNormLine[];
};

export type MixingNormRow = {
  id: string;
  ngay: string;
  ca: string;
  ma_lenh_sx: string;
  ghi_chu: string;
  products: MixingNormProduct[];
  created_at?: string;
};

type MaterialOption = {
  code: string;
  name: string;
  productionName: string;
  unit: string;
  khoNgamDinh: string;
};

type ProductOption = {
  id?: string;
  code: string;
  amisCode?: string;
  newCode?: string;
  name: string;
  tenSanXuat?: string;
  totalWeight?: number | null;
  wastePercent?: number;
  nplItems?: MixingBomItem[];
};

type MixingProductConversion = ProductConversionFactors & {
  maSp: string;
  maAmis: string;
  donViTinh: string;
};

type LineForm = {
  key: string;
  maNvl: string;
  tenNvl: string;
  tenNvlSanXuat: string;
  giaTri: string;
  donVi: 'kg' | '%';
  khoNgamDinh: string;
};

type ProductForm = {
  key: string;
  /** Các mã SP được chọn trong ô "Mã sản phẩm" — có thể chọn nhiều SP dùng chung 1 công thức trộn. */
  maSpCodes: string[];
  /** Chuỗi mã SP nối bằng dấu phẩy — dùng để lưu/so trùng, tương thích ma_sp dạng string. */
  maSp: string;
  tenSp: string;
  tongTrongLuong: string;
  haoHut: string;
  soLuongGoc: string;
  soLuongTuDong: boolean;
  dinhLuongCoi: string;
  /** Danh sách NVL của 1 cối trộn tiêu chuẩn — dùng chung cho mọi cối, không nhập riêng theo lần. */
  lines: LineForm[];
};

type NormForm = {
  ngay: string;
  ca: string;
  maLenhSx: string;
  ghiChu: string;
  products: ProductForm[];
};

const inputClass =
  'h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

const emptyLine = (): LineForm => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  maNvl: '',
  tenNvl: '',
  tenNvlSanXuat: '',
  giaTri: '',
  donVi: 'kg',
  khoNgamDinh: ''
});

const emptyProduct = (): ProductForm => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  maSpCodes: [],
  maSp: '',
  tenSp: '',
  tongTrongLuong: '',
  haoHut: '0',
  soLuongGoc: '',
  soLuongTuDong: false,
  dinhLuongCoi: '',
  lines: [emptyLine()]
});

function computeMixingRoundCount(tongTrongLuong: number, dinhLuongCoi: number) {
  return tongTrongLuong > 0 && dinhLuongCoi > 0 ? Math.ceil(tongTrongLuong / dinhLuongCoi) : 1;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

/** % Cối trộn = giá trị / Định lượng 1 cối tiêu chuẩn; % Tổng SL giữ nguyên vì tỷ lệ không đổi theo mẻ. */
function computeNplPercents(
  giaTri: number | null,
  donVi: 'kg' | '%',
  dinhLuongCoi: number,
  tongTrongLuong: number | null
): { ty_le_coi: number | null; ty_le_tong: number | null; tong_khoi_luong: number | null } {
  if (giaTri === null || !Number.isFinite(giaTri)) {
    return { ty_le_coi: null, ty_le_tong: null, tong_khoi_luong: null };
  }
  const ty_le_coi = donVi === '%'
    ? roundPercent(giaTri)
    : dinhLuongCoi > 0
      ? roundPercent((giaTri / dinhLuongCoi) * 100)
      : null;
  const ty_le_tong = ty_le_coi;
  const tong_khoi_luong = ty_le_tong !== null && tongTrongLuong
    ? roundMixing((ty_le_tong / 100) * tongTrongLuong)
    : null;
  return { ty_le_coi, ty_le_tong, tong_khoi_luong };
}

/**
 * ĐV của NVL trong cối trộn tiêu chuẩn luôn là kg — dòng cũ lưu dạng % (định lượng cối lúc đó)
 * được quy đổi sang kg; nếu chưa biết định lượng cối thì để trống cho người dùng tự nhập.
 */
function toKgLineForm(line: LineForm, dinhLuongCoi: number): LineForm {
  if (line.donVi !== '%') return line.donVi === 'kg' ? line : { ...line, donVi: 'kg' };
  const percent = parseNumberOrNull(line.giaTri);
  const kg = percent !== null && dinhLuongCoi > 0 ? roundMixing((percent / 100) * dinhLuongCoi) : null;
  return { ...line, donVi: 'kg', giaTri: kg !== null ? String(kg) : '' };
}

const emptyForm = (): NormForm => ({
  ngay: new Date().toISOString().slice(0, 10),
  ca: '',
  maLenhSx: '',
  ghiChu: '',
  products: [emptyProduct()]
});

function productToForm(
  product: MixingNormProduct,
  idHint = '',
  materialsByCode: Map<string, MaterialOption> = new Map()
): ProductForm {
  const baseLines = product.chi_tiet.length > 0
    ? product.chi_tiet.map(line =>
        toKgLineForm(
          {
            key: `${idHint}-${line.ma_nvl}-${Math.random().toString(36).slice(2, 6)}`,
            maNvl: line.ma_nvl,
            tenNvl: line.ten_nvl,
            tenNvlSanXuat: line.ten_nvl_san_xuat || materialsByCode.get(line.ma_nvl)?.productionName || '',
            khoNgamDinh: line.kho_ngam_dinh || materialsByCode.get(line.ma_nvl)?.khoNgamDinh || '',
            giaTri: line.gia_tri === null || line.gia_tri === undefined ? '' : String(line.gia_tri),
            donVi: line.don_vi === '%' ? '%' as const : 'kg' as const
          },
          product.dinh_luong_coi ?? 0
        )
      )
    : [emptyLine()];
  return {
    key: `${idHint}-${product.ma_sp}-${Math.random().toString(36).slice(2, 6)}`,
    maSpCodes: product.ma_sp
      .split(',')
      .map(code => code.trim())
      .filter(Boolean),
    maSp: product.ma_sp,
    tenSp: product.ten_sp,
    tongTrongLuong:
      product.tong_trong_luong === null || product.tong_trong_luong === undefined
        ? ''
        : String(product.tong_trong_luong),
    haoHut: product.ty_le_hao_hut == null ? '0' : String(product.ty_le_hao_hut),
    soLuongGoc: product.so_luong_goc == null ? '' : String(product.so_luong_goc),
    soLuongTuDong: product.so_luong_goc != null,
    dinhLuongCoi: product.dinh_luong_coi == null ? '' : String(product.dinh_luong_coi),
    lines: baseLines
  };
}

function normalizeMaterials(data: unknown): MaterialOption[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { materials?: unknown }).materials)
      ? (data as { materials: unknown[] }).materials
      : [];

  const mapped = rows
    .map((item): MaterialOption | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const code = String(row.ma_npl ?? row.ma_nvl ?? row.code ?? '').trim();
      const name = String(row.ten_npl ?? row.ten_nvl ?? row.name ?? '').trim();
      const productionName = String(row.ten_nvl_sx ?? row.productionName ?? '').trim();
      if (!code && !name) return null;
      const unitRaw = String(row.don_vi ?? 'kg').trim();
      return {
        code,
        name,
        productionName,
        unit: unitRaw === '%' ? '%' : 'kg',
        khoNgamDinh: String(row.kho_ngam_dinh ?? '').trim()
      };
    })
    .filter((item): item is MaterialOption => Boolean(item));

  const byCode = new Map<string, MaterialOption>();
  for (const item of mapped) {
    if (!item.code) continue;
    if (!byCode.has(item.code)) byCode.set(item.code, item);
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'vi'));
}

function normalizeCatalogProducts(data: unknown): ProductOption[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { products?: unknown }).products)
      ? (data as { products: unknown[] }).products
      : [];

  const byCode = new Map<string, ProductOption>();
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const code = String(
      row.ma_sp ?? row.productCode ?? row.code ?? row.ma_hang ?? ''
    ).trim();
    const name = String(
      row.ten_sp ?? row.productName ?? row.name ?? row.ten_hang ?? ''
    ).trim();
    if (!code && !name) continue;
    const key = code || name;
    if (!byCode.has(key)) byCode.set(key, {
      id: String(row.id ?? '').trim(),
      code: code || name,
      amisCode: String(row.ma_amis ?? row.amisCode ?? '').trim(),
      newCode: String(row.ma_sp_moi ?? row.newCode ?? '').trim(),
      name: name || code,
      tenSanXuat: String(row.ten_san_xuat ?? row.tenSanXuat ?? '').trim(),
      totalWeight: parseNumberOrNull(row.tong_trong_luong ?? row.totalWeight),
      wastePercent: parseNumberOrNull(row.ty_le_hao_hut ?? row.wastePercent) ?? 0,
      nplItems: parseMixingProductBom(row.npl_phan_tram ?? row.nplPhanTram)
    });
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'vi'));
}

function parseNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Khối lượng (kg): % → tổng TL × % / 100; kg → = giá trị. */
export function calcNvlKhoiLuong(
  tongTrongLuong: number | null,
  giaTri: number | null,
  donVi: string
): number | null {
  if (giaTri === null || !Number.isFinite(giaTri)) return null;
  if (String(donVi || '').trim() === '%') {
    if (tongTrongLuong === null || !Number.isFinite(tongTrongLuong)) return null;
    return (tongTrongLuong * giaTri) / 100;
  }
  return giaTri;
}

function formatKhoiLuongDisplay(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)} kg`;
}

function normalizeProductLookupKey(value: string) {
  return value.trim().toLocaleLowerCase('vi').replace(/\s+/g, '');
}

function findCatalogProductByAnyCode(products: ProductOption[], value: string) {
  const key = normalizeProductLookupKey(value);
  if (!key) return undefined;
  return products.find(product =>
    [product.code, product.amisCode ?? '', product.newCode ?? '']
      .some(code => normalizeProductLookupKey(code) === key)
  );
}

function roundMixing(value: number) {
  return Math.round(value * 1000) / 1000;
}

function bomToLineForms(items: MixingBomItem[]): LineForm[] {
  const lines = items.map(item => ({
    key: `${Date.now()}-${item.code}-${Math.random().toString(36).slice(2, 6)}`,
    maNvl: item.code,
    tenNvl: item.name,
    tenNvlSanXuat: item.productionName,
    giaTri: String(item.amountType === 'percent' ? item.percent ?? '' : item.quantity ?? ''),
    donVi: item.amountType === 'percent' ? '%' as const : 'kg' as const,
    khoNgamDinh: ''
  }));
  return lines.length ? lines : [emptyLine()];
}

function normalizeLines(raw: unknown, tongTrongLuong: number | null = null): MixingNormLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): MixingNormLine | null => {
      if (!item || typeof item !== 'object') return null;
      const line = item as Record<string, unknown>;
      const ma_nvl = String(line.ma_nvl ?? '').trim();
      const ten_nvl = String(line.ten_nvl ?? '').trim();
      const ten_nvl_san_xuat = String(line.ten_nvl_san_xuat ?? line.tenNvlSanXuat ?? '').trim();
      if (!ma_nvl && !ten_nvl) return null;
      const gia_tri = parseNumberOrNull(line.gia_tri ?? line.dinh_muc);
      const don_vi = String(line.don_vi ?? 'kg').trim() === '%' ? '%' : 'kg';
      const saved = parseNumberOrNull(line.khoi_luong ?? line.khoiLuong);
      return {
        ma_nvl,
        ten_nvl,
        ten_nvl_san_xuat,
        gia_tri,
        don_vi,
        khoi_luong: saved ?? calcNvlKhoiLuong(tongTrongLuong, gia_tri, don_vi),
        ty_le_coi: parseNumberOrNull(line.ty_le_coi ?? line.tyLeCoi),
        ty_le_tong: parseNumberOrNull(line.ty_le_tong ?? line.tyLeTong),
        tong_khoi_luong: parseNumberOrNull(line.tong_khoi_luong ?? line.tongKhoiLuong)
      };
    })
    .filter((line): line is MixingNormLine => Boolean(line));
}

/** NEW product block in chi_tiet: { ma_sp, nvl|chi_tiet } — not a flat NVL line. */
function looksLikeProductBlock(item: Record<string, unknown>): boolean {
  if (Array.isArray(item.nvl)) return true;
  if (Array.isArray(item.chi_tiet) && (item.ma_sp || item.ten_sp)) return true;
  const maSp = String(item.ma_sp ?? '').trim();
  const maNvl = String(item.ma_nvl ?? '').trim();
  return Boolean(maSp) && !maNvl;
}

function normalizeProductBlock(item: Record<string, unknown>): MixingNormProduct | null {
  const ma_sp = String(item.ma_sp ?? '').trim();
  const ten_sp = String(item.ten_sp ?? '').trim();
  const tong_trong_luong = parseNumberOrNull(item.tong_trong_luong);
  const nvlRaw = item.nvl ?? item.chi_tiet;
  const chi_tiet = normalizeLines(nvlRaw, tong_trong_luong);
  const lan_tron = Array.isArray(item.lan_tron)
    ? item.lan_tron.map((round, index) => {
        const source = round && typeof round === 'object' ? round as Record<string, unknown> : {};
        return {
          lan: Math.max(1, Math.trunc(parseNumberOrNull(source.lan) ?? index + 1)),
          tong_trong_luong: parseNumberOrNull(source.tong_trong_luong),
          nvl: normalizeLines(source.nvl, parseNumberOrNull(source.tong_trong_luong))
        };
      })
    : [];
  if (!ma_sp && !ten_sp && chi_tiet.length === 0) return null;
  return {
    ma_sp,
    ten_sp,
    tong_trong_luong,
    ghi_chu: String(item.ghi_chu ?? '').trim(),
    ty_le_hao_hut: parseNumberOrNull(item.ty_le_hao_hut),
    so_luong_goc: parseNumberOrNull(item.so_luong_goc),
    dinh_luong_coi: parseNumberOrNull(item.dinh_luong_coi),
    so_lan_tron: Math.max(0, Math.trunc(parseNumberOrNull(item.so_lan_tron) ?? 0)),
    lan_tron,
    chi_tiet
  };
}

function normalizeRows(data: unknown): MixingNormRow[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { records?: unknown }).records)
      ? (data as { records: unknown[] }).records
      : [];

  return rows
    .map((item): MixingNormRow | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? '').trim();
      if (!id) return null;

      const rawChiTiet = row.chi_tiet;
      let products: MixingNormProduct[] = [];

      if (Array.isArray(rawChiTiet) && rawChiTiet.length > 0) {
        const first = rawChiTiet[0];
        const isNewFormat =
          first && typeof first === 'object' && looksLikeProductBlock(first as Record<string, unknown>);

        if (isNewFormat) {
          products = rawChiTiet
            .map(entry =>
              entry && typeof entry === 'object'
                ? normalizeProductBlock(entry as Record<string, unknown>)
                : null
            )
            .filter((p): p is MixingNormProduct => Boolean(p));
        } else {
          // LEGACY: chi_tiet = flat NVL lines + row-level SP fields
          const tong_trong_luong = parseNumberOrNull(row.tong_trong_luong);
          let chi_tiet = normalizeLines(rawChiTiet, tong_trong_luong);
          if (chi_tiet.length === 0) {
            const ma = String(row.ma_nvl ?? '').trim();
            const ten = String(row.ten_nvl ?? '').trim();
            if (ma || ten) {
              const gia_tri = parseNumberOrNull(row.dinh_muc);
              const don_vi =
                String(row.don_vi_dinh_muc ?? 'kg').trim() === '%' ? '%' : 'kg';
              chi_tiet = [
                {
                  ma_nvl: ma,
                  ten_nvl: ten,
                  gia_tri,
                  don_vi,
                  khoi_luong: calcNvlKhoiLuong(tong_trong_luong, gia_tri, don_vi)
                }
              ];
            }
          }
          products = [
            {
              ma_sp: String(row.ma_sp ?? '').trim(),
              ten_sp: String(row.ten_sp ?? '').trim(),
              tong_trong_luong,
              ghi_chu: String(row.ghi_chu ?? '').trim(),
              ty_le_hao_hut: null,
              so_luong_goc: tong_trong_luong,
              dinh_luong_coi: null,
              so_lan_tron: 0,
              chi_tiet
            }
          ];
        }
      } else {
        // Empty chi_tiet — still wrap legacy SP columns if present
        const ma_sp = String(row.ma_sp ?? '').trim();
        const ten_sp = String(row.ten_sp ?? '').trim();
        const tong_trong_luong = parseNumberOrNull(row.tong_trong_luong);
        const ma = String(row.ma_nvl ?? '').trim();
        const ten = String(row.ten_nvl ?? '').trim();
        const chi_tiet: MixingNormLine[] =
          ma || ten
            ? (() => {
                const gia_tri = parseNumberOrNull(row.dinh_muc);
                const don_vi =
                  String(row.don_vi_dinh_muc ?? 'kg').trim() === '%' ? '%' : 'kg';
                return [
                  {
                    ma_nvl: ma,
                    ten_nvl: ten,
                    gia_tri,
                    don_vi,
                    khoi_luong: calcNvlKhoiLuong(tong_trong_luong, gia_tri, don_vi)
                  }
                ];
              })()
            : [];
        if (ma_sp || ten_sp || chi_tiet.length > 0) {
          products = [
            {
              ma_sp,
              ten_sp,
              tong_trong_luong,
              ghi_chu: String(row.ghi_chu ?? '').trim(),
              ty_le_hao_hut: null,
              so_luong_goc: tong_trong_luong,
              dinh_luong_coi: null,
              so_lan_tron: 0,
              chi_tiet
            }
          ];
        }
      }

      return {
        id,
        ngay: String(row.ngay ?? '').trim(),
        ca: String(row.ca ?? '').trim(),
        ma_lenh_sx: String(row.ma_lenh_sx ?? '').trim(),
        ghi_chu: String(row.ghi_chu ?? '').trim(),
        products,
        created_at: row.created_at ? String(row.created_at) : undefined
      };
    })
    .filter((row): row is MixingNormRow => Boolean(row));
}

function summarizeLines(lines: MixingNormLine[]) {
  if (lines.length === 0) return 'Chưa có NVL';
  return lines
    .map(line => {
      const name = line.ten_nvl || line.ma_nvl || 'NVL';
      const value =
        line.gia_tri === null || line.gia_tri === undefined ? '—' : `${line.gia_tri}${line.don_vi || ''}`;
      return `${name}: ${value}`;
    })
    .join(' · ');
}

type SummarizedMaterial = {
  ma_nvl: string;
  ten_nvl: string;
  khoi_luong: number | null;
  gia_tri: number | null;
  don_vi: string;
};

/** Cộng khối lượng cùng NVL qua toàn bộ cối trộn; phiếu cũ dùng chi_tiet. */
function summarizeProductMaterials(product: MixingNormProduct): SummarizedMaterial[] {
  const hasMixingRounds = Boolean(product.lan_tron?.length);
  const sourceLines = hasMixingRounds
    ? product.lan_tron!.flatMap(round => round.nvl)
    : product.chi_tiet;
  const byMaterial = new Map<string, SummarizedMaterial>();

  sourceLines.forEach((line, index) => {
    const key = `${line.ma_nvl.trim().toLocaleLowerCase('vi')}|${line.ten_nvl.trim().toLocaleLowerCase('vi')}`
      || `line-${index}`;
    const current = byMaterial.get(key);
    const weight = line.khoi_luong;
    if (!current) {
      byMaterial.set(key, {
        ma_nvl: line.ma_nvl,
        ten_nvl: line.ten_nvl,
        khoi_luong: weight,
        gia_tri: line.gia_tri,
        don_vi: line.don_vi
      });
      return;
    }
    current.khoi_luong = current.khoi_luong === null || current.khoi_luong === undefined
      ? weight
      : weight === null || weight === undefined
        ? current.khoi_luong
        : current.khoi_luong + weight;
  });

  return [...byMaterial.values()];
}

function summarizeProductsNvl(products: MixingNormProduct[]) {
  if (products.length === 0) return '—';
  return products
    .map(product => {
      const label = product.ma_sp || product.ten_sp || 'SP';
      const materials = summarizeProductMaterials(product);
      const details = materials.length === 0
        ? 'Chưa có NVL'
        : materials.map(line => {
            const name = line.ten_nvl || line.ma_nvl || 'NVL';
            return `${name}: ${line.khoi_luong == null
              ? `${line.gia_tri ?? '—'} ${line.don_vi || 'kg'}`
              : formatKhoiLuongDisplay(line.khoi_luong)}`;
          }).join(' · ');
      return `${label}: ${details}`;
    })
    .join(' | ');
}

export default function MixingNormMaterialsTab() {
  const { canCreate, canEdit, canDelete } = useTabAccess('mixing-report-list');
  const [rows, setRows] = useState<MixingNormRow[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [productionOrders, setProductionOrders] = useState<MixingProductionOrder[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductOption[]>([]);
  const [productConversions, setProductConversions] = useState<MixingProductConversion[]>([]);
  const [shiftOptions, setShiftOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [errorProductKey, setErrorProductKey] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [copySourceTitle, setCopySourceTitle] = useState('');
  const [form, setForm] = useState<NormForm>(emptyForm);
  const [printDocs, setPrintDocs] = useState<MixingNormRatioPrintDoc[]>([]);
  const [pendingPrint, setPendingPrint] = useState(false);

  const materialsByCode = useMemo(() => {
    const map = new Map<string, MaterialOption>();
    for (const item of materials) map.set(item.code, item);
    return map;
  }, [materials]);

  const selectedOrder = useMemo(() => {
    const needle = form.maLenhSx.trim().toLowerCase();
    if (!needle) return null;
    return (
      productionOrders.find(order => order.orderCode.trim().toLowerCase() === needle) ||
      productionOrders.find(order => order.orderCode.trim().toLowerCase().includes(needle)) ||
      null
    );
  }, [form.maLenhSx, productionOrders]);

  const productOptions = useMemo((): ProductOption[] => {
    const byCode = new Map<string, ProductOption>();
    const add = (code: string, name: string) => {
      const trimmedCode = code.trim();
      if (!trimmedCode) return;
      const catalog = findCatalogProductByAnyCode(catalogProducts, trimmedCode);
      // Gộp theo mã CHUẨN của catalog (ma_sp) khi tìm thấy — tránh trường hợp lệnh SX tham
      // chiếu SP bằng ma_amis/ma_sp_moi khác chuỗi ma_sp, tạo ra 1 dòng trùng lặp không có
      // npl_phan_tram bên cạnh dòng catalog đúng, khiến chọn nhầm dòng thì không fill được NVL.
      const canonicalKey = catalog ? catalog.code : trimmedCode;
      if (byCode.has(canonicalKey)) return;
      byCode.set(canonicalKey, catalog
        ? { ...catalog, name: name.trim() || catalog.name }
        : { code: trimmedCode, name: name.trim() });
    };

    // Nạp toàn bộ catalog trước — đây là nguồn chuẩn có sẵn npl_phan_tram (nplItems).
    for (const product of catalogProducts) {
      add(product.code, product.name);
    }
    // Sau đó bổ sung SP theo lệnh SX (nếu có) — chỉ để lấp chỗ cho mã hoàn toàn chưa có trong catalog.
    if (selectedOrder) {
      for (const line of selectedOrder.productLines) {
        add(line.productCode, line.productName);
      }
    }
    for (const order of productionOrders) {
      for (const line of order.productLines) {
        add(line.productCode, line.productName);
      }
    }

    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, 'vi'));
  }, [catalogProducts, productionOrders, selectedOrder]);

  const productLabel = (option: ProductOption) =>
    `${option.amisCode || option.code} — ${option.tenSanXuat || option.name}`;

  const productSearchText = (option: ProductOption) =>
    `${option.code} ${option.amisCode ?? ''} ${option.newCode ?? ''} ${option.name} ${option.tenSanXuat ?? ''}`;

  const productOptionsByCode = useMemo(() => {
    const map = new Map<string, ProductOption>();
    productOptions.forEach(option => map.set(option.code, option));
    return map;
  }, [productOptions]);

  /** Trả về ProductOption cho từng mã đã chọn — dùng luôn để hiển thị chip trong multi-select. */
  const resolveProductOptionsForCodes = (codes: string[]): ProductOption[] =>
    codes.map(code => {
      const fromOptions = productOptionsByCode.get(code);
      if (fromOptions) return fromOptions;
      const catalog = findCatalogProductByAnyCode(catalogProducts, code);
      return catalog ? { ...catalog, code } : { code, name: code };
    });

  const hasAnyProduct = form.products.some(product => product.maSpCodes.length > 0);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bang-tron-vat-tu-dinh-muc');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không tải được phiếu trộn định mức.');
      setRows(normalizeRows(data));
    } catch (err: any) {
      setRows([]);
      setError(err?.message || 'Không tải được phiếu trộn định mức.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReferenceData = useCallback(async () => {
    try {
      const [materialRes, orderRes, productRes, settingRes, conversionRes] = await Promise.all([
        fetch('/api/kho-nvl'),
        fetch('/api/lenh-sx'),
        fetch('/api/san-pham?format=table'),
        fetch('/api/cai-dat'),
        fetch('/api/bang-quy-doi-san-pham?page=1&pageSize=200')
      ]);
      const materialData = await materialRes.json().catch(() => ({}));
      const orderData = await orderRes.json().catch(() => ({}));
      const productData = await productRes.json().catch(() => ({}));
      const settingData = await settingRes.json().catch(() => ({}));
      const conversionData = await conversionRes.json().catch(() => ({}));
      if (materialRes.ok) setMaterials(normalizeMaterials(materialData));
      if (orderRes.ok) setProductionOrders(normalizeMixingProductionOrders(orderData));
      if (productRes.ok) setCatalogProducts(normalizeCatalogProducts(productData));
      if (settingRes.ok) setShiftOptions(getProductionShiftOptions(normalizeShiftSettings(settingData)));
      if (conversionRes.ok) {
        const conversions = Array.isArray(conversionData.items) ? conversionData.items as MixingProductConversion[] : [];
        const total = Number(conversionData.total) || conversions.length;
        for (let page = 2; conversions.length < total; page += 1) {
          const res = await fetch(`/api/bang-quy-doi-san-pham?page=${page}&pageSize=200`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) break;
          const items = Array.isArray(data.items) ? data.items as MixingProductConversion[] : [];
          if (!items.length) break;
          conversions.push(...items);
        }
        setProductConversions(conversions);
      }
    } catch {
      // giữ partial data nếu một nguồn lỗi
    }
  }, []);

  useEffect(() => {
    void loadRows();
    void loadReferenceData();
  }, [loadRows, loadReferenceData]);

  useEffect(() => {
    if (printDocs.length === 0) return;
    document.body.classList.add('mixing-norm-ratio-print-active');
    return () => {
      document.body.classList.remove('mixing-norm-ratio-print-active');
    };
  }, [printDocs]);

  useEffect(() => {
    if (!pendingPrint || printDocs.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      waitForPrintImagesReady().then(() => {
        if (cancelled) return;
        window.print();
        setPendingPrint(false);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pendingPrint, printDocs]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintDocs([]);
      setPendingPrint(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row => {
      const spText = row.products
        .map(p => `${p.ma_sp} ${p.ten_sp} ${p.tong_trong_luong ?? ''} ${p.ghi_chu} ${summarizeLines(p.chi_tiet)}`)
        .join(' ');
      return `${row.ngay} ${row.ca} ${row.ma_lenh_sx} ${row.ghi_chu} ${spText}`.toLowerCase().includes(q);
    });
  }, [query, rows]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditingId('');
    setCopySourceTitle('');
    setForm(emptyForm());
    setShowForm(true);
    setError('');
    setErrorProductKey('');
    setMessage('');
  };

  const openEdit = (row: MixingNormRow) => {
    if (!canEdit) return;
    setEditingId(row.id);
    setCopySourceTitle('');
    setForm({
      ngay: row.ngay || new Date().toISOString().slice(0, 10),
      ca: row.ca,
      maLenhSx: row.ma_lenh_sx,
      ghiChu: row.ghi_chu,
      products:
        row.products.length > 0
          ? row.products.map(product => productToForm(product, row.id, materialsByCode))
          : [emptyProduct()]
    });
    setShowForm(true);
    setError('');
    setErrorProductKey('');
    setMessage('');
  };

  const openCopy = (row: MixingNormRow) => {
    if (!canCreate) return;
    setEditingId('');
    setCopySourceTitle(
      `Nhân bản phiếu trộn định mức · Ca ${row.ca || '—'} · Lệnh SX ${row.ma_lenh_sx || '—'}`
    );
    setForm({
      ngay: new Date().toISOString().slice(0, 10),
      ca: row.ca,
      // Mỗi lệnh SX chỉ có 1 phiếu trộn định mức — bỏ trống để buộc chọn lệnh SX khác khi nhân bản.
      maLenhSx: '',
      ghiChu: row.ghi_chu,
      products: row.products.length > 0
        ? row.products.map(product => productToForm(product, `${row.id}-copy`, materialsByCode))
        : [emptyProduct()]
    });
    setShowForm(true);
    setError('');
    setErrorProductKey('');
    setMessage('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId('');
    setCopySourceTitle('');
    setForm(emptyForm());
  };

  const resolveOrderLineKg = (
    line: MixingProductionOrder['productLines'][number],
    catalog?: ProductOption
  ): number | null => {
    const quantity = line.quantity;
    if (quantity === null || !Number.isFinite(quantity) || quantity < 0) return null;
    if (/^kg$/i.test(line.unit.trim())) return quantity;
    const codeKey = normalizeProductLookupKey(line.productCode);
    const sameProduct = (item: MixingProductConversion) =>
      Boolean(catalog?.id && item.sanPhamId === catalog.id) ||
      normalizeProductLookupKey(item.maSp) === codeKey ||
      normalizeProductLookupKey(item.maAmis) === codeKey;
    const unitKey = line.unit.trim().toLocaleLowerCase('vi').replace('m²', 'm2');
    const conversion = productConversions.find(item =>
      sameProduct(item) && item.donViTinh.trim().toLocaleLowerCase('vi').replace('m²', 'm2') === unitKey
    ) ?? productConversions.find(sameProduct);
    if (conversion) {
      const converted = convertProductQuantity(quantity, line.unit, 'kg', conversion);
      if (converted !== null && Number.isFinite(converted)) return roundMixing(converted);
    }
    if (line.convertedWeightKg !== null && line.convertedWeightKg > 0) return line.convertedWeightKg;
    return catalog?.totalWeight ? roundMixing(quantity * catalog.totalWeight) : null;
  };

  const selectOrder = (orderCode: string) => {
    const order = productionOrders.find(item => item.orderCode === orderCode);
    setForm(prev => ({
      ...prev,
      maLenhSx: orderCode,
      products: editingId || !order
        ? prev.products
        : order.productLines.map(line => {
            const catalog = findCatalogProductByAnyCode(catalogProducts, line.productCode);
            const sourceKg = resolveOrderLineKg(line, catalog);
            const waste = catalog?.wastePercent ?? 0;
            const total = sourceKg === null ? null : roundMixing(sourceKg * (1 + waste / 100));
            return {
              ...emptyProduct(),
              maSpCodes: [line.productCode],
              maSp: line.productCode,
              tenSp: '',
              soLuongGoc: sourceKg === null ? '' : String(roundMixing(sourceKg)),
              soLuongTuDong: sourceKg !== null,
              haoHut: String(waste),
              tongTrongLuong: total === null ? '' : String(total),
              lines: bomToLineForms(catalog?.nplItems ?? []).map(line => toKgLineForm(line, 0))
            };
          })
    }));
  };

  const updateProduct = (productKey: string, patch: Partial<ProductForm>) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.map(product =>
        product.key === productKey ? { ...product, ...patch } : product
      )
    }));
  };

  const updateManualSourceQuantity = (productKey: string, value: string) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.map(product => {
        if (product.key !== productKey) return product;
        const source = parseNumberOrNull(value);
        const waste = parseNumberOrNull(product.haoHut) ?? 0;
        return {
          ...product,
          soLuongGoc: value,
          tongTrongLuong: source === null ? '' : String(roundMixing(source * (1 + waste / 100)))
        };
      })
    }));
  };

  const updateMixingBatch = (productKey: string, value: string) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.map(product => product.key === productKey
        ? { ...product, dinhLuongCoi: value }
        : product)
    }));
  };

  const buildSingleProductFromCode = (code: string): ProductForm => {
    const catalog = findCatalogProductByAnyCode(catalogProducts, code);
    const orderLine = selectedOrder?.productLines.find(item => normalizeProductLookupKey(item.productCode) === normalizeProductLookupKey(code));
    const sourceKg = orderLine ? resolveOrderLineKg(orderLine, catalog) : null;
    const waste = catalog?.wastePercent ?? 0;
    return {
      ...emptyProduct(),
      maSpCodes: [code],
      maSp: code,
      tenSp: '',
      soLuongGoc: sourceKg === null ? '' : String(roundMixing(sourceKg)),
      soLuongTuDong: sourceKg !== null,
      haoHut: String(waste),
      tongTrongLuong: sourceKg === null ? '' : String(roundMixing(sourceKg * (1 + waste / 100))),
      lines: bomToLineForms(catalog?.nplItems ?? []).map(line => toKgLineForm(line, 0))
    };
  };

  /**
   * Ô "Mã sản phẩm" cho phép chọn nhiều SP dùng chung 1 công thức trộn.
   * NVL trùng tên/mã giữa các SP được gộp lại chỉ lấy 1 dòng; giá trị (kg/%) KHÔNG tự fill —
   * người dùng phải tự điền vì mỗi SP có định mức gốc khác nhau.
   */
  const buildMergedProductFromCodes = (codes: string[]): ProductForm => {
    if (codes.length === 0) return emptyProduct();
    if (codes.length === 1) return buildSingleProductFromCode(codes[0]);

    const entries = codes.map(code => ({ code, catalog: findCatalogProductByAnyCode(catalogProducts, code) }));
    const waste = entries[0]?.catalog?.wastePercent ?? 0;

    let sumKg: number | null = 0;
    for (const { code, catalog } of entries) {
      const orderLine = selectedOrder?.productLines.find(
        item => normalizeProductLookupKey(item.productCode) === normalizeProductLookupKey(code)
      );
      const kg = orderLine ? resolveOrderLineKg(orderLine, catalog) : null;
      if (kg === null) {
        sumKg = null;
        break;
      }
      sumKg = (sumKg ?? 0) + kg;
    }

    const mergedLines = new Map<string, LineForm>();
    entries.forEach(({ catalog }) => {
      (catalog?.nplItems ?? []).forEach(item => {
        const dedupeKey = normalizeProductLookupKey(item.code || item.name);
        if (!dedupeKey || mergedLines.has(dedupeKey)) return;
        mergedLines.set(dedupeKey, {
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          maNvl: item.code,
          tenNvl: item.name,
          tenNvlSanXuat: item.productionName,
          giaTri: '',
          donVi: 'kg',
          khoNgamDinh: ''
        });
      });
    });

    return {
      ...emptyProduct(),
      maSpCodes: codes,
      maSp: codes.join(', '),
      tenSp: '',
      soLuongGoc: sumKg === null ? '' : String(roundMixing(sumKg)),
      soLuongTuDong: sumKg !== null,
      haoHut: String(waste),
      tongTrongLuong: sumKg === null ? '' : String(roundMixing(sumKg * (1 + waste / 100))),
      lines: mergedLines.size > 0 ? [...mergedLines.values()] : [emptyLine()]
    };
  };

  /** Chọn nhiều mã SP trong ô "Mã sản phẩm" của 1 dòng SP — dùng chung 1 công thức trộn. */
  const updateProductCodes = (productKey: string, selected: ProductOption[]) => {
    const codes = selected.map(option => option.code.trim()).filter(Boolean);
    setForm(prev => ({
      ...prev,
      products: prev.products.map(product => {
        if (product.key !== productKey) return product;
        const unchanged =
          codes.length === product.maSpCodes.length &&
          codes.every((code, index) => code === product.maSpCodes[index]);
        if (unchanged) return product;
        return { ...buildMergedProductFromCodes(codes), key: product.key };
      })
    }));
  };

  const addProduct = () => {
    setForm(prev => ({ ...prev, products: [...prev.products, emptyProduct()] }));
  };

  const removeProduct = (productKey: string) => {
    setForm(prev => {
      const next = prev.products.filter(item => item.key !== productKey);
      return { ...prev, products: next.length > 0 ? next : [emptyProduct()] };
    });
  };

  const updateLine = (productKey: string, lineKey: string, patch: Partial<LineForm>) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.map(product =>
        product.key !== productKey
          ? product
          : { ...product, lines: product.lines.map(line => line.key === lineKey ? { ...line, ...patch } : line) }
      )
    }));
  };

  const selectMaterialCode = (productKey: string, lineKey: string, code: string) => {
    const material = materialsByCode.get(code);
    updateLine(productKey, lineKey, {
      maNvl: code,
      tenNvl: material?.name ?? '',
      tenNvlSanXuat: material?.productionName ?? ''
      ,khoNgamDinh: material?.khoNgamDinh ?? ''
    });
  };

  const addLine = (productKey: string) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.map(product =>
        product.key !== productKey ? product : { ...product, lines: [...product.lines, emptyLine()] }
      )
    }));
  };

  const removeLine = (productKey: string, lineKey: string) => {
    setForm(prev => ({
      ...prev,
      products: prev.products.map(product => {
        if (product.key !== productKey) return product;
        if (product.lines.length <= 1) return product;
        return { ...product, lines: product.lines.filter(line => line.key !== lineKey) };
      })
    }));
  };

  const handleSave = async () => {
    setErrorProductKey('');
    const resolvedCa = resolveShiftName(form.ca.trim(), shiftOptions) || form.ca.trim();
    if (!resolvedCa || resolvedCa === '-' || resolvedCa === '—') {
      setError('Vui lòng chọn ca.');
      return;
    }
    if (!form.maLenhSx.trim()) {
      setError('Vui lòng chọn lệnh SX.');
      return;
    }
    const duplicateOrder = rows.find(
      row => row.ma_lenh_sx.trim() === form.maLenhSx.trim() && row.id !== editingId
    );
    if (duplicateOrder) {
      setError('Lệnh SX này đã có phiếu trộn định mức — mỗi lệnh SX chỉ được lập 1 phiếu.');
      return;
    }

    const products = form.products.filter(product => product.maSp.trim());
    if (products.length === 0) {
      setErrorProductKey(form.products[0]?.key || '');
      setError('Vui lòng thêm ít nhất 1 sản phẩm.');
      return;
    }

    const seenCodes = new Set<string>();
    const duplicateProduct = products.find(product =>
      product.maSpCodes.some(code => {
        const key = normalizeProductLookupKey(code);
        if (seenCodes.has(key)) return true;
        seenCodes.add(key);
        return false;
      })
    );
    if (duplicateProduct) {
      setErrorProductKey(duplicateProduct.key);
      setError('Các sản phẩm trong cùng phiếu không được trùng mã SP.');
      return;
    }

    for (const [pIndex, product] of products.entries()) {
      const hasMaterial = product.lines.some(line => line.maNvl.trim() || line.tenNvl.trim());
      if (!hasMaterial) {
        setErrorProductKey(product.key);
        setError(`Sản phẩm #${pIndex + 1} (${product.maSp}) cần ít nhất 1 dòng NVL.`);
        return;
      }
      if (parseNumberOrNull(product.soLuongGoc) === null) {
        setErrorProductKey(product.key);
        setError(`Không tính được Tổng TL của SP ${product.maSp}. Kiểm tra kết quả quy đổi trong Lệnh SX hoặc Tổng trọng lượng trong danh mục SP.`);
        return;
      }
      const batch = parseNumberOrNull(product.dinhLuongCoi);
      if (batch === null || batch <= 0) {
        setErrorProductKey(product.key);
        setError(`Định lượng 1 cối của SP ${product.maSp} phải lớn hơn 0.`);
        return;
      }
      const materialTotal = product.lines.reduce((sum, line) => sum + (parseNumberOrNull(line.giaTri) ?? 0), 0);
      if (materialTotal > batch + 0.0005) {
        setErrorProductKey(product.key);
        setError(
          `SP ${product.maSp}: tổng giá trị NVL (${formatKhoiLuongDisplay(materialTotal)}) ` +
          `không được lớn hơn Định lượng 1 cối trộn tiêu chuẩn (${formatKhoiLuongDisplay(batch)}).`
        );
        return;
      }
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payloadProducts = products.map((product, pIndex) => {
        const tong =
          product.tongTrongLuong.trim() === ''
            ? null
            : Number(product.tongTrongLuong.replace(',', '.'));
        if (tong !== null && !Number.isFinite(tong)) {
          throw new Error(`Tổng trọng lượng SP #${pIndex + 1} phải là số.`);
        }
        const batch = parseNumberOrNull(product.dinhLuongCoi) ?? 0;
        const serializeLines = (lines: LineForm[], roundWeight: number) => lines
          .filter(line => line.maNvl.trim() || line.tenNvl.trim())
          .map((line, index) => {
          const gia_tri =
            line.giaTri.trim() === '' ? null : Number(line.giaTri.replace(',', '.'));
          if (gia_tri !== null && !Number.isFinite(gia_tri)) {
            throw new Error(`Giá trị NVL #${index + 1} của SP ${product.maSp} không hợp lệ.`);
          }
          const percents = computeNplPercents(gia_tri, line.donVi, batch, tong);
          return {
            ma_nvl: line.maNvl.trim(),
            ten_nvl: line.tenNvl.trim(),
            ten_nvl_san_xuat: line.tenNvlSanXuat.trim(),
            kho_ngam_dinh: line.khoNgamDinh.trim() || null,
            gia_tri,
            don_vi: line.donVi,
            khoi_luong: calcNvlKhoiLuong(roundWeight, gia_tri, line.donVi),
            ty_le_coi: percents.ty_le_coi,
            ty_le_tong: percents.ty_le_tong,
            tong_khoi_luong: percents.tong_khoi_luong
          };
        });
        // Mọi cối dùng chung 1 công thức chuẩn — chỉ khối lượng của cối cuối được rút gọn theo phần còn lại.
        const so_lan_tron = tong && batch ? Math.ceil(tong / batch) : 0;
        const roundCount = Math.max(1, so_lan_tron);
        const lan_tron = Array.from({ length: roundCount }, (_, roundIndex) => {
          const roundWeight = tong === null || batch <= 0
            ? tong ?? 0
            : Math.min(batch, Math.max(0, tong - batch * roundIndex));
          return { lan: roundIndex + 1, tong_trong_luong: roundWeight, nvl: serializeLines(product.lines, roundWeight) };
        });
        const nvl = lan_tron[0]?.nvl ?? [];
        return {
          ma_sp: product.maSp.trim(),
          ten_sp: product.tenSp.trim(),
          tong_trong_luong: tong,
          ty_le_hao_hut: parseNumberOrNull(product.haoHut),
          so_luong_goc: parseNumberOrNull(product.soLuongGoc),
          dinh_luong_coi: parseNumberOrNull(product.dinhLuongCoi),
          so_lan_tron,
          ghi_chu: product.dinhLuongCoi.trim(),
          lan_tron,
          nvl
        };
      });

      const payload = {
        ngay: form.ngay.trim() || null,
        ca: resolvedCa,
        ma_lenh_sx: form.maLenhSx.trim(),
        ghi_chu: form.ghiChu.trim(),
        products: payloadProducts
      };

      const res = await fetch(
        editingId
          ? `/api/bang-tron-vat-tu-dinh-muc/${encodeURIComponent(editingId)}`
          : '/api/bang-tron-vat-tu-dinh-muc',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không lưu được phiếu trộn định mức.');

      setMessage(
        editingId
          ? `Đã cập nhật phiếu định mức (${products.length} SP).`
          : `Đã thêm phiếu định mức (${products.length} SP).`
      );
      closeForm();
      await loadRows();
    } catch (err: any) {
      const errorMessage = err?.message || 'Không lưu được phiếu trộn định mức.';
      const errorProduct = products.find(product => errorMessage.includes(product.maSp.trim()));
      setErrorProductKey(errorProduct?.key || products[0]?.key || '');
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Xóa phiếu trộn định mức này?')) return;
    setDeletingId(id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/bang-tron-vat-tu-dinh-muc/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không xóa được phiếu.');
      setMessage('Đã xóa phiếu trộn định mức.');
      await loadRows();
    } catch (err: any) {
      setError(err?.message || 'Không xóa được phiếu.');
    } finally {
      setDeletingId('');
    }
  };

  const handlePrintRow = (row: MixingNormRow) => {
    setError('');
    setMessage('');
    setPrintDocs([toPrintDoc(row)]);
    setPendingPrint(true);
  };

  const handlePrintFiltered = () => {
    if (filtered.length === 0) {
      setError('Không có phiếu nào để in.');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    setPrintDocs(filtered.map(toPrintDoc));
    setPendingPrint(true);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm lg:flex lg:items-center lg:gap-3">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 focus-within:border-[#ef1b2d] focus-within:ring-2 focus-within:ring-[#ef1b2d]/10">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Tìm ngày, lệnh SX, SP, NVL..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handlePrintFiltered}
          className="mt-3 flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 text-xs font-extrabold text-zinc-800 transition hover:border-zinc-950 lg:mt-0"
        >
          <Printer className="h-4 w-4" />
          In danh sách
        </button>
        {canCreate ? (
          <button
            type="button"
            onClick={openCreate}
            className="mt-3 flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#ef1b2d] px-4 text-xs font-extrabold text-white transition hover:bg-[#b30d1c] lg:mt-0"
          >
            <Plus className="h-4 w-4" />
            Thêm phiếu định mức
          </button>
        ) : null}
      </section>

      {error && !showForm && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>
      )}
      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          {message}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="whitespace-nowrap px-3 py-3 font-black">Ngày</th>
                <th className="whitespace-nowrap px-3 py-3 font-black">Ca</th>
                <th className="whitespace-nowrap px-3 py-3 font-black">Lệnh SX</th>
                <th className="whitespace-nowrap px-3 py-3 font-black">Sản phẩm</th>
                <th className="px-3 py-3 font-black">NVL / giá trị theo SP</th>
                <th className="whitespace-nowrap px-3 py-3 text-center font-black">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-red-50/40">
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-zinc-800">
                    {row.ngay || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-black text-zinc-800">{row.ca || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold text-zinc-700">
                    {row.ma_lenh_sx || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-zinc-700">
                    {row.products.length === 0 ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <div className="space-y-1">
                        {row.products.map((product, index) => (
                          <div key={`${row.id}-sp-${index}`}>
                            <span className="font-mono text-zinc-500">{product.ma_sp || '—'}</span>
                            {product.ten_sp ? <span className="ml-1">{product.ten_sp}</span> : null}
                            {product.tong_trong_luong !== null &&
                            product.tong_trong_luong !== undefined ? (
                              <span className="ml-1 font-black text-[#ef1b2d]">
                                ({product.tong_trong_luong} kg)
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td
                    className="px-3 py-2.5 text-xs font-semibold text-zinc-700"
                    title={summarizeProductsNvl(row.products)}
                  >
                    {row.products.length === 0 ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <div className="space-y-2">
                        {row.products.map((product, pIndex) => {
                          const materials = summarizeProductMaterials(product);
                          return (
                          <div key={`${row.id}-nvl-${pIndex}`}>
                            <p className="mb-0.5 font-black text-zinc-800">
                              {product.ma_sp || product.ten_sp || `SP #${pIndex + 1}`}
                            </p>
                            {materials.length === 0 ? (
                              <span className="text-zinc-400">Chưa có NVL</span>
                            ) : (
                              <div className="space-y-0.5">
                                {materials.map((line, index) => (
                                  <div
                                    key={`${row.id}-${pIndex}-${index}`}
                                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                                  >
                                    <span className="font-mono text-zinc-500">
                                      {line.ma_nvl || '—'}
                                    </span>
                                    <span>{line.ten_nvl || '—'}</span>
                                    <span className="font-black text-[#ef1b2d]">
                                      {line.khoi_luong !== null && line.khoi_luong !== undefined
                                        ? formatKhoiLuongDisplay(line.khoi_luong)
                                        : line.gia_tri === null || line.gia_tri === undefined
                                          ? '—'
                                          : `${line.gia_tri} ${line.don_vi || 'kg'}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <RowActionsMenu label={`Thao tác định mức ${row.ngay || row.id}`}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePrintRow(row)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                        title="In phiếu này"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        In
                      </button>
                      {canCreate ? (
                        <button
                          type="button"
                          onClick={() => openCopy(row)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-[11px] font-bold text-sky-700 hover:bg-sky-100"
                          title="Nhân bản"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Nhân bản
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => void handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        >
                          {deletingId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Xóa
                        </button>
                      ) : null}
                    </div>
                    </RowActionsMenu>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-bold text-zinc-500">
                    Chưa có phiếu trộn định mức. Bấm “Thêm phiếu định mức”.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center font-bold text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải...
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (canCreate || (canEdit && editingId)) ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full max-w-7xl overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                {copySourceTitle || (editingId ? 'Sửa phiếu trộn định mức' : 'Thêm phiếu trộn định mức')}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {error && !errorProductKey ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  {error}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Ca <span className="text-[#ef1b2d]">*</span></span>
                  <select value={form.ca} onChange={event => setForm(prev => ({ ...prev, ca: event.target.value }))} className={inputClass}>
                    <option value="">Chọn ca</option>
                    {form.ca && !shiftOptions.some(option => option.value === form.ca) ? (
                      <option value={form.ca}>{form.ca}</option>
                    ) : null}
                    {shiftOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    Lệnh SX <span className="text-[#ef1b2d]">*</span>
                  </span>
                  <SearchableSelect
                    value={form.maLenhSx}
                    onChange={selectOrder}
                    options={productionOrders}
                    placeholder="Chọn lệnh SX..."
                    getValue={item => (item as MixingProductionOrder).orderCode}
                    getLabel={item => {
                      const order = item as MixingProductionOrder;
                      const first = order.productLines[0];
                      return `${order.orderCode}${first ? ` — ${first.productCode}` : ''}`;
                    }}
                    getSearchText={item => {
                      const order = item as MixingProductionOrder;
                      return `${order.orderCode} ${order.productLines.map(l => `${l.productCode} ${l.productName}`).join(' ')}`;
                    }}
                    displaySelectedAsValue
                    maxResults={60}
                  />
                  {!editingId && form.maLenhSx.trim() && rows.some(row => row.ma_lenh_sx.trim() === form.maLenhSx.trim()) ? (
                    <p className="text-[11px] font-bold text-rose-600">
                      Lệnh SX này đã có phiếu trộn định mức — mỗi lệnh SX chỉ được lập 1 phiếu.
                    </p>
                  ) : null}
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    Ghi chú phiếu
                  </span>
                  <input
                    value={form.ghiChu}
                    onChange={event => setForm(prev => ({ ...prev, ghiChu: event.target.value }))}
                    className={inputClass}
                    placeholder="Ghi chú chung (tuỳ chọn)"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                  Sản phẩm ({form.products.length})
                  {selectedOrder ? ` · theo ${selectedOrder.orderCode}` : ''}
                </p>
                <button
                  type="button"
                  onClick={addProduct}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#ef1b2d]/20 bg-red-50 px-2.5 text-[11px] font-extrabold text-[#ef1b2d] hover:bg-red-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm sản phẩm
                </button>
              </div>

              {!hasAnyProduct ? (
                <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-center text-xs font-bold text-zinc-500">
                  Thêm sản phẩm → chọn mã SP → mới sổ NVL trong từng SP.
                </p>
              ) : null}

              <div className="space-y-3">
                {form.products.map((product, productIndex) => {
                  const productSelected = product.maSpCodes.length > 0;
                  const productTotal = parseNumberOrNull(product.tongTrongLuong) ?? 0;
                  const standardBatch = parseNumberOrNull(product.dinhLuongCoi) ?? 0;
                  const mixingRoundCount = computeMixingRoundCount(productTotal, standardBatch);
                  return (
                    <div
                      key={product.key}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-sm"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-600">
                          SP #{productIndex + 1}
                          {product.maSp ? ` · ${product.maSp}` : ''}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeProduct(product.key)}
                          disabled={form.products.length <= 1}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa SP
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="space-y-1 sm:col-span-2">
                          {error && errorProductKey === product.key ? (
                            <span className="block rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold normal-case tracking-normal text-rose-700">
                              {error}
                            </span>
                          ) : null}
                          <span className="text-[11px] font-bold text-zinc-500">
                            Mã sản phẩm (có thể chọn nhiều SP dùng chung 1 công thức trộn)
                          </span>
                          <SearchableMultiSelect<ProductOption>
                            values={resolveProductOptionsForCodes(product.maSpCodes)}
                            onChange={selected => updateProductCodes(product.key, selected)}
                            options={productOptions}
                            getValue={option => option.code}
                            getLabel={productLabel}
                            getSearchText={productSearchText}
                            allowCustomValues={false}
                            placeholder={productOptions.length ? 'Tìm mã SP...' : 'Chưa có sản phẩm — kiểm tra lệnh SX'}
                            inputClassName={inputClass}
                          />
                        </label>
                        <label className="space-y-1 sm:col-span-2">
                          <span className="text-[11px] font-bold text-zinc-500">
                            Tên sản phẩm / tên hiển thị cho công nhân trộn
                          </span>
                          <input
                            value={product.tenSp}
                            onChange={event => updateProduct(product.key, { tenSp: event.target.value })}
                            className={inputClass}
                            placeholder="Nhập tên hiển thị cho công nhân (không tự động điền)"
                          />
                          {productSelected ? (
                            <p className="text-[11px] font-semibold text-zinc-500">
                              Hao hụt: <strong className="text-rose-600">{product.haoHut || '0'}%</strong>
                            </p>
                          ) : null}
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-bold text-zinc-500">SL quy đổi trước hao hụt (kg)</span>
                          <input
                            value={product.soLuongTuDong && product.soLuongGoc
                              ? formatKhoiLuongDisplay(parseNumberOrNull(product.soLuongGoc))
                              : product.soLuongGoc}
                            onChange={event => updateManualSourceQuantity(product.key, event.target.value)}
                            readOnly={product.soLuongTuDong}
                            inputMode="decimal"
                            className={`${inputClass} ${product.soLuongTuDong ? 'bg-zinc-100' : 'bg-amber-50'}`}
                            placeholder="Chưa quy đổi được — nhập SL kg"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-bold text-zinc-500">Tổng SL sau hao hụt (kg)</span>
                          <input
                            value={product.tongTrongLuong ? formatKhoiLuongDisplay(parseNumberOrNull(product.tongTrongLuong)) : ''}
                            readOnly
                            className={`${inputClass} bg-zinc-100 font-black text-[#ef1b2d]`}
                            placeholder="Tự tính, không nhập tay"
                          />
                        </label>
                        <label className="space-y-1 sm:col-span-2">
                          <span className="text-[11px] font-bold text-zinc-500">Định lượng 1 cối trộn tiêu chuẩn (kg)</span>
                          <input
                            value={product.dinhLuongCoi}
                            onChange={event => updateMixingBatch(product.key, event.target.value)}
                            className={inputClass}
                            inputMode="decimal"
                            placeholder="VD: 500"
                          />
                        </label>
                      </div>

                      {productSelected ? (
                        <div className="mt-3 overflow-x-auto pb-2">
                          <div className="w-full min-w-[760px] rounded-lg border border-[#ef1b2d]/20 bg-red-50/50 p-2">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                Cối trộn tiêu chuẩn · {formatKhoiLuongDisplay(standardBatch)}
                                {mixingRoundCount > 0 ? ` · Cần trộn ~${mixingRoundCount} cối` : ''}
                              </p>
                              <button
                                type="button"
                                onClick={() => addLine(product.key)}
                                className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#ef1b2d]/20 bg-white px-2 text-[10px] font-extrabold text-[#ef1b2d] hover:bg-red-100"
                              >
                                <Plus className="h-3 w-3" />
                                Thêm NVL
                              </button>
                            </div>
                            <p className="mb-1.5 hidden text-[9px] font-bold text-zinc-400 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px_40px_56px_56px_72px_30px] sm:gap-1 sm:px-1">
                              <span>Mã NVL - Tên NVL</span>
                              <span>Tên NVL sản xuất</span>
                              <span>Giá trị</span>
                              <span>% Cối trộn</span>
                              <span>% Tổng SL</span>
                              <span>Tổng trọng lượng</span>
                              <span />
                            </p>
                            <div className="space-y-2">
                              {product.lines.map((line, index) => {
                                const gia = parseNumberOrNull(line.giaTri);
                                const { ty_le_coi, ty_le_tong, tong_khoi_luong } = computeNplPercents(
                                  gia,
                                  line.donVi,
                                  standardBatch,
                                  productTotal || null
                                );
                                return (
                                  <div
                                    key={line.key}
                                    className="grid grid-cols-1 gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_56px_40px_56px_56px_72px_30px]"
                                  >
                                    <SearchableSelect
                                      value={line.maNvl}
                                      onChange={value => selectMaterialCode(product.key, line.key, value)}
                                      options={materials}
                                      placeholder={`Tìm mã hoặc tên NVL #${index + 1}`}
                                      getValue={item => (item as MaterialOption).code}
                                      getLabel={item => `${(item as MaterialOption).code} - ${(item as MaterialOption).name}`}
                                      getSearchText={item => `${(item as MaterialOption).code} ${(item as MaterialOption).name}`}
                                      inputClassName={inputClass}
                                    />
                                    <input
                                      value={line.tenNvlSanXuat}
                                      onChange={event => updateLine(product.key, line.key, {
                                        tenNvlSanXuat: event.target.value
                                      })}
                                      className={inputClass}
                                      placeholder="Nhập tên NVL sản xuất"
                                    />
                                    <input
                                      value={line.giaTri}
                                      onChange={event =>
                                        updateLine(product.key, line.key, {
                                          giaTri: event.target.value
                                        })
                                      }
                                      className={`${inputClass} h-8 px-1 text-[10px]`}
                                      placeholder={line.donVi === '%' ? '%' : 'kg'}
                                      inputMode="decimal"
                                      title="Giá trị NVL cho 1 cối tiêu chuẩn"
                                    />
                                    <input
                                      value={ty_le_coi === null ? '' : `${ty_le_coi}%`}
                                      readOnly
                                      className={`${inputClass} h-8 bg-zinc-50 px-1 text-[10px] font-black text-zinc-700`}
                                      title="% Cối trộn = giá trị (kg) / Định lượng 1 cối tiêu chuẩn"
                                    />
                                    <input
                                      value={ty_le_tong === null ? '' : `${ty_le_tong}%`}
                                      readOnly
                                      className={`${inputClass} h-8 bg-zinc-50 px-1 text-[10px] font-black text-zinc-700`}
                                      title="% Tổng SL — bằng % Cối trộn vì tỷ lệ không đổi theo mẻ"
                                    />
                                    <input
                                      value={tong_khoi_luong === null ? '' : formatKhoiLuongDisplay(tong_khoi_luong)}
                                      readOnly
                                      className={`${inputClass} h-8 bg-zinc-50 px-1 text-[10px] font-black text-[#ef1b2d]`}
                                      title="Tổng trọng lượng = % Tổng SL × Tổng SL sau hao hụt"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeLine(product.key, line.key)}
                                      disabled={product.lines.length <= 1}
                                      className="inline-flex h-8 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                                      title="Xóa dòng NVL"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-3 text-center text-[11px] font-bold text-zinc-500">
                          Chọn mã SP ở trên để sổ danh sách NVL.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <button
                type="button"
                onClick={closeForm}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#ef1b2d] px-4 text-xs font-extrabold text-white hover:bg-[#b30d1c] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving
                  ? 'Đang lưu...'
                  : editingId
                    ? 'Cập nhật phiếu'
                    : `Lưu phiếu (${form.products.filter(p => p.maSp.trim()).length || 0} SP)`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {printDocs.length > 0 ? <MixingNormRatioPrintBatch docs={printDocs} /> : null}
    </div>
  );
}
