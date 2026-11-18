/** Trọng lượng: cắt tối đa 4 số lẻ, không làm tròn (12.34567 → 12.3456).
 * Bù sai số nhị phân trước Math.floor để phép nhân/chia không hụt 0.0001.
 */
export function truncateTo4Decimals(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.floor(value * 10000 + 1e-6) / 10000;
}

/** Legacy: chỉ giữ cho nơi yêu cầu rõ 3 số lẻ; trọng lượng dùng truncateTo4Decimals. */
export function truncateTo3Decimals(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.floor(value * 1000 + 1e-6) / 1000;
}

/** Bọc an toàn cho giá trị có thể là null/undefined (kiểu BE `number | null`). */
export function truncateTo3DecimalsOrNull(value: number | null | undefined, fallback: number | null = null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? truncateTo3Decimals(n) : fallback;
}
