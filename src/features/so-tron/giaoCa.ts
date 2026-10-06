/**
 * Giao ca = tổng tồn cuối ca.
 * Tồn cuối từng dòng = Tồn đầu ca + Lấy kho − Tổng sử dụng, làm tròn 1 số.
 */

function num(value: unknown): number {
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!text) return 0;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const normalized =
    lastComma >= 0 && lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function tonCuoiGiaoCa(tonDau: unknown, layKho: unknown, tongSd: unknown): number {
  return round1(num(tonDau) + num(layKho) - num(tongSd));
}

export function tongGiaoCaKg(rows: { tonDau: unknown; layKho: unknown; tongSd: unknown }[]): number {
  return round1(rows.reduce((sum, row) => sum + tonCuoiGiaoCa(row.tonDau, row.layKho, row.tongSd), 0));
}

/** `1,234.6 kg`. Bằng 0 thì để trống. */
export function formatGiaoCaKg(kg: number): string {
  if (!Number.isFinite(kg)) return '';
  const rounded = round1(kg);
  if (rounded === 0) return '';
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(rounded);
  return `${text} kg`;
}
