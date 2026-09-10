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
const SONG_LENGTH_TAIL_RE = /-\s*([\d.,]+)\s*m\s*$/iu;
const AMIS_LI_RE = /-\s*([\d.,]+)\s*li\b/iu;
const AMIS_DAY_RE = /\*\s*([\d.,]+)\s*m\b/iu;
const AMIS_ZEM_RE = /(\d+)\s*zem\b/iu;
const NAME_ZEM_RE = /(\d+)\s*zem\b/iu;
const NAME_MANG_RE = /(?:màng\s+)?(ECO|STD|SUN\s*PC|HA|LUX|STANDA)\b/iu;
const NAME_HANG_PHE_RE = /(hàng\s+100%\s+NS\s+Off|hàng\s+chạy\s+100%\s+phế|hàng\s+100%\s+phế)/iu;

function normalizeDecimalToken(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, '').replace(',', '.');
}

function formatMetersLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const n = Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  return `${n}m`;
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

export function parseSongLengthMeters(tenSanXuat: string): number | null {
  const text = String(tenSanXuat || '').trim();
  const match = text.match(SONG_LENGTH_TAIL_RE);
  if (!match) return null;
  const n = Number(normalizeDecimalToken(match[1]));
  return Number.isFinite(n) && n > 0 ? n : null;
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

function splitLastDash(text: string): { before: string; after: string } {
  const idx = text.lastIndexOf('-');
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
    if (/100%\s*phế/i.test(t) && !/chạy/i.test(t) && !/NS\s*Off/i.test(t)) {
      return 'hàng chạy 100% phế';
    }
    return t;
  }
  if (/\bNP\b/i.test(tenSanXuat) || /(?:^|-)NP(?:-|$)/i.test(maAmis)) {
    return 'hàng chạy 100% phế';
  }
  return '';
}

function resolveDoLi(maAmis: string, tenSanXuat: string, group: ProductPxGroup): string {
  const amis = parseAmisSpecs(maAmis);
  if (amis.doLi) return amis.doLi;
  if (amis.zem) return amis.zem;
  const zemInName = String(tenSanXuat || '').match(NAME_ZEM_RE);
  if (zemInName) return `${zemInName[1]}ZEM`;
  if (group === 'song') {
    const liInName = String(tenSanXuat || '').match(/([\d.,]+)\s*li\b/iu);
    if (liInName) return `${normalizeDecimalToken(liInName[1])}li`;
    const kgInName = String(tenSanXuat || '').match(/([\d.,]+)\s*kg\b/iu);
    if (kgInName) return `${normalizeDecimalToken(kgInName[1])}KG`;
  }
  return '';
}

export function parseProductionNameParts(
  tenSanXuat: string,
  nhomVthh: string,
  maAmis = '',
  options?: { songLengthNames?: string[] }
): ProductionNameParts {
  const group = classifyProductPxGroup(nhomVthh);
  const text = String(tenSanXuat || '').trim();
  const amis = parseAmisSpecs(maAmis);
  const doLiDm = extractDoLiDm(text) || '';
  const mang = extractMang(text);
  const hangPhe = extractHangPhe(text, maAmis);
  const doLi = resolveDoLi(maAmis, text, group);

  if (group === 'song') {
    const { before, after } = splitLastDash(text);
    const singleLen = parseSongLengthMeters(text);
    const maxLen = options?.songLengthNames?.length
      ? pickMaxSongLengthMeters(options.songLengthNames)
      : singleLen;
    return {
      tenGoc: before || text,
      doLi,
      doDayM: '',
      doDaiM: maxLen != null ? formatMetersLabel(maxLen) : (after.match(/^[\d.,]+\s*m$/iu) ? after.replace(/\s+/g, '') : ''),
      mang,
      hangPhe,
      doLiDm
    };
  }

  // Đặc / Rỗng / other: ten_goc trước dấu - đầu
  const { before } = splitFirstDash(text);
  let doDaiM = '';
  const xDims = text.match(/x\s*([\d.,]+)\s*m(?:\s*x\s*([\d.,]+)\s*m)?/iu);
  if (xDims?.[2]) {
    doDaiM = formatMetersLabel(Number(normalizeDecimalToken(xDims[2])));
  } else if (xDims?.[1] && !amis.doDayM) {
    doDaiM = formatMetersLabel(Number(normalizeDecimalToken(xDims[1])));
  } else {
    const tail = text.match(/-\s*([\d.,]+)\s*m\s*$/iu);
    if (tail) doDaiM = formatMetersLabel(Number(normalizeDecimalToken(tail[1])));
  }

  return {
    tenGoc: before || text,
    doLi,
    doDayM: amis.doDayM,
    doDaiM,
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

/** Ghép tên hiển thị theo nhóm VTHH. */
export function composeProductionDisplayName(
  parts: Partial<ProductionNameParts>,
  nhomVthh: string
): string {
  const group = classifyProductPxGroup(nhomVthh);
  const tenGoc = String(parts.tenGoc || '').trim();
  const doLi = String(parts.doLi || '').trim();
  const mang = String(parts.mang || '').trim();
  const hangPhe = String(parts.hangPhe || '').trim();
  const doLiDm = String(parts.doLiDm || '').trim();
  const doDaiM = String(parts.doDaiM || '').trim();

  if (group === 'song') {
    return joinSegments([tenGoc, doLi]) || tenGoc || '-';
  }

  // Đặc + Rỗng
  return joinSegments([tenGoc, hangPhe, mang, doLi, doLiDm, doDaiM]) || tenGoc || '-';
}

/** Seed đầy đủ từ bản ghi catalog (1 dòng hoặc nhiều tên sóng để lấy max m). */
export function seedProductionSpecs(input: {
  tenSanXuat: string;
  maAmis?: string;
  nhomVthh: string;
  songLengthNames?: string[];
}): ProductionNameParts & { tenGhep: string } {
  const parts = parseProductionNameParts(
    input.tenSanXuat,
    input.nhomVthh,
    input.maAmis || '',
    { songLengthNames: input.songLengthNames }
  );
  return {
    ...parts,
    tenGhep: composeProductionDisplayName(parts, input.nhomVthh)
  };
}
