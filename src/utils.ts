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

/** Đọc số tiền nhập tay: 25,000 -> 25000, 1,250.5 -> 1250.5 (vẫn đọc được 1.250.000 và 1.250,5 cũ). */
export function parseMoneyInput(value: string): number {
  return parseLocalizedNumber(value);
}

/** Format ô nhập giá: chỉ giữ số, hiển thị dấu phẩy phân cách (24000 -> 24,000) */
export function sanitizeMoneyInput(value: string): string {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';
  return formatMoney(Number(digits), 0);
}

export function formatPercent(val: number): string {
  return formatNumber(val, 2);
}

export function parsePercentInput(value: string): number {
  // Chuẩn mới "3,000.00", vẫn đọc được kiểu cũ "3.000,00".
  return parseLocalizedNumber(value);
}
