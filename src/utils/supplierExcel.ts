import * as XLSX from 'xlsx';

export type SupplierExcelRow = {
  code: string;
  name: string;
  address: string;
  debt: string;
  taxCode: string;
  invoiceRisk: string;
  referenceDoc: string;
  phone: string;
  isInternal: string;
  isGroup: string;
  rowNumber: number;
};

export type SupplierExcelExportRow = {
  code: string;
  name: string;
  address: string;
  debt: number;
  taxCode: string;
  invoiceRisk: string;
  referenceDoc: string;
  phone: string;
  isInternal: boolean;
  isGroup: boolean;
};

const CODE_HEADERS = ['ma nha cung cap', 'ma ncc', 'ma_nha_cung_cap', 'ma_ncc', 'ma', 'code'];
const NAME_HEADERS = ['ten nha cung cap', 'ten ncc', 'ten_nha_cung_cap', 'ten_ncc', 'ten', 'name'];
const ADDRESS_HEADERS = ['dia chi', 'dia_chi', 'address'];
const DEBT_HEADERS = ['so tien no', 'so_tien_no', 'tien no', 'cong no', 'cong_no', 'debt'];
const TAX_CODE_HEADERS = [
  'ma so thue/cccd chu ho',
  'ma so thue cccd chu ho',
  'ma so thue cccd',
  'ma so thue',
  'ma_so_thue_cccd',
  'ma_so_thue',
  'cccd',
  'tax code'
];
const INVOICE_RISK_HEADERS = ['rui ro ve hoa don', 'rui ro hoa don', 'rui_ro_hoa_don', 'rui ro', 'risk'];
const REFERENCE_HEADERS = [
  'van ban tham chieu',
  'van_ban_tham_chieu',
  'tham chieu',
  'van ban',
  'reference'
];
const PHONE_HEADERS = ['dien thoai', 'so dien thoai', 'dien_thoai', 'so_dien_thoai', 'sdt', 'phone'];
const IS_INTERNAL_HEADERS = ['la doi tuong noi bo', 'la_doi_tuong_noi_bo', 'doi tuong noi bo', 'noi bo'];
const IS_GROUP_HEADERS = [
  'la tong cong ty/chi nhanh',
  'la tong cong ty chi nhanh',
  'la_tong_cong_ty_chi_nhanh',
  'tong cong ty',
  'chi nhanh',
  'tong cong ty/chi nhanh'
];

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function cellToText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function findColumn(headers: string[], aliases: string[]) {
  const exact = headers.findIndex(header => aliases.some(alias => header === alias));
  if (exact >= 0) return exact;
  return headers.findIndex(header =>
    aliases.some(alias => alias.length >= 4 && (header.includes(alias) || alias.includes(header)))
  );
}

export async function parseSupplierExcel(file: File): Promise<SupplierExcelRow[]> {
  const isCsv = /\.csv$/i.test(file.name || '');
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false
  }) as unknown[][];
  if (matrix.length === 0) return [];

  const headers = matrix[0].map(normalizeHeader);
  const codeIndex = findColumn(headers, CODE_HEADERS);
  const nameIndex = findColumn(headers, NAME_HEADERS);
  if (nameIndex < 0) {
    throw new Error('Không tìm thấy cột "Tên nhà cung cấp" trong file (Excel/CSV).');
  }

  const addressIndex = findColumn(headers, ADDRESS_HEADERS);
  const debtIndex = findColumn(headers, DEBT_HEADERS);
  const taxCodeIndex = findColumn(headers, TAX_CODE_HEADERS);
  const invoiceRiskIndex = findColumn(headers, INVOICE_RISK_HEADERS);
  const referenceIndex = findColumn(headers, REFERENCE_HEADERS);
  const phoneIndex = findColumn(headers, PHONE_HEADERS);
  const isInternalIndex = findColumn(headers, IS_INTERNAL_HEADERS);
  const isGroupIndex = findColumn(headers, IS_GROUP_HEADERS);

  return matrix
    .slice(1)
    .map((row, index) => ({
      code: codeIndex >= 0 ? cellToText(row[codeIndex]) : '',
      name: cellToText(row[nameIndex]),
      address: addressIndex >= 0 ? cellToText(row[addressIndex]) : '',
      debt: debtIndex >= 0 ? cellToText(row[debtIndex]) : '',
      taxCode: taxCodeIndex >= 0 ? cellToText(row[taxCodeIndex]) : '',
      invoiceRisk: invoiceRiskIndex >= 0 ? cellToText(row[invoiceRiskIndex]) : '',
      referenceDoc: referenceIndex >= 0 ? cellToText(row[referenceIndex]) : '',
      phone: phoneIndex >= 0 ? cellToText(row[phoneIndex]) : '',
      isInternal: isInternalIndex >= 0 ? cellToText(row[isInternalIndex]) : '',
      isGroup: isGroupIndex >= 0 ? cellToText(row[isGroupIndex]) : '',
      rowNumber: index + 2
    }))
    .filter(
      row =>
        row.code ||
        row.name ||
        row.address ||
        row.debt ||
        row.taxCode ||
        row.invoiceRisk ||
        row.referenceDoc ||
        row.phone ||
        row.isInternal ||
        row.isGroup
    );
}

export const parseSupplierFile = parseSupplierExcel;

const TEMPLATE_HEADERS = [
  'Mã nhà cung cấp',
  'Tên nhà cung cấp',
  'Địa chỉ',
  'Số tiền nợ',
  'Mã số thuế/CCCD chủ hộ',
  'Rủi ro về hóa đơn',
  'Văn bản tham chiếu',
  'Điện thoại',
  'Là đối tượng nội bộ',
  'Là Tổng công ty/chi nhánh'
];

export function downloadSupplierExcelTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ['NCC001', 'Công ty mẫu', 'Địa chỉ mẫu', '', '', '', '', '', 'Không', 'Không'],
    ['NCC002', 'Nhà cung cấp để trống các cột còn lại', '', '', '', '', '', '', '', '']
  ]);
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 36 },
    { wch: 40 },
    { wch: 16 },
    { wch: 26 },
    { wch: 28 },
    { wch: 28 },
    { wch: 22 },
    { wch: 20 },
    { wch: 26 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Nha_cung_cap');
  XLSX.writeFile(workbook, 'mau-nhap-nha-cung-cap.xlsx');
}

export function downloadSupplierExcel(suppliers: SupplierExcelExportRow[]) {
  const rows = suppliers.map(supplier => ({
    'Mã nhà cung cấp': supplier.code,
    'Tên nhà cung cấp': supplier.name,
    'Địa chỉ': supplier.address,
    'Số tiền nợ': supplier.debt,
    'Mã số thuế/CCCD chủ hộ': supplier.taxCode,
    'Rủi ro về hóa đơn': supplier.invoiceRisk,
    'Văn bản tham chiếu': supplier.referenceDoc,
    'Điện thoại': supplier.phone,
    'Là đối tượng nội bộ': supplier.isInternal ? 'Có' : 'Không',
    'Là Tổng công ty/chi nhánh': supplier.isGroup ? 'Có' : 'Không'
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 36 },
    { wch: 40 },
    { wch: 16 },
    { wch: 26 },
    { wch: 28 },
    { wch: 28 },
    { wch: 22 },
    { wch: 20 },
    { wch: 26 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Nha_cung_cap');
  XLSX.writeFile(workbook, 'danh-sach-nha-cung-cap.xlsx');
}

export function downloadSupplierCsvTemplate() {
  const escapeCsvCell = (value: string | number) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    TEMPLATE_HEADERS.join(','),
    ['NCC001', 'Công ty mẫu', '', '', '', '', '', '', 'Không', 'Không'].map(escapeCsvCell).join(','),
    ['NCC002', 'Nhà cung cấp để trống các cột còn lại', '', '', '', '', '', '', '', ''].map(escapeCsvCell).join(',')
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mau-nhap-nha-cung-cap.csv';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
