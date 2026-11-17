/**
 * Quy tắc gom nhóm SP trên phiếu trộn định mức.
 * Nguồn: `.ai/Rule_hien_thi_san_pham_phieu_tron.xlsx`
 * Sản phẩm không khớp rule → category `KHÁC`.
 */
import {
  classifyProductPxGroup,
  extractDinhMucKg,
  extractMang,
  extractZemToken,
  normalizeDoLiToken,
  parseDoDaiMLength,
  parseProductionNameParts,
  type ProductPxGroup
} from './productProductionName';

export type MixingNormCategoryGroup = 'song' | 'dac' | 'rong' | 'other';

export type MixingNormCategoryDef = {
  id: string;
  group: MixingNormCategoryGroup;
  label: string;
  /** Mô tả điều kiện (hiển thị phụ). */
  hint: string;
};

export type MixingNormProductSignals = {
  px: ProductPxGroup;
  doLi: number | null;
  zem: number | null;
  kg: number | null;
  doDaiM: number | null;
  mang: string;
  np: boolean;
  off: boolean;
  tcmb: boolean;
  tcmn: boolean;
  giaRe: boolean;
  mau: string;
  text: string;
};

const approx = (value: number | null, target: number, tol = 0.08) =>
  value != null && Math.abs(value - target) <= tol;

const inRange = (value: number | null, min: number, max: number) =>
  value != null && value + 1e-9 >= min && value - 1e-9 <= max;

const hasAnyMang = (mang: string, allowed: string[]) => {
  const m = mang.toUpperCase().replace(/\s+/g, '');
  if (!m) return true;
  return allowed.some(item => m === item.toUpperCase().replace(/\s+/g, ''));
};

function parseLiNumber(raw: string): number | null {
  const normalized = normalizeDoLiToken(raw);
  if (normalized) {
    const n = Number(normalized.replace(/li$/iu, '').replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Bắt buộc có hậu tố li/i — tránh nuốt số của `5,55ZEM`.
  const match = String(raw || '').match(/([\d.,]+)\s*(?:li|(?<![a-z])i)\b/iu);
  if (!match) return null;
  const n = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseZemNumber(raw: string): number | null {
  // Ưu tiên regex thập phân riêng — extractZemToken chỉ lấy phần nguyên (`5.55ZEM` → 55).
  const match = String(raw || '').match(/([\d.,]+)\s*zem\b/iu);
  if (!match) {
    const token = extractZemToken(raw);
    if (!token) return null;
    const n = Number(token.replace(/zem$/iu, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseKgNumber(raw: string): number | null {
  const labeled = extractDinhMucKg(raw);
  const fromLabel = labeled.match(/([\d.,]+)/);
  if (fromLabel) {
    const n = Number(String(fromLabel[1]).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const match = String(raw || '').match(/([\d.,]+)\s*kg\b/iu);
  if (!match) return null;
  const n = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Mét dài thường gặp trên Rỗng/Đặc (5.8m / 6m…); lấy token `Nm` cuối trong chuỗi. */
function parseLengthFromText(raw: string): number | null {
  const direct = parseDoDaiMLength(String(raw || '').trim());
  if (direct != null) return direct;
  const matches = [...String(raw || '').matchAll(/([\d.,]+)\s*m\b/giu)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const n = Number(String(last[1]).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Mét dài Rỗng: 5,8m hoặc 6m (rule Excel tách MN/MB nhưng SP thực tế hay dùng cả hai). */
const isRongCommonLength = (value: number | null) =>
  value == null || approx(value, 5.8, 0.15) || approx(value, 6, 0.15);

/** Nhóm VTHH chuẩn là `TP; PX Đặc/Sóng/Rỗng`; fallback đọc từ tên nếu thiếu. */
function resolveMixingNormPx(nhomVthh: string, text: string): ProductPxGroup {
  const fromGroup = classifyProductPxGroup(nhomVthh);
  if (fromGroup !== 'other') return fromGroup;
  const fromText = classifyProductPxGroup(text);
  if (fromText !== 'other') return fromText;
  const blob = `${nhomVthh} ${text}`.toLocaleLowerCase('vi');
  if (/px\s*đặc|px\s*dac|tấm\s*nhựa\s*đặc|nhựa\s*đặc|(?:^|[^\p{L}\p{N}])đặc(?:$|[^\p{L}\p{N}])/iu.test(blob)) {
    return 'dac';
  }
  if (/px\s*sóng|px\s*song|nhựa\s*sóng|(?:^|[^\p{L}\p{N}])sóng(?:$|[^\p{L}\p{N}])/iu.test(blob)) {
    return 'song';
  }
  if (/px\s*rỗng|px\s*rong|tấm\s*nhựa\s*rỗng|nhựa\s*rỗng|(?:^|[^\p{L}\p{N}])rỗng(?:$|[^\p{L}\p{N}])/iu.test(blob)) {
    return 'rong';
  }
  return 'other';
}

/** Trích tín hiệu phân loại từ mã / tên SX / nhóm VTHH. */
export function buildMixingNormProductSignals(input: {
  nhomVthh?: string;
  maAmis?: string;
  tenSanXuat?: string;
  tenGhep?: string;
  tenSp?: string;
  mang?: string;
  hangPhe?: string;
  doLi?: string;
  zem?: string;
  dinhMucKg?: string;
  doDaiM?: string;
  mau?: string;
  tcmb?: boolean | string;
  tcmn?: string;
  giaRe?: string;
  np?: string;
  off?: string;
}): MixingNormProductSignals {
  const text = [
    input.tenGhep,
    input.tenSanXuat,
    input.tenSp,
    input.maAmis,
    input.hangPhe,
    input.mang,
    input.doLi,
    input.zem,
    input.dinhMucKg,
    input.doDaiM,
    input.mau
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' | ');
  const px = resolveMixingNormPx(input.nhomVthh || '', text);
  const parsed = parseProductionNameParts(input.tenSanXuat || input.tenGhep || '', input.nhomVthh || '', input.maAmis || '');
  const mang = String(input.mang || parsed.mang || extractMang(text) || '')
    .trim()
    .toUpperCase();
  const hangPhe = String(input.hangPhe || parsed.hangPhe || '').trim();
  const np =
    /^NP$/iu.test(String(input.np || '')) ||
    parsed.np === 'NP' ||
    /(?:^|[\s-])NP(?:2)?(?:$|[\s-])/iu.test(text) ||
    /nguyên\s*phế|100%\s*phế/iu.test(hangPhe);
  const off =
    /^OFF$/iu.test(String(input.off || '')) ||
    parsed.off === 'OFF' ||
    /(?:^|[\s-])OFF(?:$|[\s-])/iu.test(text) ||
    /NS\s*Off/iu.test(hangPhe);
  const tcmb =
    Boolean(input.tcmb) === true ||
    /^tcmb$/iu.test(String(input.tcmb || '')) ||
    parsed.tcmb === 'TCMB' ||
    /\bTCMB\b/iu.test(text);
  const tcmn =
    /tcmn/iu.test(String(input.tcmn || '')) ||
    parsed.tcmn === 'TCMN' ||
    /\bTCMN\b/iu.test(text);
  const giaRe =
    /giá\s*rẻ/iu.test(String(input.giaRe || '')) ||
    parsed.giaRe === 'Giá rẻ' ||
    /giá\s*rẻ|\(GIÁ\s*RẺ\)/iu.test(text);
  const mau = String(input.mau || parsed.mau || '').trim();
  const doLi =
    parseLiNumber(input.doLi || '') ||
    parseLiNumber(parsed.doLi || '') ||
    parseLiNumber(text);
  const zem =
    parseZemNumber(input.zem || '') ||
    parseZemNumber(parsed.zem || '') ||
    parseZemNumber(text);
  const kg =
    parseKgNumber(input.dinhMucKg || '') ||
    parseKgNumber(parsed.dinhMucKg || '') ||
    parseKgNumber(text);
  const doDaiM =
    parseLengthFromText(String(input.doDaiM || '')) ??
    parseLengthFromText(String(parsed.doDaiM || '')) ??
    parseLengthFromText(text);

  return { px, doLi, zem, kg, doDaiM, mang, np, off, tcmb, tcmn, giaRe, mau, text };
}

type Rule = MixingNormCategoryDef & {
  match: (s: MixingNormProductSignals) => boolean;
};

const RULES: Rule[] = [
  // —— SÓNG ——
  {
    id: 'song-mong',
    group: 'song',
    label: 'SÓNG MỎNG',
    hint: '5,55ZEM→7ZEM (4,8→6KG)',
    match: s =>
      s.px === 'song' &&
      !s.giaRe &&
      (inRange(s.zem, 5.55, 7) || inRange(s.kg, 4.8, 6) || (s.zem != null && s.zem < 7.3 && s.doLi == null))
  },
  {
    id: 'song-day-zem',
    group: 'song',
    label: 'SÓNG DÀY',
    hint: '7,3ZEM→1,2li (6,3→9,5KG)',
    match: s =>
      s.px === 'song' &&
      !s.giaRe &&
      (inRange(s.zem, 7.3, 20) || inRange(s.kg, 6.3, 9.5) || (s.doLi != null && s.doLi <= 1.2 && (s.zem != null || s.kg != null)))
  },
  {
    id: 'song-day-li',
    group: 'song',
    label: 'SÓNG DÀY (1.5–2li)',
    hint: '1,5li & 2li (12KG & 15,5KG)',
    match: s =>
      s.px === 'song' &&
      !s.giaRe &&
      (approx(s.doLi, 1.5, 0.15) || approx(s.doLi, 2, 0.15) || approx(s.kg, 12, 0.4) || approx(s.kg, 15.5, 0.5))
  },
  {
    id: 'song-mong-gia-re-mb',
    group: 'song',
    label: 'SÓNG MỎNG GIÁ RẺ (MB)',
    hint: '5,55ZEM→0,67ZEM · TCMB / MB',
    match: s =>
      s.px === 'song' &&
      s.giaRe &&
      (s.tcmb || !s.tcmn) &&
      (inRange(s.zem, 0.67, 7) || inRange(s.kg, 4.8, 5.8) || s.zem != null)
  },
  {
    id: 'song-day-gia-re-mn',
    group: 'song',
    label: 'SÓNG DÀY GIÁ RẺ (MN - MT)',
    hint: '7,3ZEM→1,2li · TCMN / MN-MT',
    match: s =>
      s.px === 'song' &&
      s.giaRe &&
      (s.tcmn || !s.tcmb) &&
      (inRange(s.zem, 7.3, 20) || inRange(s.kg, 6.3, 9.5) || (s.doLi != null && s.doLi <= 1.2))
  },
  {
    id: 'song-mong-gia-re-mn',
    group: 'song',
    label: 'SÓNG MỎNG GIÁ RẺ (MN - MT)',
    hint: '5,55ZEM→0,67ZEM · rẻ hơn MB',
    match: s =>
      s.px === 'song' &&
      s.giaRe &&
      (inRange(s.zem, 0.67, 7) || inRange(s.kg, 4.8, 5.8))
  },

  // —— ĐẶC ——
  {
    id: 'dac-mong-np',
    group: 'dac',
    label: 'ĐẶC MỎNG (NP)',
    hint: '8ZEM→3li · NP · ECO/SUN PC/STD',
    match: s =>
      s.px === 'dac' &&
      s.np &&
      !s.off &&
      hasAnyMang(s.mang, ['ECO', 'SUN PC', 'SUNPC', 'STD']) &&
      (inRange(s.zem, 8, 20) || inRange(s.doLi, 0.5, 3))
  },
  {
    id: 'dac-mong-tcmb-3li',
    group: 'dac',
    label: 'ĐẶC MỎNG (TCMB 3li)',
    hint: '3li · TCMB · ECO/STD',
    match: s =>
      s.px === 'dac' &&
      s.tcmb &&
      !s.np &&
      approx(s.doLi, 3, 0.2) &&
      hasAnyMang(s.mang, ['ECO', 'STD'])
  },
  {
    id: 'dac-day-4-6-tcmb',
    group: 'dac',
    label: 'ĐẶC DÀY (4–6li TCMB)',
    hint: '4li→6li · TCMB · ECO/STD',
    match: s =>
      s.px === 'dac' &&
      s.tcmb &&
      inRange(s.doLi, 4, 6) &&
      hasAnyMang(s.mang, ['ECO', 'STD'])
  },
  {
    id: 'dac-day-4-5-np-std',
    group: 'dac',
    label: 'ĐẶC DÀY (4–5li NP STD)',
    hint: '4li & 5li · NP · STD',
    match: s =>
      s.px === 'dac' &&
      s.np &&
      (approx(s.doLi, 4, 0.2) || approx(s.doLi, 5, 0.2)) &&
      hasAnyMang(s.mang, ['STD'])
  },
  {
    id: 'dac-day-8-10-tcmb',
    group: 'dac',
    label: 'ĐẶC DÀY (8–10li TCMB)',
    hint: '8li & 10li · TCMB · ECO/STD',
    match: s =>
      s.px === 'dac' &&
      s.tcmb &&
      (approx(s.doLi, 8, 0.3) || approx(s.doLi, 10, 0.3)) &&
      hasAnyMang(s.mang, ['ECO', 'STD'])
  },
  {
    id: 'dac-mong-trang-off',
    group: 'dac',
    label: 'ĐẶC MỎNG (TRẮNG MN - OFF)',
    hint: '1,2li→3li · OFF · STD',
    match: s =>
      s.px === 'dac' &&
      s.off &&
      inRange(s.doLi, 1.2, 3) &&
      hasAnyMang(s.mang, ['STD']) &&
      (/trắng|trang/iu.test(s.mau) || /trắng|trang/iu.test(s.text))
  },

  // —— RỖNG ——
  {
    id: 'rong-mong-4-42-np-ha',
    group: 'rong',
    label: 'RỖNG MỎNG (4–4.2li NP HA)',
    hint: '4li & 4,2li · 5,8m/6m · NP · HA',
    match: s =>
      s.px === 'rong' &&
      s.np &&
      hasAnyMang(s.mang, ['HA']) &&
      (approx(s.doLi, 4, 0.15) || approx(s.doLi, 4.2, 0.15)) &&
      isRongCommonLength(s.doDaiM)
  },
  {
    id: 'rong-mong-45-6-tcmb-eco',
    group: 'rong',
    label: 'RỖNG MỎNG (4.5–6li TCMB ECO)',
    hint: '4,5li, 5li, 6li · 5,8m/6m · TCMB · ECO',
    match: s =>
      s.px === 'rong' &&
      s.tcmb &&
      hasAnyMang(s.mang, ['ECO']) &&
      inRange(s.doLi, 4.5, 6) &&
      isRongCommonLength(s.doDaiM)
  },
  {
    id: 'rong-mong-mn-58-np-std',
    group: 'rong',
    label: 'RỖNG MỎNG (MN 5.8m NP STD)',
    hint: '4li→6li - 5,8m · NP · STD',
    match: s =>
      s.px === 'rong' &&
      s.np &&
      hasAnyMang(s.mang, ['STD']) &&
      inRange(s.doLi, 4, 6) &&
      approx(s.doDaiM, 5.8, 0.15)
  },
  {
    id: 'rong-mong-mn-tcmn-std',
    group: 'rong',
    label: 'RỖNG MỎNG (MN TCMN STD)',
    hint: '4li→6li · TCMN · STD',
    match: s =>
      s.px === 'rong' &&
      s.tcmn &&
      hasAnyMang(s.mang, ['STD']) &&
      inRange(s.doLi, 4, 6)
  },
  {
    id: 'rong-day-8-10',
    group: 'rong',
    label: 'RỖNG DÀY (8–10li)',
    hint: '8li & 10li · 5,8m/6m · ECO/STD/LUX',
    match: s =>
      s.px === 'rong' &&
      (approx(s.doLi, 8, 0.3) || approx(s.doLi, 10, 0.3)) &&
      hasAnyMang(s.mang, ['ECO', 'STD', 'LUX']) &&
      isRongCommonLength(s.doDaiM)
  }
];

export const MIXING_NORM_OTHER_CATEGORY: MixingNormCategoryDef = {
  id: 'khac',
  group: 'other',
  label: 'KHÁC',
  hint: 'Không thỏa điều kiện các nhóm trên'
};

export const MIXING_NORM_CATEGORIES: MixingNormCategoryDef[] = [
  ...RULES.map(({ id, group, label, hint }) => ({ id, group, label, hint })),
  MIXING_NORM_OTHER_CATEGORY
];

export function classifyMixingNormCategory(signals: MixingNormProductSignals): string {
  for (const rule of RULES) {
    if (rule.match(signals)) return rule.id;
  }
  return MIXING_NORM_OTHER_CATEGORY.id;
}

export function mixingNormCategoryById(id: string): MixingNormCategoryDef {
  return MIXING_NORM_CATEGORIES.find(item => item.id === id) || MIXING_NORM_OTHER_CATEGORY;
}

export function mixingNormCategoryGroupLabel(group: MixingNormCategoryGroup): string {
  if (group === 'song') return 'SÓNG';
  if (group === 'dac') return 'ĐẶC';
  if (group === 'rong') return 'RỖNG';
  return 'KHÁC';
}
