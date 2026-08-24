import type { ProductConversion } from '../features/bang-quy-doi-san-pham/types';

export const PRODUCT_CONVERSION_CSV_MAX_BYTES = 1024 * 1024;

export type ProductConversionCsvRow = {
  rowNumber: number;
  productCode: string;
  amisCode: string;
  productName: string;
  productionName: string;
  sheetWidthM: string;
  sheetLengthM: string;
  rollWidthM: string;
  rollLengthM: string;
  areaM2: string;
  kgPerLinearM: string;
  kgPerM2: string;
  kgPerSheet: string;
  kgPerRoll: string;
};

const HEADERS = [
  'Stt',
  'Mã amis',
  'Tên sản phẩm',
  'Tên sản xuất',
  'Khổ tấm rộng (m rộng)',
  'Khổ tấm dài (m dài / tấm)',
  'Khổ cuộn rộng (m rộng)',
  'Khổ cuộn dài (m dài)',
  'Khổ diện tích mét vuông (m2)',
  'Trọng lượng (kg/1 m dài)',
  'Trọng lượng (kg/m2)',
  'Trọng lượng (kg/Tấm)',
  'Trọng lượng (kg/Cuộn)'
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
}

function detectCsvDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
}

function parseCsv(text: string): string[][] {
  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function parseProductConversionCsv(file: File): Promise<ProductConversionCsvRow[]> {
  if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Chỉ chấp nhận file CSV.');
  if (file.size > PRODUCT_CONVERSION_CSV_MAX_BYTES) throw new Error('File CSV vượt quá giới hạn 1 MB.');
  const matrix = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
  if (matrix.length < 2) throw new Error('File CSV không có dữ liệu.');
  const headers = matrix[0].map(normalizeHeader);
  const find = (name: string) => headers.indexOf(normalizeHeader(name));
  const indexes = HEADERS.map(find);
  if (indexes[1] < 0) {
    throw new Error('CSV cần có cột Mã amis.');
  }
  return matrix.slice(1).map((cells, index) => {
    const get = (position: number) => indexes[position] >= 0 ? String(cells[indexes[position]] ?? '').trim() : '';
    return {
      rowNumber: index + 2, productCode: '', amisCode: get(1), productName: get(2), productionName: get(3),
      sheetWidthM: get(4), sheetLengthM: get(5), rollWidthM: get(6), rollLengthM: get(7),
      areaM2: get(8), kgPerLinearM: get(9), kgPerM2: get(10), kgPerSheet: get(11), kgPerRoll: get(12)
    };
  }).filter(row => row.productCode || row.amisCode);
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[;",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadProductConversionsCsv(rows: ProductConversion[], filename = `bang-quy-doi-san-pham-${new Date().toISOString().slice(0, 10)}.csv`) {
  const lines = [HEADERS, ...rows.map((row, index) => [
    index + 1, row.maAmis, row.tenSp, '', row.khoTamRongM, row.khoTamDaiM, row.khoCuonRongM,
    row.khoCuonDaiM, row.dienTichM2, row.trongLuongKgMDai, row.trongLuongKgM2, row.trongLuongKgTam, row.trongLuongKgCuon
  ])].map(columns => columns.map(csvCell).join(';'));
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadProductConversionCsvTemplate() {
  const example = ['1', 'AMIS001', 'Tên sản phẩm mẫu', 'Tên sản xuất mẫu', '1.08', '6', '', '', '6.48', '0.82', '', '4.92', ''];
  const content = [HEADERS, example].map(columns => columns.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'mau-bang-quy-doi-san-pham.csv'; anchor.click();
  URL.revokeObjectURL(url);
}
