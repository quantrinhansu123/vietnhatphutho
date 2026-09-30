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

export type SuCoRow = { key: string; ten: string; lan: string };

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

export function tongSuCo(rows: Array<Pick<SuCoRow, 'ten' | 'lan'>>): { gio: number; kg: number } {
  let gio = 0;
  let kg = 0;
  for (const row of rows) {
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
    .filter(row => row.ten && num(row.lan) > 0)
    .map(row => {
      const parts = [`${row.ten} — ${String(row.lan).trim()} lần`];
      const gio = gioSuCo(row.ten, row.lan);
      const kg = kgSuCo(row.ten, row.lan);
      if (gio) parts.push(`${gio} giờ`);
      if (kg) parts.push(`${kg} kg`);
      return parts.join(' — ');
    });
  return [...lines, note.trim()].filter(Boolean).join('\n');
}

const SU_CO_LINE =
  /^(.+?)\s+—\s+(\d+(?:[.,]\d+)?)\s+lần(?:\s+—\s+\d+(?:[.,]\d+)?\s+giờ)?(?:\s+—\s+\d+(?:[.,]\d+)?\s+kg)?\s*$/;

export function parseSuCo(text: string): { rows: SuCoRow[]; note: string } {
  const rows: SuCoRow[] = [];
  const notes: string[] = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(SU_CO_LINE);
    const ten = match?.[1]?.trim() || '';
    if (match && suCoMau(ten)) {
      rows.push({
        key: `su-co-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ten,
        lan: match[2]
      });
    } else if (line.trim()) {
      notes.push(line);
    }
  }
  return { rows, note: notes.join('\n') };
}
