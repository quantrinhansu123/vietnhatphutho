export type MachinePriceGroupQuantity = {
  code: string;
  warehouse: string;
  unitPrice: number;
  quantity: number;
};

export type MachinePriceGroupIssue = MachinePriceGroupQuantity & {
  available: number;
};

function normalizePrice(value: number) {
  return (Math.round((Number(value) || 0) * 10000) / 10000).toFixed(4);
}

export function machinePriceGroupKey(
  code: string,
  warehouse: string,
  unitPrice: number,
  normalizeWarehouse: (value: unknown) => string
) {
  return `${String(code || '').trim()}|${normalizeWarehouse(warehouse)}|${normalizePrice(unitPrice)}`;
}

/** Returns the first requested price layer that exceeds its issued balance. */
export function findExceededMachinePriceGroup(
  requested: MachinePriceGroupQuantity[],
  issued: Map<string, number>,
  previouslyReturned: Map<string, number>,
  normalizeWarehouse: (value: unknown) => string
): MachinePriceGroupIssue | null {
  for (const row of requested) {
    const key = machinePriceGroupKey(row.code, row.warehouse, row.unitPrice, normalizeWarehouse);
    const issuedQty = issued.get(key);
    if (issuedQty === undefined) {
      const codePrefix = `${String(row.code || '').trim()}|`;
      const hasTrackedPriceGroupsForCode = [...issued.keys()].some(issuedKey => issuedKey.startsWith(codePrefix));
      // Historical/manual machine stock may have no source-price history. The overall Sổ trộn
      // quantity remains the guard in that case; once a code has tracked layers, keep them strict.
      if (!hasTrackedPriceGroupsForCode) continue;
      return { ...row, available: 0 };
    }
    const available = Math.max(0, issuedQty - (previouslyReturned.get(key) || 0));
    if (row.quantity > available + 1e-9) return { ...row, available };
  }
  return null;
}
