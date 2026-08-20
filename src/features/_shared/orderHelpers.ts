import { pickText } from './recordHelpers';
import { normalizeHrBranches } from './hr';
import { normalizeProducts } from '../san-pham';

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
