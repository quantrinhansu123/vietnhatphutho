import {
  classifyProductPxGroup,
  hasZemInName,
  normalizeDoLiDm,
  normalizeDoLiToken
} from '../../utils/productProductionName';
import { orderDacDoLiRealNumber, type OrderProductOption } from '../_shared/orderHelpers';

/**
 * Số độ li thực của nhóm Đặc (token chính, vd `2`). Không dùng để điền ô "Độ li ĐM".
 * Ô đó luôn hiện số trong `(đm n li)`.
 */
export function dacDoLiRealForProduct(product: OrderProductOption | null | undefined): string {
  if (!product || classifyProductPxGroup(product.group || '') !== 'dac') return '';
  if (hasZemInName(product.productionName, product.name, product.code)) return '';
  return orderDacDoLiRealNumber({
    doLi: product.doLi,
    tenSanXuat: product.productionName,
    tenGhep: product.tenGhep,
    maAmis: product.code || product.newCode,
    savedDoLiDm: product.doLiDm
  });
}

/** Chuẩn để tính hệ số trọng lượng: luôn là độ li định mức `(đm …)`, không phải độ li thực. */
export function catalogWeightLi(product: OrderProductOption | null | undefined): string {
  if (!product) return '';
  return product.doLiDm || '';
}

/** Số trong ô "Độ li ĐM" → token độ li (`2`, `2.0`, `2li` → `2li`). Rỗng/không đọc được → ''. */
export function orderDoLiFieldToken(value: string | null | undefined): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const bare = text.replace(/\s*l?i\s*$/iu, '').replace(',', '.');
  if (!/^[\d.]+$/u.test(bare)) return '';
  const number = Number(bare);
  if (!Number.isFinite(number) || number <= 0) return '';
  return normalizeDoLiToken(`${number}li`);
}

export interface OrderDoLiDmFieldInput {
  isCutLikeOrder: boolean;
  group?: string | null;
  nameHasZem: boolean;
  /** Giá trị ô trên form (`line.doLiDm`). */
  fieldText?: string | null;
  /** `do_li` đã lưu của dòng (`sourceProduct.do_li`) hoặc `line.doLi`. */
  savedDoLi?: string | null;
  productionName?: string | null;
  tenGhep?: string | null;
  maAmis?: string | null;
  /** `do_li_dm` đã lưu của dòng (`sourceProduct.do_li_dm`). */
  savedDoLiDm?: string | null;
}

export interface OrderDoLiDmFieldResult {
  /** Dòng thuộc nhóm Đặc và ô mang nghĩa độ li thực. */
  isDacField: boolean;
  /** Token độ li người dùng đang nhập (`2li`), '' nếu trống/không đọc được. */
  fieldToken: string;
  /** Token độ li đang có của dòng (`2li`) — dùng để biết người dùng có sửa ô không. */
  savedToken: string;
  /** Ô đã bị sửa khác độ li đang có → phải đổi token độ li chính của tên ghép. */
  changed: boolean;
  /** `(đm n li)` cũ của dòng (nếu có) — giữ nguyên khi không sửa ô. */
  existingDoLiDm: string;
  /** Giá trị lưu vào `do_li_dm` (nhóm Đặc = đm canonical tự tính, nhóm khác = đm nhập tay). */
  doLiDmValue: string;
  /** Giá trị lưu vào `do_li` cho nhóm Đặc (độ li thực). */
  doLiStored: string;
}

/**
 * Ô "Độ li ĐM" là độ li định mức `(đm n li)` với mọi nhóm, kể cả Đặc.
 * Không đọc ô này thành độ li thực và không đổi token độ li chính của tên.
 */
export function resolveOrderDoLiDmField(input: OrderDoLiDmFieldInput): OrderDoLiDmFieldResult {
  const fieldText = String(input.fieldText ?? '').trim();
  return {
    isDacField: false,
    fieldToken: '',
    savedToken: '',
    changed: false,
    existingDoLiDm: '',
    doLiDmValue: input.isCutLikeOrder && !input.nameHasZem ? normalizeDoLiDm(fieldText, 'li') : '',
    doLiStored: ''
  };
}
