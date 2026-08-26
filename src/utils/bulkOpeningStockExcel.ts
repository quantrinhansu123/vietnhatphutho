import * as XLSX from 'xlsx';

export type BulkOpeningStockImportRow = {
  code: string;
  name: string;
  openingStock: string;
};

export type BulkOpeningStockMaterialRow = {
  code: string;
  name: string;
  openingStock: string;
};

const CODE_HEADERS = ['mã npl', 'ma npl', 'ma_npl', 'mã sp', 'ma sp', 'ma_sp', 'code', 'mã', 'ma'];
const NAME_HEADERS = ['tên nguyên phụ liệu', 'ten nguyen phu lieu', 'ten_npl', 'tên npl', 'ten npl', 'tên sp', 'ten sp', 'name'];
const OPENING_HEADERS = ['tồn đầu', 'ton dau', 'ton_dau', 'tồn đầu kỳ', 'ton dau ky', 'openingstock', 'opening stock'];

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function cellToText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function openingStockInput(value: string) {
  return value === '-' ? '' : value;
}

function findHeaderKey(headers: string[], aliases: string[]) {
  return headers.find(header => aliases.some(alias => header === alias || header.includes(alias)));
}

function normalizeCodeKey(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

function dedupeImportRows(rows: BulkOpeningStockImportRow[]) {
  const map = new Map<string, BulkOpeningStockImportRow>();
  rows.forEach(row => {
    map.set(normalizeCodeKey(row.code), row);
  });
  return [...map.values()];
}

function parseSheetRows(sheet: XLSX.WorkSheet): BulkOpeningStockImportRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  }) as unknown[][];

  if (matrix.length === 0) return [];

  const firstRow = matrix[0].map(cell => normalizeHeader(cell));
  const codeHeader = findHeaderKey(firstRow, CODE_HEADERS);
  const nameHeader = findHeaderKey(firstRow, NAME_HEADERS);
  const openingHeader = findHeaderKey(firstRow, OPENING_HEADERS);
  const hasHeader = Boolean(codeHeader && openingHeader);

  if (hasHeader) {
    const codeIndex = firstRow.indexOf(codeHeader!);
    const nameIndex = nameHeader ? firstRow.indexOf(nameHeader) : -1;
    const openingIndex = firstRow.indexOf(openingHeader!);
    return dedupeImportRows(
      matrix
        .slice(1)
        .map(row => ({
          code: cellToText(row[codeIndex]),
          name: nameIndex >= 0 ? cellToText(row[nameIndex]) : '',
          openingStock: cellToText(row[openingIndex])
        }))
        .filter(row => row.code)
    );
  }

  return dedupeImportRows(
    matrix
      .map(row => {
        const code = cellToText(row[0]);
        const name = row.length >= 3 ? cellToText(row[1]) : '';
        const openingStock = cellToText(row.length >= 3 ? row[2] : row[1]);
        return { code, name, openingStock };
      })
      .filter(row => row.code && !CODE_HEADERS.includes(normalizeHeader(row.code)))
  );
}

export async function parseBulkOpeningStockExcel(file: File): Promise<BulkOpeningStockImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  return parseSheetRows(sheet);
}

export function downloadBulkOpeningStockTemplate(materials: BulkOpeningStockMaterialRow[]) {
  const rows = materials
    .filter(material => material.code && material.code !== '-')
    .sort((a, b) => a.code.localeCompare(b.code, 'vi'))
    .map(material => ({
      'Mã NVL': material.code,
      'Tên nguyên vật liệu': material.name === '-' ? '' : material.name,
      'Tồn đầu': openingStockInput(material.openingStock)
    }));

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['Mã NVL', 'Tên nguyên vật liệu', 'Tồn đầu']
  });
  worksheet['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ton_dau');
  XLSX.writeFile(workbook, 'mau-cap-nhat-ton-dau-nvl.xlsx');
}
