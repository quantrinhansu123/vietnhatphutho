/**
 * Lệnh cắt lẻ — logic thuần (không fetch, không JSX).
 * Quy ước đã chốt với nghiệp vụ:
 *  - Tên hiển thị `... 8li ...` là `do_li` — GIỮ NGUYÊN khi cắt.
 *  - Nhát cắt đổi `do_dai_m` (m dài) và/hoặc khổ. Đổi độ li thì `do_day_m` của SP cắt = số li mới (m).
 *    Được hạ một chiều hoặc cả khổ lẫn m dài. Độ li đổi riêng.
 *  - Gốc tính trọng lượng là 3 hệ số 1 SP của dòng mẹ trong `nhap_kho`
 *    (kg1 / a1 / l1): kg2 = kg1 × (w2×l2)/(w1×l1), với w1 = a1/l1.
 *  - Phần thừa (mọi chiều dài, mọi máy) nhập lại Kho cắt lẻ, không nhập Kho tái chế.
 */
import {
  calculateDoLiDm,
  composeProductionDisplayName,
  isValidDoLiToken
} from '../../utils/productProductionName';

export const KHO_CAT_LE = 'Kho cắt lẻ';
export const KHO_THANH_PHAM = 'Kho thành phẩm';
export const KHO_TAI_CHE = 'Kho tái chế';

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
  /** 3 hệ số 1 SP của dòng mẹ (từ nhap_kho). */
  kg1: number;
  a1: number;
  l1: number;
}

export interface CatLeInput {
  /** Khổ rộng mới (m). */
  w2: number;
  /** M dài mới (m). */
  l2: number;
  /** Số đơn vị mẹ đem cắt. */
  qty: number;
  /** Kg cân thực tế của 1 SP con (khi mẹ thiếu số để auto). */
  kgCanThucTe?: number | null;
  /** Độ li SP đích. Trống = giữ độ li mẹ. */
  doLiMoi?: string | null;
}

export type CatLeKieu = 'xe_kho' | 'cat_tam' | 'doi_li' | 'ca_hai';

export interface CatLeResult {
  kieuCat: CatLeKieu;
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
  /** True = mẹ thiếu số, kg con lấy từ cân tay. */
  tuCanTay: boolean;
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
 * Không nhân bản các trường này ra cột mẹ/con của bảng.
 */
export interface CatLeSanPhamLine {
  san_pham_nguon: CatLeSanPhamNguon;
  san_pham_cat_1: CatLePiece;
  san_pham_cat_2: CatLePiece | null;
  kieu_cat: CatLeKieu;
  di_tai_che: boolean;
  ghi_chu: string;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function positiveNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').trim().replace(',', '.'));
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
 * Tính 1 nhát cắt trên 1 đơn vị mẹ.
 * Ném Error với message tiếng Việt khi input không hợp lệ (UI bắt và hiển thị).
 */
export function computeCatLe(
  mother: CatLeMother,
  input: CatLeInput,
  options: { nhomVthh?: string } = {}
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
    throw new Error('Dòng mẹ thiếu m2 / m dài 1 SP — nhập kg cân thực tế hoặc bổ sung quy đổi.');
  }
  const w1 = a1 / l1;
  if (!(w1 > 0)) throw new Error('Không suy được khổ rộng mẹ từ m2 / m dài.');

  const giuRong = sameMeter(w2, w1);
  const giuDai = sameMeter(l2, l1);
  const doLiCon = normalizeDoLiLabel(input.doLiMoi) || mother.doLi;
  const doiDoLi = Boolean(doLiCon) && !sameLi(doLiCon, mother.doLi);
  if (giuRong && giuDai && !doiDoLi) {
    throw new Error('Khổ, m dài và độ li mới giống hệt cuộn mẹ — không có gì để cắt.');
  }
  const kieuCat: CatLeKieu = giuRong && giuDai ? 'doi_li' : !giuRong && !giuDai ? 'ca_hai' : giuDai ? 'xe_kho' : 'cat_tam';
  if (w2 > w1 + EPS) throw new Error('Khổ mới lớn hơn khổ mẹ — không cắt được.');
  if (l2 > l1 + EPS) throw new Error('M dài mới lớn hơn mẹ — không cắt được.');

  const kgCan = Number(input.kgCanThucTe);
  const coCanTay = Number.isFinite(kgCan) && kgCan > 0;
  let kg2: number;
  if (!(kg1 > 0) && !coCanTay) {
    throw new Error('Dòng mẹ thiếu kg 1 SP — nhập kg cân thực tế của SP con.');
  }
  if (coCanTay) {
    if (kg1 > 0 && kgCan >= kg1 + EPS) {
      throw new Error('Kg cân của con phải nhỏ hơn kg mẹ.');
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
  const aThua = Math.max(0, a1 - a2);
  // Phần còn lại giữ độ li mẹ nên kg theo diện tích thừa. Kg cân tay thì lấy phần mẹ trừ cân.
  const kgThua = coCanTay ? Math.max(0, kg1 - kg2) : (kg1 * Math.max(0, a1 - a2)) / a1;

  // Khổ còn lại = khổ mẹ − khổ cắt. Hạ cả hai chiều vẫn giữ m dài mẹ (không gộp thành khổ tương đương).
  const wThua = kieuCat === 'cat_tam' ? w1 : w1 - w2;
  const lThua = kieuCat === 'cat_tam' ? l1 - l2 : l1;
  const nhomVthh = String(options.nhomVthh ?? '').trim();
  const doLiDmCon = doiDoLi ? calculateDoLiDm(doLiCon, nhomVthh) || mother.doLiDm : mother.doLiDm;
  // Đổi độ li (độ dày): do_day_m của SP cắt = số li mới, dạng mét (1 → 1m).
  // Không đổi độ li: do_day_m theo khổ (xẻ khổ hoặc giữ khổ mẹ).
  const liDay = doiDoLi ? parseLiNumber(doLiCon) : null;
  const doDayMCon = liDay ? formatMeterLabel(liDay) : formatMeterLabel(w2);
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
  const tenSpCon = withMoTaTem(composeProductionDisplayName(
    { ...baseSpecs, doLi: doLiCon, doLiDm: doLiDmCon, doDayM: doDayMCon, doDaiM: doDaiMCon },
    nhomVthh
  ));
  const mDaiThua = kieuCat === 'xe_kho' || kieuCat === 'ca_hai' ? l1 : round3(l1 - l2);
  // Thừa quá vụn (cả 2 chiều ~0, hoặc chỉ đổi độ li) thì không sinh tên thừa.
  const conThua = wThua > EPS && lThua > EPS;
  const doDayMThua = conThua ? formatMeterLabel(wThua) : '';
  const doDaiMThua = conThua ? formatMeterLabel(mDaiThua) : '';
  const tenSpThua = conThua
    ? withMoTaTem(composeProductionDisplayName(
        { ...baseSpecs, doDayM: doDayMThua, doDaiM: doDaiMThua },
        nhomVthh
      ))
    : '';
  const diTaiChe = false;

  return {
    kieuCat,
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

/** Ghép 1 dòng JSON `san_pham` từ mẹ + thông số cắt (độ li, m dài, khổ rộng). */
export function buildCatLeSanPhamLine(args: {
  idSanPhamTrongKho?: string | null;
  mother: CatLeMother;
  nhomVthh?: string;
  qty: number;
  w2: number;
  l2: number;
  doLiMoi?: string | null;
  kgCanThucTe?: number | null;
  ghiChu?: string | null;
}): CatLeSanPhamLine {
  const { mother } = args;
  const computed = computeCatLe(
    mother,
    {
      w2: args.w2,
      l2: args.l2,
      qty: args.qty,
      kgCanThucTe: args.kgCanThucTe,
      doLiMoi: args.doLiMoi
    },
    { nhomVthh: args.nhomVthh }
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
      do_dai_m: computed.doDaiMCon
    },
    san_pham_cat_2: cat2,
    kieu_cat: computed.kieuCat,
    di_tai_che: computed.diTaiChe,
    ghi_chu: String(args.ghiChu || '').trim()
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
    do_dai_m: catLeText(source.do_dai_m)
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
    return {
      san_pham_nguon: {
        ...piece,
        id_san_pham_trong_kho: catLeText(nguon.id_san_pham_trong_kho),
        ma_sp: catLeText(nguon.ma_sp),
        don_vi: catLeText(nguon.don_vi),
        so_luong: catLeNum(nguon.so_luong),
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
      ghi_chu: catLeText(row.ghi_chu)
    };
  }
  const maSp = catLeText(row.ma_sp_nguon);
  const tenSp = catLeText(row.ten_sp_nguon);
  if (!maSp && !tenSp) return null;
  const cat2name = catLeText(row.ten_sp_con_lai);
  return {
    san_pham_nguon: {
      id_san_pham_trong_kho: catLeText(row.id_san_pham_trong_kho),
      ma_sp: maSp,
      ten_sp: tenSp,
      don_vi: catLeText(row.don_vi),
      so_luong: catLeNum(row.so_luong),
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
    ghi_chu: catLeText(row.ghi_chu)
  };
}

export function normalizeCatLeSanPhamList(raw: unknown): CatLeSanPhamLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCatLeSanPhamLine).filter((line): line is CatLeSanPhamLine => Boolean(line));
}

/** Hậu tố tem đơn miền nam cuối tên nguồn, vd "(Dán Tem 2.5li) Màu Hồng MVCC Dán Tem 2 Đầu". */
export function extractTemSuffix(tenSp: unknown): string {
  const text = String(tenSp ?? '');
  const m = text.match(
    /\s*(\(Dán Tem\s*[^)]*\)(?:\s*Màu\s*\S+(?:\s*M\w+)?)?(?:\s*Dán Tem 2 Đầu)?)\s*$/iu
  );
  return m ? m[1].trim() : '';
}

/**
 * Tên SP cắt để hiển thị: tên đã lưu + mo_ta_tem của mẹ.
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
 * Một phiếu xuất Kho cắt lẻ: chỉ sản phẩm nguồn đang có tồn, chuẩn bị cắt.
 * Nhập thành phẩm, nhập mọi phần còn lại về Kho cắt lẻ.
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
  const khoDich = String(lenh.kho_dich || KHO_THANH_PHAM);
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
      line.san_pham_nguon.so_luong,
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

/** Mã lệnh cắt tiếp theo: CL-YYYYMMDD-XXXX (XXXX random, server chốt unique). */
export function suggestMaLenhCatLe(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `CL-${date}-${rand}`;
}
