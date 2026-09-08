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

const positive = (value: number | null) => Number.isFinite(value) && (value as number) > 0
  ? value as number
  : null;

export const roundProductConversion = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Trả về các giá trị có thể suy ra từ dữ liệu nguồn.
 * `null` nghĩa là chưa đủ dữ liệu cho công thức tương ứng.
 */
export function calculateProductConversionFormulas(
  input: ProductConversionCalculationInput
): ProductConversionFormulaResult {
  const sheetWidth = positive(input.sheetWidthM);
  const sheetLength = positive(input.sheetLengthM);
  const rollWidth = positive(input.rollWidthM);
  const rollLength = positive(input.rollLengthM);
  const enteredArea = positive(input.areaM2);
  const enteredKgPerLinearM = positive(input.kgPerLinearM);
  const kgPerM2 = positive(input.kgPerM2);

  const effectiveRollWidth = rollWidth || sheetWidth;
  const effectiveSheetWidth = sheetWidth || rollWidth;
  const areaM2 = effectiveRollWidth && rollLength
    ? roundProductConversion(effectiveRollWidth * rollLength)
    : null;

  // kg/1 m dài được suy ra riêng từ khổ tấm rộng và kg/m².
  const kgPerLinearM = sheetWidth && kgPerM2
    ? roundProductConversion(sheetWidth * kgPerM2)
    : null;
  // kg/m dài nhập trực tiếp là dữ liệu nguồn và được ưu tiên cho kg/tấm.
  const effectiveKgPerLinearM = enteredKgPerLinearM || kgPerLinearM;

  let kgPerSheet: number | null = null;
  if (sheetLength && effectiveKgPerLinearM) {
    kgPerSheet = roundProductConversion(sheetLength * effectiveKgPerLinearM);
  } else if (sheetLength && kgPerM2 && effectiveSheetWidth) {
    kgPerSheet = roundProductConversion(effectiveSheetWidth * sheetLength * kgPerM2);
  }

  // Diện tích người dùng nhập được ưu tiên; nếu trống mới dùng diện tích suy ra.
  const effectiveAreaM2 = enteredArea || areaM2;
  let kgPerRoll: number | null = null;
  if (effectiveAreaM2 && kgPerM2) {
    kgPerRoll = roundProductConversion(effectiveAreaM2 * kgPerM2);
  } else if (rollLength && kgPerM2 && effectiveRollWidth) {
    kgPerRoll = roundProductConversion(effectiveRollWidth * rollLength * kgPerM2);
  } else if (rollLength && effectiveKgPerLinearM) {
    kgPerRoll = roundProductConversion(rollLength * effectiveKgPerLinearM);
  }

  return { areaM2, kgPerLinearM, kgPerSheet, kgPerRoll };
}
