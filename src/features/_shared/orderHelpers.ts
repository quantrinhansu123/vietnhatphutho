import { pickText } from './recordHelpers';
import { normalizeHrBranches } from './hr';
import { normalizeProducts } from '../san-pham';
import { availableConvertedUnits, convertProductQuantity, type ProductConvertedUnit } from '../../utils/productUnitConversion';
import { parsePercentInput } from '../../utils';

export const ORDER_TYPE_OPTIONS = ['Đơn bán', 'Đơn sản xuất', 'Đơn theo quy cách của khách đặt'] as const;
export const CUT_ORDER_TYPE = 'Đơn theo quy cách của khách đặt';
export const ORDER_STATUS_DEFAULT = 'Chờ sx';
export const ORDER_STATUS_OPTIONS = ['Chờ sx', 'Đang sx', 'Hoàn thành', 'Hủy'] as const;
export const STORAGE_ORDER_UNIT_KEY = 'order_unit_suggestions_v1';
export const orderFieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-800 outline-none focus:border-[#ef1b2d] focus:ring-2 focus:ring-red-500/10';

export interface StaffOption {
  code: string;
  name: string;
  region?: string;
}

export interface CustomerOption {
  id: string;
  name: string;
  code: string;
}

export interface OrderProductOption {
  id: string;
  code: string;
  name: string;
  productionName: string;
  group: string;
  unit: string;
  newCode: string;
}

export function normalizeLookupText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function normalizeStaffOptions(data: unknown): StaffOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item): StaffOption | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { code: name, name } : null;
      }
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = pickText(record, ['code', 'ma_nhan_su', 'id'], '') || pickText(record, ['name', 'nhan_su', 'ho_ten', 'ten'], '');
      const name = pickText(record, ['name', 'nhan_su', 'ho_ten', 'ten'], '');
      const region = pickText(record, ['region', 'khu_vuc'], '');
      return name && code ? { code, name, region: region || undefined } : null;
    })
    .filter((item): item is StaffOption => Boolean(item));
}

export function normalizeDaNangBusinessStaffOptions(data: unknown): StaffOption[] {
  const branches = normalizeHrBranches(data);
  const staff = branches.flatMap(branch => {
    const branchText = normalizeLookupText(`${branch.name} ${branch.shortName}`);
    if (!branchText.includes('da nang')) return [];

    return branch.departments.flatMap(department => {
      const departmentText = normalizeLookupText(department.name);
      if (!departmentText.includes('kinh doanh')) return [];
      return department.members.map(member => {
        const code = member.code || member.id || member.name;
        return {
          code: String(code).trim(),
          name: member.name,
          region: member.region || ''
        };
      });
    });
  });

  const seen = new Set<string>();
  return staff
    .filter(item => {
      const key = normalizeLookupText(item.name.trim());
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function normalizeCustomerOptions(data: unknown): CustomerOption[] {
  if (!data || typeof data !== 'object') return [];
  const customers = (data as { customers?: unknown }).customers;
  if (!Array.isArray(customers)) return [];

  return customers
    .map((item): CustomerOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = pickText(record, ['ten_khach_hang', 'khach_hang', 'ten', 'name', 'ten_cong_ty'], '');
      const code = pickText(record, ['ma_khach_hang', 'ma_kh', 'code', 'id'], '');
      if (!name && !code) return null;
      return {
        id: code || name,
        name: name || code,
        code
      };
    })
    .filter((item): item is CustomerOption => Boolean(item));
}

export function normalizeOrderProducts(data: unknown): OrderProductOption[] {
  return normalizeProducts(data).map(product => ({
    id: product.id,
    code: product.amisCode && product.amisCode !== '-' ? product.amisCode : '',
    name: product.name,
    productionName: product.productionName,
    group: product.group,
    unit: product.unit === '-' ? '' : product.unit,
    newCode: product.newCode
  })).filter(product => product.code);
}

export function findOrderProductById(products: OrderProductOption[], id: string) {
  const normalized = id.trim();
  if (!normalized) return null;
  return products.find(product => product.id === normalized) ?? null;
}

export function findOrderProductByCode(products: OrderProductOption[], code: string) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;

  return (
    products.find(
      product =>
        product.code.toLowerCase() === normalized ||
        product.newCode.toLowerCase() === normalized
    ) ?? null
  );
}

export function resolveOrderProductFields(
  products: OrderProductOption[],
  productCode: string,
  fallback: { productName?: string; unit?: string } = {}
) {
  const match = findOrderProductByCode(products, productCode);
  if (!match) {
    return {
      productName: productCode.trim() ? '' : (fallback.productName ?? ''),
      productionName: '',
      unit: fallback.unit ?? ''
    };
  }

  return {
    productName: match.name,
    productionName: match.productionName,
    unit: match.unit || fallback.unit || ''
  };
}

export function readUnitSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_ORDER_UNIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];
  } catch {
    return [];
  }
}

export function saveUnitSuggestion(unit: string) {
  const trimmed = unit.trim();
  if (!trimmed) return;
  const next = [...new Set([trimmed, ...readUnitSuggestions()])].slice(0, 30);
  localStorage.setItem(STORAGE_ORDER_UNIT_KEY, JSON.stringify(next));
}

export type OrderProductConversion = {
  id: number; sanPhamId: string; maSp: string; maAmis: string; donViTinh: string;
  khoTamRongM: number | null; khoTamDaiM: number | null;
  khoCuonRongM: number | null; khoCuonDaiM: number | null;
  dienTichM2: number | null; trongLuongKgMDai: number | null;
  trongLuongKgM2: number | null; trongLuongKgTam: number | null;
  trongLuongKgCuon: number | null;
};

export type CutOrderWeightResult = {
  kg1Sp: number;
  tongKg: number;
  source: 'trong_luong_kg_m_dai' | 'trong_luong_kg_m2' | 'trong_luong_kg_tam' | 'trong_luong_kg_cuon' | 'don_vi_kg';
  dienTich1SpM2?: number;
};

export function normalizeConversionUnit(value: string) {
  return value.trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ').replace('m²', 'm2');
}

export type ConversionUnit = 'sheet' | 'roll' | 'meter' | 'squareMeter' | 'kg' | 'unsupported';

export function resolveConversionUnit(value: string): ConversionUnit {
  const unit = normalizeConversionUnit(value);
  if (unit === 'tấm' || unit === 'tam') return 'sheet';
  if (unit === 'cuộn' || unit === 'cuon') return 'roll';
  if (unit === 'm' || unit === 'm dài' || unit === 'mét' || unit === 'met') return 'meter';
  if (unit === 'm2' || unit === 'm 2' || unit === 'mét vuông' || unit === 'met vuong') return 'squareMeter';
  if (unit === 'kg' || unit === 'kilogram') return 'kg';
  return 'unsupported';
}

export function calculateOrderConversion(quantityText: string, inputUnitText: string, conversion: OrderProductConversion, group = '') {
  const quantity = parsePercentInput(quantityText);
  if (!Number.isFinite(quantity) || quantity <= 0) return [] as Array<[string, number, string]>;
  const normalizedGroup = group.replace(/\s+/g, '').toLocaleLowerCase('vi');
  const targetUnits: ProductConvertedUnit[] = normalizedGroup === 'tp;pxđặc'
    ? ['kg', 'm2', 'm']
    : normalizedGroup === 'tp;pxsóng'
      ? ['m', 'kg']
      : normalizedGroup === 'tp;pxrỗng'
        ? ['kg']
        : availableConvertedUnits(inputUnitText, conversion);
  return targetUnits.flatMap(unit => {
    const value = convertProductQuantity(quantity, inputUnitText, unit, conversion);
    return value !== null && Number.isFinite(value) && value > 0
      ? [['Quy đổi', value, unit === 'm' ? 'm dài' : unit] as [string, number, string]]
      : [];
  });
}

export function conversionSupportsUnit(conversion: OrderProductConversion, unitText: string) {
  const unit = resolveConversionUnit(unitText);
  if (unit === 'sheet') return Boolean(conversion.trongLuongKgTam);
  if (unit === 'roll') return Boolean(conversion.trongLuongKgCuon);
  if (unit === 'squareMeter') return Boolean(conversion.trongLuongKgM2);
  if (unit === 'meter') return Boolean(conversion.trongLuongKgMDai);
  if (unit === 'kg') return true;
  return false;
}

export function calculateCutOrderWeight(
  lengthText: string,
  quantityText: string,
  conversion: OrderProductConversion | null | undefined,
  unitText = 'Tấm'
): CutOrderWeightResult | null {
  const length = parsePercentInput(lengthText);
  const quantity = parsePercentInput(quantityText);
  if (!conversion || !Number.isFinite(length) || length <= 0 || !Number.isFinite(quantity) || quantity <= 0) return null;
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

  const kgPerMeter = conversion.trongLuongKgMDai;
  if (Number.isFinite(kgPerMeter) && (kgPerMeter as number) > 0) {
    const rawKg1Sp = length * (kgPerMeter as number);
    return { kg1Sp: round(rawKg1Sp), tongKg: round(rawKg1Sp * quantity), source: 'trong_luong_kg_m_dai' };
  }

  const width = conversion.khoTamRongM || conversion.khoCuonRongM;
  const kgPerM2 = conversion.trongLuongKgM2;
  if (Number.isFinite(width) && (width as number) > 0 && Number.isFinite(kgPerM2) && (kgPerM2 as number) > 0) {
    const dienTich1SpM2 = length * (width as number);
    const rawKg1Sp = dienTich1SpM2 * (kgPerM2 as number);
    return { kg1Sp: round(rawKg1Sp), tongKg: round(rawKg1Sp * quantity), source: 'trong_luong_kg_m2', dienTich1SpM2 };
  }

  const unit = resolveConversionUnit(unitText);
  const perUnit = unit === 'sheet'
    ? conversion.trongLuongKgTam
    : unit === 'roll'
      ? conversion.trongLuongKgCuon
      : null;
  if (Number.isFinite(perUnit) && (perUnit as number) > 0) {
    const kg1Sp = round(perUnit as number);
    return {
      kg1Sp,
      tongKg: round((perUnit as number) * quantity),
      source: unit === 'sheet' ? 'trong_luong_kg_tam' : 'trong_luong_kg_cuon'
    };
  }

  if (unit === 'kg') {
    return { kg1Sp: 1, tongKg: round(quantity), source: 'don_vi_kg' };
  }

  return null;
}

export function allowedOrderUnits(product: Pick<OrderProductOption, 'group' | 'unit'> | null, preferredUnit = '') {
  if (!product) return [];
  const group = product.group.replace(/\s+/g, '').toLocaleLowerCase('vi');
  const units =
    group === 'tp;pxđặc'
      ? ['Tấm', 'Cuộn']
      : group === 'tp;pxsóng' || group === 'tp;pxrỗng'
        ? ['Tấm']
        : ['kg'];
  const orderUnit = (preferredUnit || product.unit || '').trim();
  return orderUnit && !units.includes(orderUnit) ? [orderUnit, ...units] : units;
}
