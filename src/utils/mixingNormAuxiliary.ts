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

export function isTapeOrStampMaterial(groupOrName: string): boolean {
  const norm = normalizeNhomVatTuPhuKey(groupOrName);
  return norm === 'Băng Dính' || norm === 'Tem';
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

/** Ghép tên phiếu trộn định mức ban đầu. */
export function formatMixingNormSlipName(
  ngay?: string | null,
  mayOrCa?: string | null,
  lsxOrDh?: string | null
): string {
  const parts: string[] = ['PTĐM'];
  const n = String(ngay ?? '').trim();
  const may = String(mayOrCa ?? '').trim();
  const ref = String(lsxOrDh ?? '').trim();
  if (n) parts.push(n);
  if (may) parts.push(may);
  if (ref) parts.push(ref);
  return parts.join(' - ');
}

/** Bỏ hậu tố phiên bản để luôn lấy đúng tên của phiếu định mức ban đầu. */
export function stripMixingNormRevisionSuffix(value?: string | null): string {
  return String(value ?? '')
    .replace(/\s*-\s*tỷ lệ\s+\d+\s*$/iu, '')
    .trim();
}

/** Tên một phiên bản thay đổi định mức, ví dụ "PTĐM ... - tỷ lệ 2". */
export function buildMixingNormRevisionName(baseName: string, revision: number): string {
  const normalizedRevision = Math.max(1, Math.trunc(Number(revision) || 1));
  const normalizedBaseName = stripMixingNormRevisionSuffix(baseName) || 'PTĐM';
  return `${normalizedBaseName} - tỷ lệ ${normalizedRevision}`;
}

/** Đọc số lần thay đổi từ hậu tố tên phiếu. */
export function getMixingNormRevisionNumber(value?: string | null): number {
  const match = String(value ?? '').trim().match(/\s-\s*tỷ lệ\s+(\d+)\s*$/iu);
  return match ? Math.max(0, Math.trunc(Number(match[1]) || 0)) : 0;
}

type MixingNormHistoryLine = {
  material_id?: unknown;
  ma_nvl?: unknown;
  ten_nvl?: unknown;
  ten_nvl_san_xuat?: unknown;
  nhom_vthh?: unknown;
  gia_tri?: unknown;
  don_vi?: unknown;
  khoi_luong?: unknown;
  tong_khoi_luong?: unknown;
};

type MixingNormHistoryProduct = {
  loai?: unknown;
  san_pham_id?: unknown;
  san_pham_ids?: unknown;
  ma_sp?: unknown;
  nvl?: MixingNormHistoryLine[];
  chi_tiet?: MixingNormHistoryLine[];
  nvl_phu?: MixingNormHistoryLine[];
};

function normalizeHistoryNumber(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 1_000_000) / 1_000_000 : null;
}

function mixingNormMaterialWeightSnapshot(products: MixingNormHistoryProduct[]): string[] {
  const snapshots: string[] = [];
  for (const product of Array.isArray(products) ? products : []) {
    const productIds = Array.isArray(product.san_pham_ids)
      ? product.san_pham_ids.map(value => String(value ?? '').trim()).filter(Boolean)
      : String(product.san_pham_id ?? '').trim()
        ? [String(product.san_pham_id).trim()]
        : [];
    const productKey = String(product.ma_sp ?? '').trim().toLocaleLowerCase('vi') || productIds.sort().join(',');
    const isSecondaryBlock = String(product.loai ?? '').trim() === 'nvl_phu';
    const groups: Array<{ kind: 'chinh' | 'phu'; lines: MixingNormHistoryLine[] }> = isSecondaryBlock
      ? [{ kind: 'phu', lines: Array.isArray(product.nvl_phu) ? product.nvl_phu : [] }]
      : [
          {
            kind: 'chinh',
            lines: Array.isArray(product.nvl)
              ? product.nvl
              : Array.isArray(product.chi_tiet)
                ? product.chi_tiet
                : []
          },
          { kind: 'phu', lines: Array.isArray(product.nvl_phu) ? product.nvl_phu : [] }
        ];

    for (const group of groups) {
      for (const line of group.lines) {
        const materialKey = [
          line.ma_nvl,
          line.ten_nvl,
          line.ten_nvl_san_xuat,
          line.nhom_vthh
        ].map(value => String(value ?? '').trim().toLocaleLowerCase('vi')).join('|') ||
          String(line.material_id ?? '').trim();
        snapshots.push(JSON.stringify({
          kind: group.kind,
          product: productKey,
          material: materialKey,
          giaTri: normalizeHistoryNumber(line.gia_tri),
          donVi: String(line.don_vi ?? '').trim().toLocaleLowerCase('vi'),
          khoiLuong: normalizeHistoryNumber(line.khoi_luong),
          tongKhoiLuong: normalizeHistoryNumber(line.tong_khoi_luong)
        }));
      }
    }
  }
  return snapshots.sort();
}

/**
 * FE dùng hàm này để quyết định có yêu cầu API tạo bản ghi lịch sử hay không.
 * Chỉ snapshot trọng lượng các dòng NVL chính/phụ được so sánh; metadata phiếu không tham gia.
 */
export function hasMixingNormMaterialWeightChanges(
  before: MixingNormHistoryProduct[],
  after: MixingNormHistoryProduct[]
): boolean {
  const beforeSnapshot = mixingNormMaterialWeightSnapshot(before);
  const afterSnapshot = mixingNormMaterialWeightSnapshot(after);
  return beforeSnapshot.length !== afterSnapshot.length ||
    beforeSnapshot.some((value, index) => value !== afterSnapshot[index]);
}

/** Ẩn nhãn chuẩn kiểu STD01/STD02 trên phiếu in. */
export function isMixingNormStdLabel(value?: string | null): boolean {
  return /^STD\s*\d+$/i.test(String(value ?? '').trim());
}

/** Lấy phần ghi chú còn lại sau khi bỏ tiền tố STD0x. */
export function stripMixingNormStdPrefix(value?: string | null): string {
  return String(value ?? '')
    .replace(/^\s*STD\s*\d+\s*[-–—:]?\s*/i, '')
    .trim();
}

/**
 * Tính trọng lượng định mức (kg/ĐVT) cho nguyên vật liệu phụ.
 * - Băng Dính: Rỗng = 0.5 kg/cuộn, Đặc/Sóng = 0.4 kg/cuộn
 * - Tem: Rỗng = 0.0023 kg/cái, Đặc/Sóng = 0.0013 kg/cái
 * - Đơn vị kg: luôn bằng 1.0
 */
export function resolveAuxiliaryWeightPerUnit(
  groupOrName: string,
  nhomVthh?: string | null,
  unit?: string | null
): number | undefined {
  const normUnit = (unit || '').trim().toLowerCase();
  if (normUnit === 'kg') return 1.0;
  const group = normalizeNhomVatTuPhuKey(groupOrName || '');
  const ws = resolveWorkshopType(nhomVthh || '');

  if (group === 'Băng Dính') {
    if (ws === 'rong') return 0.5;
    if (ws === 'dac' || ws === 'song') return 0.4;
    return 0.5;
  }
  if (group === 'Tem') {
    if (ws === 'rong') return 0.0023;
    if (ws === 'dac' || ws === 'song') return 0.0013;
    return 0.0023;
  }
  return undefined;
}


