export type WorkshopType = 'rong' | 'dac' | 'song' | 'unknown';

export function normalizeNhomVatTuPhuKey(group: string): string {
  const s = (group || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  if (s.includes('bang dinh') || s.includes('bang keo')) return 'Băng Dính';
  if (s.includes('bat doc') || s.includes('bat boc')) return 'Bạt Dọc';
  if (s.includes('mang')) return 'Màng';
  if (s.includes('tem')) return 'Tem';
  if (s.includes('muc in')) return 'Mực In';
  if (s.includes('kep sat')) return 'Kẹp Sắt';
  if (s.includes('day dai') || s.includes('day buoc')) return 'Dây Đai';
  if (s.includes('dung moi')) return 'Dung Môi';
  return (group || '').trim();
}

export function resolveWorkshopType(nhomVthh: string): WorkshopType {
  const s = (nhomVthh || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (s.includes('rong')) return 'rong';
  if (s.includes('dac')) return 'dac';
  if (s.includes('song')) return 'song';
  return 'unknown';
}

export function roundWeight4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

export function calcAuxiliaryWeight(
  workshop: WorkshopType,
  nhomVatTuPhu: string,
  donVi: string,
  giaTri: number | null
): number | null {
  if (giaTri === null || !Number.isFinite(giaTri)) return null;

  // 2.4 Nếu nvl phụ có đơn vị tính là kg thì không cần công thức số lượng * trọng lượng,
  // mà trọng lượng sậ bằng với giá trị luôn.
  const normUnit = (donVi || '').trim().toLowerCase();
  if (normUnit === 'kg') {
    return roundWeight4(giaTri);
  }

  const group = normalizeNhomVatTuPhuKey(nhomVatTuPhu);

  // 2.1 Nhóm VTHH là TP; PX Rỗng: BÃng dính 0.5kg, Tem 0.0023kg
  if (workshop === 'rong') {
    if (group === 'Băng Dính') return roundWeight4(giaTri * 0.5);
    if (group === 'Tem') return roundWeight4(giaTri * 0.0023);
  }

  // 2.2 Nhóm VTHH là TP; PX Đặc: Băng dính 0.4kg, Tem 0.0013kg
  if (workshop === 'dac') {
    if (group === 'Băng Dính') return roundWeight4(giaTri * 0.4);
    if (group === 'Tem') return roundWeight4(giaTri * 0.0013);
  }

  // 2.3 Nhóm VTHH là TP; PX Sóng: Tem: 0.0013kg, Băng dính: 0.4kg
  if (workshop === 'song') {
    if (group === 'Băng Dính') return roundWeight4(giaTri * 0.4);
    if (group === 'Tem') return roundWeight4(giaTri * 0.0013);
  }

  return roundWeight4(giaTri);
}

export function getAllowedSecondaryGroups(workshop: WorkshopType): string[] | null {
  if (workshop === 'rong') {
    return ['Băng Dính', 'Màng', 'Tem'];
  }
  if (workshop === 'dac') {
    return ['Tem', 'Băng Dính', 'Bạt Dọc', 'Màng', 'Kẹp Sắt', 'Dây Đai'];
  }
  if (workshop === 'song') {
    return ['Tem', 'Băng Dính', 'Bạt Dọc', 'Mực In', 'Dung Môi'];
  }
  return null;
}

export function filterSecondaryMaterialOptions<T extends { id?: string; code: string; nhomVatTuPhu?: string }>(
  options: T[],
  allowedGroups: string[] | null,
  currentLine?: { materialId?: string; maNvl?: string }
): T[] {
  if (!allowedGroups || allowedGroups.length === 0) return options;
  const set = new Set(allowedGroups.map(normalizeNhomVatTuPhuKey));
  return options.filter(item => {
    if (currentLine && ((item.id && item.id === currentLine.materialId) || item.code === currentLine.maNvl)) {
      return true;
    }
    const groupKey = normalizeNhomVatTuPhuKey(item.nhomVatTuPhu || '');
    return set.has(groupKey);
  });
}

/**
 * Ghép tên phiếu trộn định mức: PTĐM + ngày + ca + lệnh sản xuất
 * Ví dụ: formatMixingNormSlipName('2026-09-08', 'Ca 1', 'LSX-001') => 'PTĐM - 2026-09-08 - Ca 1 - LSX-001'
 */
export function formatMixingNormSlipName(
  ngay?: string | null,
  ca?: string | null,
  maLenhSx?: string | null
): string {
  const parts: string[] = ['PTĐM'];
  const n = String(ngay ?? '').trim();
  const c = String(ca ?? '').trim();
  const lsx = String(maLenhSx ?? '').trim();
  if (n) parts.push(n);
  if (c) parts.push(c);
  if (lsx) parts.push(lsx);
  return parts.join(' - ');
}

