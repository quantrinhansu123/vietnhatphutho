import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeImportUnit,
  productCatalogRowToPayload,
  type ProductCatalogExcelRow
} from './productCatalogExcel.ts';

function makeRow(patch: Partial<ProductCatalogExcelRow> = {}): ProductCatalogExcelRow {
  return {
    code: '',
    amisCode: '',
    newCode: '',
    name: '',
    productionName: '',
    tenGoc: '',
    doLi: '',
    doLiDm: '',
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
});

test('import: marker 100%NS giữ nguyên text trong hangPhe và ten_ghep', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'SP-NS',
      name: 'SP NS',
      productionName: 'Tấm đặc - 8li - 8m - 100%NS - màng STD',
      group: 'TP; PX Đặc'
    })
  );
  assert.equal(payload.hangPhe, '100%NS');
  assert.ok(String(payload.tenGhep).includes('100%NS'));
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
});
