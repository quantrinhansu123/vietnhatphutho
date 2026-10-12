export type ProductionConversionRates = {
  kg?: number;
  m2?: number;
  mDai?: number;
};

export type ManualConversionFlags = {
  /** Người dùng đã sửa tay ô KG (hiển thị nguyên văn đã gõ). */
  manualKg?: boolean;
  /** Người dùng đã sửa tay ô M2 (hiển thị nguyên văn đã gõ). */
  manualM2?: boolean;
  /** Người dùng đã sửa tay ô M dài (hiển thị nguyên văn đã gõ). */
  manualMDai?: boolean;
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
  // Ô đã sửa tay (còn số hợp lệ) thì giữ nguyên tuyệt đối, chỉ tính lại các ô tự động.
  const flags = line as Partial<ManualConversionFlags>;
  const manualText = (flag: boolean | undefined, text: string | undefined) => {
    const trimmed = String(text ?? '').trim();
    return flag && parseQty(trimmed) > 0 && qty > 0 ? trimmed : null;
  };
  const keptKg = manualText(flags.manualKg, line.tongKg);
  const keptM2 = manualText(flags.manualM2, line.m2);
  const keptMDai = manualText(flags.manualMDai, line.mDai);
  const scaled = (rate: number | undefined) => {
    if (!rate || qty <= 0) return '';
    const value = roundEntryConversion(rate * qty);
    return value > 0 ? String(value) : '';
  };
  const kg = keptKg ?? scaled(rates.kg);
  const m2 = keptM2 ?? scaled(rates.m2);
  const mDai = keptMDai ?? scaled(rates.mDai);
  const kept = (line.conversionResults || []).filter(item => {
    const unit = normalizeConversionUnitLabel(item.unit);
    if (unit === 'kg') return keptKg !== null;
    if (unit === 'm2') return keptM2 !== null;
    if (unit === 'm dài') return keptMDai !== null;
    return true;
  });
  const nextResults = [
    ...kept,
    ...(kg && !keptKg ? [{ unit: 'kg', value: Number(kg) }] : []),
    ...(m2 && !keptM2 ? [{ unit: 'm2', value: Number(m2) }] : []),
    ...(mDai && !keptMDai ? [{ unit: 'm dài', value: Number(mDai) }] : [])
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

/**
 * Người dùng sửa tay ô KG / M2 / M dài: chốt số đã nhập (lưu + hiển thị),
 * suất 1 SP gốc giữ nguyên. Đổi SL sau đó: ô tay giữ nguyên tuyệt đối,
 * các ô còn lại tính theo suất gốc. Xóa trắng ô → quay về tự động.
 */
export function setManualEntryConversionValue<T extends EntryConversionLine & ManualConversionFlags>(
  line: T,
  unit: 'kg' | 'm2' | 'm dài',
  rawValue: string
): T {
  const flagKey = unit === 'kg' ? 'manualKg' : unit === 'm2' ? 'manualM2' : 'manualMDai';
  const fieldKey = unit === 'kg' ? 'tongKg' : unit === 'm2' ? 'm2' : 'mDai';
  const rateKey = unit === 'kg' ? 'kg' : unit === 'm2' ? 'm2' : 'mDai';
  const trimmed = rawValue.trim();
  const keptResults = (line.conversionResults || []).filter(
    item => normalizeConversionUnitLabel(item.unit) !== normalizeConversionUnitLabel(unit)
  );

  // Xóa trắng → về tự động (tính lại theo suất gốc còn giữ nguyên).
  if (trimmed === '') {
    const cleared: T = { ...line, [fieldKey]: '', [flagKey]: false, conversionResults: keptResults };
    const rates = cleared.quyDoiMotDonVi ?? conversionRatesForEntry(cleared, parseQty(cleared.quantity));
    const qty = parseQty(cleared.quantity);
    const rate = rates?.[rateKey];
    if (rate && qty > 0) {
      const value = roundEntryConversion(rate * qty);
      const text = value > 0 ? String(value) : '';
      return {
        ...cleared,
        [fieldKey]: text,
        conversionResults: [...keptResults, ...(value > 0 ? [{ unit, value: Number(value) }] : [])],
        quyDoiMotDonVi: rates
      };
    }
    return { ...cleared, quyDoiMotDonVi: rates };
  }

  const numeric = parseQty(trimmed);
  // Chưa phải số hợp lệ (đang gõ dở) → giữ nguyên văn, chưa chốt suất.
  if (!(numeric > 0)) {
    return { ...line, [fieldKey]: rawValue, [flagKey]: true };
  }

  return {
    ...line,
    [fieldKey]: trimmed,
    [flagKey]: true,
    conversionResults: [...keptResults, { unit, value: numeric }]
  };
}
