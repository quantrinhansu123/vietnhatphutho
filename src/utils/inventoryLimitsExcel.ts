import * as XLSX from 'xlsx';

export type InventoryLimitExcelRow = {
  ma_amis: string;
  ten_san_xuat: string;
  don_vi: string;
  ton_kho_toi_thieu: string;
  ton_kho_toi_da: string;
  thang: string;
  nam: string;
};

// Header aliases (normalized: no diacritics, lowercase)
const MA_AMIS_HEADERS  = ['ma amis', 'ma_amis', 'maamis', 'amis'];
const TEN_SX_HEADERS   = ['ten san xuat', 'ten_san_xuat', 'tensanxuat', 'ten sx'];
const DON_VI_HEADERS   = ['don vi', 'don_vi', 'donvi', 'unit'];
const MIN_HEADERS      = ['ton kho toi thieu', 'ton_kho_toi_thieu', 'toi thieu', 'min'];
const MAX_HEADERS      = ['ton kho toi da', 'ton_kho_toi_da', 'toi da', 'max'];
const THANG_HEADERS    = ['thang', 'month'];
const NAM_HEADERS      = ['nam', 'year'];

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function findCol(headers: string[], aliases: string[]): number {
  return headers.findIndex(h => aliases.some(a => h === a || h.includes(a)));
}

export async function parseInventoryLimitsExcel(file: File): Promise<InventoryLimitExcelRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (matrix.length < 2) return [];

  const firstRow = matrix[0].map(c => normalizeHeader(c));
  const colMa    = findCol(firstRow, MA_AMIS_HEADERS);
  const colTen   = findCol(firstRow, TEN_SX_HEADERS);
  const colDv    = findCol(firstRow, DON_VI_HEADERS);
  const colMin   = findCol(firstRow, MIN_HEADERS);
  const colMax   = findCol(firstRow, MAX_HEADERS);
  const colThang = findCol(firstRow, THANG_HEADERS);
  const colNam   = findCol(firstRow, NAM_HEADERS);

  const hasHeader = colMa >= 0 && colMin >= 0 && colMax >= 0 && colThang >= 0 && colNam >= 0;

  if (hasHeader) {
    return matrix
      .slice(1)
      .map(row => ({
        ma_amis:           cellToText(row[colMa]),
        ten_san_xuat:      colTen >= 0 ? cellToText(row[colTen]) : '',
        don_vi:            colDv  >= 0 ? cellToText(row[colDv])  : 'Tam',
        ton_kho_toi_thieu: cellToText(row[colMin]),
        ton_kho_toi_da:    cellToText(row[colMax]),
        thang:             cellToText(row[colThang]),
        nam:               cellToText(row[colNam]),
      }))
      .filter(r => r.ma_amis && r.thang && r.nam);
  }

  // Fallback positional: A=Ma Amis, B=Ten sx, C=Don vi, D=Min, E=Max, F=Thang, G=Nam
  return matrix
    .slice(1)
    .map(row => ({
      ma_amis:           cellToText(row[0]),
      ten_san_xuat:      cellToText(row[1]),
      don_vi:            cellToText(row[2]) || 'Tam',
      ton_kho_toi_thieu: cellToText(row[3]),
      ton_kho_toi_da:    cellToText(row[4]),
      thang:             cellToText(row[5]),
      nam:               cellToText(row[6]),
    }))
    .filter(r => r.ma_amis && r.thang && r.nam);
}

export function downloadInventoryLimitsTemplate() {
  const year = new Date().getFullYear();

  const H_MA    = 'Ma Amis';
  const H_TEN   = 'Ten san xuat';
  const H_DV    = 'Don vi';
  const H_MIN   = 'Ton kho toi thieu';
  const H_MAX   = 'Ton kho toi da';
  const H_THANG = 'Thang';
  const H_NAM   = 'Nam';

  const sampleRows = [
    { [H_MA]: 'SP001', [H_TEN]: 'Tam lop mau do', [H_DV]: 'Tam',  [H_MIN]: 100, [H_MAX]: 500, [H_THANG]: 1, [H_NAM]: year },
    { [H_MA]: 'SP002', [H_TEN]: 'Cuon ton trang', [H_DV]: 'Cuon', [H_MIN]: 10,  [H_MAX]: 50,  [H_THANG]: 1, [H_NAM]: year },
  ];

  const headers = [H_MA, H_TEN, H_DV, H_MIN, H_MAX, H_THANG, H_NAM];
  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  worksheet['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 8 }, { wch: 8 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ton_kho');
  XLSX.writeFile(workbook, 'mau-ton-kho-toi-thieu-toi-da.xlsx');
}
