import { buildOrderTenGhep, seedProductionSpecs } from '../../utils/productProductionName';

export interface OrderProductLine {
  /** Bản ghi gốc trong JSON `don_hang.san_pham`, dùng để form sửa không làm mất dữ liệu đã lưu. */
  sourceProduct?: Record<string, unknown>;
  productId?: string;
  productCode: string;
  productName: string;
  productionName?: string;
  unit: string;
  quantity: string;
  orderRef?: string;
  conversionResults?: Array<{ unit: string; value: number }>;
  kg1Sp?: string;
  tongKg?: string;
  conversionSource?: string;
  /** Thứ tự dòng trong JSON `san_pham` của đơn hàng. */
  stt?: number;
  /** Chỉ dùng cho đơn "Đơn theo quy cách của khách đặt" (đơn cắt lẻ). */
  doLi?: string;
  kho?: string;
  daiM?: string;
  note?: string;
  quyCach?: string;
  quyCachMDai?: number | string;
  /** Tên ghép (đơn cắt lẻ) — hiển thị thay ten_san_xuat khi in đơn / lệnh SX. */
  tenGhep?: string;
  tlCuon?: string;
  tlTam?: string;
  m2?: string;
  mDai?: string;
  /** SL theo miền cho loại "Đơn sản xuất" (Bắc/Trung/Nam). SL tổng = B + T + N. */
  soLuongBac?: string;
  soLuongTrung?: string;
  soLuongNam?: string;
}

export function splitProductionProductCodes(raw: string): string[] {
  return raw
    .split(',')
    .map(code => code.trim())
    .filter(code => code && code !== '-');
}

export function splitProductionProductNames(raw: string, expectedCount: number): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || expectedCount <= 1) {
    return trimmed && trimmed !== '-' ? [trimmed] : [];
  }

  const matchCount = (parts: string[]) =>
    parts.length === expectedCount ? parts : null;

  const byPlus = matchCount(trimmed.split(/\s+\+\s+/).map(part => part.trim()).filter(Boolean));
  if (byPlus) return byPlus;

  const byComma = matchCount(trimmed.split(/,\s+/).map(part => part.trim()).filter(Boolean));
  if (byComma) return byComma;

  const byProductPrefix = matchCount(
    trimmed.split(/,\s*(?=Màng\s)/u).map(part => part.trim()).filter(Boolean)
  );
  if (byProductPrefix) return byProductPrefix;

  return [trimmed];
}

export function splitProductionFieldValues(
  raw: string,
  expectedCount: number,
  options?: { duplicateSingle?: boolean }
): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || expectedCount <= 1) {
    return [trimmed || '-'];
  }

  const parts = trimmed.split(/,\s+/).map(part => part.trim()).filter(Boolean);
  if (parts.length === expectedCount) return parts;
  if (parts.length === 1) {
    if (options?.duplicateSingle) {
      return Array(expectedCount).fill(parts[0]);
    }
    return [parts[0], ...Array(expectedCount - 1).fill('-')];
  }

  return [trimmed, ...Array(expectedCount - 1).fill('-')];
}

export function expandMergedProductionProducts(
  productCode: string,
  productName: string,
  unit: string,
  quantity: string,
  orderRef?: string
): OrderProductLine[] {
  const codes = splitProductionProductCodes(productCode);
  if (codes.length <= 1) {
    if (!productCode && !productName) return [];
    return [{ productCode, productName, unit, quantity, orderRef }];
  }

  const names = splitProductionProductNames(productName, codes.length);
  const units = splitProductionFieldValues(unit, codes.length, { duplicateSingle: true });
  const quantities = splitProductionFieldValues(quantity, codes.length);

  return codes.map((code, index) => ({
    productCode: code,
    productName: names[index] ?? names[0] ?? '',
    unit: units[index] ?? units[0] ?? unit,
    quantity: quantities[index] ?? quantities[0] ?? quantity,
    orderRef
  }));
}

export function expandProductionOrderProductLines(lines: OrderProductLine[]): OrderProductLine[] {
  return lines.flatMap(line => {
    if (splitProductionProductCodes(line.productCode).length <= 1) return [line];
    return expandMergedProductionProducts(
      line.productCode,
      line.productName,
      line.unit,
      line.quantity,
      line.orderRef
    );
  });
}

export function formatProductionNameWithLength(
  name: string,
  length?: number | string,
  options?: { tenGhep?: string; nhomVthh?: string; maAmis?: string }
): string {
  const storedTenGhep = String(options?.tenGhep || '').trim();
  if (storedTenGhep) return storedTenGhep;

  const cleanName = (name || '').trim();
  const numericLength = Number(String(length ?? '').replace(',', '.'));
  const hasValidLength = Number.isFinite(numericLength) && numericLength > 0;
  if (!cleanName || cleanName === '-') {
    if (!hasValidLength) return '-';
    return buildOrderTenGhep('', { cutLengthM: numericLength }) || '-';
  }
  if (!hasValidLength) {
    // Mọi loại đơn đều hiển thị tên ghép (kể cả khi không có mét dài).
    // Chỉ ghép lại khi tên chứa thông số parse được; tên tự do (vd "Hàng mẫu - test")
    // giữ nguyên để không cắt mất đoạn sau dấu '-'.
    const seeded = seedProductionSpecs({
      tenSanXuat: cleanName,
      nhomVthh: options?.nhomVthh || '',
      maAmis: options?.maAmis || ''
    });
    const hasSpecs = [seeded.doLi, seeded.doDayM, seeded.doDaiM, seeded.mang, seeded.hangPhe, seeded.doLiDm]
      .some(part => String(part || '').trim() !== '');
    if (!hasSpecs) return cleanName;
    return seeded.tenGhep || cleanName;
  }

  return buildOrderTenGhep(cleanName, {
    nhomVthh: options?.nhomVthh,
    maAmis: options?.maAmis,
    cutLengthM: numericLength
  });
}

/** Re-export engine ghép tên SP (Đặc/Sóng/Rỗng) — dùng dần thay raw ten_san_xuat khi đã có thông số. */
export {
  buildOrderTenGhep,
  composeProductionDisplayName,
  extractDoLiDm,
  seedProductionSpecs
} from '../../utils/productProductionName';

