/** Quy tắc Miền / Loại đơn dùng chung cho form và API. */
export const SALE_ORDER_TYPE = 'Đơn bán';
export const PRODUCTION_ORDER_TYPE = 'Đơn sản xuất';
export const CUT_ORDER_TYPE = 'Đơn theo quy cách của khách đặt';
export const CUT_ORDER_TYPE_NEW = 'Đơn cắt lẻ miền Bắc';
export const SOUTH_ORDER_TYPE = 'Đơn miền nam';
export const SOUTH_RETAIL_CUT_ORDER_TYPE = 'Đơn cắt lẻ miền Nam';
export const ORDER_TYPE_OPTIONS = [SALE_ORDER_TYPE, PRODUCTION_ORDER_TYPE, CUT_ORDER_TYPE,
  CUT_ORDER_TYPE_NEW, SOUTH_ORDER_TYPE, SOUTH_RETAIL_CUT_ORDER_TYPE] as const;
export const ORDER_REGION_OPTIONS = ['Tất cả', 'Miền Bắc', 'Miền Nam'] as const;
export type OrderRegion = (typeof ORDER_REGION_OPTIONS)[number];

/** Nguồn danh mục Đơn hàng; không nhận tên bảng tùy ý từ request. */
export function orderProductTablesForRegion(value: string): Array<'san_pham_mb' | 'san_pham_mn'> {
  const region = normalizeOrderRegion(value);
  if (region === 'Miền Bắc') return ['san_pham_mb'];
  if (region === 'Miền Nam') return ['san_pham_mn'];
  if (region === 'Tất cả') return ['san_pham_mb', 'san_pham_mn'];
  throw new Error('Miền sản phẩm không hợp lệ.');
}

export function orderProductLookupUrl(region: OrderRegion): string {
  return `/api/san-pham?format=table&mien=${encodeURIComponent(region)}`;
}

/** Đơn cắt lẻ cũ vẫn được đọc như cắt lẻ miền Bắc, không cần đổi DB hàng loạt. */
export function normalizeOrderType(value?: string | null): string {
  const text = String(value || '').trim().toLocaleLowerCase('vi');
  if (text === 'đơn cắt lẻ') return CUT_ORDER_TYPE_NEW;
  return ORDER_TYPE_OPTIONS.find(type => type.toLocaleLowerCase('vi') === text) || '';
}

export function isSouthOrderType(value?: string | null): boolean {
  const type = normalizeOrderType(value);
  return type === SOUTH_ORDER_TYPE || type === SOUTH_RETAIL_CUT_ORDER_TYPE;
}

export function isCustomSpecOrderType(value?: string | null): boolean {
  return normalizeOrderType(value) === CUT_ORDER_TYPE;
}

export function isRetailCutOrderType(value?: string | null): boolean {
  const type = normalizeOrderType(value);
  return type === CUT_ORDER_TYPE_NEW || type === SOUTH_RETAIL_CUT_ORDER_TYPE;
}

export function isCutOrderType(value?: string | null): boolean {
  return isCustomSpecOrderType(value) || isRetailCutOrderType(value);
}

export function isCutLikeOrderType(value?: string | null): boolean {
  return isCutOrderType(value) || isSouthOrderType(value);
}

export function normalizeOrderRegion(value?: string | null): OrderRegion | '' {
  const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd').toLowerCase().trim();
  if (['tat ca', 'all'].includes(text)) return 'Tất cả';
  if (text === 'nam' || text.includes('mien nam') || text === 'south') return 'Miền Nam';
  if (text === 'bac' || text.includes('mien bac') || text === 'north') return 'Miền Bắc';
  return '';
}

export function resolveOrderRegion(orderType?: string | null, region?: string | null): OrderRegion {
  const type = normalizeOrderType(orderType);
  if (type === PRODUCTION_ORDER_TYPE) return 'Tất cả';
  if (isSouthOrderType(type)) return 'Miền Nam';
  if (type) return 'Miền Bắc';
  return normalizeOrderRegion(region) || 'Miền Bắc';
}

export function orderTypeOptionsForRegion(region: OrderRegion | '', canSeeProduction: boolean): string[] {
  if (region === 'Tất cả') return canSeeProduction ? [PRODUCTION_ORDER_TYPE] : [];
  if (region === 'Miền Nam') return [SOUTH_ORDER_TYPE, SOUTH_RETAIL_CUT_ORDER_TYPE];
  return [SALE_ORDER_TYPE, CUT_ORDER_TYPE, CUT_ORDER_TYPE_NEW];
}

export function resolveOrderTypeFromRegion(region: OrderRegion | '', value: string, canSeeProduction: boolean): string {
  const options = orderTypeOptionsForRegion(region, canSeeProduction);
  const current = normalizeOrderType(value);
  if (options.includes(current)) return current;
  if (isRetailCutOrderType(current) && region !== 'Tất cả') {
    return region === 'Miền Nam' ? SOUTH_RETAIL_CUT_ORDER_TYPE : CUT_ORDER_TYPE_NEW;
  }
  return options[0] || '';
}

/** API từ chối cặp miền / loại đơn sai; nguồn cũ thiếu miền được suy từ loại đơn. */
export function orderScopeValidationError(orderType: string, region?: string | null): string | null {
  const type = normalizeOrderType(orderType);
  if (!type) return 'Vui lòng chọn loại đơn hợp lệ.';
  if (String(region || '').trim() && normalizeOrderRegion(region) !== resolveOrderRegion(type)) {
    return `${type} chỉ áp dụng cho Miền: ${resolveOrderRegion(type)}.`;
  }
  return null;
}
