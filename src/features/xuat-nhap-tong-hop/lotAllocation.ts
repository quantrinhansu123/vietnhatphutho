/** Phân bổ SL xuất vào các lô nhập còn tồn (nhập trước – xuất trước), tính giá bình quân gia quyền. */
export type LotLike = {
  id: string;
  ma_phieu?: string;
  ngay_phieu?: string;
  don_gia: number;
  so_luong_con: number;
};

export type LotAlloc = {
  id: string;
  maPhieu: string;
  qty: number;
  donGia: number;
};

export type LotAllocResult = {
  allocs: LotAlloc[];
  /** Tổng SL phân bổ được (≤ SL cần xuất). */
  allocated: number;
  /** Tổng tồn khả dụng của các lô (đã trừ phần dòng khác giữ). */
  available: number;
  /** Tổng tiền = Σ qty × đơn giá lô. */
  total: number;
  /** Giá bình quân gia quyền (0 khi chưa có). */
  avgPrice: number;
};

const r3 = (value: number) => Math.round(value * 1000) / 1000;

export function sortLotsFifo<T extends LotLike>(lots: T[]): T[] {
  return [...lots].sort((a, b) =>
    String(a.ngay_phieu || '').localeCompare(String(b.ngay_phieu || '')) ||
    String(a.ma_phieu || '').localeCompare(String(b.ma_phieu || ''))
  );
}

/**
 * @param reserved SL mỗi lô đã bị dòng khác trong cùng phiếu giữ.
 * @param preferredId lô người dùng chọn làm lô bắt đầu; hết lô này mới sang lô kế (FIFO).
 */
export function allocateLots(
  lots: LotLike[],
  qty: number,
  reserved: Map<string, number>,
  preferredId?: string
): LotAllocResult {
  const sorted = sortLotsFifo(lots);
  const ordered = preferredId
    ? [...sorted.filter(lot => lot.id === preferredId), ...sorted.filter(lot => lot.id !== preferredId)]
    : sorted;
  const free = (lot: LotLike) => Math.max(0, r3(Number(lot.so_luong_con) - (reserved.get(lot.id) || 0)));
  const available = r3(ordered.reduce((sum, lot) => sum + free(lot), 0));
  const allocs: LotAlloc[] = [];
  let left = r3(qty);
  for (const lot of ordered) {
    if (left <= 1e-9) break;
    const room = free(lot);
    if (room <= 0) continue;
    const take = Math.min(room, left);
    allocs.push({ id: lot.id, maPhieu: lot.ma_phieu || '', qty: r3(take), donGia: Number(lot.don_gia) || 0 });
    left = r3(left - take);
  }
  const allocated = r3(allocs.reduce((sum, item) => sum + item.qty, 0));
  const total = allocs.reduce((sum, item) => sum + item.qty * item.donGia, 0);
  return { allocs, allocated, available, total, avgPrice: allocated > 0 ? total / allocated : 0 };
}
