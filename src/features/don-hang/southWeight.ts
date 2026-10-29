import { formatNumber, parseLocalizedNumber, parsePercentInput } from '../../utils';
import { truncateTo3Decimals } from '../../utils/weightTruncate';
import { extractDoLiDmNumber, hasZemInName, parseProductionNameParts } from '../../utils/productProductionName';

/**
 * SP chưa có quy đổi/thông số danh mục: suy Dài (m), Khổ rộng (m), Độ li ĐM (số) từ tên sản xuất.
 * Tên ZEM không có độ li ĐM. Không suy được ô nào thì trả '' cho ô đó.
 */
export function inferSpecsFromProductionName(
  productionName: string | null | undefined,
  group = ''
): { daiM: string; kho: string; doLiDm: string } {
  const name = String(productionName ?? '').trim();
  if (!name) return { daiM: '', kho: '', doLiDm: '' };
  const parts = parseProductionNameParts(name, group);
  const stripM = (value: string) => String(value || '').replace(/m\s*$/iu, '').trim();
  return {
    daiM: stripM(parts.doDaiM),
    kho: stripM(parts.doDayM),
    doLiDm: hasZemInName(name)
      ? ''
      : extractDoLiDmNumber(parts.doLiDm) || extractDoLiDmNumber(parts.dinhMucKg)
  };
}

/** Đơn cắt lẻ + miền nam: chuẩn hóa Định mức KG/tấm (giữ 3 số lẻ bằng cắt số, không làm tròn). Không hợp lệ / <= 0 = null. */
export function parseSouthDinhMucKg(value: unknown): number | null {
  const parsed = parsePercentInput(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? truncateTo3Decimals(parsed) : null;
}

/** Đơn cắt lẻ + miền nam: Tổng KG = Định mức KG (3 số lẻ, cắt số) × SL tổng — cắt 3 số lẻ để khớp ĐM × SL. Thiếu ĐM/SL = null. */
export function southDinhMucKgTotal(dinhMucKg: unknown, quantity: unknown): number | null {
  const dm = parseSouthDinhMucKg(dinhMucKg);
  const qty = Number(quantity);
  if (dm === null || !Number.isFinite(qty) || qty <= 0) return null;
  return truncateTo3Decimals(dm * qty);
}

/**
 * Miền nam: TL/tấm = kg/1m × Dài × hệ số, cắt 3 số lẻ; Tổng KG = TL/tấm × SL (cắt 3 số lẻ)
 * để tích khớp tuyệt đối. `scale` = hệ số khổ × hệ số độ li (mặc định 1 = đúng chuẩn danh mục).
 */
export function southScaledTlAndTotal(
  kgPerMeter: number,
  daiM: number,
  quantity: number,
  scale = 1
): { tl: number; total: number } {
  const tl = truncateTo3Decimals(kgPerMeter * daiM * scale);
  return { tl, total: truncateTo3Decimals(tl * quantity) };
}

/** Thiếu độ dài tấm tiêu chuẩn: TL/tấm = Định mức tiêu chuẩn × hệ số (cắt 3 số lẻ); Tổng = TL/tấm × SL (cắt 3 số lẻ). */
export function southFallbackTlAndTotal(
  dinhMucKg: unknown,
  quantity: number,
  scale = 1
): { tl: number; total: number } | null {
  const dm = parseSouthDinhMucKg(dinhMucKg);
  if (dm === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  const tl = truncateTo3Decimals(dm * scale);
  return { tl, total: truncateTo3Decimals(tl * quantity) };
}

/** Hệ số khổ = khổ nhập / khổ chuẩn của sản phẩm. Thiếu một trong hai → null (không điều chỉnh). */
export function southKhoScale(enteredKho: unknown, standardKho: unknown): number | null {
  const entered = parsePercentInput(String(enteredKho ?? ''));
  const standard = parsePercentInput(String(standardKho ?? '').replace(/m\s*$/iu, ''));
  if (!Number.isFinite(entered) || !Number.isFinite(standard) || entered <= 0 || standard <= 0) return null;
  return entered / standard;
}

/** Tổng KG đơn hàng luôn lưu tối đa 3 số sau dấu phẩy bằng cắt số (không làm tròn). Không hợp lệ / <= 0 = null. */
export function truncateTotalKg3(value: unknown): number | null {
  const parsed = parsePercentInput(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? truncateTo3Decimals(parsed) : null;
}

/**
 * Đơn miền nam: kg/1m = định mức tiêu chuẩn (kg) / độ dài tấm tiêu chuẩn (m).
 * Ưu tiên kg nhập trên đơn, rồi TL tấm danh mục. Không chia được thì lấy kg/1m dài của danh mục.
 */
export function southOrderKgPerMeter(
  enteredStandardKg: unknown,
  catalogSheetKg: unknown,
  catalogKgPerMeter: unknown,
  doDaiTamTieuChuan: unknown
): number | null {
  return southKgPerStandardMeter(enteredStandardKg, doDaiTamTieuChuan)
    ?? southKgPerStandardMeter(catalogSheetKg, doDaiTamTieuChuan)
    ?? parseSouthDinhMucKg(catalogKgPerMeter);
}

/** kg/1m = định mức tiêu chuẩn (kg) / độ dài tấm tiêu chuẩn (m). */
export function southKgPerStandardMeter(
  standardKg: unknown,
  doDaiTamTieuChuan: unknown
): number | null {
  const kg = parseSouthDinhMucKg(standardKg);
  const sheetLength = parsePercentInput(String(doDaiTamTieuChuan ?? ''));
  if (kg === null || !Number.isFinite(sheetLength) || sheetLength <= 0) return null;
  // Không làm tròn trung gian: tránh lệch 0.01 kg khi nhân lại với Dài (hiển thị KG/1m làm tròn ở UI).
  return kg / sheetLength;
}

/** Tổng trọng lượng miền nam = kg/1m × m dài × số lượng (giữ 3 số sau dấu phẩy bằng cắt số). */
export function southLengthScaledTotalKg(
  standardKg: unknown,
  doDaiTamTieuChuan: unknown,
  daiM: unknown,
  quantity: unknown
): number | null {
  const perMeter = southKgPerStandardMeter(standardKg, doDaiTamTieuChuan);
  const length = parsePercentInput(String(daiM ?? ''));
  const qty = parsePercentInput(String(quantity ?? ''));
  if (perMeter === null || !Number.isFinite(length) || length <= 0 || !Number.isFinite(qty) || qty <= 0) return null;
  return truncateTo3Decimals(perMeter * length * qty);
}

function orderDecimalFractionDigits(text: string): number {
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let digits = 0;
  if (lastDot >= 0 && lastComma >= 0) {
    digits = (lastComma > lastDot ? text.slice(lastComma + 1) : text.slice(lastDot + 1)).length;
  } else if (lastComma >= 0) {
    digits = /^-?\d{1,3}(,\d{3})+$/.test(text) ? 0 : text.slice(lastComma + 1).length;
  } else if ((text.match(/\./g) || []).length > 1) {
    digits = 0;
  } else if (lastDot >= 0) {
    digits = text.slice(lastDot + 1).length;
  }
  return Math.min(digits, 6);
}

/** Số trên đơn hàng: phần nghìn `,`, thập phân `.` (5,7 -> 5.7; 1.250.000 -> 1,250,000). */
export function orderDuplicateDecimalText(value: string): string {
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return '';
  const parsed = parseLocalizedNumber(text);
  if (!Number.isFinite(parsed)) return String(value ?? '');
  return formatNumber(parsed, orderDecimalFractionDigits(text));
}
