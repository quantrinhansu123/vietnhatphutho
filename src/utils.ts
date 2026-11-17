import { ProductionReport, ComputedReportMetrics, STANDARD_PRODUCTS } from './types';

export function sumArray(arr: number[] | undefined): number {
  if (!arr) return 0;
  return arr.reduce((sum, val) => sum + (Number(val) || 0), 0);
}

export function computeReportMetrics(report: Omit<ProductionReport, 'id' | 'createdAt'>): ComputedReportMetrics {
  const { productEntry, materials } = report;
  
  // Total of each material
  const totalVirginPlastic = sumArray(materials.virginPlastic);
  const totalRecycledPlastic = sumArray(materials.recycledPlastic);
  const totalPlastic = totalVirginPlastic + totalRecycledPlastic;
  
  const totalBrightener = sumArray(materials.brightenerPowder);
  const totalDispersionOil = sumArray(materials.dispersionOil);
  const totalOtherAdditives = sumArray(materials.otherAdditives);
  
  // Total raw materials mixed
  const totalMaterials = totalPlastic + totalBrightener + totalDispersionOil + totalOtherAdditives;
  
  // Mixing proportion based on total plastic
  const divisor = totalPlastic || 1;
  const virginPercent = (totalVirginPlastic / divisor) * 100;
  const recycledPercent = (totalRecycledPlastic / divisor) * 100;
  
  // Product details
  const matchingProduct = STANDARD_PRODUCTS.find(p => p.code === productEntry.productCode);
  const normWeight = matchingProduct ? matchingProduct.normWeight : 0;
  const expectedProductWeight = Number(productEntry.rolls || 0) * normWeight;
  const actualProductWeight = Number(productEntry.actualWeight || 0);
  
  // Variance = Plastic used - Finished product weight
  // A negative variance means we got more product weight than plastic used (unexpected, usually reporting error or dynamic moisture/filler)
  // A positive variance means plastic lost/wasted during extrusion
  const varianceWeight = totalPlastic - actualProductWeight;
  const variancePercent = totalPlastic > 0 ? (varianceWeight / totalPlastic) * 100 : 0;
  
  // Determine warning status based on threshold limits:
  // e.g., standard variance should be between 0% and +3.5% (normal melt loss, trimming loss).
  // If variance is negative, or greater than 5%, it flags a warning.
  // Over 8% or negative below -2% triggers error alert.
  let status: 'optimal' | 'warning' | 'error' = 'optimal';
  let statusMessage = 'Chỉ số bình thường';
  
  if (totalPlastic === 0 || actualProductWeight === 0) {
    status = 'warning';
    statusMessage = 'Chưa đầy đủ dữ liệu tính toán';
  } else if (variancePercent < -2 || variancePercent > 8) {
    status = 'error';
    statusMessage = variancePercent < 0 
      ? `Lỗi hao hụt âm (${formatNumber(variancePercent, 1)}%): Thành phẩm lớn hơn lượng hạt nhựa nạp vào`
      : `Lao hụt quá cao (${formatNumber(variancePercent, 1)}%): Khách hàng hoặc kỹ thuật cần kiểm tra máy`;
  } else if (variancePercent < 0 || variancePercent > 3.5) {
    status = 'warning';
    statusMessage = variancePercent < 0 
      ? `Hao hụt âm nhẹ (${formatNumber(variancePercent, 1)}%): Kiểm tra hiệu chuẩn cân`
      : `Hao hụt hơi cao (${formatNumber(variancePercent, 1)}%): Kiểm tra phế phẩm biên`;
  }
  
  return {
    totalVirginPlastic,
    totalRecycledPlastic,
    totalPlastic,
    virginPercent,
    recycledPercent,
    totalBrightener,
    totalDispersionOil,
    totalOtherAdditives,
    totalMaterials,
    expectedProductWeight,
    actualProductWeight,
    varianceWeight,
    variancePercent,
    status,
    statusMessage
  };
}

/** Chuẩn hiển thị số: phần nghìn `,`, thập phân `.` (VD: 1,234.5). */
export function formatNumber(val: number, fractionDigits: number = 1): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits
  }).format(val);
}

/** Định dạng số theo quy ước Việt Nam: hàng nghìn `.`, thập phân `,`. */
export function formatNumberVN(val: number, fractionDigits: number = 1): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits
  }).format(val);
}

/** Format giá trị vừa nhập, giữ nguyên số chữ số thập phân người dùng đã gõ. */
export function formatNumberInputVN(value: string, fallbackFractionDigits = 3): string {
  const parsed = parseLocalizedNumberVN(value);
  if (!Number.isFinite(parsed)) return value;
  const text = value.trim().replace(/\s/g, '');
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const decimalSeparator = lastComma >= 0 && lastDot >= 0
    ? (lastComma > lastDot ? ',' : '.')
    : lastComma >= 0 ? ','
      : lastDot >= 0 && !/^-?\d{1,3}(\.\d{3})+$/.test(text) ? '.' : '';
  const fractionDigits = decimalSeparator ? (text.split(decimalSeparator).pop() || '').length : 0;
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: Math.max(fallbackFractionDigits, fractionDigits)
  }).format(parsed);
}

/** Tiền VND: phần nghìn `,` (VD: 1,250,000). Lẻ dùng `.` (VD: 1,250.5). */
export function formatMoney(val: number, fractionDigits: number = 0): string {
  if (!Number.isFinite(val)) return '0';
  const rounded = Math.round(val * 10 ** fractionDigits) / 10 ** fractionDigits;
  const [intPart, decPart = ''] = Math.abs(rounded).toFixed(fractionDigits).split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = rounded < 0 ? '-' : '';
  if (fractionDigits > 0) {
    const trimmedDec = decPart.replace(/0+$/, '');
    return trimmedDec ? `${sign}${withCommas}.${trimmedDec}` : `${sign}${withCommas}`;
  }
  return `${sign}${withCommas}`;
}

/** Tiền theo quy ước Việt Nam: 1.234,50. */
export function formatMoneyVN(val: number, fractionDigits: number = 0): string {
  if (!Number.isFinite(val)) return '0';
  const rounded = Math.round(val * 10 ** fractionDigits) / 10 ** fractionDigits;
  const [intPart, decPart = ''] = Math.abs(rounded).toFixed(fractionDigits).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = rounded < 0 ? '-' : '';
  if (fractionDigits > 0) {
    const trimmedDec = decPart.replace(/0+$/, '');
    return trimmedDec ? `${sign}${withDots},${trimmedDec}` : `${sign}${withDots}`;
  }
  return `${sign}${withDots}`;
}

/**
 * Số lượng tồn/phiếu: phần nghìn `,`, thập phân `.`, làm tròn 2 số,
 * luôn hiện đủ 2 số sau `.` (VD: 1,234.50 / 22.58 / 0.00).
 */
export function formatQty(val: number): string {
  if (!Number.isFinite(val)) return '0.00';
  const rounded = Math.round(val * 100) / 100;
  const [intPart, decPart = ''] = Math.abs(rounded).toFixed(2).split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${rounded < 0 ? '-' : ''}${withCommas}.${decPart}`;
}

/** Số lượng theo quy ước Việt Nam, luôn hiện đủ hai chữ số thập phân. */
export function formatQtyVN(val: number): string {
  if (!Number.isFinite(val)) return '0,00';
  const rounded = Math.round(val * 100) / 100;
  const [intPart, decPart = ''] = Math.abs(rounded).toFixed(2).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${rounded < 0 ? '-' : ''}${withDots},${decPart}`;
}

/**
 * Đọc số nhập tay theo chuẩn mới, vẫn chịu được số cũ.
 * Mới: 25,000 -> 25000, 1,250.5 -> 1250.5.
 * Cũ: 1.250.000 -> 1250000, 1.250,5 -> 1250.5 (cùng quy ước sổ trộn).
 */
export function parseLocalizedNumber(value: unknown): number {
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return NaN;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let normalized = text;
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      // Kiểu cũ: 1.250.000,5 — dấu phẩy cuối là thập phân.
      const parts = text.replace(/\./g, '').split(',');
      const dec = parts.pop() as string;
      normalized = `${parts.join('')}.${dec}`;
    } else {
      // Kiểu mới: 1,250,000.5 — dấu chấm cuối là thập phân.
      const parts = text.replace(/,/g, '').split('.');
      const dec = parts.pop() as string;
      normalized = parts.length ? `${parts.join('')}.${dec}` : `0.${dec}`;
    }
  } else if (lastComma >= 0) {
    // Chỉ có dấu phẩy: nhóm 3 số là hàng nghìn, còn lại là thập phân.
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(/,/g, '.');
  } else if ((text.match(/\./g) || []).length > 1) {
    // Nhiều dấu chấm: kiểu cũ 1.250.000 — bỏ hết (cùng quy ước sổ trộn).
    normalized = text.replace(/\./g, '');
  }
  return Number(normalized);
}

/** Parser cho ô nhập đã chuyển sang chuẩn Việt Nam; dấu phẩy luôn là thập phân. */
export function parseLocalizedNumberVN(value: unknown): number {
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return NaN;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let normalized = text;
  if (lastDot >= 0 && lastComma >= 0) {
    // Hỗ trợ cả kiểu Việt 1.234,5 và dữ liệu cũ kiểu Mỹ 1,234.5.
    const decimalIsComma = lastComma > lastDot;
    const decimal = decimalIsComma ? ',' : '.';
    const grouping = decimalIsComma ? /\./g : /,/g;
    normalized = `${text.slice(0, text.lastIndexOf(decimal)).replace(grouping, '')}.${text.slice(text.lastIndexOf(decimal) + 1)}`;
  } else if (lastComma >= 0) {
    normalized = /^-?\d{1,3}(,\d{3}){2,}$/.test(text)
      ? text.replace(/,/g, '')
      : text.replace(',', '.');
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, '');
  }
  return Number(normalized);
}

/** Đọc số tiền nhập tay: 25,000 -> 25000, 1,250.5 -> 1250.5 (vẫn đọc được 1.250.000 và 1.250,5 cũ). */
export function parseMoneyInput(value: string): number {
  return parseLocalizedNumber(value);
}

export function parseMoneyInputVN(value: string): number {
  return parseLocalizedNumberVN(value);
}

/** Format ô nhập giá: chỉ giữ số, hiển thị dấu phẩy phân cách (24000 -> 24,000) */
export function sanitizeMoneyInput(value: string): string {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';
  return formatMoney(Number(digits), 0);
}

/** Giữ phần thập phân nhập bằng dấu phẩy và nhóm hàng nghìn bằng dấu chấm. */
export function sanitizeMoneyInputVN(value: string): string {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(/-/g, '');
  if (!cleaned) return '';
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  const commaThousandsOnly = hasComma && !hasDot && /^\d{1,3}(,\d{3}){2,}$/.test(cleaned);
  const decimalSeparator = hasComma && hasDot
    ? (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') ? ',' : '.')
    : hasComma && !commaThousandsOnly ? ',' : '';
  const decimalIndex = decimalSeparator ? cleaned.lastIndexOf(decimalSeparator) : -1;
  const integerRaw = (decimalIndex >= 0 ? cleaned.slice(0, decimalIndex) : cleaned).replace(/[.,]/g, '');
  const decimalRaw = decimalIndex >= 0 ? cleaned.slice(decimalIndex + 1).replace(/[^\d]/g, '') : '';
  const grouped = integerRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimalIndex >= 0 ? `${grouped},${decimalRaw}` : grouped;
}

export function formatPercent(val: number): string {
  return formatNumber(val, 2);
}

export function formatPercentVN(val: number): string {
  return formatNumberVN(val, 2);
}

export function parsePercentInput(value: string): number {
  // Chuẩn mới "3,000.00", vẫn đọc được kiểu cũ "3.000,00".
  return parseLocalizedNumber(value);
}

export function parsePercentInputVN(value: string): number {
  return parseLocalizedNumberVN(value);
}
