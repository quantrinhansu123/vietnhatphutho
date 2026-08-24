import * as XLSX from 'xlsx';

export type ProductConversionExcelRow = {
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
  rowNumber: number;
};

export const PRODUCT_CONVERSION_EXCEL_HEADERS = [
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
] as const;

const HEADER_ALIASES: Record<keyof Omit<ProductConversionExcelRow, 'rowNumber'>, string[]> = {
  amisCode: ['ma amis', 'ma_amis', 'amis code', 'amis' , 'Mã amis'],
  productName: ['ten san pham', 'ten_san_pham', 'product name', 'ten sp'],
  productionName: ['ten san xuat', 'ten_san_xuat', 'production name', 'ten sx'],
  sheetWidthM: ['kho tam rong', 'kho_tam_rong', 'sheet width', 'tam rong'],
  sheetLengthM: ['kho tam dai', 'kho_tam_dai', 'sheet length', 'tam dai'],
  rollWidthM: ['kho cuon rong', 'kho_cuon_rong', 'roll width', 'cuon rong'],
  rollLengthM: ['kho cuon dai', 'kho_cuon_dai', 'roll length', 'cuon dai'],
  areaM2: ['dien tich', 'dien_tich', 'area', 'area m2', 'kho dien tich'],
  kgPerLinearM: ['trong luong kg m dai', 'trong luong m dai', 'trong luong kg 1 m dai', 'kg m dai', 'kg per linear m'],
  kgPerM2: ['trong luong kg m2', 'trong luong m2', 'kg m2', 'kg per m2'],
  kgPerSheet: ['trong luong kg tam', 'trong luong tam', 'kg tam', 'kg per sheet'],
  kgPerRoll: ['trong luong kg cuon', 'trong luong cuon', 'kg cuon', 'kg per roll']
};

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[_/-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ');
}

function cellToText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function findColumn(headers: string[], aliases: string[]) {
  const exact = headers.findIndex(header => aliases.some(alias => header === alias));
  if (exact >= 0) return exact;
  return headers.findIndex(header =>
    aliases.some(alias => alias.length >= 3 && (header.includes(alias) || alias.includes(header)))
  );
}

export async function parseProductConversionExcel(file: File): Promise<ProductConversionExcelRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  }) as unknown[][];
  if (matrix.length === 0) return [];

  const headers = matrix[0].map(normalizeHeader);

  const amisCodeIndex = findColumn(headers, HEADER_ALIASES.amisCode);
  if (amisCodeIndex < 0) {
    throw new Error('Không tìm thấy cột "Mã amis" trong file Excel.');
  }

  const indices = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>).map(key => [
      key,
      key === 'amisCode' ? amisCodeIndex : findColumn(headers, HEADER_ALIASES[key])
    ])
  ) as Record<keyof typeof HEADER_ALIASES, number>;
 
  return matrix
    .slice(1)
    .map((row, index) => {
      const get = (key: keyof typeof indices) => {
        const col = indices[key];
        return col >= 0 ? cellToText(row[col]) : '';
      };
      return {
        amisCode: get('amisCode'),
        productName: get('productName'),
        productionName: get('productionName'),
        sheetWidthM: get('sheetWidthM'),
        sheetLengthM: get('sheetLengthM'),
        rollWidthM: get('rollWidthM'),
        rollLengthM: get('rollLengthM'),
        areaM2: get('areaM2'),
        kgPerLinearM: get('kgPerLinearM'),
        kgPerM2: get('kgPerM2'),
        kgPerSheet: get('kgPerSheet'),
        kgPerRoll: get('kgPerRoll'),
        rowNumber: index + 2
      };
    })
    .filter(row => Boolean(row.amisCode.trim()));
}

export function downloadProductConversionExcelTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...PRODUCT_CONVERSION_EXCEL_HEADERS],
    [
      'AMIS001',
      'Sản phẩm mẫu A',
      'Nhà máy 1',
      '1.08',
      '6',
      '',
      '2',
      '6.48',
      '0.82',
      '',
      '4.92',
      ''
    ],
    [
      'AMIS002',
      'Sản phẩm mẫu B',
      '',
      '1.2',
      '7',
      '',
      '2',
      '8.4',
      '0.95',
      '',
      '6.3',
      ''
    ]
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bang quy doi');
  XLSX.writeFile(workbook, 'mau-bang-quy-doi-san-pham.xlsx');
}
