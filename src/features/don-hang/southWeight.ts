import { formatNumber, parseLocalizedNumber, parsePercentInput } from '../../utils';

/** Đơn cắt lẻ + miền nam: chuẩn hóa Định mức KG/tấm (làm tròn 2 số lẻ). Không hợp lệ / <= 0 = null. */
export function parseSouthDinhMucKg(value: unknown): number | null {
  const parsed = parsePercentInput(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

/** Đơn cắt lẻ + miền nam: Tổng KG = Định mức KG × SL tổng (làm tròn 2 số lẻ). Thiếu ĐM/SL = null. */
export function southDinhMucKgTotal(dinhMucKg: unknown, quantity: unknown): number | null {
  const dm = parseSouthDinhMucKg(dinhMucKg);
  const qty = Number(quantity);
  if (dm === null || !Number.isFinite(qty) || qty <= 0) return null;
  return Math.round(dm * qty * 100) / 100;
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
  return Math.round((kg / sheetLength) * 1000) / 1000;
}

/** Tổng trọng lượng miền nam = kg/1m × m dài × số lượng. */
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
  return Math.round(perMeter * length * qty * 100) / 100;
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
