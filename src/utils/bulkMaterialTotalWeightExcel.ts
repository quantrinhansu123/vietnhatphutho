import * as XLSX from 'xlsx';

export type BulkMaterialTotalWeightImportRow = {
  code: string;
  totalWeight: string;
};

export type BulkMaterialTotalWeightMaterialRow = {
  code: string;
  totalWeight: string;
};

const CODE_HEADERS = [
  'mã nvl',
  'ma nvl',
  'mã npl',
  'ma npl',
  'ma_npl',
  'ma_nvl',
  'code',
  'mã',
  'ma'
];
const WEIGHT_HEADERS = [
  'tổng trọng lượng',
  'tong trong luong',
  'tong_trong_luong',
  'tổng kg',
  'tong kg',
  'tong_kg',
  'totalweight',
  'total weight',
  'tổng',
  'tong'
];

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

function weightInput(value: string) {
  return value === '-' ? '' : value;
}

function findHeaderKey(headers: string[], aliases: string[]) {
  return headers.find(header => aliases.some(alias => header === alias || header.includes(alias)));
}

function normalizeCodeKey(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

function dedupeImportRows(rows: BulkMaterialTotalWeightImportRow[]) {
  const map = new Map<string, BulkMaterialTotalWeightImportRow>();
  rows.forEach(row => {
    map.set(normalizeCodeKey(row.code), row);
  });
  return [...map.values()];
}

function parseSheetRows(sheet: XLSX.WorkSheet): BulkMaterialTotalWeightImportRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  }) as unknown[][];

  if (matrix.length === 0) return [];

  const firstRow = matrix[0].map(cell => normalizeHeader(cell));
  const codeHeader = findHeaderKey(firstRow, CODE_HEADERS);
  const weightHeader = findHeaderKey(firstRow, WEIGHT_HEADERS);
  const hasHeader = Boolean(codeHeader && weightHeader);

  if (hasHeader) {
    const codeIndex = firstRow.indexOf(codeHeader!);
    const weightIndex = firstRow.indexOf(weightHeader!);
    return dedupeImportRows(
      matrix
        .slice(1)
        .map(row => ({
          code: cellToText(row[codeIndex]),
          totalWeight: cellToText(row[weightIndex])
        }))
        .filter(row => row.code)
    );
  }

  return dedupeImportRows(
    matrix
      .map(row => ({
        code: cellToText(row[0]),
        totalWeight: cellToText(row[1])
      }))
      .filter(row => row.code && !CODE_HEADERS.includes(normalizeHeader(row.code)))
  );
}

export async function parseBulkMaterialTotalWeightExcel(
  file: File
): Promise<BulkMaterialTotalWeightImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  return parseSheetRows(sheet);
}

export function downloadBulkMaterialTotalWeightTemplate(
  materials: BulkMaterialTotalWeightMaterialRow[]
) {
  const rows = materials
    .filter(material => material.code && material.code !== '-')
    .sort((a, b) => a.code.localeCompare(b.code, 'vi'))
    .map(material => ({
      'Mã NVL': material.code,
      'Tổng trọng lượng': weightInput(material.totalWeight)
    }));

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ['Mã NVL', 'Tổng trọng lượng']
  });
  worksheet['!cols'] = [{ wch: 18 }, { wch: 18 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tong_trong_luong');
  XLSX.writeFile(workbook, 'mau-cap-nhat-tong-trong-luong-nvl.xlsx');
}
