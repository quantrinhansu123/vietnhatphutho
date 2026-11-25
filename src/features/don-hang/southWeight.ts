import { formatNumber, parseLocalizedNumber, parsePercentInput } from '../../utils';
import { truncateTo4Decimals } from '../../utils/weightTruncate';
import { classifyProductPxGroup, doLiDmWeightScale, extractDoLiDmLi, extractDoLiDmNumber, hasZemInName, parseProductionNameParts } from '../../utils/productProductionName';

/** Số cho ô Độ li ĐM. `(đm n kg)` không điền vào ô này. */
export function orderDoLiDmLiNumber(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    const li = extractDoLiDmLi(text);
    if (li) {
      const number = extractDoLiDmNumber(li);
      if (number) return number;
      continue;
    }
    if (/\bkg\b/iu.test(text)) continue;
    const number = extractDoLiDmNumber(text);
    if (number) return number;
  }
  return '';
}

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
    doLiDm: hasZemInName(name) ? '' : orderDoLiDmLiNumber(parts.doLiDm)
  };
}

/** Đơn cắt lẻ + miền nam: chuẩn hóa Định mức KG/tấm (giữ 4 số lẻ bằng cắt số, không làm tròn). Không hợp lệ / <= 0 = null. */
export function parseSouthDinhMucKg(value: unknown): number | null {
  const parsed = parsePercentInput(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? truncateTo4Decimals(parsed) : null;
}

/** Đơn cắt lẻ + miền nam: Tổng KG = Định mức KG (4 số lẻ, cắt số) × SL tổng — cắt 4 số lẻ để khớp ĐM × SL. Thiếu ĐM/SL = null. */
export function southDinhMucKgTotal(dinhMucKg: unknown, quantity: unknown): number | null {
  const dm = parseSouthDinhMucKg(dinhMucKg);
  const qty = Number(quantity);
  if (dm === null || !Number.isFinite(qty) || qty <= 0) return null;
  return truncateTo4Decimals(dm * qty);
}

/**
 * Miền nam: TL/tấm = kg/1m × Dài × hệ số, cắt 4 số lẻ; Tổng KG = TL/tấm × SL (cắt 4 số lẻ)
 * để tích khớp tuyệt đối. `scale` = hệ số khổ × hệ số độ li (mặc định 1 = đúng chuẩn danh mục).
 */
export function southScaledTlAndTotal(
  kgPerMeter: number,
  daiM: number,
  quantity: number,
  scale = 1
): { tl: number; total: number } {
  const tl = truncateTo4Decimals(kgPerMeter * daiM * scale);
  return { tl, total: truncateTo4Decimals(tl * quantity) };
}

/** Thiếu độ dài tấm tiêu chuẩn: TL/tấm = Định mức tiêu chuẩn × hệ số (cắt 4 số lẻ); Tổng = TL/tấm × SL (cắt 4 số lẻ). */
export function southFallbackTlAndTotal(
  dinhMucKg: unknown,
  quantity: number,
  scale = 1
): { tl: number; total: number } | null {
  const dm = parseSouthDinhMucKg(dinhMucKg);
  if (dm === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  const tl = truncateTo4Decimals(dm * scale);
  return { tl, total: truncateTo4Decimals(tl * quantity) };
}

/** Dán tem chỉ đổi độ li / `(đm n li)` với nhóm Đặc. Sóng và Rỗng giữ độ li. */
export function temMayReplaceDoLi(group?: string | null): boolean {
  return classifyProductPxGroup(group || '') === 'dac';
}

/** Sóng và Rỗng miền nam: không chọn tem độ li (ô tem khóa, tem không lưu). Màu tem và 2 Đầu vẫn dùng. */
export function temLiLockedForGroup(group?: string | null): boolean {
  const px = classifyProductPxGroup(group || '');
  return px === 'song' || px === 'rong';
}

/**
 * Ô Độ li ĐM sau khi chọn/xóa tem.
 * Chỉ nhóm Đặc: tem có số và ô đang là `(đm n li)` → đổi ô theo tem. Sóng, Rỗng, ZEM hoặc đm kg giữ nguyên.
 * Xóa tem khi ô đang đúng số tem vừa xóa → trả về số định mức danh mục.
 */
export function nextDoLiDmAfterTem(input: {
  tem: string | null | undefined;
  previousTem?: string | null | undefined;
  currentDoLiDm: string | null | undefined;
  catalogDoLiDm?: string | null | undefined;
  /** Chỉ nhóm Đặc được đổi ô theo tem. */
  allowReplace?: boolean;
  zem?: boolean;
}): string {
  const current = String(input.currentDoLiDm || '').trim();
  if (input.zem || !input.allowReplace || !current || /\bkg\b/iu.test(current)) return current;
  const temNumber = String(input.tem || '').match(/[\d.,]+/)?.[0] || '';
  if (temNumber) return temNumber.replace(',', '.');
  const previousNumber = String(input.previousTem || '').match(/[\d.,]+/)?.[0] || '';
  const catalogNumber = orderDoLiDmLiNumber(input.catalogDoLiDm);
  if (previousNumber && current.replace(',', '.') === previousNumber.replace(',', '.') && catalogNumber) {
    return catalogNumber;
  }
  return current;
}

/**
 * Định mức tiêu chuẩn (kg) khi dán tem đổi `(đm n li)` nhưng ô/ĐM còn theo độ li cũ.
 * Chỉ nâng số tự tính (đúng kg tấm danh mục, hoặc đúng ĐM theo ô hiện tại).
 * Số người dùng đã sửa khác hai mức đó giữ nguyên. ZEM / thiếu số → giữ số đang nhập.
 */
export function alignSouthStandardKgToStoredDoLi(input: {
  catalogSheetKg: unknown;
  catalogDoLiDm: string | null | undefined;
  khoScale?: number | null;
  fieldDoLiDm: string | null | undefined;
  storedDoLiDm: string | null | undefined;
  enteredStandardKg: unknown;
  zem?: boolean;
}): number | null {
  const entered = parseSouthDinhMucKg(input.enteredStandardKg);
  if (input.zem || entered === null) return entered;
  const sheet = parseSouthDinhMucKg(input.catalogSheetKg);
  if (sheet === null) return entered;
  const kho = input.khoScale && Number.isFinite(input.khoScale) && input.khoScale > 0 ? input.khoScale : 1;
  const fieldScale = doLiDmWeightScale(input.fieldDoLiDm, input.catalogDoLiDm) ?? 1;
  const storedScale = doLiDmWeightScale(input.storedDoLiDm, input.catalogDoLiDm) ?? 1;
  const catalogDm = truncateTo4Decimals(sheet * kho);
  const fieldAuto = truncateTo4Decimals(sheet * kho * fieldScale);
  const storedAuto = truncateTo4Decimals(sheet * kho * storedScale);
  if (entered === catalogDm || entered === fieldAuto) return storedAuto;
  return entered;
}

/** Hệ số khổ = khổ nhập / khổ chuẩn của sản phẩm. Thiếu một trong hai → null (không điều chỉnh). */
export function southKhoScale(enteredKho: unknown, standardKho: unknown): number | null {
  const entered = parsePercentInput(String(enteredKho ?? ''));
  const standard = parsePercentInput(String(standardKho ?? '').replace(/m\s*$/iu, ''));
  if (!Number.isFinite(entered) || !Number.isFinite(standard) || entered <= 0 || standard <= 0) return null;
  return entered / standard;
}

/** Tổng KG đơn hàng luôn lưu tối đa 4 số sau dấu phẩy bằng cắt số (không làm tròn). Không hợp lệ / <= 0 = null. */
export function truncateTotalKg4(value: unknown): number | null {
  const parsed = parsePercentInput(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? truncateTo4Decimals(parsed) : null;
}

/**
 * Đơn miền nam: ưu tiên kg/1m đã lưu trên bảng quy đổi, không chia lại TL/tấm đã cắt số.
 * Nếu người dùng đổi ĐM kg/chiều dài tiêu chuẩn so với danh mục thì tính theo số đã sửa.
 * Thiếu kg/1m danh mục mới suy từ kg tiêu chuẩn / chiều dài tiêu chuẩn.
 */
export function southOrderKgPerMeter(
  enteredStandardKg: unknown,
  catalogSheetKg: unknown,
  catalogKgPerMeter: unknown,
  doDaiTamTieuChuan: unknown,
  catalogSheetLength?: unknown
): number | null {
  const catalogRate = parseSouthDinhMucKg(catalogKgPerMeter);
  if (catalogRate !== null) {
    const enteredKg = parseSouthDinhMucKg(enteredStandardKg);
    const catalogKg = parseSouthDinhMucKg(catalogSheetKg);
    const enteredLength = parsePercentInput(String(doDaiTamTieuChuan ?? ''));
    const catalogLength = parsePercentInput(String(catalogSheetLength ?? ''));
    const kgChanged = enteredKg !== null && catalogKg !== null && enteredKg !== catalogKg;
    const lengthChanged = enteredLength > 0 && catalogLength > 0 && enteredLength !== catalogLength;
    if (kgChanged || lengthChanged) {
      return southKgPerStandardMeter(enteredStandardKg, doDaiTamTieuChuan) ?? catalogRate;
    }
    return catalogRate;
  }
  return southKgPerStandardMeter(enteredStandardKg, doDaiTamTieuChuan)
    ?? southKgPerStandardMeter(catalogSheetKg, doDaiTamTieuChuan);
}

/** kg/1m = định mức tiêu chuẩn (kg) / độ dài tấm tiêu chuẩn (m). */
export function southKgPerStandardMeter(
  standardKg: unknown,
  doDaiTamTieuChuan: unknown
): number | null {
  const kg = parseSouthDinhMucKg(standardKg);
  const sheetLength = parsePercentInput(String(doDaiTamTieuChuan ?? ''));
  if (kg === null || !Number.isFinite(sheetLength) || sheetLength <= 0) return null;
  // Không làm tròn trung gian; UI cắt 4 số lẻ khi hiển thị.
  return kg / sheetLength;
}

/** Tổng trọng lượng miền nam = kg/1m × m dài × số lượng (giữ 4 số sau dấu phẩy bằng cắt số). */
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
  return truncateTo4Decimals(perMeter * length * qty);
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
