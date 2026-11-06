import type { ProductConversionForm } from '../san-pham';
import { truncateTo3Decimals } from '../../utils/weightTruncate';

export const conversionKeys = ['khoTamRongM', 'khoTamDaiM', 'khoCuonRongM', 'khoCuonDaiM', 'dienTichM2', 'trongLuongKgMDai', 'trongLuongKgM2', 'trongLuongKgTam', 'trongLuongKgCuon'] as const;
export const positiveNumber = (value: unknown): number | null => {
  const number = Number(String(value ?? '').replace(',', '.').replace(/m\s*$/iu, '').trim());
  return Number.isFinite(number) && number > 0 ? number : null;
};
const kg = (value: number | null) => value === null ? '' : String(truncateTo3Decimals(value));
const area = (value: number | null) => value === null ? '' : String(Math.round((value + Number.EPSILON) * 100) / 100);

/** Tính lại từ suất trọng lượng gốc, không dùng tổng KG/số lượng đơn hàng. */
export function variantConversion(
  source: ProductConversionForm,
  specs: { width?: string; length?: string; weightScale?: number | null; kgPerSheet?: string }
): ProductConversionForm {
  const oldWidth = positiveNumber(source.khoTamRongM);
  const oldLength = positiveNumber(source.khoTamDaiM);
  if ((!specs.width || positiveNumber(specs.width) === oldWidth)
    && (!specs.length || positiveNumber(specs.length) === oldLength)
    && (specs.weightScale === undefined || specs.weightScale === 1)
    && !positiveNumber(specs.kgPerSheet)) return { ...source };
  const width = positiveNumber(specs.width) ?? oldWidth;
  const length = positiveNumber(specs.length) ?? oldLength;
  const next = { ...source, khoTamRongM: width ? String(width) : '', khoTamDaiM: length ? String(length) : '' };
  if (specs.width && source.khoCuonRongM) next.khoCuonRongM = String(width ?? '');
  const rollWidth = positiveNumber(next.khoCuonRongM) ?? width;
  const rollLength = positiveNumber(next.khoCuonDaiM);
  const directSheet = positiveNumber(specs.kgPerSheet);
  const oldLinear = positiveNumber(source.trongLuongKgMDai);
  const oldSheet = positiveNumber(source.trongLuongKgTam);
  const oldRoll = positiveNumber(source.trongLuongKgCuon);
  const oldArea = positiveNumber(source.dienTichM2)
    ?? ((positiveNumber(source.khoCuonRongM) ?? oldWidth) && rollLength
      ? (positiveNumber(source.khoCuonRongM) ?? oldWidth)! * rollLength : null);
  const baseM2 = positiveNumber(source.trongLuongKgM2)
    ?? (oldLinear && oldWidth ? oldLinear / oldWidth : null)
    ?? (oldSheet && oldWidth && oldLength ? oldSheet / (oldWidth * oldLength) : null)
    ?? (oldRoll && oldArea ? oldRoll / oldArea : null);
  const m2Weight = directSheet && width && length
    ? directSheet / (width * length)
    : baseM2 && specs.weightScale !== null ? baseM2 * (specs.weightScale ?? 1) : null;
  const linear = m2Weight && width ? m2Weight * width
    : directSheet && length ? directSheet / length : null;
  const nextArea = rollWidth && rollLength ? rollWidth * rollLength : null;
  return {
    ...next,
    dienTichM2: area(nextArea),
    trongLuongKgM2: kg(m2Weight),
    trongLuongKgMDai: kg(linear),
    trongLuongKgTam: kg(directSheet ?? (linear && length ? linear * length : null)),
    trongLuongKgCuon: kg(m2Weight && nextArea ? m2Weight * nextArea : null)
  };
}

/** Đổi ô nguồn trong modal: xóa giá trị dẫn xuất cũ nếu không còn đủ căn cứ. */
export function editVariantConversion(row: ProductConversionForm, key: keyof ProductConversionForm, value: string): ProductConversionForm {
  const next = { ...row, [key]: value };
  if (key === 'trongLuongKgTam' || key === 'trongLuongKgCuon') return next;
  const width = positiveNumber(next.khoTamRongM);
  const length = positiveNumber(next.khoTamDaiM);
  const rollWidth = positiveNumber(next.khoCuonRongM) ?? width;
  const rollLength = positiveNumber(next.khoCuonDaiM);
  const m2 = positiveNumber(next.trongLuongKgM2);
  if (key === 'khoTamRongM' || key === 'trongLuongKgM2') next.trongLuongKgMDai = kg(width && m2 ? width * m2 : null);
  if (['khoTamRongM', 'khoCuonRongM', 'khoCuonDaiM'].includes(key)) next.dienTichM2 = area(rollWidth && rollLength ? rollWidth * rollLength : null);
  const linear = positiveNumber(next.trongLuongKgMDai);
  const surface = positiveNumber(next.dienTichM2);
  next.trongLuongKgTam = kg(linear && length ? linear * length : null);
  next.trongLuongKgCuon = kg(m2 && surface ? m2 * surface : linear && rollLength ? linear * rollLength : null);
  return next;
}

export function validateVariantConversions(rows: ProductConversionForm[], unit: string): string {
  if (rows.length !== 1) return 'Mỗi sản phẩm cần đúng một bộ quy đổi gồm đầy đủ các trường. Vui lòng kiểm tra bảng quy đổi.';
  for (const row of rows) {
    if (conversionKeys.some(key => row[key].trim() && positiveNumber(row[key]) === null)) return 'Các giá trị quy đổi phải lớn hơn 0 hoặc để trống.';
    const sheetRequired = unit.toLocaleLowerCase('vi') === 'tấm';
    const rollRequired = unit.toLocaleLowerCase('vi') === 'cuộn';
    if (unit.toLowerCase() === 'm' && !positiveNumber(row.trongLuongKgMDai)) return 'Cần bổ sung kg/m dài để lưu đúng quy đổi sản phẩm.';
    if (['m2', 'm²'].includes(unit.toLowerCase()) && !positiveNumber(row.trongLuongKgM2)) return 'Cần bổ sung kg/m² để lưu đúng quy đổi sản phẩm.';
    if (sheetRequired && (!positiveNumber(row.khoTamRongM) || !positiveNumber(row.khoTamDaiM) || !positiveNumber(row.trongLuongKgTam))) return 'Cần bổ sung khổ tấm rộng, dài và kg/Tấm để lưu đúng quy đổi sản phẩm.';
    if (rollRequired && (!positiveNumber(row.khoCuonRongM) || !positiveNumber(row.khoCuonDaiM) || !positiveNumber(row.trongLuongKgCuon))) return 'Cần bổ sung khổ cuộn rộng, dài và kg/Cuộn để lưu đúng quy đổi sản phẩm.';
    if (!Object.values(row).some(value => positiveNumber(value))) return 'Vui lòng nhập quy đổi sản phẩm trước khi lưu.';
  }
  return '';
}
