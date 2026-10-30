/**
 * Giữ 3 chữ số sau dấu phẩy cho các giá trị quy đổi trọng lượng (KG/1 SP, TL/tấm,
 * TL/cuộn, Tổng KG, Định mức kg, kg/1m) bằng cách **cắt số** (truncate) — không làm tròn.
 *
 * Giá trị 12.34567 → 12.345; 12.3459 → 12.345 (thay vì 12.346).
 *
 * Cộng thêm 1e-6 (thang phần nghìn) trước `Math.floor` để bù sai số nhị phân của
 * phép nhân/chia trong JS: kết quả "đúng 3 số lẻ" do tính toán có thể ra
 * `2343.9999999999995` thay vì `2344` — không cộng bù thì sẽ bị cắt nhầm thành
 * 2.343. Nghiệm thật với ≥10 chữ số 9 liên tiếp sau chữ số thứ 3 coi như không xảy ra.
 */
export function truncateTo3Decimals(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.floor(value * 1000 + 1e-6) / 1000;
}

/** Bọc an toàn cho giá trị có thể là null/undefined (kiểu BE `number | null`). */
export function truncateTo3DecimalsOrNull(value: number | null | undefined, fallback: number | null = null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? truncateTo3Decimals(n) : fallback;
}
