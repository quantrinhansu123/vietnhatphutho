import XLSX from 'xlsx';
const path = './MASTER DATA - NHÀ MÁY PHÚ THỌ-v3-7.8.xlsx - DM_SAN_PHAM.csv';
const workbook = XLSX.readFile(path, { raw: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
const normalizeHeader = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[_\/-]+/g, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ');
const headerRowIndex = matrix.findIndex(row => Array.isArray(row) && row.some(cell => String(cell ?? '').trim() !== ''));
const headers = (matrix[headerRowIndex] || []).map(normalizeHeader);
// emulate findColumn
const findColumn = (headers, aliases) => {
  const exact = headers.findIndex(header => aliases.some(alias => header === alias));
  if (exact >= 0) return exact;
  return headers.findIndex(header => aliases.some(alias => alias.length >= 4 && (header.includes(alias) || alias.includes(header))));
};
const HEADER_ALIASES = {
  code: ['ma sp', 'ma_sp', 'ma san pham', 'code'],
  amisCode: ['ma amis', 'ma_amis', 'amis'],
  newCode: ['ma moi', 'ma_sp_moi', 'ma sp moi'],
  name: ['ten san pham', 'ten_sp', 'ten sp', 'name'],
  productionName: ['ten san xuat', 'ten_san_xuat', 'production name'],
  unit: ['don vi tinh', 'don_vi', 'don vi', 'unit'],
  wastePercent: ['% ty le hao hut', 'ty le hao hut', 'ty_le_hao_hut', 'hao hut', 'waste percent']
};
const indices = {
  code: findColumn(headers, HEADER_ALIASES.code),
  amisCode: findColumn(headers, HEADER_ALIASES.amisCode),
  newCode: findColumn(headers, HEADER_ALIASES.newCode),
  name: findColumn(headers, HEADER_ALIASES.name),
  productionName: findColumn(headers, HEADER_ALIASES.productionName),
  unit: findColumn(headers, HEADER_ALIASES.unit),
  wastePercent: findColumn(headers, HEADER_ALIASES.wastePercent)
};
console.log('indices', indices);
const rows = matrix.slice(headerRowIndex+1);
let failures = 0;
for (let i=0;i<rows.length;i++){
  const row = rows[i];
  const rawWaste = (indices.wastePercent>=0? String(row[indices.wastePercent]||'') : '').trim();
  if (rawWaste && !/^(?:\d{1,2}(?:[.,]\d{1,2})?|100(?:[.,]0{1,2})?)$/.test(rawWaste)) {
    failures++;
  }
}
console.log('total rows:', rows.length, 'waste failures:', failures);
