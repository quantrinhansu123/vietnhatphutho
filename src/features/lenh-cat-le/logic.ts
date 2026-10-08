/**
 * Lệnh cắt lẻ — logic thuần (không fetch, không JSX).
 * Quy ước đã chốt với nghiệp vụ:
 *  - Tên hiển thị `... 8li ...` là `do_li` — GIỮ NGUYÊN khi cắt.
 *  - Nhát cắt đổi `do_dai_m` (m dài) và/hoặc khổ. Hạ độ li đổi token độ li và kg, khổ mét giữ nguyên.
 *    Được hạ một chiều, hạ cả khổ lẫn m dài, hoặc hạ độ li kèm mét.
 *  - Gốc tính trọng lượng là 3 hệ số 1 SP của dòng nguồn trong `nhap_kho`
 *    (kg1 / a1 / l1): kg2 = kg1 × (w2×l2)/(w1×l1), với w1 = a1/l1.
 *  - Phần thừa (mọi chiều dài, mọi máy) nhập lại Kho cắt lẻ, không nhập Kho tái chế.
 *  - Xuất nguồn từ kho chính suy từ nhóm VTHH (Đặc → Kho Đặc; Sóng/Rỗng → Kho Sóng).
 *  - SP cắt / phần thừa mang Mã AMIS mới (sinh từ mã gốc + mét cắt + màng),
 *    truy vết về mã gốc qua ma_amis_cu; duyệt lệnh tạo lại SP biến thể trong san_pham.
 */
import {
  buildCutAmisCodeFull,
  calculateDoLiDm,
  composeProductionDisplayName,
  isValidDoLiToken,
  normalizeDoLiDm
} from '../../utils/productProductionName';
import { parseLocalizedNumber } from '../../utils';

export const KHO_CAT_LE = 'Kho cắt lẻ';
export const KHO_THANH_PHAM = 'Kho thành phẩm';
export const KHO_TAI_CHE = 'Kho tái chế';
/** Kho chính theo nhóm VTHH (plan lệnh cắt lẻ kho). */
export const KHO_DAC = 'Kho Đặc';
export const KHO_SONG = 'Kho Sóng';

/**
 * Suy kho chính từ nhóm VTHH để xuất nguồn khi cắt:
 * Đặc → Kho Đặc; Sóng/Rỗng → Kho Sóng (rỗng chung kho sóng).
 * Trả '' khi không suy được (giữ kho đã chọn / Kho cắt lẻ).
 */
export function inferKhoChinhTuNhom(nhomVthh?: string | null): string {
  const key = String(nhomVthh || '').trim().toLocaleLowerCase('vi');
  if (key.includes('px đặc') || key.includes('px dac')) return KHO_DAC;
  if (
    key.includes('px sóng') ||
    key.includes('px song') ||
    key.includes('px rỗng') ||
    key.includes('px rong')
  ) {
    return KHO_SONG;
  }
  return '';
}

export interface CatLeSpecs {
  tenGoc: string;
  doLi: string;
  doLiDm: string;
  doDayM: string;
  doDaiM: string;
  mang: string;
  hangPhe: string;
  maAmis: string;
}

export interface CatLeMother extends CatLeSpecs {
  moTaTem?: string;
  maSp: string;
  tenSp: string;
  donVi: string;
  /** 3 hệ số 1 SP của dòng nguồn (từ nhap_kho). */
  kg1: number;
  a1: number;
  l1: number;
}

export interface CatLeInput {
  /** Khổ rộng mới (m). */
  w2: number;
  /** M dài mới (m). */
  l2: number;
  /** Số đơn vị nguồn đem cắt. */
  qty: number;
  /** Kg cân thực tế của 1 SP cắt (khi nguồn thiếu số để auto). */
  kgCanThucTe?: number | null;
  /** Độ li SP đích. Trống = giữ độ li nguồn. */
  doLiMoi?: string | null;
  /** Độ li ĐM người dùng nhập, dạng `(đm n li)`. Có thì giữ, không tính lại từ độ li mới. */
  doLiDmGiu?: string | null;
  /** Số tấm TP cắt ra trên mỗi tấm nguồn (mặc định 1). Vd 1 tấm nguồn 20m = 2 tấm TP 10m. */
  pieces?: number | null;
  /** Nguồn không ghi khổ, nhưng người dùng nhập hạ khổ — ghi khổ vào tên và mã. */
  labelCutWidth?: boolean | null;
}

export type CatLeKieu = 'xe_kho' | 'cat_tam' | 'doi_li' | 'ca_hai';

export interface CatLeResult {
  kieuCat: CatLeKieu;
  /** Số tấm TP trên mỗi tấm nguồn (>= 1). */
  pieces: number;
  /** Số tấm TP tối đa vừa khít theo kích thước (để UI gợi ý). */
  maxPieces: number;
  tenSpCon: string;
  kgCon: number;
  m2Con: number;
  mDaiCon: number;
  doLiCon: string;
  doDayMCon: string;
  doDaiMCon: string;
  doLiDmCon: string;
  tenSpThua: string;
  kgThua: number;
  m2Thua: number;
  mDaiThua: number;
  doLiThua: string;
  doDayMThua: string;
  doDaiMThua: string;
  diTaiChe: boolean;
  /** True = nguồn thiếu số, kg cắt lấy từ cân tay. */
  tuCanTay: boolean;
  /** True = giữ nguyên quy cách theo đơn (không hạ gì) — không sinh mã mới. */
  keptIdentical?: boolean;
}

/** Quy đổi + tên của một sản phẩm sau cắt. */
export interface CatLePiece {
  ten_sp: string;
  kg: number;
  m2: number;
  m_dai: number;
  do_li: string;
  do_li_dm: string;
  do_day_m: string;
  do_dai_m: string;
  /**
   * Mã hiện tại của piece: nguồn = mã gốc, cắt/thừa = mã MỚI của biến thể
   * (sinh từ mã gốc + mét cắt + màng, xem variantCodeForCatPiece).
   */
  ma_amis?: string;
  /** Mã gốc để truy vết biến thể (san_pham.ma_amis_cu / nhap_kho.ma_sp_cu). */
  ma_amis_cu?: string;
}

/** Sản phẩm nguồn trong JSON `san_pham`. */
export interface CatLeSanPhamNguon extends CatLePiece {
  id_san_pham_trong_kho: string;
  ma_sp: string;
  don_vi: string;
  so_luong: number;
  nhom_vthh: string;
  ten_goc: string;
  mang: string;
  hang_phe: string;
  ma_amis: string;
  mo_ta_tem?: string;
}

/**
 * Một dòng JSON `san_pham`.
 * Nguồn + cắt 1 (nhập thành phẩm) + cắt 2 (phần còn lại, null nếu hết).
 * `so_con_mot_me` (N): số tấm TP trên mỗi tấm nguồn. `so_luong_cat_1` = nguồn × N.
 * Bản ghi cũ thiếu 2 field → mặc định N = 1 (giữ tương thích).
 * Không nhân bản các trường này ra cột nguồn/cắt của bảng.
 */
export interface CatLeSanPhamLine {
  san_pham_nguon: CatLeSanPhamNguon;
  san_pham_cat_1: CatLePiece;
  san_pham_cat_2: CatLePiece | null;
  kieu_cat: CatLeKieu;
  di_tai_che: boolean;
  ghi_chu: string;
  so_con_mot_me: number;
  so_luong_cat_1: number;
  /** SL thành phẩm người nhập (có thể nhỏ hơn số tấm cắt ra từ cả tấm nguồn). */
  sl_can?: number;
  sl_bac?: string;
  sl_trung?: string;
  sl_nam?: string;
  dinh_muc_kg?: string;
  tong_kg?: string;
  tem?: string;
  mau_tem?: string;
  dan_tem_2_dau?: boolean;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function positiveNumber(value: unknown): number | null {
  const n = parseLocalizedNumber(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse ô nhập mét (`1.22m`, `1,22`, `30`) → số. Trả null khi không parse được. */
export function parseMeterInput(raw: unknown): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return positiveNumber(text.replace(/\s*m\s*$/iu, ''));
}

/** Parse segment mét trong tên/specs (`1.22m`) → số. */
export function parseMeterLabel(raw: unknown): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return positiveNumber(text.replace(/\s*m\s*$/iu, ''));
}

export function formatMeterLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const n = Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  return `${n}m`;
}

/** Thay lần xuất hiện cuối của `6m` / `6M` trong tên gốc bằng nhãn mét mới. */
function replaceLastLengthMeter(name: string, fromMeters: number, toLabel: string): string {
  const source = String(name || '');
  const label = String(toLabel || '').trim();
  if (!source || !label || !(fromMeters > 0)) return '';
  const num = formatPlainNumber(fromMeters).replace('.', '[,.]');
  if (!num) return '';
  const re = new RegExp(`(^|[^\\d])(${num})\\s*m\\b`, 'giu');
  const matches = [...source.matchAll(re)];
  if (matches.length === 0) return '';
  const last = matches[matches.length - 1];
  const at = (last.index ?? 0) + last[1].length;
  return source.slice(0, at) + label + source.slice(at + last[0].length - last[1].length);
}

function formatPlainNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

/** `0.8`, `0,8li`, `8li` → `0.8li`. Trả '' khi không phải độ li. */
export function normalizeDoLiLabel(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (!isValidDoLiToken(text) && !/^\d+[.,]?\d*$/.test(text)) return '';
  const n = positiveNumber(text.replace(/\s*l?i\s*$/iu, ''));
  if (!n) return '';
  return `${formatPlainNumber(n)}li`;
}

function parseLiNumber(raw: string): number | null {
  return positiveNumber(String(raw || '').replace(/\s*l?i\s*$/iu, ''));
}

function sameLi(a: string, b: string): boolean {
  const na = parseLiNumber(a);
  const nb = parseLiNumber(b);
  if (na === null || nb === null) return a.trim().toLowerCase() === b.trim().toLowerCase();
  return Math.abs(na - nb) < EPS;
}

const EPS = 1e-9;
function sameMeter(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

/** Dòng nhap_kho (snake_case) → CatLeMother. Trả null khi thiếu mã. */
export function motherFromNhapKhoRow(
  row: Record<string, unknown>,
  fallbackSpecs?: Partial<CatLeSpecs>
): CatLeMother | null {
  const maSp = String(row.ma_sp ?? '').trim();
  if (!maSp) return null;
  const get = (key: string, fb?: string) =>
    String(row[key] ?? (fb as string) ?? '').trim();
  return {
    maSp,
    tenSp: String(row.ten_sp ?? '').trim(),
    donVi: String(row.don_vi ?? '').trim(),
    kg1: Number(row.trong_luong_kg_mot_sp) || 0,
    a1: Number(row.so_m2_mot_sp) || 0,
    l1: Number(row.so_m_dai_mot_sp) || 0,
    tenGoc: get('ten_goc', fallbackSpecs?.tenGoc),
    doLi: get('do_li', fallbackSpecs?.doLi),
    doLiDm: get('do_li_dm', fallbackSpecs?.doLiDm),
    doDayM: get('do_day_m', fallbackSpecs?.doDayM),
    doDaiM: get('do_dai_m', fallbackSpecs?.doDaiM),
    mang: get('mang', fallbackSpecs?.mang),
    hangPhe: get('hang_phe', fallbackSpecs?.hangPhe),
    maAmis: String(row.ma_amis ?? fallbackSpecs?.maAmis ?? '').trim(),
    moTaTem: get('mo_ta_tem')
  };
}

/**
 * Tính 1 nhát cắt trên 1 đơn vị nguồn.
 * Ném Error với message tiếng Việt khi input không hợp lệ (UI bắt và hiển thị).
 */
export function computeCatLe(
  mother: CatLeMother,
  input: CatLeInput,
  options: { nhomVthh?: string; allowIdentical?: boolean } = {}
): CatLeResult {
  const qty = Number(input.qty);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Số lượng cắt phải lớn hơn 0.');
  const w2 = Number(input.w2);
  const l2 = Number(input.l2);
  if (!Number.isFinite(w2) || w2 <= 0) throw new Error('Khổ rộng mới (m) phải lớn hơn 0.');
  if (!Number.isFinite(l2) || l2 <= 0) throw new Error('M dài mới (m) phải lớn hơn 0.');

  let { kg1, a1, l1 } = mother;
  // Dựng lại a1/l1 từ specs khi kho thiếu hệ số (vd dòng cũ chưa backfill).
  if (!(a1 > 0) || !(l1 > 0)) {
    const wSpec = parseMeterLabel(mother.doDayM);
    const lSpec = parseMeterLabel(mother.doDaiM);
    if (wSpec && lSpec) {
      if (!(a1 > 0)) a1 = wSpec * lSpec;
      if (!(l1 > 0)) l1 = lSpec;
    }
  }
  if (!(a1 > 0) || !(l1 > 0)) {
    throw new Error('Dòng nguồn thiếu m2 / m dài 1 SP — nhập kg cân thực tế hoặc bổ sung quy đổi.');
  }
  const w1 = a1 / l1;
  if (!(w1 > 0)) throw new Error('Không suy được khổ rộng nguồn từ m2 / m dài.');

  const giuRong = sameMeter(w2, w1);
  const giuDai = sameMeter(l2, l1);
  const doLiCon = normalizeDoLiLabel(input.doLiMoi) || mother.doLi;
  const doiDoLi = Boolean(doLiCon) && !sameLi(doLiCon, mother.doLi);
  if (giuRong && giuDai && !doiDoLi) {
    if (!options.allowIdentical) {
      throw new Error('Khổ, m dài và độ li mới giống hệt cuộn nguồn — không có gì để cắt.');
    }
    // Dòng fill từ đơn hàng: cho qua nguyên khổ/dài/li (cắt giữ nguyên quy cách).
    return {
      kieuCat: 'cat_tam',
      pieces: 1,
      maxPieces: 1,
      tenSpCon: mother.tenSp,
      kgCon: round3(kg1),
      m2Con: round3(a1),
      mDaiCon: round3(l1),
      doLiCon: mother.doLi,
      doDayMCon: mother.doDayM,
      doDaiMCon: mother.doDaiM,
      doLiDmCon: mother.doLiDm,
      tenSpThua: '',
      kgThua: 0,
      m2Thua: 0,
      mDaiThua: 0,
      doLiThua: '',
      doDayMThua: '',
      doDaiMThua: '',
      diTaiChe: false,
      tuCanTay: false,
      keptIdentical: true
    };
  }
  const kieuCat: CatLeKieu = giuRong && giuDai ? 'doi_li' : !giuRong && !giuDai ? 'ca_hai' : giuDai ? 'xe_kho' : 'cat_tam';
  if (w2 > w1 + EPS) throw new Error('Khổ mới lớn hơn khổ nguồn — không cắt được.');
  if (l2 > l1 + EPS) throw new Error('M dài mới lớn hơn nguồn — không cắt được.');

  // Số tấm TP trên mỗi tấm nguồn (N). cat_tam: N*l2 <= l1, xe_kho: N*w2 <= w1.
  const maxPieces =
    kieuCat === 'cat_tam'
      ? Math.max(1, Math.floor(l1 / l2 + EPS))
      : kieuCat === 'xe_kho'
        ? Math.max(1, Math.floor(w1 / w2 + EPS))
        : 1;
  const rawPieces =
    input.pieces === null || input.pieces === undefined || (input.pieces as unknown) === '' ? 1 : Number(input.pieces);
  const pieces = Number.isFinite(rawPieces) ? Math.floor(rawPieces) : NaN;
  if (!Number.isFinite(pieces) || pieces < 1) throw new Error('Số TP/nguồn phải là số nguyên >= 1.');
  if (pieces > maxPieces) {
    if (kieuCat === 'cat_tam') throw new Error(`Nguồn dài ${round3(l1)}m chỉ cắt tối đa ${maxPieces} tấm ${round3(l2)}m.`);
    if (kieuCat === 'xe_kho') throw new Error(`Nguồn rộng ${round3(w1)}m chỉ xẻ tối đa ${maxPieces} tấm ${round3(w2)}m.`);
    throw new Error('Kiểu cắt này chỉ cho 1 TP/nguồn — muốn nhiều TP thì cắt 1 chiều (giữ khổ hoặc giữ dài).');
  }
  if ((kieuCat === 'doi_li' || kieuCat === 'ca_hai') && pieces > 1) {
    throw new Error('Đổi độ li / hạ cả 2 chiều hiện chỉ cho 1 TP/nguồn — muốn nhiều TP thì giữ nguyên khổ hoặc m dài.');
  }

  const kgCan = Number(input.kgCanThucTe);
  const coCanTay = Number.isFinite(kgCan) && kgCan > 0;
  let kg2: number;
  if (!(kg1 > 0) && !coCanTay) {
    throw new Error('Dòng nguồn thiếu kg 1 SP — nhập kg cân thực tế của SP cắt.');
  }
  if (coCanTay) {
    if (kg1 > 0 && kgCan >= kg1 + EPS) {
      throw new Error('Kg cân của TP phải nhỏ hơn kg nguồn.');
    }
    if (kg1 > 0 && kgCan * pieces > kg1 + EPS) {
      throw new Error(`Tổng kg ${pieces} TP (${round3(kgCan * pieces)}kg) vượt kg nguồn (${round3(kg1)}kg).`);
    }
    kg2 = kgCan;
  } else {
    kg2 = (kg1 * (w2 * l2)) / (w1 * l1);
    if (doiDoLi) {
      const li1 = parseLiNumber(mother.doLi);
      const li2 = parseLiNumber(doLiCon);
      if (li1 && li2) kg2 = kg2 * (li2 / li1);
    }
  }
  const a2 = w2 * l2;
  const tongConArea = a2 * pieces;
  if (tongConArea > a1 + EPS) throw new Error(`Tổng diện tích ${pieces} TP vượt diện tích nguồn.`);
  const aThua = Math.max(0, a1 - tongConArea);
  // Phần còn lại giữ độ li nguồn nên kg theo diện tích thừa. Kg cân tay thì lấy phần nguồn trừ tổng cân.
  const kgThua = coCanTay ? Math.max(0, kg1 - kg2 * pieces) : (kg1 * Math.max(0, a1 - tongConArea)) / a1;

  // Khổ còn lại = khổ nguồn − N*khổ cắt (xẻ khổ) / dài còn lại = dài nguồn − N*dài cắt (cắt tấm).
  // Hạ cả hai chiều vẫn giữ m dài nguồn (không gộp thành khổ tương đương).
  const wThua = kieuCat === 'cat_tam' ? w1 : kieuCat === 'xe_kho' ? Math.max(0, w1 - w2 * pieces) : w1 - w2;
  const lThua = kieuCat === 'cat_tam' ? Math.max(0, l1 - l2 * pieces) : l1;
  const nhomVthh = String(options.nhomVthh ?? '').trim();
  const keptDm = String(input.doLiDmGiu || '').trim();
  const doLiDmCon = keptDm || (doiDoLi ? calculateDoLiDm(doLiCon, nhomVthh) || mother.doLiDm : mother.doLiDm);
  // Hạ độ li đổi token độ li và kg. Khổ (m) giữ nguyên nếu nguồn có khổ.
  const widthLabeled = Boolean(String(mother.doDayM || '').trim()) || Boolean(input.labelCutWidth);
  const doDayMCon = widthLabeled ? formatMeterLabel(w2) : '';
  const doDaiMCon = formatMeterLabel(l2);
  const baseSpecs: CatLeSpecs = {
    tenGoc: mother.tenGoc,
    doLi: mother.doLi,
    doLiDm: mother.doLiDm,
    doDayM: mother.doDayM,
    doDaiM: mother.doDaiM,
    mang: mother.mang,
    hangPhe: mother.hangPhe,
    maAmis: mother.maAmis
  };
  const withMoTaTem = (name: string) => {
    const base = String(name || '').trim();
    const suffix = String(mother.moTaTem || '').trim();
    if (!base || !suffix || base.endsWith(suffix)) return base;
    return `${base} ${suffix}`;
  };
  const composedCon = composeProductionDisplayName(
    { ...baseSpecs, doLi: doLiCon, doLiDm: doLiDmCon, doDayM: doDayMCon, doDaiM: doDaiMCon },
    nhomVthh
  );
  // Sóng không có khổ mét: thay đúng token dài trong tên gốc (6M → 2m), không chèn khổ 1m giả.
  const replacedCon = !widthLabeled && !doiDoLi ? replaceLastLengthMeter(mother.tenSp, l1, doDaiMCon) : '';
  const tenSpCon = withMoTaTem(replacedCon || composedCon);
  const mDaiThua = kieuCat === 'xe_kho' || kieuCat === 'ca_hai' ? l1 : round3(Math.max(0, l1 - l2 * pieces));
  // Thừa quá vụn (cả 2 chiều ~0, hoặc chỉ đổi độ li) thì không sinh tên thừa.
  // Vừa khít (20m = 2x10m) thì aThua ~0 → không sinh thừa.
  const conThua = wThua > EPS && lThua > EPS && aThua > EPS;
  const doDayMThua = conThua && widthLabeled ? formatMeterLabel(wThua) : '';
  const doDaiMThua = conThua ? formatMeterLabel(mDaiThua) : '';
  const replacedThua = conThua && !widthLabeled ? replaceLastLengthMeter(mother.tenSp, l1, doDaiMThua) : '';
  const tenSpThua = conThua
    ? withMoTaTem(replacedThua || composeProductionDisplayName(
        { ...baseSpecs, doDayM: doDayMThua, doDaiM: doDaiMThua },
        nhomVthh
      ))
    : '';
  const diTaiChe = false;

  return {
    kieuCat,
    pieces,
    maxPieces,
    tenSpCon,
    kgCon: round3(kg2),
    m2Con: round3(a2),
    mDaiCon: round3(l2),
    doLiCon,
    doDayMCon,
    doDaiMCon,
    doLiDmCon,
    tenSpThua,
    kgThua: conThua ? round3(kieuCat === 'ca_hai' && !coCanTay ? (kg1 * wThua * lThua) / a1 : kgThua) : 0,
    m2Thua: conThua ? round3(kieuCat === 'ca_hai' ? wThua * lThua : aThua) : 0,
    mDaiThua: conThua ? round3(mDaiThua) : 0,
    doLiThua: conThua ? mother.doLi : '',
    doDayMThua,
    doDaiMThua,
    diTaiChe,
    tuCanTay: coCanTay
  };
}

/** Số TP/nguồn từ nhiều nguồn field (tương thích bản cũ). */
export function parsePiecesValue(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 1;
  const n = Math.floor(parseLocalizedNumber(raw));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** SL cắt 1 (nhập TP) của 1 dòng = SL nguồn × N. Bản cũ thiếu field → = SL nguồn. */
export function catLeConQty(line: Pick<CatLeSanPhamLine, 'san_pham_nguon' | 'so_con_mot_me' | 'so_luong_cat_1'>): number {
  const qtyMe = Number(line.san_pham_nguon.so_luong) || 0;
  const saved = Number((line as { so_luong_cat_1?: unknown }).so_luong_cat_1);
  if (Number.isFinite(saved) && saved > 0) return saved;
  const pieces = parsePiecesValue((line as { so_con_mot_me?: unknown }).so_con_mot_me);
  return Math.round(qtyMe * pieces * 1000) / 1000;
}

/** Ghép 1 dòng JSON `san_pham` từ nguồn + thông số cắt (độ li, m dài, khổ rộng, số TP/nguồn). */
/**
 * Mã AMIS cũ chốt cho miếng cắt: ưu tiên mã cũ đã lưu trong danh mục
 * (chuỗi cắt nhiều nhát quy về mã gốc, không trôi về mã trung gian);
 * chưa có thì lấy mã nguồn.
 */
export function resolveOriginMaCu(
  storedMaCu: string | null | undefined,
  sourceCode: string | null | undefined
): string {
  const stored = String(storedMaCu || '').trim();
  if (stored) return stored;
  return String(sourceCode || '').trim();
}

export function buildCatLeSanPhamLine(args: {
  idSanPhamTrongKho?: string | null;
  mother: CatLeMother;
  nhomVthh?: string;
  qty: number;
  w2: number;
  l2: number;
  doLiMoi?: string | null;
  kgCanThucTe?: number | null;
  pieces?: number | null;
  ghiChu?: string | null;
  tem?: string | null;
  mauTem?: string | null;
  danTem2Dau?: boolean | null;
  doLiDm?: string | null;
  /** Mã cũ đã chốt (quy về gốc) — không có thì lấy mã nguồn. */
  originMaCu?: string | null;
  /** Dòng fill từ đơn hàng: cho qua khi quy cách giữ nguyên (không bắt hạ). */
  allowIdentical?: boolean | null;
  /** Tên sản xuất đang hiện trên dòng (tên ghép đơn). Mã cắt rút viết tắt từ tên này. */
  tenSanXuat?: string | null;
}): CatLeSanPhamLine {
  const { mother } = args;
  const sourceWidth = parseMeterLabel(mother.doDayM);
  const inferredWidth = mother.a1 > 0 && mother.l1 > 0 ? mother.a1 / mother.l1 : null;
  const labelCutWidth =
    sourceWidth == null &&
    inferredWidth != null &&
    Math.abs(args.w2 - inferredWidth) > 1e-9;
  const computed = computeCatLe(
    mother,
    {
      w2: args.w2,
      l2: args.l2,
      qty: args.qty,
      kgCanThucTe: args.kgCanThucTe,
      doLiMoi: args.doLiMoi,
      doLiDmGiu: normalizeDoLiDm(args.doLiDm || '', 'li') || null,
      pieces: args.pieces ?? 1,
      labelCutWidth
    },
    { nhomVthh: args.nhomVthh, allowIdentical: Boolean(args.allowIdentical) }
  );
  const cat2: CatLePiece | null = computed.tenSpThua
    ? {
        ten_sp: computed.tenSpThua,
        kg: computed.kgThua,
        m2: computed.m2Thua,
        m_dai: computed.mDaiThua,
        do_li: computed.doLiThua,
        do_li_dm: mother.doLiDm,
        do_day_m: computed.doDayMThua,
        do_dai_m: computed.doDaiMThua
      }
    : null;
  // Mã AMIS mới cho SP cắt / phần thừa (giữ mã gốc truy vết).
  const baseAmis = String(mother.maAmis || mother.maSp || '').trim();
  const originCu = resolveOriginMaCu(args.originMaCu, baseAmis);
  const groupName = String(args.nhomVthh || '').trim();
  // Hạ độ li thật thì token li mới thắng — ĐM thừa kế của nguồn (vd (đm 4li))
  // không được đè lên li mới (vd 3li). Chỉ ĐM gõ tay mới luôn được giữ.
  const liChangedCon =
    Boolean(String(computed.doLiCon || '').trim()) &&
    normalizeDoLiLabel(computed.doLiCon).toLocaleLowerCase('vi') !==
      normalizeDoLiLabel(mother.doLi).toLocaleLowerCase('vi');
  const moiCon = variantCodeForCatPiece({
    baseMaAmis: baseAmis,
    nhomVthh: groupName,
    motherDaiM: mother.doDaiM,
    pieceDaiM: computed.doDaiMCon,
    motherWidthM: sourceWidth,
    pieceWidthM: parseMeterLabel(computed.doDayMCon),
    motherLi: mother.doLi,
    pieceLi: computed.doLiCon,
    mang: mother.mang,
    hangPhe: mother.hangPhe,
    doLiDm: args.doLiDm || (!liChangedCon ? mother.doLiDm : undefined),
    tem: args.tem,
    mauTem: args.mauTem,
    danTem2Dau: args.danTem2Dau,
    tenSanXuat: String(args.tenSanXuat || '').trim() || computed.tenSpCon
  });
  const moiThua =
    cat2 != null
      ? variantCodeForCatPiece({
          baseMaAmis: baseAmis,
          nhomVthh: groupName,
          motherDaiM: mother.doDaiM,
          pieceDaiM: computed.doDaiMThua,
          motherWidthM: sourceWidth,
          pieceWidthM: parseMeterLabel(computed.doDayMThua),
          motherLi: mother.doLi,
          pieceLi: computed.doLiThua,
          mang: mother.mang,
          hangPhe: mother.hangPhe,
          doLiDm: mother.doLiDm,
          tenSanXuat: computed.tenSpThua
        })
      : '';
  return {
    san_pham_nguon: {
      id_san_pham_trong_kho: String(args.idSanPhamTrongKho || '').trim(),
      ma_sp: mother.maSp,
      ten_sp: mother.tenSp,
      don_vi: mother.donVi,
      so_luong: args.qty,
      nhom_vthh: String(args.nhomVthh || '').trim(),
      ten_goc: mother.tenGoc,
      do_li: mother.doLi,
      do_li_dm: mother.doLiDm,
      do_day_m: mother.doDayM,
      do_dai_m: mother.doDaiM,
      mang: mother.mang,
      hang_phe: mother.hangPhe,
      ma_amis: mother.maAmis,
      mo_ta_tem: mother.moTaTem || '',
      kg: mother.kg1,
      m2: mother.a1,
      m_dai: mother.l1
    },
    san_pham_cat_1: {
      ten_sp: computed.tenSpCon,
      kg: computed.kgCon,
      m2: computed.m2Con,
      m_dai: computed.mDaiCon,
      do_li: computed.doLiCon,
      do_li_dm: computed.doLiDmCon,
      do_day_m: computed.doDayMCon,
      do_dai_m: computed.doDaiMCon,
      ...(moiCon ? { ma_amis: moiCon, ma_amis_cu: originCu } : {})
    },
    san_pham_cat_2:
      cat2 != null
        ? {
            ...cat2,
            ...(moiThua ? { ma_amis: moiThua, ma_amis_cu: originCu } : {})
          }
        : null,
    kieu_cat: computed.kieuCat,
    di_tai_che: computed.diTaiChe,
    ghi_chu: String(args.ghiChu || '').trim(),
    so_con_mot_me: computed.pieces,
    so_luong_cat_1: Math.round(Number(args.qty) * computed.pieces * 1000) / 1000
  };
}

function catLeText(value: unknown): string {
  return String(value ?? '').trim();
}

function catLeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function catLePiece(source: Record<string, unknown>): CatLePiece {
  return {
    ten_sp: catLeText(source.ten_sp),
    kg: catLeNum(source.kg),
    m2: catLeNum(source.m2),
    m_dai: catLeNum(source.m_dai),
    do_li: catLeText(source.do_li),
    do_li_dm: catLeText(source.do_li_dm),
    do_day_m: catLeText(source.do_day_m),
    do_dai_m: catLeText(source.do_dai_m),
    ...(catLeText(source.ma_amis) ? { ma_amis: catLeText(source.ma_amis) } : {}),
    ...(catLeText(source.ma_amis_cu) ? { ma_amis_cu: catLeText(source.ma_amis_cu) } : {})
  };
}

/**
 * Mã AMIS mới cho 1 SP cắt sau cắt (giữ mã gốc để truy vết).
 * Trả '' khi không có mã gốc hoặc mã mới trùng mã gốc (không biến thể).
 */
export function variantCodeForCatPiece(args: {
  baseMaAmis: string;
  nhomVthh?: string | null;
  motherDaiM?: string | null;
  pieceDaiM?: string | null;
  motherWidthM?: number | null;
  pieceWidthM?: number | null;
  motherLi?: string | null;
  pieceLi?: string | null;
  mang?: string | null;
  hangPhe?: string | null;
  doLiDm?: string | null;
  tem?: string | null;
  mauTem?: string | null;
  /** `2DAU` trên mã = dán tem 2 đầu. */
  danTem2Dau?: boolean | null;
  /** Tên sản xuất của tấm cắt — rút màu / ZEM / số sóng / kg vào mã. */
  tenSanXuat?: string | null;
}): string {
  const base = String(args.baseMaAmis || '').trim();
  if (!base) return '';
  const lCon = parseMeterLabel(args.pieceDaiM);
  const lMe = parseMeterLabel(args.motherDaiM);
  const cutDiffers = lCon != null && (lMe == null || Math.abs(lCon - lMe) > 1e-9);
  const wCon = args.pieceWidthM != null && Number.isFinite(args.pieceWidthM) ? args.pieceWidthM : null;
  const wMe = args.motherWidthM != null && Number.isFinite(args.motherWidthM) ? args.motherWidthM : null;
  const widthDiffers = wCon != null && wCon > 0 && (wMe == null || Math.abs(wCon - wMe) > 1e-9);
  const liMe = String(args.motherLi || '').trim().toLocaleLowerCase('vi');
  const liCon = String(args.pieceLi || '').trim().toLocaleLowerCase('vi');
  const liDiffers = Boolean(liCon) && liCon !== liMe;
  // Mã đủ info (mẫu TC/length-cuối/tem). Pass 1 phát hiện thay đổi (chưa ép khổ
  // để quy cách giữ nguyên không sinh mã giả); pass 2 bổ sung khổ khi có đổi.
  const widthArg = wCon != null && wCon > 0 ? { ensureWidthM: wCon } : {};
  const shared = {
    baseMaAmis: base,
    nhomVthh: args.nhomVthh,
    cutLengthM: lCon != null && lCon > 0 ? lCon : undefined,
    cutWidthM: widthDiffers ? wCon : undefined,
    doLi: liDiffers ? String(args.pieceLi || '') : undefined,
    mang: args.mang || undefined,
    hangPhe: args.hangPhe,
    doLiDm: args.doLiDm,
    tem: args.tem,
    mauTem: args.mauTem,
    danTem2Dau: args.danTem2Dau,
    ...widthArg
  };
  const plain = buildCutAmisCodeFull(shared);
  const named = buildCutAmisCodeFull({ ...shared, tenSanXuat: args.tenSanXuat });
  const specsChanged = cutDiffers || widthDiffers || liDiffers || Boolean(String(args.tem || '').trim() || String(args.mauTem || '').trim() || args.danTem2Dau);
  // Giữ nguyên khổ/dài/li: chỉ hiện mã mới khi tên sản xuất bổ sung viết tắt chưa có trong mã gốc.
  if (!specsChanged) {
    if (!String(args.tenSanXuat || '').trim() || !named || named === plain) return '';
    if (named.toLocaleLowerCase('vi') === base.toLocaleLowerCase('vi')) return '';
    return named;
  }
  const normalizedBase = buildCutAmisCodeFull({ baseMaAmis: base, tenSanXuat: args.tenSanXuat });
  if (!named || named === normalizedBase) return '';
  return named;
}

function catLeFormFields(row: Record<string, unknown>): Pick<
  CatLeSanPhamLine,
  'sl_can' | 'sl_bac' | 'sl_trung' | 'sl_nam' | 'dinh_muc_kg' | 'tong_kg' | 'tem' | 'mau_tem' | 'dan_tem_2_dau'
> {
  const slCan = Number(row.sl_can ?? row.slCan);
  const slBac = catLeText(row.sl_bac ?? row.slBac);
  const slTrung = catLeText(row.sl_trung ?? row.slTrung);
  const slNam = catLeText(row.sl_nam ?? row.slNam);
  const dinhMuc = catLeText(row.dinh_muc_kg ?? row.dinhMucKg);
  const tongKg = catLeText(row.tong_kg ?? row.tongKg);
  const tem = catLeText(row.tem);
  const mauTem = catLeText(row.mau_tem ?? row.mauTem);
  const danRaw = row.dan_tem_2_dau ?? row.danTem2Dau;
  const dan = danRaw === true || danRaw === 1 || danRaw === '1' || danRaw === 'true';
  return {
    ...(Number.isFinite(slCan) && slCan > 0 ? { sl_can: slCan } : {}),
    ...(slBac ? { sl_bac: slBac } : {}),
    ...(slTrung ? { sl_trung: slTrung } : {}),
    ...(slNam ? { sl_nam: slNam } : {}),
    ...(dinhMuc ? { dinh_muc_kg: dinhMuc } : {}),
    ...(tongKg ? { tong_kg: tongKg } : {}),
    ...(tem ? { tem } : {}),
    ...(mauTem ? { mau_tem: mauTem } : {}),
    ...(dan ? { dan_tem_2_dau: true } : {})
  };
}

/** Đọc 1 dòng JSON, kể cả bản phẳng cũ (ten_sp_dich / ten_sp_con_lai). */
export function normalizeCatLeSanPhamLine(raw: unknown): CatLeSanPhamLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.san_pham_nguon && typeof row.san_pham_nguon === 'object') {
    const nguon = row.san_pham_nguon as Record<string, unknown>;
    const cat1 = (
      row.san_pham_cat_1 && typeof row.san_pham_cat_1 === 'object' ? row.san_pham_cat_1 : {}
    ) as Record<string, unknown>;
    const cat2raw = row.san_pham_cat_2;
    const cat2 = cat2raw && typeof cat2raw === 'object' ? catLePiece(cat2raw as Record<string, unknown>) : null;
    const piece = catLePiece(nguon);
    const qtyMe = catLeNum(nguon.so_luong);
    const pieces = parsePiecesValue(
      row.so_con_mot_me ?? row.so_con_tren_mot_me ?? row.pieces ?? (row as Record<string, unknown>).soConMotMe
    );
    const savedConQty = Number(row.so_luong_cat_1 ?? (row as Record<string, unknown>).soLuongCat1);
    return {
      san_pham_nguon: {
        ...piece,
        id_san_pham_trong_kho: catLeText(nguon.id_san_pham_trong_kho),
        ma_sp: catLeText(nguon.ma_sp),
        don_vi: catLeText(nguon.don_vi),
        so_luong: qtyMe,
        nhom_vthh: catLeText(nguon.nhom_vthh),
        ten_goc: catLeText(nguon.ten_goc),
        mang: catLeText(nguon.mang),
        hang_phe: catLeText(nguon.hang_phe),
        ma_amis: catLeText(nguon.ma_amis),
        mo_ta_tem: catLeText(nguon.mo_ta_tem)
      },
      san_pham_cat_1: catLePiece(cat1),
      san_pham_cat_2: cat2 && cat2.ten_sp ? cat2 : null,
      kieu_cat: (catLeText(row.kieu_cat) || 'cat_tam') as CatLeKieu,
      di_tai_che: Boolean(row.di_tai_che),
      ghi_chu: catLeText(row.ghi_chu),
      so_con_mot_me: pieces,
      so_luong_cat_1:
        Number.isFinite(savedConQty) && savedConQty > 0
          ? savedConQty
          : Math.round(qtyMe * pieces * 1000) / 1000,
      ...catLeFormFields(row)
    };
  }
  const maSp = catLeText(row.ma_sp_nguon);
  const tenSp = catLeText(row.ten_sp_nguon);
  if (!maSp && !tenSp) return null;
  const cat2name = catLeText(row.ten_sp_con_lai);
  const qtyFlat = catLeNum(row.so_luong);
  const piecesFlat = parsePiecesValue(row.so_con_mot_me ?? row.pieces);
  const savedFlatCon = Number(row.so_luong_cat_1);
  return {
    san_pham_nguon: {
      id_san_pham_trong_kho: catLeText(row.id_san_pham_trong_kho),
      ma_sp: maSp,
      ten_sp: tenSp,
      don_vi: catLeText(row.don_vi),
      so_luong: qtyFlat,
      nhom_vthh: catLeText(row.nhom_vthh),
      ten_goc: catLeText(row.ten_goc),
      do_li: catLeText(row.do_li),
      do_li_dm: catLeText(row.do_li_dm),
      do_day_m: catLeText(row.do_day_m),
      do_dai_m: catLeText(row.do_dai_m),
      mang: catLeText(row.mang),
      hang_phe: catLeText(row.hang_phe),
      ma_amis: catLeText(row.ma_amis),
      mo_ta_tem: catLeText(row.mo_ta_tem),
      kg: catLeNum(row.kg_nguon),
      m2: catLeNum(row.m2_nguon),
      m_dai: catLeNum(row.m_dai_nguon)
    },
    san_pham_cat_1: {
      ten_sp: catLeText(row.ten_sp_dich),
      kg: catLeNum(row.kg_dich),
      m2: catLeNum(row.m2_dich),
      m_dai: catLeNum(row.m_dai_dich),
      do_li: catLeText(row.do_li_dich),
      do_li_dm: catLeText(row.do_li_dm_dich),
      do_day_m: catLeText(row.do_day_m_dich),
      do_dai_m: catLeText(row.do_dai_m_dich)
    },
    san_pham_cat_2: cat2name
      ? {
          ten_sp: cat2name,
          kg: catLeNum(row.kg_con_lai),
          m2: catLeNum(row.m2_con_lai),
          m_dai: catLeNum(row.m_dai_con_lai),
          do_li: catLeText(row.do_li_con_lai),
          do_li_dm: catLeText(row.do_li_dm),
          do_day_m: catLeText(row.do_day_m_con_lai),
          do_dai_m: catLeText(row.do_dai_m_con_lai)
        }
      : null,
    kieu_cat: (catLeText(row.kieu_cat) || 'cat_tam') as CatLeKieu,
    di_tai_che: Boolean(row.di_tai_che),
    ghi_chu: catLeText(row.ghi_chu),
    so_con_mot_me: piecesFlat,
    so_luong_cat_1:
      Number.isFinite(savedFlatCon) && savedFlatCon > 0
        ? savedFlatCon
        : Math.round(qtyFlat * piecesFlat * 1000) / 1000,
    ...catLeFormFields(row)
  };
}

export function normalizeCatLeSanPhamList(raw: unknown): CatLeSanPhamLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCatLeSanPhamLine).filter((line): line is CatLeSanPhamLine => Boolean(line));
}

/** Hậu tố tem đơn miền nam cuối tên nguồn, vd "(Dán Tem 2.5li) Màu Hồng MVCC Dán Tem 2 Đầu" (màu/tick lẻ không kèm tem vẫn nhận). */
export function extractTemSuffix(tenSp: unknown): string {
  const text = String(tenSp ?? '');
  const m = text.match(
    /\s*(\(Dán Tem\s*[^)]*\)(?:\s*Màu\s*\S+(?:\s*M\w+)?)?(?:\s*Dán Tem 2 Đầu)?|Màu\s*\S+\s+M\w+(?:\s*Dán Tem 2 Đầu)?|Dán Tem 2 Đầu)\s*$/iu
  );
  return m ? m[1].trim() : '';
}

/**
 * Tên SP cắt để hiển thị: tên đã lưu + mo_ta_tem của nguồn.
 * Ưu tiên field mo_ta_tem; bản ghi cũ chưa có field thì tách hậu tố từ tên nguồn.
 * Không nối lặp khi tên đã có hậu tố.
 */
export function catDisplayName(tenCat: unknown, moTaTem: unknown, tenNguon?: unknown): string {
  const base = String(tenCat ?? '').trim();
  if (!base) return '';
  const suffix = String(moTaTem ?? '').trim() || extractTemSuffix(tenNguon);
  if (!suffix || base.endsWith(suffix)) return base;
  return `${base} ${suffix}`;
}

export interface CatLePrintLine {
  code: string;
  name: string;
  unit: string;
  quantity: number;
  weightKg: number;
}

export interface CatLePrintSlip {
  slipCode: string;
  slipType: 'nhap' | 'xuat';
  slipDate: string;
  reason: string;
  note: string;
  warehouseName: string;
  createdBy: string;
  lines: CatLePrintLine[];
}

function slipLineFromProduct(
  code: string,
  name: string,
  unit: string,
  qty: number,
  kgPerUnit: number
): CatLePrintLine {
  return {
    code,
    name,
    unit: unit || 'Tấm',
    quantity: qty,
    weightKg: round3(kgPerUnit * qty)
  };
}

/** Bộ phiếu in của 1 lệnh.
 * Một phiếu xuất kho nguồn: SL nguồn đem cắt.
 * Nhập lại kho nguồn: SP cắt (SL = nguồn × N) + mọi phần còn lại (SL = SL nguồn).
 * Phiếu Kho tái chế chỉ còn khi lệnh cũ đã ghi `ma_phieu_nhap_tai_che`.
 * `preview`: vẫn dựng phiếu khi chưa có số phiếu (bản xem trước, chưa ghi kho).
 */
export function buildCatLePrintSlips(lenh: {
  ma_lenh?: string | null;
  ngay_cat?: string | null;
  kho_nguon?: string | null;
  kho_dich?: string | null;
  kho_tai_che?: string | null;
  nguoi_lap?: string | null;
  san_pham?: CatLeSanPhamLine[] | null;
  ma_phieu_xuat?: string | null;
  ma_phieu_nhap_tp?: string | null;
  ma_phieu_nhap_thua?: string | null;
  ma_phieu_chuyen_tai_che?: string | null;
  ma_phieu_xuat_tai_che?: string | null;
  ma_phieu_nhap_tai_che?: string | null;
}, options?: { preview?: boolean }): CatLePrintSlip[] {
  const preview = Boolean(options?.preview);
  const slipCode = (real: string | null | undefined): string => {
    const code = String(real || '').trim();
    if (code) return code;
    return preview ? 'Chưa sinh' : '';
  };
  const lines = normalizeCatLeSanPhamList(lenh.san_pham);
  const ngay = String(lenh.ngay_cat || '').slice(0, 10);
  const nguoi = String(lenh.nguoi_lap || '').trim();
  const khoNguon = String(lenh.kho_nguon || KHO_CAT_LE);
  // SP cắt nhập lại chính kho nguồn (không qua Kho thành phẩm).
  const khoDich = String(lenh.kho_dich || khoNguon);
  const khoTaiChe = String(lenh.kho_tai_che || KHO_TAI_CHE);
  const maLenh = String(lenh.ma_lenh || '').trim();
  const slips: CatLePrintSlip[] = [];
  const xuatLines = lines.map(line =>
    slipLineFromProduct(
      line.san_pham_nguon.ma_sp,
      line.san_pham_nguon.ten_sp,
      line.san_pham_nguon.don_vi,
      line.san_pham_nguon.so_luong,
      line.san_pham_nguon.kg
    )
  );
  const nhapTpLines = lines.map(line =>
    slipLineFromProduct(
      line.san_pham_nguon.ma_sp,
      line.san_pham_cat_1.ten_sp,
      line.san_pham_nguon.don_vi,
      catLeConQty(line),
      line.san_pham_cat_1.kg
    )
  );
  const conLai = lines.filter(line => line.san_pham_cat_2 && !line.di_tai_che);
  const taiChe = lines.filter(line => line.san_pham_cat_2 && line.di_tai_che);
  const maXuat = slipCode(lenh.ma_phieu_xuat);
  if (maXuat && xuatLines.length > 0) {
    slips.push({
      slipCode: maXuat,
      slipType: 'xuat',
      slipDate: ngay,
      reason: `Cắt lẻ ${maLenh}`,
      note: `Xuất ${khoNguon} — sản phẩm chuẩn bị cắt`,
      warehouseName: khoNguon,
      createdBy: nguoi,
      lines: xuatLines
    });
  }
  const maNhapTp = slipCode(lenh.ma_phieu_nhap_tp);
  if (maNhapTp && nhapTpLines.length > 0) {
    slips.push({
      slipCode: maNhapTp,
      slipType: 'nhap',
      slipDate: ngay,
      reason: `Cắt lẻ ${maLenh}`,
      note: `Nhập ${khoDich} — sản phẩm được cắt`,
      warehouseName: khoDich,
      createdBy: nguoi,
      lines: nhapTpLines
    });
  }
  const maNhapThua = slipCode(lenh.ma_phieu_nhap_thua);
  if (maNhapThua && conLai.length > 0) {
    slips.push({
      slipCode: maNhapThua,
      slipType: 'nhap',
      slipDate: ngay,
      reason: `Cắt lẻ ${maLenh}`,
      note: `Nhập ${khoNguon} — sản phẩm còn lại`,
      warehouseName: khoNguon,
      createdBy: nguoi,
      lines: conLai.map(line =>
        slipLineFromProduct(
          line.san_pham_nguon.ma_sp,
          line.san_pham_cat_2?.ten_sp || '',
          line.san_pham_nguon.don_vi,
          line.san_pham_nguon.so_luong,
          line.san_pham_cat_2?.kg || 0
        )
      )
    });
  }
  if (taiChe.length > 0 && (preview || lenh.ma_phieu_nhap_tai_che)) {
    const ckLines = taiChe.map(line =>
      slipLineFromProduct(
        line.san_pham_nguon.ma_sp,
        line.san_pham_cat_2?.ten_sp || '',
        line.san_pham_nguon.don_vi,
        line.san_pham_nguon.so_luong,
        line.san_pham_cat_2?.kg || 0
      )
    );
    const maNhapCk = slipCode(lenh.ma_phieu_nhap_tai_che);
    if (maNhapCk) {
      slips.push({
        slipCode: maNhapCk,
        slipType: 'nhap',
        slipDate: ngay,
        reason: `Cắt lẻ ${maLenh}`,
        note: `Nhập ${khoTaiChe} — phần còn lại (phiếu cũ)`,
        warehouseName: khoTaiChe,
        createdBy: nguoi,
        lines: ckLines
      });
    }
  }
  return slips;
}

/**
 * Tự tính phương án xuất tối thiểu cho SL TP cần.
 * Trả về N dùng, số nguồn cần, số TP thực ra, số dư và câu diễn giải tiếng Việt.
 * Ném Error khi kích thước không cắt được (TP to hơn nguồn).
 */
export function suggestCatLePlan(
  mother: CatLeMother,
  args: { w2: number; l2: number; desiredConQty: number; pieces?: number | null; doLiMoi?: string | null; allowIdentical?: boolean | null }
): {
  kieuCat: CatLeKieu;
  pieces: number;
  maxPieces: number;
  mothers: number;
  actualCons: number;
  surplus: number;
  hint: string;
} {
  const desired = Number(args.desiredConQty);
  if (!Number.isFinite(desired) || desired <= 0) throw new Error('SL TP cần phải lớn hơn 0.');
  const w2 = Number(args.w2);
  const l2 = Number(args.l2);
  if (!Number.isFinite(w2) || w2 <= 0 || !Number.isFinite(l2) || l2 <= 0) {
    throw new Error('Thiếu khổ rộng / m dài đích.');
  }
  const doLiMoi = args.doLiMoi ?? null;
  const allowIdentical = Boolean(args.allowIdentical);
  // Tận dụng computeCatLe để validate kích thước + lấy Nmax/kiểu cắt (qty dummy = 1).
  const probe = computeCatLe(mother, { w2, l2, qty: 1, pieces: 1, doLiMoi }, { allowIdentical });
  const maxPieces = probe.maxPieces;
  const rawN = args.pieces === null || args.pieces === undefined || (args.pieces as unknown) === '' ? maxPieces : Math.floor(Number(args.pieces));
  if (!Number.isFinite(rawN) || rawN < 1) throw new Error('Số TP/nguồn phải >= 1.');
  if (rawN > maxPieces) {
    if (probe.kieuCat === 'cat_tam') throw new Error(`Nguồn dài chỉ cắt tối đa ${maxPieces} tấm/nguồn.`);
    if (probe.kieuCat === 'xe_kho') throw new Error(`Nguồn rộng chỉ xẻ tối đa ${maxPieces} tấm/nguồn.`);
    throw new Error('Kiểu cắt này chỉ cho 1 TP/nguồn.');
  }
  // Validate lại với N thực (bắt lỗi tổng diện tích/kg) + lấy thừa thực tế theo N.
  const finalCheck = computeCatLe(mother, { w2, l2, qty: 1, pieces: rawN, doLiMoi }, { allowIdentical });
  const mothers = Math.ceil(desired / rawN);
  const actualCons = mothers * rawN;
  const surplus = actualCons - Math.ceil(desired);
  const noThua = finalCheck.tenSpThua ? '' : ' — vừa khít, không thừa';
  return {
    kieuCat: probe.kieuCat,
    pieces: rawN,
    maxPieces,
    mothers,
    actualCons,
    surplus,
    hint: `Xuất ${mothers} nguồn → ${actualCons} TP (cần ${Math.ceil(desired)}, dư ${surplus}, ${rawN} TP/nguồn${noThua})`
  };
}

/** Mã lệnh cắt tiếp theo: CL-YYYYMMDD-XXXX (XXXX random, server chốt unique). */
export function suggestMaLenhCatLe(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `CL-${date}-${rand}`;
}
