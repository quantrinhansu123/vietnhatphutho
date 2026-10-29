import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  PRODUCT_CATALOG_EXCEL_HEADERS,
  normalizeImportUnit,
  parseProductCatalogExcel,
  productCatalogRowToPayload,
  type ProductCatalogExcelRow
} from './productCatalogExcel.ts';

function makeRow(patch: Partial<ProductCatalogExcelRow> = {}): ProductCatalogExcelRow {
  return {
    code: '',
    amisCode: '',
    amisOldCode: '',
    newCode: '',
    name: '',
    productionName: '',
    tenGoc: '',
    doLi: '',
    doLiDm: '',
    zem: '',
    soSong: '',
    dinhMucKg: '',
    tcmb: '',
    doDayM: '',
    doDaiM: '',
    mang: '',
    hangPhe: '',
    nature: '',
    group: '',
    unit: '',
    totalWeight: '',
    wastePercent: '',
    rollWidth: '',
    rollLength: '',
    coreWeight: '',
    bagWeight: '',
    plasticWeight: '',
    openingStock: '',
    inbound: '',
    outbound: '',
    stock: '',
    minStock: '',
    origin: '',
    description: '',
    rowNumber: 2,
    ...patch
  };
}

test('normalizeImportUnit: CUỘN, TẤM về Tấm', () => {
  assert.equal(normalizeImportUnit('CUỘN, TẤM'), 'Tấm');
  assert.equal(normalizeImportUnit('Tấm, cuộn'), 'Tấm');
  assert.equal(normalizeImportUnit('kg'), 'kg');
  assert.equal(normalizeImportUnit(''), '');
});

test('import: độ li chứa KG thì bỏ, dùng suy từ tên SX', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'SP-KG',
      name: 'SP KG',
      productionName: 'Tấm đặc - 8li - 8m - 2.1m - ECO',
      group: 'TP; PX Đặc',
      doLi: '4,8KG'
    })
  );
  assert.equal(payload.doLi, '8li');
});

test('import: ĐVT CUỘN, TẤM về Tấm và tính ten_ghep', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'SP-U',
      name: 'SP U',
      productionName: 'Tấm nhựa đặc màu TRẮNG - 10li ( đm 9,7 li ) - 9m - 1,22m - STD',
      group: 'TP; PX Đặc',
      unit: 'CUỘN, TẤM'
    })
  );
  assert.equal(payload.unit, 'Tấm');
  assert.equal(payload.doLiDm, '(đm 9,7 li)');
  assert.equal(
    payload.tenGhep,
    'Tấm nhựa đặc màu TRẮNG - STD - 10li - (đm 9,7 li) - 1.22m - 9m'
  );
  assert.equal(payload.productionName, payload.tenGhep);
});

test('import: marker 100%NS chuẩn hóa về 100% NS trong hangPhe và ten_ghep', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'SP-NS',
      name: 'SP NS',
      productionName: 'Tấm đặc - 8li - 8m - 100%NS - màng STD',
      group: 'TP; PX Đặc'
    })
  );
  assert.equal(payload.hangPhe, '100% NS');
  assert.ok(String(payload.tenGhep).includes('100% NS'));
});

test('import: Rỗng bỏ 2.1m khỏi tên ghép nhưng vẫn lưu doDayM', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'ECR05-4.5li-6m',
      amisCode: 'ECR05-4.5li-6m',
      name: 'Tấm nhựa rỗng màu trà',
      productionName: 'Tấm nhựa rỗng màu trà - 4.5li x 2.1m x 6m - màng ECO',
      group: 'TP; PX Rỗng',
      unit: 'Tấm'
    })
  );
  assert.equal(payload.doDayM, '2.1m');
  assert.equal(payload.doDaiM, '6m');
  assert.equal(payload.tenGhep, 'Tấm nhựa rỗng màu trà - ECO - 4.5li - 6m');
  assert.equal(payload.productionName, payload.tenGhep);
});

test('import: tên gốc đuôi li trùng độ li thì cắt, tên ghép hết trùng', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'STS06-1.2li- NP',
      amisCode: 'STS06-1.2li- NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG 1,2LI - 4M',
      group: 'TP; PX Sóng'
    })
  );
  assert.equal(payload.tenGoc, 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG');
  assert.equal(payload.doLi, '1.2li');
  assert.equal(payload.tenGhep, 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1.2li - 4m');
  assert.equal(payload.productionName, payload.tenGhep);
});

test('import: cột ZEM / Số sóng / ĐM kg / TCMB ghép đúng vị trí', () => {
  const dac = productCatalogRowToPayload(
    makeRow({
      code: 'SP-ZEM',
      name: 'Tấm nhựa đặc màu XDT 8ZEM',
      productionName: 'Tấm nhựa đặc màu XDT - STD - 2li - 1.22m - 30m',
      group: 'TP; PX Đặc',
      doLi: '2li',
      doLiDm: '(đm 1.8 li)',
      zem: '8',
      tcmb: 'x'
    })
  );
  assert.equal(dac.zem, '8ZEM');
  assert.equal(dac.tcmb, true);
  // Hàng ZEM: không ghép độ li / đm-li vào tên (ZEM thay độ li).
  assert.equal(
    dac.tenGhep,
    'Tấm nhựa đặc màu XDT 8ZEM - STD - TCMB - 1.22m - 30m'
  );

  const song = productCatalogRowToPayload(
    makeRow({
      code: 'STS06-13s',
      name: 'Nhựa sóng trắng 13 sóng',
      productionName: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 2m',
      group: 'TP; PX Sóng',
      soSong: '13 sóng',
      dinhMucKg: '4,8 kg'
    })
  );
  assert.equal(song.soSong, '13');
  assert.equal(song.dinhMucKg, '(đm 4.8 kg)');
  assert.equal(song.tenGhep, 'NHỰA SÓNG TRẮNG - NP - 13 SÓNG - (đm 4.8 kg) - 2m');
});

test('import: đọc đúng header mới ĐM (đm li) / ĐM (đm kg) / ZEM / Số sóng / TCMB', async () => {
  const headers: string[] = [...PRODUCT_CATALOG_EXCEL_HEADERS];
  const row = headers.map(() => '');
  const set = (header: string, value: string) => {
    const index = headers.indexOf(header);
    assert.ok(index >= 0, `Thiếu header ${header}`);
    row[index] = value;
  };
  set('Mã SP', 'SP-HDR');
  set('Tên sản phẩm', 'Sản phẩm header mới');
  set('Tên sản xuất', 'Tấm nhựa đặc màu XDT - STD - 2li - 1.22m - 30m');
  set('Độ li', '2li');
  set('ZEM', '8');
  set('Số sóng', '11');
  set('ĐM (đm li)', '(đm 1.8 li)');
  set('ĐM (đm kg)', '(đm 4,8 kg)');
  set('TCMB', 'x');
  set('Nhóm', 'TP; PX Đặc');

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, row]), 'San_pham');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const [parsed] = await parseProductCatalogExcel(
    new File([new Uint8Array(buffer)], 'danh-muc.xlsx')
  );

  assert.equal(parsed.doLi, '2li');
  assert.equal(parsed.zem, '8');
  assert.equal(parsed.soSong, '11');
  assert.equal(parsed.doLiDm, '(đm 1.8 li)');
  assert.equal(parsed.dinhMucKg, '(đm 4,8 kg)');
  assert.equal(parsed.tcmb, 'x');
});
