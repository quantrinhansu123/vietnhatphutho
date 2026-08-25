import XLSX from 'xlsx';
import fs from 'fs';
const path = './MASTER DATA - NHÀ MÁY PHÚ THỌ-v3-7.8.xlsx - DM_SAN_PHAM.csv';
const workbook = XLSX.readFile(path, { raw: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
const headerRowIndex = matrix.findIndex(row => Array.isArray(row) && row.some(cell => String(cell ?? '').trim() !== ''));
console.log('matrix rows:', matrix.length, 'headerRowIndex:', headerRowIndex);
if (headerRowIndex >= 0) {
  const normalizeHeader = v => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[_\/-]+/g, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ');
  const headers = matrix[headerRowIndex].map(normalizeHeader);
  console.log('headers sample:', headers.slice(0, 20));
  // find index of wastePercent alias like 'ty le hao hut' or '% ty le hao hut'
  const wasteAliases = ['% ty le hao hut', 'ty le hao hut', 'ty_le_hao_hut', 'hao hut', 'waste percent'];
  const findColumn = (headers, aliases) => {
    const exact = headers.findIndex(header => aliases.some(alias => header === alias));
    if (exact >= 0) return exact;
    return headers.findIndex(header => aliases.some(alias => alias.length >= 4 && (header.includes(alias) || alias.includes(header))));
  };
  const wasteIndex = findColumn(headers, wasteAliases);
  console.log('wasteIndex:', wasteIndex);
  // show first data row
  const dataRow = matrix[headerRowIndex+1];
  console.log('first data row sample (first 20 cols):', dataRow.slice(0,20));
  console.log('waste value:', wasteIndex>=0 ? dataRow[wasteIndex] : '<not found>');
}
