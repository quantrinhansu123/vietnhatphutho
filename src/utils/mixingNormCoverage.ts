import type { MixingProductionOrderProductLine } from './mixingOrderAutofill';

export type NormOrderQuantity = { key: string; label: string; quantity: number };

/**
 * Định danh dòng lệnh bền vững cho đối soát PTĐM.
 * Không dùng STT làm khóa chính — server lệnh SX đánh lại STT sau mỗi lần sửa.
 * Khóa = lệnh + (productId|productCode) + tên SX + ghi chú + mét cắt + ĐVT.
 */
export function orderLineIdentity(line: MixingProductionOrderProductLine): string | null {
  if (!line.orderCode || !line.productCode) return null;
  const fields = [
    line.orderCode,
    line.productId || line.productCode,
    line.productionName,
    line.ghiChu,
    line.quyCachMDai,
    line.unit
  ];
  return JSON.stringify(fields.map(value => String(value ?? '').trim().toLocaleLowerCase('vi')));
}

export function orderQuantity(line: MixingProductionOrderProductLine): NormOrderQuantity | null {
  const key = orderLineIdentity(line);
  if (!key || line.quantity == null) return null;
  return {
    key,
    label: line.orderCode + ' · ' + line.productCode,
    quantity: line.quantity
  };
}

export function readNormOrderQuantities(value: unknown): NormOrderQuantity[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (row): row is NormOrderQuantity =>
        !!row &&
        typeof row.key === 'string' &&
        typeof row.label === 'string' &&
        typeof row.quantity === 'number' &&
        Number.isFinite(row.quantity) &&
        row.quantity >= 0
    )
    .map(({ key, label, quantity }) => ({ key, label, quantity }));
}

export function compareNormCoverage(current: NormOrderQuantity[], saved: NormOrderQuantity[]) {
  const group = (rows: NormOrderQuantity[]) => {
    const map = new Map<string, NormOrderQuantity[]>();
    for (const row of rows) {
      const matches = map.get(row.key) || [];
      matches.push(row);
      map.set(row.key, matches);
    }
    return map;
  };
  const expected = group(current);
  const previous = group(saved);
  return [...new Set([...expected.keys(), ...previous.keys()])].map(key => {
    const now = expected.get(key) || [];
    const before = previous.get(key) || [];
    const delta = (now[0]?.quantity ?? 0) - (before[0]?.quantity ?? 0);
    return {
      key,
      label: (now[0] || before[0]).label,
      delta,
      ambiguous: now.length > 1 || before.length > 1
    };
  });
}
