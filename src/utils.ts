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
      ? `Lỗi hao hụt âm (${variancePercent.toFixed(1)}%): Thành phẩm lớn hơn lượng hạt nhựa nạp vào`
      : `Lao hụt quá cao (${variancePercent.toFixed(1)}%): Khách hàng hoặc kỹ thuật cần kiểm tra máy`;
  } else if (variancePercent < 0 || variancePercent > 3.5) {
    status = 'warning';
    statusMessage = variancePercent < 0 
      ? `Hao hụt âm nhẹ (${variancePercent.toFixed(1)}%): Kiểm tra hiệu chuẩn cân`
      : `Hao hụt hơi cao (${variancePercent.toFixed(1)}%): Kiểm tra phế phẩm biên`;
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

export function formatNumber(val: number, fractionDigits: number = 1): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(val);
}
