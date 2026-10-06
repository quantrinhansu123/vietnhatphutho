import { parseSlipNumber } from './parseSlipNumber';

export const SU_CO_MAU = [
  { ten: 'Chuyển hàng màu sang hàng trắng', gio: 0, kg: 150 },
  { ten: 'Chuyển hàng trắng sang hàng màu', gio: 0, kg: 50 },
  { ten: 'Chuyển màu hàng mỏng', gio: 1, kg: 0 },
  { ten: 'Chuyển màu hàng dày', gio: 1.5, kg: 0 },
  { ten: 'Chuyển màu (chung)', gio: 1, kg: 0 },
  { ten: 'Đổi li (trừ giờ)', gio: 1 / 3, kg: 0 },
  { ten: 'Đổi li (trừ kg)', gio: 0, kg: 50 },
  { ten: 'Đổi khổ', gio: 1, kg: 0 },
  { ten: 'Đổi tỷ lệ nhựa', gio: 1, kg: 0 }
] as const;

export type SuCoRow = {
  key: string;
  /** 'mau' = sự cố cố định (9 mẫu), 'tu_do' = tự nhập ghi chú + giờ. Mặc định 'mau' để tương thích bản ghi cũ. */
  kind?: 'mau' | 'tu_do';
  ten: string;
  lan: string;
  ghi_chu?: string;
  gio_tu?: string;
  gio_den?: string;
  tong_gio?: string;
};

function num(value: unknown): number {
  return parseSlipNumber(value);
}

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function formatSuCoAmount(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = round1(value);
  if (!(rounded > 0)) return '';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function suCoRateText(value: number): string {
  const rounded = round1(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function suCoOptionLabel(item: { ten: string; gio: number; kg: number }): string {
  if (item.ten === 'Đổi li (trừ giờ)') return `${item.ten} — 20p`;
  const bits: string[] = [];
  if (item.gio > 0) bits.push(`${suCoRateText(item.gio)}h`);
  if (item.kg > 0) bits.push(`${suCoRateText(item.kg)}kg`);
  return bits.length ? `${item.ten} — ${bits.join(' / ')}` : item.ten;
}

function suCoMau(ten: string) {
  return SU_CO_MAU.find(item => item.ten === ten);
}

/** Số giờ từ khoảng HH:MM → HH:MM (qua đêm tự +24h), làm tròn 1 số. Rỗng nếu không parse được. */
export function tinhTongGioTuKhoang(gioTu: string, gioDen: string): string {
  const parse = (v: string) => {
    const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  };
  const from = parse(gioTu);
  const to = parse(gioDen);
  if (from === null || to === null) return '';
  let diff = to - from;
  if (diff < 0) diff += 24 * 60;
  return formatSuCoAmount(round1(diff / 60));
}

export function gioSuCoRow(row: Pick<SuCoRow, 'kind' | 'ten' | 'lan' | 'tong_gio'>): string {
  if (row.kind === 'tu_do') {
    const v = num(row.tong_gio);
    return v > 0 ? formatSuCoAmount(v) : '';
  }
  return gioSuCo(row.ten, row.lan);
}

export function gioSuCo(ten: string, lan: string): string {
  const hit = suCoMau(ten);
  const times = num(lan);
  if (!hit || !(hit.gio > 0) || !(times > 0)) return '';
  return formatSuCoAmount(hit.gio * times);
}

export function kgSuCo(ten: string, lan: string): string {
  const hit = suCoMau(ten);
  const times = num(lan);
  if (!hit || !(hit.kg > 0) || !(times > 0)) return '';
  return formatSuCoAmount(hit.kg * times);
}

export function tongSuCo(rows: Array<Pick<SuCoRow, 'kind' | 'ten' | 'lan' | 'tong_gio'>>): { gio: number; kg: number } {
  let gio = 0;
  let kg = 0;
  for (const row of rows) {
    if (row.kind === 'tu_do') {
      gio += num(row.tong_gio);
      continue;
    }
    gio += num(gioSuCo(row.ten, row.lan));
    kg += num(kgSuCo(row.ten, row.lan));
  }
  return { gio: round1(gio), kg: round1(kg) };
}

export function formatTongSuCo(value: number): string {
  const rounded = round1(value);
  if (!Number.isFinite(rounded) || !(rounded > 0)) return '0';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function composeSuCo(rows: SuCoRow[], note: string): string {
  const lines = rows
    .filter(row => {
      if (row.kind === 'tu_do') return Boolean(str(row.ghi_chu) || str(row.tong_gio));
      return Boolean(row.ten) && num(row.lan) > 0;
    })
    .map(row => {
      if (row.kind === 'tu_do') {
        const range =
          str(row.gio_tu) || str(row.gio_den) ? `${str(row.gio_tu) || '--:--'}–${str(row.gio_den) || '--:--'}` : '';
        const gio = str(row.tong_gio) ? `${str(row.tong_gio)} giờ` : '';
        return [`Tự do`, str(row.ghi_chu) || 'Sự cố', range, gio].filter(Boolean).join(' — ');
      }
      const parts = [`${row.ten} — ${String(row.lan).trim()} lần`];
      const gio = gioSuCo(row.ten, row.lan);
      const kg = kgSuCo(row.ten, row.lan);
      if (gio) parts.push(`${gio} giờ`);
      if (kg) parts.push(`${kg} kg`);
      return parts.join(' — ');
    });
  return [...lines, note.trim()].filter(Boolean).join('\n');
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

const SU_CO_LINE =
  /^(.+?)\s+—\s+(\d+(?:[.,]\d+)?)\s+lần(?:\s+—\s+\d+(?:[.,]\d+)?\s+giờ)?(?:\s+—\s+\d+(?:[.,]\d+)?\s+kg)?\s*$/;

const SU_CO_TU_DO_LINE = /^Tự do\s+—\s+(.+?)(?:\s+—\s+(\d{1,2}:\d{2})–(\d{1,2}:\d{2}))?(?:\s+—\s+(\d+(?:[.,]\d+)?)\s+giờ)?\s*$/;

export function parseSuCo(text: string): { rows: SuCoRow[]; note: string } {
  const rows: SuCoRow[] = [];
  const notes: string[] = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const free = line.match(SU_CO_TU_DO_LINE);
    if (free && str(free[1]) && free[1].trim() !== 'Sự cố') {
      rows.push({
        key: `su-co-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'tu_do',
        ten: '',
        lan: '',
        ghi_chu: str(free[1]),
        gio_tu: str(free[2]),
        gio_den: str(free[3]),
        tong_gio: str(free[4]).replace(',', '.')
      });
      continue;
    }
    if (free && str(free[4])) {
      rows.push({
        key: `su-co-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'tu_do',
        ten: '',
        lan: '',
        ghi_chu: str(free[1]),
        gio_tu: str(free[2]),
        gio_den: str(free[3]),
        tong_gio: str(free[4]).replace(',', '.')
      });
      continue;
    }
    const match = line.match(SU_CO_LINE);
    const ten = match?.[1]?.trim() || '';
    if (match && suCoMau(ten)) {
      rows.push({
        key: `su-co-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'mau',
        ten,
        lan: match[2]
      });
    } else if (line.trim()) {
      notes.push(line);
    }
  }
  return { rows, note: notes.join('\n') };
}
