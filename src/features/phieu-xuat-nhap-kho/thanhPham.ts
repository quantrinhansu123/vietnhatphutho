/**
 * Phiếu nhập / xuất kho thành phẩm + tồn kỳ.
 * Quy ước đã chốt:
 *  1) Gộp SP theo khóa (ma_sp + ten_sp).
 *  2) Thành tiền = SL thực × đơn giá.
 *  3) Tồn đầu kỳ = Nhập − Xuất trước `from`; Tồn cuối = Tồn đầu + Nhập − Xuất trong kỳ.
 *  4) Phiếu nhập: 1 ngày + nhiều ca → chọn nhiều sổ trộn.
 */

export type SoTronProductLineInput = {
  soTronId?: string;
  ma_sp?: string | null;
  ten_sp?: string | null;
  so_luong?: string | number | null;
  trong_luong?: string | number | null;
  tong_m2?: string | number | null;
  tong_m_dai?: string | number | null;
  trong_luong_kg_tam?: string | number | null;
  trong_luong_kg_cuon?: string | number | null;
  dvt?: string | null;
  don_vi?: string | null;
  nhom_vthh?: string | null;
};

export type MergedThanhPhamLine = {
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  nhom_vthh: string;
  so_luong: number;
  trong_luong_kg: number;
  tong_m2: number;
  tong_m_dai: number;
  kg_per_unit: number;
  m2_per_unit: number;
  m_dai_per_unit: number;
  so_tron_ids: string[];
};

export type ProductConversionHint = {
  ma_sp?: string;
  ten_sp?: string;
  don_vi?: string;
  nhom_vthh?: string;
  dien_tich_m2?: number | null;
  do_dai_m?: number | null;
  trong_luong_kg_tam?: number | null;
  trong_luong_kg_cuon?: number | null;
};

export type TonKhoMetric = {
  sl: number;
  kg: number;
  m_dai: number;
  m2: number;
};

export type TonKhoThanhPhamPeriodRow = {
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  nhom_vthh: string;
  loai_kho: string;
  ten_kho: string;
  ton_dau: TonKhoMetric;
  nhap: TonKhoMetric;
  xuat: TonKhoMetric;
  ton_cuoi: TonKhoMetric;
  /** Hệ số 1 SP từ sổ nhap_kho. Tồn kỳ vẫn lấy từ phiếu. */
  trong_luong_kg_mot_sp?: number;
  so_m2_mot_sp?: number;
  so_m_dai_mot_sp?: number;
};

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseThanhPhamNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Khóa gộp SP: ma_sp + ten_sp (trim, so sánh không phân biệt hoa thường tên). */
export function thanhPhamMergeKey(maSp: string, tenSp: string): string {
  return `${String(maSp || '').trim()}||${String(tenSp || '').trim().toLocaleLowerCase('vi')}`;
}

/** Khóa quy đổi 1 SP: trong_luong_kg_mot_sp|so_m2_mot_sp|so_m_dai_mot_sp. */
export function nhapKhoPerUnitKey(kg: number, m2: number, mDai: number): string {
  const part = (value: number) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '0';
    return String(Math.round(n * 1_000_000) / 1_000_000);
  };
  return `${part(kg)}|${part(m2)}|${part(mDai)}`;
}

/** Sổ nhap_kho: cùng mã + tên nhưng khác quy đổi là hai dòng. */
export function nhapKhoProductKey(
  maSp: string,
  tenSp: string,
  kg: number,
  m2: number,
  mDai: number
): string {
  return `${thanhPhamMergeKey(maSp, tenSp)}||${nhapKhoPerUnitKey(kg, m2, mDai)}`;
}

export function isCuonLikeUnit(unit: string): boolean {
  const n = String(unit || '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  return n.includes('cuon');
}

export function resolveKgPerUnit(
  unit: string,
  line: Pick<SoTronProductLineInput, 'trong_luong_kg_tam' | 'trong_luong_kg_cuon'>,
  hint?: ProductConversionHint | null
): number {
  const fromLineTam = parseThanhPhamNumber(line.trong_luong_kg_tam);
  const fromLineCuon = parseThanhPhamNumber(line.trong_luong_kg_cuon);
  if (isCuonLikeUnit(unit)) {
    if (fromLineCuon > 0) return fromLineCuon;
    if (hint?.trong_luong_kg_cuon && hint.trong_luong_kg_cuon > 0) return hint.trong_luong_kg_cuon;
  }
  if (fromLineTam > 0) return fromLineTam;
  if (hint?.trong_luong_kg_tam && hint.trong_luong_kg_tam > 0) return hint.trong_luong_kg_tam;
  if (fromLineCuon > 0) return fromLineCuon;
  if (hint?.trong_luong_kg_cuon && hint.trong_luong_kg_cuon > 0) return hint.trong_luong_kg_cuon;
  return 0;
}

/**
 * Gộp dòng SP từ nhiều sổ trộn theo (ma_sp + ten_sp).
 * Bỏ dòng thiếu cả mã và tên.
 */
export function mergeSoTronProductsByMaTen(
  lines: SoTronProductLineInput[],
  catalogHints: ProductConversionHint[] = []
): MergedThanhPhamLine[] {
  const hintByKey = new Map<string, ProductConversionHint>();
  for (const hint of catalogHints) {
    const ma = String(hint.ma_sp || '').trim();
    const ten = String(hint.ten_sp || '').trim();
    if (!ma && !ten) continue;
    hintByKey.set(thanhPhamMergeKey(ma, ten), hint);
    if (ma && !hintByKey.has(thanhPhamMergeKey(ma, ''))) {
      hintByKey.set(thanhPhamMergeKey(ma, ''), hint);
    }
  }

  const map = new Map<string, MergedThanhPhamLine>();
  for (const raw of lines) {
    const ma_sp = String(raw.ma_sp || '').trim();
    const ten_sp = String(raw.ten_sp || '').trim();
    if (!ma_sp && !ten_sp) continue;
    const hint =
      hintByKey.get(thanhPhamMergeKey(ma_sp, ten_sp)) ||
      hintByKey.get(thanhPhamMergeKey(ma_sp, '')) ||
      null;
    const don_vi = String(raw.dvt || raw.don_vi || hint?.don_vi || 'Tấm').trim() || 'Tấm';
    const nhom_vthh = String(raw.nhom_vthh || hint?.nhom_vthh || '').trim();
    const so_luong = Math.max(0, parseThanhPhamNumber(raw.so_luong));
    const kgPerUnit = resolveKgPerUnit(don_vi, raw, hint);
    const m2PerUnit =
      parseThanhPhamNumber(raw.tong_m2) > 0 && so_luong > 0
        ? parseThanhPhamNumber(raw.tong_m2) / so_luong
        : Math.max(0, Number(hint?.dien_tich_m2) || 0);
    const mDaiPerUnit =
      parseThanhPhamNumber(raw.tong_m_dai) > 0 && so_luong > 0
        ? parseThanhPhamNumber(raw.tong_m_dai) / so_luong
        : Math.max(0, Number(hint?.do_dai_m) || 0);

    let trong_luong_kg = parseThanhPhamNumber(raw.trong_luong);
    if (trong_luong_kg <= 0 && kgPerUnit > 0 && so_luong > 0) {
      trong_luong_kg = so_luong * kgPerUnit;
    }
    let tong_m2 = parseThanhPhamNumber(raw.tong_m2);
    if (tong_m2 <= 0 && m2PerUnit > 0 && so_luong > 0) {
      tong_m2 = so_luong * m2PerUnit;
    }
    let tong_m_dai = parseThanhPhamNumber(raw.tong_m_dai);
    if (tong_m_dai <= 0 && mDaiPerUnit > 0 && so_luong > 0) {
      tong_m_dai = so_luong * mDaiPerUnit;
    }

    const key = thanhPhamMergeKey(ma_sp, ten_sp);
    const soTronId = String(raw.soTronId || '').trim();
    const existing = map.get(key);
    if (existing) {
      existing.so_luong = round3(existing.so_luong + so_luong);
      existing.trong_luong_kg = round3(existing.trong_luong_kg + trong_luong_kg);
      existing.tong_m2 = round3(existing.tong_m2 + tong_m2);
      existing.tong_m_dai = round3(existing.tong_m_dai + tong_m_dai);
      if (!existing.don_vi && don_vi) existing.don_vi = don_vi;
      if (!existing.nhom_vthh && nhom_vthh) existing.nhom_vthh = nhom_vthh;
      if (soTronId && !existing.so_tron_ids.includes(soTronId)) {
        existing.so_tron_ids.push(soTronId);
      }
      if (existing.so_luong > 0) {
        existing.kg_per_unit = round3(existing.trong_luong_kg / existing.so_luong);
        existing.m2_per_unit = round3(existing.tong_m2 / existing.so_luong);
        existing.m_dai_per_unit = round3(existing.tong_m_dai / existing.so_luong);
      }
      continue;
    }

    map.set(key, {
      ma_sp,
      ten_sp,
      don_vi,
      nhom_vthh,
      so_luong: round3(so_luong),
      trong_luong_kg: round3(trong_luong_kg),
      tong_m2: round3(tong_m2),
      tong_m_dai: round3(tong_m_dai),
      kg_per_unit: round3(kgPerUnit || (so_luong > 0 ? trong_luong_kg / so_luong : 0)),
      m2_per_unit: round3(m2PerUnit),
      m_dai_per_unit: round3(mDaiPerUnit),
      so_tron_ids: soTronId ? [soTronId] : []
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    `${a.ma_sp}${a.ten_sp}`.localeCompare(`${b.ma_sp}${b.ten_sp}`, 'vi')
  );
}

/** Recalc quy đổi khi user đổi SL thực (giữ hệ số / đơn vị). */
export function recalcThanhPhamLineMetrics(input: {
  quantity: number;
  kgPerUnit: number;
  m2PerUnit: number;
  mDaiPerUnit: number;
}): { weightKg: number; m2: number; mDai: number } {
  const qty = Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 0;
  return {
    weightKg: round3(qty * Math.max(0, input.kgPerUnit || 0)),
    m2: round3(qty * Math.max(0, input.m2PerUnit || 0)),
    mDai: round3(qty * Math.max(0, input.mDaiPerUnit || 0))
  };
}

/** Thành tiền = SL thực × đơn giá. */
export function computeThanhPhamLineAmount(quantity: number, unitPrice: number): number {
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const price = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
  return round2(qty * price);
}

export function emptyTonKhoMetric(): TonKhoMetric {
  return { sl: 0, kg: 0, m_dai: 0, m2: 0 };
}

export function addTonKhoMetric(a: TonKhoMetric, b: TonKhoMetric): TonKhoMetric {
  return {
    sl: round3(a.sl + b.sl),
    kg: round3(a.kg + b.kg),
    m_dai: round3(a.m_dai + b.m_dai),
    m2: round3(a.m2 + b.m2)
  };
}

export function subTonKhoMetric(a: TonKhoMetric, b: TonKhoMetric): TonKhoMetric {
  return {
    sl: round3(a.sl - b.sl),
    kg: round3(a.kg - b.kg),
    m_dai: round3(a.m_dai - b.m_dai),
    m2: round3(a.m2 - b.m2)
  };
}

export type ThanhPhamMovementRow = {
  ma_sp: string;
  ten_sp: string;
  don_vi?: string;
  nhom_vthh?: string;
  ten_kho?: string;
  loai_phieu: 'nhap' | 'xuat' | string;
  ngay_phieu: string;
  so_luong: number;
  trong_luong_kg?: number | null;
  so_m2?: number | null;
  so_m_dai?: number | null;
};

/**
 * Tính tồn kỳ từ danh sách phiếu.
 * - Trước `from` (nếu có): cộng vào ton_dau (nhập +, xuất −).
 * - Trong [from, to]: cộng nhap/xuat.
 * - Không có from: ton_dau = 0, mọi phiếu trong (to hoặc tất cả) là nhap/xuat kỳ.
 */
export function computeThanhPhamPeriodBalances(
  movements: ThanhPhamMovementRow[],
  options: {
    from?: string | null;
    to?: string | null;
    tenKho?: string | null;
    /** Khi có sổ nhap_kho, phiếu được gắn vào đúng dòng quy đổi (mã + tên + hệ số 1 SP). */
    catalog?: NhapKhoProductSeed[];
  } = {}
): TonKhoThanhPhamPeriodRow[] {
  const from = options.from ? String(options.from).slice(0, 10) : '';
  const to = options.to ? String(options.to).slice(0, 10) : '';
  const tenKhoFilter = String(options.tenKho || '').trim();
  const seedsByProduct = new Map<string, NhapKhoProductSeed[]>();
  for (const seed of options.catalog || []) {
    const productKey = thanhPhamMergeKey(seed.ma_sp, seed.ten_sp);
    const list = seedsByProduct.get(productKey);
    if (list) list.push(seed);
    else seedsByProduct.set(productKey, [seed]);
  }

  type Acc = {
    ma_sp: string;
    ten_sp: string;
    don_vi: string;
    nhom_vthh: string;
    ten_kho: string;
    trong_luong_kg_mot_sp: number;
    so_m2_mot_sp: number;
    so_m_dai_mot_sp: number;
    ton_dau: TonKhoMetric;
    nhap: TonKhoMetric;
    xuat: TonKhoMetric;
  };
  const map = new Map<string, Acc>();

  for (const row of movements) {
    const ma_sp = String(row.ma_sp || '').trim();
    const ten_sp = String(row.ten_sp || '').trim();
    if (!ma_sp && !ten_sp) continue;
    const ten_kho = String(row.ten_kho || '').trim() || 'Kho thành phẩm';
    if (tenKhoFilter && ten_kho !== tenKhoFilter) continue;
    const ngay = String(row.ngay_phieu || '').slice(0, 10);
    if (!ngay) continue;
    if (to && ngay > to) continue;

    const metric: TonKhoMetric = {
      sl: Math.max(0, parseThanhPhamNumber(row.so_luong)),
      kg: Math.max(0, parseThanhPhamNumber(row.trong_luong_kg)),
      m_dai: Math.max(0, parseThanhPhamNumber(row.so_m_dai)),
      m2: Math.max(0, parseThanhPhamNumber(row.so_m2))
    };
    const seed = matchNhapKhoSeed(seedsByProduct.get(thanhPhamMergeKey(ma_sp, ten_sp)) || [], row);
    const key = seed
      ? `${nhapKhoProductKey(seed.ma_sp, seed.ten_sp, seed.trong_luong_kg_mot_sp, seed.so_m2_mot_sp, seed.so_m_dai_mot_sp)}||${ten_kho}`
      : `${thanhPhamMergeKey(ma_sp, ten_sp)}||${ten_kho}`;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        ma_sp,
        ten_sp,
        don_vi: String(row.don_vi || '').trim(),
        nhom_vthh: String(row.nhom_vthh || '').trim(),
        ten_kho,
        trong_luong_kg_mot_sp: seed?.trong_luong_kg_mot_sp || 0,
        so_m2_mot_sp: seed?.so_m2_mot_sp || 0,
        so_m_dai_mot_sp: seed?.so_m_dai_mot_sp || 0,
        ton_dau: emptyTonKhoMetric(),
        nhap: emptyTonKhoMetric(),
        xuat: emptyTonKhoMetric()
      };
      map.set(key, acc);
    } else {
      if (!acc.don_vi && row.don_vi) acc.don_vi = String(row.don_vi).trim();
      if (!acc.nhom_vthh && row.nhom_vthh) acc.nhom_vthh = String(row.nhom_vthh).trim();
    }

    const isXuat = String(row.loai_phieu || '').trim().toLowerCase() === 'xuat';
    const beforeFrom = Boolean(from && ngay < from);
    if (beforeFrom) {
      acc.ton_dau = isXuat
        ? subTonKhoMetric(acc.ton_dau, metric)
        : addTonKhoMetric(acc.ton_dau, metric);
      continue;
    }
    if (from && ngay < from) continue;
    if (isXuat) acc.xuat = addTonKhoMetric(acc.xuat, metric);
    else acc.nhap = addTonKhoMetric(acc.nhap, metric);
  }

  return Array.from(map.values())
    .map(acc => ({
      ma_sp: acc.ma_sp,
      ten_sp: acc.ten_sp,
      don_vi: acc.don_vi,
      nhom_vthh: acc.nhom_vthh,
      loai_kho: 'san_pham',
      ten_kho: acc.ten_kho,
      trong_luong_kg_mot_sp: acc.trong_luong_kg_mot_sp,
      so_m2_mot_sp: acc.so_m2_mot_sp,
      so_m_dai_mot_sp: acc.so_m_dai_mot_sp,
      ton_dau: acc.ton_dau,
      nhap: acc.nhap,
      xuat: acc.xuat,
      ton_cuoi: subTonKhoMetric(addTonKhoMetric(acc.ton_dau, acc.nhap), acc.xuat)
    }))
    .sort((a, b) => `${a.ma_sp}${a.ten_sp}`.localeCompare(`${b.ma_sp}${b.ten_sp}`, 'vi'));
}

/** Dòng danh mục từ sổ nhap_kho (đã gộp theo mã + tên). Hệ số là của 1 SP. */
export type NhapKhoProductSeed = {
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  ten_kho: string;
  trong_luong_kg_mot_sp: number;
  so_m2_mot_sp: number;
  so_m_dai_mot_sp: number;
};

function positivePerUnit(value: unknown): number {
  const n = parseThanhPhamNumber(value);
  if (!(n > 0)) return 0;
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * Gắn một dòng phiếu vào đúng seed nhap_kho.
 * Một seed thì dùng luôn. Nhiều quy đổi thì chọn seed có SL × hệ số sát tổng dòng phiếu nhất.
 */
function matchNhapKhoSeed(
  seeds: NhapKhoProductSeed[],
  row: Pick<ThanhPhamMovementRow, 'so_luong' | 'trong_luong_kg' | 'so_m2' | 'so_m_dai'>
): NhapKhoProductSeed | null {
  if (seeds.length === 0) return null;
  if (seeds.length === 1) return seeds[0];
  const qty = Math.max(0, parseThanhPhamNumber(row.so_luong));
  const kg = Math.max(0, parseThanhPhamNumber(row.trong_luong_kg));
  const m2 = Math.max(0, parseThanhPhamNumber(row.so_m2));
  const mDai = Math.max(0, parseThanhPhamNumber(row.so_m_dai));
  let best = seeds[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const seed of seeds) {
    const dist =
      Math.abs(qty * seed.trong_luong_kg_mot_sp - kg) +
      Math.abs(qty * seed.so_m2_mot_sp - m2) +
      Math.abs(qty * seed.so_m_dai_mot_sp - mDai);
    if (dist < bestDist - 1e-9) {
      best = seed;
      bestDist = dist;
    }
  }
  return best;
}

function nhapKhoBalanceKey(row: {
  ma_sp: string;
  ten_sp: string;
  trong_luong_kg_mot_sp?: number;
  so_m2_mot_sp?: number;
  so_m_dai_mot_sp?: number;
}): string {
  const kg = positivePerUnit(row.trong_luong_kg_mot_sp);
  const m2 = positivePerUnit(row.so_m2_mot_sp);
  const mDai = positivePerUnit(row.so_m_dai_mot_sp);
  if (kg > 0 || m2 > 0 || mDai > 0) return nhapKhoProductKey(row.ma_sp, row.ten_sp, kg, m2, mDai);
  return thanhPhamMergeKey(row.ma_sp, row.ten_sp);
}

/**
 * Tổng hợp SP trong nhap_kho theo mã + tên + quy đổi 1 SP.
 * Cùng mã, cùng tên, khác kg/m²/m dài là hai dòng.
 */
export function aggregateNhapKhoProducts(
  rows: Array<{
    ma_sp?: string | null;
    ten_sp?: string | null;
    don_vi?: string | null;
    ten_kho?: string | null;
    trong_luong_kg_mot_sp?: number | null;
    so_m2_mot_sp?: number | null;
    so_m_dai_mot_sp?: number | null;
    created_at?: string | null;
  }>
): NhapKhoProductSeed[] {
  const ordered = [...rows].sort((a, b) => {
    const ta = String(a.created_at || '');
    const tb = String(b.created_at || '');
    if (ta && tb && ta !== tb) return ta < tb ? -1 : 1;
    return 0;
  });
  const map = new Map<string, NhapKhoProductSeed>();
  for (const row of ordered) {
    const ma_sp = String(row.ma_sp || '').trim();
    const ten_sp = String(row.ten_sp || '').trim();
    if (!ma_sp && !ten_sp) continue;
    const kg = positivePerUnit(row.trong_luong_kg_mot_sp);
    const m2 = positivePerUnit(row.so_m2_mot_sp);
    const mDai = positivePerUnit(row.so_m_dai_mot_sp);
    const key = nhapKhoProductKey(ma_sp, ten_sp, kg, m2, mDai);
    const existing = map.get(key);
    if (existing) {
      if (!existing.don_vi && row.don_vi) existing.don_vi = String(row.don_vi).trim();
      if (!existing.ten_kho && row.ten_kho) existing.ten_kho = String(row.ten_kho).trim();
      continue;
    }
    map.set(key, {
      ma_sp,
      ten_sp,
      don_vi: String(row.don_vi || '').trim(),
      ten_kho: String(row.ten_kho || '').trim() || 'Kho thành phẩm',
      trong_luong_kg_mot_sp: kg,
      so_m2_mot_sp: m2,
      so_m_dai_mot_sp: mDai
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    `${a.ma_sp}${a.ten_sp}`.localeCompare(`${b.ma_sp}${b.ten_sp}`, 'vi')
  );
}

/**
 * Danh sách SP = sổ nhap_kho; tồn đầu / nhập / xuất / tồn = từ phiếu NX (đã compute).
 * Khớp theo mã + tên + quy đổi 1 SP. Cùng mã tên nhưng khác hệ số không cộng chung tồn.
 * SP có trong nhap_kho nhưng chưa có phiếu → số liệu 0.
 */
export function mergeNhapKhoCatalogWithPeriodBalances(
  catalog: NhapKhoProductSeed[],
  balances: TonKhoThanhPhamPeriodRow[],
  options: { tenKho?: string | null } = {}
): TonKhoThanhPhamPeriodRow[] {
  const displayKho = String(options.tenKho || '').trim() || 'Kho thành phẩm';

  const balanceByKey = new Map<string, TonKhoThanhPhamPeriodRow>();
  for (const row of balances) {
    const key = nhapKhoBalanceKey(row);
    const existing = balanceByKey.get(key);
    if (!existing) {
      balanceByKey.set(key, {
        ...row,
        ton_dau: { ...row.ton_dau },
        nhap: { ...row.nhap },
        xuat: { ...row.xuat },
        ton_cuoi: { ...row.ton_cuoi },
        ten_kho: displayKho,
        loai_kho: 'thanh_pham'
      });
      continue;
    }
    existing.ton_dau = addTonKhoMetric(existing.ton_dau, row.ton_dau);
    existing.nhap = addTonKhoMetric(existing.nhap, row.nhap);
    existing.xuat = addTonKhoMetric(existing.xuat, row.xuat);
    existing.ton_cuoi = subTonKhoMetric(addTonKhoMetric(existing.ton_dau, existing.nhap), existing.xuat);
    if (!existing.don_vi && row.don_vi) existing.don_vi = row.don_vi;
    if (!existing.nhom_vthh && row.nhom_vthh) existing.nhom_vthh = row.nhom_vthh;
  }

  const result: TonKhoThanhPhamPeriodRow[] = [];
  for (const seed of catalog) {
    const key = nhapKhoBalanceKey(seed);
    const balance = balanceByKey.get(key);
    if (balance) {
      result.push({
        ...balance,
        ma_sp: seed.ma_sp || balance.ma_sp,
        ten_sp: seed.ten_sp || balance.ten_sp,
        don_vi: seed.don_vi || balance.don_vi,
        ten_kho: displayKho,
        loai_kho: 'thanh_pham',
        trong_luong_kg_mot_sp: seed.trong_luong_kg_mot_sp,
        so_m2_mot_sp: seed.so_m2_mot_sp,
        so_m_dai_mot_sp: seed.so_m_dai_mot_sp
      });
      continue;
    }
    const zero = emptyTonKhoMetric();
    result.push({
      ma_sp: seed.ma_sp,
      ten_sp: seed.ten_sp,
      don_vi: seed.don_vi,
      nhom_vthh: '',
      loai_kho: 'thanh_pham',
      ten_kho: displayKho,
      ton_dau: zero,
      nhap: { ...zero },
      xuat: { ...zero },
      ton_cuoi: { ...zero },
      trong_luong_kg_mot_sp: seed.trong_luong_kg_mot_sp,
      so_m2_mot_sp: seed.so_m2_mot_sp,
      so_m_dai_mot_sp: seed.so_m_dai_mot_sp
    });
  }

  return result.sort((a, b) => `${a.ma_sp}${a.ten_sp}`.localeCompare(`${b.ma_sp}${b.ten_sp}`, 'vi'));
}

/** Snapshot tồn hiện tại (toàn thời gian) — dùng nội bộ khi cần, không gắn bảng ton_kho_thanh_pham. */
export function computeThanhPhamCurrentStock(
  movements: ThanhPhamMovementRow[],
  tenKho?: string | null
): Array<{
  ma_sp: string;
  ten_sp: string;
  don_vi: string;
  nhom_vthh: string;
  ten_kho: string;
  ton_cuoi_sl: number;
  ton_cuoi_kg: number;
  ton_cuoi_m_dai: number;
  ton_cuoi_m2: number;
}> {
  return computeThanhPhamPeriodBalances(movements, { tenKho }).map(row => ({
    ma_sp: row.ma_sp,
    ten_sp: row.ten_sp,
    don_vi: row.don_vi,
    nhom_vthh: row.nhom_vthh,
    ten_kho: row.ten_kho,
    ton_cuoi_sl: row.ton_cuoi.sl,
    ton_cuoi_kg: row.ton_cuoi.kg,
    ton_cuoi_m_dai: row.ton_cuoi.m_dai,
    ton_cuoi_m2: row.ton_cuoi.m2
  }));
}
