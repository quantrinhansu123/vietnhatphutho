import { truncateTo4Decimals } from './weightTruncate';
export type ProductConversionCalculationInput = {
  sheetWidthM: number | null;
  sheetLengthM: number | null;
  rollWidthM: number | null;
  rollLengthM: number | null;
  areaM2: number | null;
  kgPerLinearM: number | null;
  kgPerM2: number | null;
};

export type ProductConversionFormulaResult = {
  areaM2: number | null;
  kgPerLinearM: number | null;
  kgPerSheet: number | null;
  kgPerRoll: number | null;
};

export type ProductConversionFormulaOptions = {
  /**
   * `ui` (mặc định): làm tròn 2 số lẻ cho form.
   * `import`: không làm tròn / không cắt số — giữ tích đầy đủ (dùng khi cần suy ra).
   */
  mode?: 'ui' | 'import';
};

const positive = (value: number | null) => Number.isFinite(value) && (value as number) > 0
  ? value as number
  : null;

export const roundProductConversion = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Import Bảng quy đổi: giữ nguyên giá trị file (không làm tròn, không cắt số).
 * Parse số đã đổi `,` → `.` ở lớp đọc Excel/CSV; hàm này chỉ passthrough.
 */
export function roundImportedConversionWeight(value: unknown): unknown {
  return value;
}

/**
 * Trả về các giá trị có thể suy ra từ dữ liệu nguồn.
 * `null` nghĩa là chưa đủ dữ liệu cho công thức tương ứng.
 */
export function calculateProductConversionFormulas(
  input: ProductConversionCalculationInput,
  options?: ProductConversionFormulaOptions
): ProductConversionFormulaResult {
  const importMode = options?.mode === 'import';
  // Import: identity — không Math.round, không truncate.
  const finalize = (value: number) => (importMode ? value : roundProductConversion(value));

  const sheetWidth = positive(input.sheetWidthM);
  const sheetLength = positive(input.sheetLengthM);
  const rollWidth = positive(input.rollWidthM);
  const rollLength = positive(input.rollLengthM);
  const enteredArea = positive(input.areaM2);
  const enteredKgPerLinearM = positive(input.kgPerLinearM);
  const kgPerM2 = positive(input.kgPerM2);

  const effectiveRollWidth = rollWidth || sheetWidth;
  const effectiveSheetWidth = sheetWidth || rollWidth;
  const rawAreaM2 = effectiveRollWidth && rollLength
    ? effectiveRollWidth * rollLength
    : null;
  const areaM2 = rawAreaM2 !== null ? finalize(rawAreaM2) : null;

  // kg/1 m dài được suy ra riêng từ khổ tấm rộng và kg/m².
  const rawKgPerLinearM = sheetWidth && kgPerM2 ? sheetWidth * kgPerM2 : null;
  const kgPerLinearM = rawKgPerLinearM !== null ? finalize(rawKgPerLinearM) : null;
  // Import: chuỗi tính dùng số thô; UI: bước sau dùng giá trị đã làm tròn 2dp.
  const effectiveKgPerLinearM = enteredKgPerLinearM
    || (importMode ? rawKgPerLinearM : kgPerLinearM);

  let kgPerSheet: number | null = null;
  if (sheetLength && effectiveKgPerLinearM) {
    kgPerSheet = finalize(sheetLength * effectiveKgPerLinearM);
  } else if (sheetLength && kgPerM2 && effectiveSheetWidth) {
    kgPerSheet = finalize(effectiveSheetWidth * sheetLength * kgPerM2);
  }

  // Diện tích người dùng nhập được ưu tiên; nếu trống mới dùng diện tích suy ra.
  const effectiveAreaM2 = enteredArea || (importMode ? rawAreaM2 : areaM2);
  let kgPerRoll: number | null = null;
  if (effectiveAreaM2 && kgPerM2) {
    kgPerRoll = finalize(effectiveAreaM2 * kgPerM2);
  } else if (rollLength && kgPerM2 && effectiveRollWidth) {
    kgPerRoll = finalize(effectiveRollWidth * rollLength * kgPerM2);
  } else if (rollLength && effectiveKgPerLinearM) {
    kgPerRoll = finalize(rollLength * effectiveKgPerLinearM);
  }

  return { areaM2, kgPerLinearM, kgPerSheet, kgPerRoll };
}

/**
 * TL/tấm: lấy `trongLuongKgTam` nếu có; thiếu thì suy ra = kg/m² × khổ rộng × dài tấm.
 * Khổ/dài tấm lấy ô tấm trước, thiếu thì dùng khổ/dài cuộn (sản phẩm tấm có khổ cuộn = khổ tấm).
 * Trả null nếu không đủ dữ liệu. Kết quả cắt 4 số lẻ (không làm tròn).
 */
export function resolveSheetKgPerUnit(row: {
  trongLuongKgTam?: unknown;
  trongLuongKgM2?: unknown;
  khoTamRongM?: unknown;
  khoTamDaiM?: unknown;
  khoCuonRongM?: unknown;
  khoCuonDaiM?: unknown;
}): number | null {
  const pos = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const direct = pos(row.trongLuongKgTam);
  if (direct !== null) return truncateTo4Decimals(direct);
  const kgM2 = pos(row.trongLuongKgM2);
  const width = pos(row.khoTamRongM) ?? pos(row.khoCuonRongM);
  const length = pos(row.khoTamDaiM) ?? pos(row.khoCuonDaiM);
  if (kgM2 === null || width === null || length === null) return null;
  return truncateTo4Decimals(kgM2 * width * length);
}
