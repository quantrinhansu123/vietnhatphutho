import { formatNumber, parseLocalizedNumber, parsePercentInput } from '../../utils';

/** Đơn cắt lẻ + miền nam: chuẩn hóa Định mức KG/tấm (làm tròn 2 số lẻ). Không hợp lệ / <= 0 = null. */
export function parseSouthDinhMucKg(value: unknown): number | null {
  const parsed = parsePercentInput(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

/** Đơn cắt lẻ + miền nam: Tổng KG = Định mức KG (2 số lẻ) × SL tổng, làm tròn 2 số lẻ để khớp ĐM × SL. Thiếu ĐM/SL = null. */
export function southDinhMucKgTotal(dinhMucKg: unknown, quantity: unknown): number | null {
  const dm = parseSouthDinhMucKg(dinhMucKg);
  const qty = Number(quantity);
  if (dm === null || !Number.isFinite(qty) || qty <= 0) return null;
  return Math.round(dm * qty * 100) / 100;
}

/**
 * Miền nam: TL/tấm = kg/1m × Dài × hệ số (khổ, độ li) làm tròn 2 số lẻ; Tổng KG = TL/tấm × SL (2 số lẻ)
 * để tích khớp tuyệt đối. `scale` = hệ số khổ × hệ số độ li (mặc định 1 = đúng chuẩn danh mục).
 */
export function southScaledTlAndTotal(
  kgPerMeter: number,
  daiM: number,
  quantity: number,
  scale = 1
): { tl: number; total: number } {
  const tl = Math.round(kgPerMeter * daiM * scale * 100) / 100;
  return { tl, total: Math.round(tl * quantity * 100) / 100 };
}

/** Thiếu độ dài tấm tiêu chuẩn: TL/tấm = Định mức tiêu chuẩn × hệ số; Tổng = TL/tấm × SL (2 số lẻ). */
export function southFallbackTlAndTotal(
  dinhMucKg: unknown,
  quantity: number,
  scale = 1
): { tl: number; total: number } | null {
  const dm = parseSouthDinhMucKg(dinhMucKg);
  if (dm === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  const tl = Math.round(dm * scale * 100) / 100;
  return { tl, total: Math.round(tl * quantity * 100) / 100 };
}

/** Hệ số khổ = khổ nhập / khổ chuẩn của sản phẩm. Thiếu một trong hai → null (không điều chỉnh). */
export function southKhoScale(enteredKho: unknown, standardKho: unknown): number | null {
  const entered = parsePercentInput(String(enteredKho ?? ''));
  const standard = parsePercentInput(String(standardKho ?? '').replace(/m\s*$/iu, ''));
  if (!Number.isFinite(entered) || !Number.isFinite(standard) || entered <= 0 || standard <= 0) return null;
  return entered / standard;
}

/** Tổng KG đơn hàng luôn lưu/hiển thị số nguyên (làm tròn). Không hợp lệ / <= 0 = null. */
export function roundTotalKgInt(value: unknown): number | null {
  const parsed = parsePercentInput(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
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

/** Tổng trọng lượng miền nam = kg/1m × m dài × số lượng (làm tròn số nguyên). */
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
  return Math.round(perMeter * length * qty);
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
