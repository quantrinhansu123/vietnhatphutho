import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import {
  MATERIAL_CATALOG_EXCEL_HEADERS,
  materialCatalogRowToPayload,
  parseMaterialCatalogExcel,
  type MaterialCatalogExcelRow
} from './materialCatalogExcel.ts';

test('mẫu Excel kho NVL có cột Nhóm vật tư phụ và không có cột Trọng lượng kg/1 sản phẩm', () => {
  assert.ok(MATERIAL_CATALOG_EXCEL_HEADERS.includes('Nhóm vật tư phụ'));
  assert.ok(!MATERIAL_CATALOG_EXCEL_HEADERS.includes('Trọng lượng kg/1 sản phẩm' as any));
});

test('payload import giữ nhóm vật tư phụ', () => {
  const row: MaterialCatalogExcelRow = {
    code: ' NPL-001 ',
    name: ' Băng dính ',
    productionName: '',
    unit: ' cuộn ',
    phanLoai: ' Nguyên vật liệu phụ ',
    auxiliaryMaterialGroup: ' Băng Dính ',
    totalWeight: '',
    plasticWeight: '',
    bagWeight: '',
    coreWeight: '',
    rollWidth: '',
    unitLength: '',
    openingStock: '',
    inbound: '',
    outbound: '',
    rowNumber: 2
  };

  const payload = materialCatalogRowToPayload(row);
  assert.equal(payload.auxiliaryMaterialGroup, 'Băng Dính');
});

test('đọc được tiêu đề DB nhom_vat_tu_phu khi import', async () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['ma_npl', 'ten_npl', 'nhom_vat_tu_phu'],
    ['NPL-002', 'Tem nhãn', 'Tem']
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kho_NVL');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = { arrayBuffer: async () => bytes } as File;

  const rows = await parseMaterialCatalogExcel(file);
  assert.equal(rows[0]?.auxiliaryMaterialGroup, 'Tem');
});

test('đọc được nhóm vật tư phụ Bạt Bọc khi import Excel', async () => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Mã NPL', 'Tên nguyên vật liệu', 'Nhóm vật tư phụ'],
    ['BATBOC', 'Bạt bọc hàng', 'Bạt Bọc']
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kho_NVL');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = { arrayBuffer: async () => bytes } as File;

  const rows = await parseMaterialCatalogExcel(file);
  assert.equal(rows[0]?.code, 'BATBOC');
  assert.equal(rows[0]?.auxiliaryMaterialGroup, 'Bạt Bọc');
  const payload = materialCatalogRowToPayload(rows[0]);
  assert.equal(payload.auxiliaryMaterialGroup, 'Bạt Bọc');
});
