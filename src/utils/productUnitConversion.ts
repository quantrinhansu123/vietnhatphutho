export type ProductConversionFactors = {
  sanPhamId: string;
  donViTinh?: string;
  khoTamRongM: number | null;
  khoTamDaiM: number | null;
  khoCuonRongM: number | null;
  khoCuonDaiM: number | null;
  dienTichM2: number | null;
  trongLuongKgMDai: number | null;
  trongLuongKgM2: number | null;
  trongLuongKgTam: number | null;
  trongLuongKgCuon: number | null;
};

export type ProductConvertedUnit = 'm' | 'm2' | 'Tấm' | 'kg';

export function normalizeProductUnit(value: string): ProductConvertedUnit | null {
  const unit = value.trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ').replace('m²', 'm2');
  if (unit === 'm' || unit === 'm dài' || unit === 'mét' || unit === 'met') return 'm';
  if (unit === 'm2' || unit === 'm 2' || unit === 'mét vuông' || unit === 'met vuong') return 'm2';
  if (unit === 'tấm' || unit === 'tam') return 'Tấm';
  if (unit === 'kg' || unit === 'kilogram') return 'kg';
  return null;
}

export function convertProductQuantity(quantity: number, sourceUnitText: string, targetUnit: ProductConvertedUnit, conversion: ProductConversionFactors): number | null {
  if (!Number.isFinite(quantity)) return null;
  const sourceUnit = normalizeProductUnit(sourceUnitText);
  if (!sourceUnit) return null;
  if (sourceUnit === targetUnit) return quantity;
  const sheetLength = conversion.khoTamDaiM;
  const width = conversion.khoTamRongM || conversion.khoCuonRongM;
  const kgPerMeter = conversion.trongLuongKgMDai;
  const kgPerM2 = conversion.trongLuongKgM2;
  const kgPerSheet = conversion.trongLuongKgTam;

  let meters: number | null = null;
  let squareMeters: number | null = null;
  let sheets: number | null = null;
  let kg: number | null = null;
  if (sourceUnit === 'Tấm') sheets = quantity;
  if (sourceUnit === 'm') meters = quantity;
  if (sourceUnit === 'm2') squareMeters = quantity;
  if (sourceUnit === 'kg') kg = quantity;

  if (sheets !== null && sheetLength) meters = sheets * sheetLength;
  if (meters !== null && width) squareMeters = meters * width;
  if (squareMeters !== null && width && meters === null) meters = squareMeters / width;
  if (meters !== null && sheetLength && sheets === null) sheets = meters / sheetLength;
  if (kg === null) {
    if (sheets !== null && kgPerSheet) kg = sheets * kgPerSheet;
    else if (meters !== null && kgPerMeter) kg = meters * kgPerMeter;
    else if (squareMeters !== null && kgPerM2) kg = squareMeters * kgPerM2;
  }
  if (kg !== null && targetUnit !== 'kg') {
    if (kgPerMeter && meters === null) meters = kg / kgPerMeter;
    else if (kgPerM2 && squareMeters === null) squareMeters = kg / kgPerM2;
    else if (kgPerSheet && sheets === null) sheets = kg / kgPerSheet;
    if (meters === null && squareMeters !== null && width) meters = squareMeters / width;
    if (meters === null && sheets !== null && sheetLength) meters = sheets * sheetLength;
    if (sheets === null && meters !== null && sheetLength) sheets = meters / sheetLength;
  }
  return targetUnit === 'm' ? meters : targetUnit === 'm2' ? squareMeters : targetUnit === 'Tấm' ? sheets : kg;
}

export function availableConvertedUnits(sourceUnitText: string, conversion: ProductConversionFactors): ProductConvertedUnit[] {
  const source = normalizeProductUnit(sourceUnitText);
  if (!source) return [];
  return (['m', 'm2', 'Tấm', 'kg'] as ProductConvertedUnit[]).filter(unit => unit !== source && convertProductQuantity(1, source, unit, conversion) !== null);
}
