/** Suy luận thông số + ghép tên sản xuất theo nhóm VTHH (Đặc / Sóng / Rỗng). */

export type ProductPxGroup = 'dac' | 'song' | 'rong' | 'other';

export const FILM_OPTIONS = ['ECO', 'STD', 'SUN PC', 'HA'] as const;

export const WASTE_GRADE_OPTIONS = [
  'hàng 100% NS Off',
  'hàng chạy 100% phế'
] as const;

export interface AmisSpecs {
  doLi: string;
  doDayM: string;
  zem: string;
}

export interface ProductionNameParts {
  tenGoc: string;
  doLi: string;
  doDayM: string;
  doDaiM: string;
  mang: string;
  hangPhe: string;
  doLiDm: string;
}

const DO_LI_DM_RE = /\(\s*đm\s*([\d.,]+)\s*li\s*\)/iu;
const AMIS_LI_RE = /-\s*([\d.,]+)\s*li\b/iu;
const AMIS_DAY_RE = /\*\s*([\d.,]+)\s*m\b/iu;
const AMIS_ZEM_RE = /(\d+)\s*zem\b/iu;
const NAME_ZEM_RE = /(\d+)\s*zem\b/iu;
const NAME_MANG_RE = /(?:màng\s+)?(ECO|STD|SUN\s*PC|HA|LUX|STANDA)\b/iu;
const NAME_HANG_PHE_RE =
  /(hàng\s+100%\s+NS\s+Off|hàng\s+chạy\s+100%\s+phế|hàng\s+100%\s+phế|chạy\s+100%\s+phế)/iu;
/** Mét sau dấu `-` (standalone), cho phép text theo sau như `30m hàng…`. */
const DASH_METER_RE = /-\s*([\d.,]+)\s*m(?=\b)/giu;
/** Mọi token mét trong chuỗi (Sóng: lấy cái cuối). */
const ANY_METER_RE = /([\d.,]+)\s*m\b/giu;
/** Rỗng/Đặc: `Nli x Am x Bm` hoặc `Nli x Am`. */
const LI_X_METERS_RE = /([\d.,]+)\s*li\s*x\s*([\d.,]+)\s*m(?:\s*x\s*([\d.,]+)\s*m)?/iu;

export function normalizeDecimalToken(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, '').replace(',', '.');
}

export function formatMetersLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const n = Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  return `${n}m`;
}

function parseMeterNumber(raw: string): number | null {
  const n = Number(normalizeDecimalToken(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Extract `(đm n li)` từ ten_san_xuat → chuỗi chuẩn hóa lưu cột `do_li_dm`. Không lấy `(đm …kg)`. */
export function extractDoLiDm(tenSanXuat: string): string | null {
  const text = String(tenSanXuat || '');
  const match = text.match(DO_LI_DM_RE);
  if (!match) return null;
  const n = match[1].trim();
  if (!n) return null;
  return `(đm ${n} li)`;
}

export function classifyProductPxGroup(nhomVthh: string): ProductPxGroup {
  const key = String(nhomVthh || '').trim().toLocaleLowerCase('vi');
  if (key.includes('px đặc') || key.includes('px dac')) return 'dac';
  if (key.includes('px sóng') || key.includes('px song')) return 'song';
  if (key.includes('px rỗng') || key.includes('px rong')) return 'rong';
  return 'other';
}

export function parseAmisSpecs(maAmis: string): AmisSpecs {
  const text = String(maAmis || '').trim();
  const liMatch = text.match(AMIS_LI_RE);
  const dayMatch = text.match(AMIS_DAY_RE);
  const zemMatch = text.match(AMIS_ZEM_RE);
  const doLi = liMatch ? `${normalizeDecimalToken(liMatch[1])}li` : '';
  const doDayM = dayMatch ? formatMetersLabel(Number(normalizeDecimalToken(dayMatch[1]))) : '';
  const zem = zemMatch ? `${zemMatch[1]}ZEM` : '';
  return { doLi, doDayM, zem };
}

/** Sóng: mét dài = token `…m` cuối cùng trong tên (vd 3,5M trước ghi chú, hoặc 30M sau 1.2m). */
export function parseSongLengthMeters(tenSanXuat: string): number | null {
  const text = String(tenSanXuat || '').trim();
  const matches = [...text.matchAll(ANY_METER_RE)];
  if (matches.length === 0) return null;
  return parseMeterNumber(matches[matches.length - 1][1]);
}

/** Với TP; PX Sóng: lấy mét dài nhất trong danh sách tên SX biến thể. */
export function pickMaxSongLengthMeters(names: string[]): number | null {
  let max: number | null = null;
  for (const name of names) {
    const n = parseSongLengthMeters(name);
    if (n == null) continue;
    if (max == null || n > max) max = n;
  }
  return max;
}

function splitFirstDash(text: string): { before: string; after: string } {
  const idx = text.indexOf('-');
  if (idx < 0) return { before: text.trim(), after: '' };
  return { before: text.slice(0, idx).trim(), after: text.slice(idx + 1).trim() };
}

function extractMang(tenSanXuat: string): string {
  const match = String(tenSanXuat || '').match(NAME_MANG_RE);
  if (!match) return '';
  const raw = match[1].replace(/\s+/g, ' ').trim().toUpperCase();
  if (raw === 'SUNPC' || raw === 'SUN PC') return 'SUN PC';
  if (raw === 'STANDA') return 'STD';
  return raw;
}

function extractHangPhe(tenSanXuat: string, maAmis = ''): string {
  const fromName = String(tenSanXuat || '').match(NAME_HANG_PHE_RE);
  if (fromName) {
    const t = fromName[1].trim();
    if (/^chạy\s+100%\s+phế$/i.test(t) || (/100%\s*phế/i.test(t) && !/NS\s*Off/i.test(t))) {
      return 'hàng chạy 100% phế';
    }
    return t;
  }
  if (/\bNP\b/i.test(tenSanXuat) || /(?:^|-)NP(?:-|$)/i.test(maAmis)) {
    return 'hàng chạy 100% phế';
  }
  return '';
}

function resolveDoLi(maAmis: string, tenSanXuat: string, _group: ProductPxGroup): string {
  const amis = parseAmisSpecs(maAmis);
  if (amis.doLi && !/\bkg\b/i.test(amis.doLi)) return amis.doLi;
  if (amis.zem) return amis.zem;
  const zemInName = String(tenSanXuat || '').match(NAME_ZEM_RE);
  if (zemInName) return `${zemInName[1]}ZEM`;
  // Chỉ nhận token …li — không lấy …KG làm độ li
  const liInName = String(tenSanXuat || '').match(/([\d.,]+)\s*li\b/iu);
  if (liInName) return `${normalizeDecimalToken(liInName[1])}li`;
  return '';
}

/** Token độ li hợp lệ: …li hoặc …ZEM — không phải KG. */
export function isValidDoLiToken(value: string): boolean {
  const t = String(value || '').trim();
  if (!t) return false;
  if (/kg/i.test(t)) return false;
  return /^\d+[.,]?\d*\s*li$/i.test(t) || /^\d+\s*zem$/i.test(t);
}

/** Mét dài Đặc thường gặp — ưu tiên nhận diện là do_dai_m. */
export const DEFAULT_DAC_LENGTH_METERS = [8, 9, 20, 30] as const;

function isDefaultDacLength(n: number): boolean {
  return (DEFAULT_DAC_LENGTH_METERS as readonly number[]).some(v => Math.abs(v - n) < 1e-9);
}

/**
 * Đặc: các mét standalone sau `-` (không tính pattern `x …m`).
 * Ưu tiên 8m / 9m / 20m / 30m làm mét dài; mét còn lại = độ dày/khổ.
 * Fallback: lớn = dài, nhỏ = dày.
 */
export function parseDacDashMeters(tenSanXuat: string): { doDayM: string; doDaiM: string } {
  const text = String(tenSanXuat || '');
  const withoutX = text.replace(/\bx\s*[\d.,]+\s*m\b/giu, ' ');
  const values: number[] = [];
  for (const match of withoutX.matchAll(DASH_METER_RE)) {
    const n = parseMeterNumber(match[1]);
    if (n != null) values.push(n);
  }
  if (values.length === 0) return { doDayM: '', doDaiM: '' };
  if (values.length === 1) {
    const only = values[0];
    if (isDefaultDacLength(only)) {
      return { doDayM: '', doDaiM: formatMetersLabel(only) };
    }
    // Một mét không thuộc bộ dài mặc định → coi là độ dày/khổ (vd chỉ có 1.56m)
    return { doDayM: formatMetersLabel(only), doDaiM: '' };
  }

  const knownLength = values.find(isDefaultDacLength);
  if (knownLength != null) {
    const other = values.find(v => Math.abs(v - knownLength) >= 1e-9);
    return {
      doDayM: other != null ? formatMetersLabel(other) : '',
      doDaiM: formatMetersLabel(knownLength)
    };
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  return {
    doDayM: formatMetersLabel(min),
    doDaiM: formatMetersLabel(max)
  };
}

/** Rỗng (và Đặc kiểu x): `li x khổ x dài` hoặc `li x khổ` (không có dài). */
export function parseLiXMeters(tenSanXuat: string): { doLi: string; doDayM: string; doDaiM: string } {
  const match = String(tenSanXuat || '').match(LI_X_METERS_RE);
  if (!match) return { doLi: '', doDayM: '', doDaiM: '' };
  const doLi = `${normalizeDecimalToken(match[1])}li`;
  const doDayM = formatMetersLabel(Number(normalizeDecimalToken(match[2])));
  const doDaiM = match[3] ? formatMetersLabel(Number(normalizeDecimalToken(match[3]))) : '';
  return { doLi, doDayM, doDaiM };
}

function songTenGoc(tenSanXuat: string, lengthMeters: number | null): string {
  const text = String(tenSanXuat || '').trim();
  if (lengthMeters == null) {
    const idx = text.lastIndexOf('-');
    return idx >= 0 ? text.slice(0, idx).trim() : text;
  }
  // Cắt từ dấu `-` gắn với mét dài cuối (cho phép ghi chú sau như `( GIÁ RẺ )`)
  const re = new RegExp(
    `-\\s*${String(lengthMeters).replace('.', '[,.]')}\\s*m\\b.*$`,
    'iu'
  );
  const cut = text.replace(re, '').trim().replace(/[-\s]+$/u, '').trim();
  return cut || text;
}

export function parseProductionNameParts(
  tenSanXuat: string,
  nhomVthh: string,
  maAmis = ''
): ProductionNameParts {
  const group = classifyProductPxGroup(nhomVthh);
  const text = String(tenSanXuat || '').trim();
  const amis = parseAmisSpecs(maAmis);
  const doLiDm = extractDoLiDm(text) || '';
  const mang = extractMang(text);
  const hangPhe = extractHangPhe(text, maAmis);
  let doLi = resolveDoLi(maAmis, text, group);
  if (doLi && !isValidDoLiToken(doLi)) doLi = '';

  if (group === 'song') {
    // Sóng: lấy đúng mét dài từ tên SX của dòng (không lấy max giữa các biến thể)
    const lengthM = parseSongLengthMeters(text);
    const tenGoc = songTenGoc(text, lengthM);
    return {
      tenGoc,
      doLi,
      doDayM: '',
      doDaiM: lengthM != null ? formatMetersLabel(lengthM) : '',
      mang,
      hangPhe,
      doLiDm
    };
  }

  const { before } = splitFirstDash(text);
  const xParts = parseLiXMeters(text);

  if (group === 'rong') {
    if (xParts.doLi && !doLi) doLi = xParts.doLi;
    return {
      tenGoc: before || text,
      doLi,
      doDayM: xParts.doDayM || amis.doDayM,
      doDaiM: xParts.doDaiM,
      mang,
      hangPhe,
      doLiDm
    };
  }

  // Đặc (+ other)
  if (xParts.doDayM && !xParts.doDaiM) {
    // `2.6li x 1.22m` → chỉ có độ dày/khổ, không có m dài
    if (xParts.doLi && !doLi) doLi = xParts.doLi;
    return {
      tenGoc: before || text,
      doLi,
      doDayM: xParts.doDayM || amis.doDayM,
      doDaiM: '',
      mang,
      hangPhe,
      doLiDm
    };
  }

  if (xParts.doDaiM) {
    if (xParts.doLi && !doLi) doLi = xParts.doLi;
    return {
      tenGoc: before || text,
      doLi,
      doDayM: xParts.doDayM || amis.doDayM,
      doDaiM: xParts.doDaiM,
      mang,
      hangPhe,
      doLiDm
    };
  }

  const dashMeters = parseDacDashMeters(text);
  return {
    tenGoc: before || text,
    doLi,
    doDayM: dashMeters.doDayM || amis.doDayM,
    doDaiM: dashMeters.doDaiM,
    mang,
    hangPhe,
    doLiDm
  };
}

function joinSegments(parts: Array<string | null | undefined>): string {
  return parts
    .map(p => String(p || '').trim())
    .filter(Boolean)
    .join(' - ');
}

/**
 * Ghép tên hiển thị.
 * Thứ tự: ten_goc - hàng phế - màng - độ li - đm - độ dày - mét dài (mét dài luôn cuối).
 */
export function composeProductionDisplayName(
  parts: Partial<ProductionNameParts>,
  nhomVthh: string
): string {
  const tenGoc = String(parts.tenGoc || '').trim();
  const doLi = String(parts.doLi || '').trim();
  const mang = String(parts.mang || '').trim();
  const hangPhe = String(parts.hangPhe || '').trim();
  const doLiDm = String(parts.doLiDm || '').trim();
  const doDayM = String(parts.doDayM || '').trim();
  const doDaiM = String(parts.doDaiM || '').trim();

  // Mét dài luôn segment cuối cùng khi có.
  return (
    joinSegments([tenGoc, hangPhe, mang, doLi, doLiDm, doDayM, doDaiM]) ||
    tenGoc ||
    '-'
  );
}

/** Seed đầy đủ từ bản ghi catalog theo đúng tên SX của dòng. */
export function seedProductionSpecs(input: {
  tenSanXuat: string;
  maAmis?: string;
  nhomVthh: string;
}): ProductionNameParts & { tenGhep: string } {
  const parts = parseProductionNameParts(
    input.tenSanXuat,
    input.nhomVthh,
    input.maAmis || ''
  );
  return {
    ...parts,
    tenGhep: composeProductionDisplayName(parts, input.nhomVthh)
  };
}
