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
  productionName: ['ten san xuat moi', 'ten san xuat', 'ten_san_xuat', 'production name', 'ten sx'],
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

/** Giữ đủ chữ số từ ô số (raw:true); không lấy format hiển thị Excel (raw:false hay làm tròn). */
function cellToText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Object.is(value, -0)) return '0';
    if (Number.isInteger(value)) return String(value);
    // Bỏ nhiễu float (4.925000000000001) — không Math.round 2dp.
    const precise = value.toPrecision(15);
    if (/e/i.test(precise)) return String(value);
    return precise.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

function findColumn(headers: string[], aliases: string[]) {
  const exact = headers.findIndex(header => aliases.some(alias => header === alias));
  if (exact >= 0) return exact;
  return headers.findIndex(header =>
    aliases.some(alias => alias.length >= 3 && (header.includes(alias) || alias.includes(header)))
  );
}

function sheetHasConversionHeaders(headers: string[]) {
  const hasAmis = findColumn(headers, HEADER_ALIASES.amisCode) >= 0;
  const hasWeight =
    findColumn(headers, HEADER_ALIASES.kgPerSheet) >= 0
    || findColumn(headers, HEADER_ALIASES.kgPerRoll) >= 0
    || findColumn(headers, HEADER_ALIASES.kgPerLinearM) >= 0
    || findColumn(headers, HEADER_ALIASES.kgPerM2) >= 0;
  return hasAmis && hasWeight;
}

function pickConversionSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const preferred = workbook.SheetNames.find(name => {
    const key = normalizeHeader(name);
    return key.includes('quy doi') || key.includes('bang quy doi') || key.includes('import quy doi');
  });
  if (preferred && workbook.Sheets[preferred]) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[preferred], {
      header: 1,
      defval: '',
      raw: true
    }) as unknown[][];
    const headers = (matrix[0] || []).map(normalizeHeader);
    if (sheetHasConversionHeaders(headers)) return workbook.Sheets[preferred];
  }

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true
    }) as unknown[][];
    const headers = (matrix[0] || []).map(normalizeHeader);
    if (sheetHasConversionHeaders(headers)) return sheet;
  }

  return workbook.Sheets[workbook.SheetNames[0]] || null;
}

export async function parseProductConversionExcel(file: File): Promise<ProductConversionExcelRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = pickConversionSheet(workbook);
  if (!sheet) return [];

  // raw:true = giá trị ô thật (không theo format hiển thị 0.00 → làm tròn khi đọc).
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true
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
