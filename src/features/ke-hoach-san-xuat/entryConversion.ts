export type ProductionConversionRates = {
  kg?: number;
  m2?: number;
  mDai?: number;
};

export type EntryConversionLine = {
  quantity: string;
  conversionResults?: Array<{ unit: string; value: number }>;
  tongKg?: string;
  m2?: string;
  mDai?: string;
  kg1Sp?: string;
  quyDoiMotDonVi?: ProductionConversionRates;
};

function parseQty(value: string) {
  const normalized = String(value ?? '').replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeConversionUnitLabel(value: string) {
  return value.trim().toLocaleLowerCase('vi').replace(/\s+/g, ' ');
}

export function productionEntryConversionValue(
  line: Pick<EntryConversionLine, 'conversionResults' | 'tongKg' | 'm2' | 'mDai'>,
  unit: 'kg' | 'm2' | 'm dài'
): number | null {
  const result = line.conversionResults?.find(item => normalizeConversionUnitLabel(item.unit) === normalizeConversionUnitLabel(unit));
  if (result && Number.isFinite(result.value) && result.value > 0) return result.value;
  const fallback = unit === 'kg' ? line.tongKg : unit === 'm2' ? line.m2 : line.mDai;
  const parsed = fallback ? parseQty(fallback) : 0;
  return parsed > 0 ? parsed : null;
}

function roundEntryConversion(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/** Suất quy đổi 1 SP từ tổng của `basisQuantity` (số lượng mà KG/M2/M dài hiện đang tương ứng). */
export function conversionRatesForEntry(
  line: Pick<EntryConversionLine, 'conversionResults' | 'tongKg' | 'm2' | 'mDai' | 'kg1Sp'>,
  basisQuantity: number
): ProductionConversionRates | undefined {
  const rates: ProductionConversionRates = {};
  const kgTotal = productionEntryConversionValue(line, 'kg');
  const m2Total = productionEntryConversionValue(line, 'm2');
  const mDaiTotal = productionEntryConversionValue(line, 'm dài');
  const kg1 = parseQty(String(line.kg1Sp || ''));
  if (basisQuantity > 0 && kgTotal) rates.kg = kgTotal / basisQuantity;
  else if (kg1 > 0) rates.kg = kg1;
  if (basisQuantity > 0 && m2Total) rates.m2 = m2Total / basisQuantity;
  if (basisQuantity > 0 && mDaiTotal) rates.mDai = mDaiTotal / basisQuantity;
  return rates.kg || rates.m2 || rates.mDai ? rates : undefined;
}

/** Tính lại KG / M2 / M dài = suất 1 SP × số lượng mới, kể cả khi gõ thêm chữ số. */
export function scaleProductionEntryQuantity<T extends EntryConversionLine>(
  line: T,
  quantity: string
): Partial<T> {
  const rates = line.quyDoiMotDonVi ?? conversionRatesForEntry(line, parseQty(line.quantity));
  if (!rates) return { quantity } as Partial<T>;
  const qty = parseQty(quantity);
  const scaled = (rate: number | undefined) => {
    if (!rate || qty <= 0) return '';
    const value = roundEntryConversion(rate * qty);
    return value > 0 ? String(value) : '';
  };
  const kg = scaled(rates.kg);
  const m2 = scaled(rates.m2);
  const mDai = scaled(rates.mDai);
  const kept = (line.conversionResults || []).filter(item => {
    const unit = normalizeConversionUnitLabel(item.unit);
    return unit !== 'kg' && unit !== 'm2' && unit !== 'm dài';
  });
  const nextResults = [
    ...kept,
    ...(kg ? [{ unit: 'kg', value: Number(kg) }] : []),
    ...(m2 ? [{ unit: 'm2', value: Number(m2) }] : []),
    ...(mDai ? [{ unit: 'm dài', value: Number(mDai) }] : [])
  ];
  return {
    quantity,
    tongKg: kg,
    m2,
    mDai,
    conversionResults: nextResults,
    quyDoiMotDonVi: rates
  } as Partial<T>;
}
