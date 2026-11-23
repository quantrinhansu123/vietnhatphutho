import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  PRODUCT_CATALOG_EXCEL_HEADERS,
  buildProductCatalogImportPlan,
  cellToText,
  normalizeImportUnit,
  parseProductCatalogExcel,
  productCatalogRowToPayload,
  resolveImportHangPhe,
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
    doDaiTamTieuChuan: '',
    tcmb: '',
    doDayM: '',
    doDaiM: '',
    mang: '',
    hangPhe: '',
    mau: '',
    giaRe: '',
    tcmn: '',
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

test('cellToText: không dùng toPrecision; giữ thập phân số thường', () => {
  assert.equal(cellToText('1.23456'), '1.23456');
  assert.equal(cellToText(1.23456), '1.23456');
  assert.equal(cellToText(12), '12');
  assert.equal(cellToText(''), '');
});

test('hangPhe: token NP đơn không suy thành hàng nguyên phế', () => {
  assert.equal(
    resolveImportHangPhe({
      productionName: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1.2li - 4m',
      group: 'TP; PX Sóng'
    }),
    ''
  );
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'STS06-1.2li- NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1.2li - 4m',
      group: 'TP; PX Sóng'
    })
  );
  assert.equal(payload.hangPhe, '');
});

test('update: ô trống không đẩy field để tránh xóa giá trị DB', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'SP-KEEP',
      name: 'SP giữ tồn',
      productionName: 'Tấm nhựa đặc màu TRẮNG - STD - 2li - 1.22m - 9m',
      group: 'TP; PX Đặc',
      openingStock: '',
      totalWeight: '',
      hangPhe: ''
    }),
    { forUpdate: true }
  );
  assert.equal('openingStock' in payload, false);
  assert.equal('totalWeight' in payload, false);
  // Có tên SX → ghép lại thông số; hangPhe vẫn chỉ theo marker (không có thì rỗng nhưng có trong payload khi recomposite).
  assert.ok('productionName' in payload);
  assert.equal(payload.hangPhe, '');
});

test('import plan: báo mã trùng trong file và phân loại create/update', () => {
  const plan = buildProductCatalogImportPlan(
    [
      makeRow({ code: 'SP-A', name: 'A1', productionName: 'Tên A1', group: 'TP; PX Đặc', rowNumber: 2 }),
      makeRow({ code: 'SP-A', name: 'A2', productionName: 'Tên A2', group: 'TP; PX Đặc', rowNumber: 3 }),
      makeRow({ code: 'SP-B', name: 'B1', productionName: 'Tên B1', group: 'TP; PX Đặc', rowNumber: 4 })
    ],
    [{ id: '11111111-1111-4111-8111-111111111111', code: 'SP-B', name: 'B cũ', productionName: 'Tên B cũ' }]
  );
  assert.equal(plan.createCount, 1);
  assert.equal(plan.updateCount, 1);
  assert.equal(plan.duplicateCodeGroups.length, 1);
  assert.deepEqual(plan.duplicateCodeGroups[0].rowNumbers, [2, 3]);
  const keptDup = plan.items.find(item => item.code === 'SP-A');
  assert.equal(keptDup?.rowNumber, 3);
  assert.equal(keptDup?.name, 'A2');
  assert.ok(plan.items.some(item => item.action === 'update' && item.warnings.length > 0));
});

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
  assert.equal(payload.doLiDm, '(đm 9.7 li)');
  assert.equal(
    payload.tenGhep,
    'Tấm nhựa đặc màu TRẮNG - STD - 10li - (đm 9.7 li) - 1.22m - 9m'
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

test('import: thiếu Tên gốc thì chỉ lấy loại SP; tên ghép vẫn đủ thông số', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'STS06-1.2li- NP',
      amisCode: 'STS06-1.2li- NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG 1,2LI - 4M',
      group: 'TP; PX Sóng',
      mau: 'TRẮNG'
    })
  );
  assert.equal(payload.tenGoc, 'NHỰA SÓNG');
  assert.equal(payload.doLi, '1.2li');
  assert.equal(payload.tenGhep, 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1.2li - 4m');
  assert.equal(payload.productionName, payload.tenGhep);
});

test('import: tên gốc ghi tay đuôi li trùng độ li thì cắt', () => {
  const payload = productCatalogRowToPayload(
    makeRow({
      code: 'STS06-1.2li- NP',
      amisCode: 'STS06-1.2li- NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG 1,2LI - 4M',
      group: 'TP; PX Sóng',
      tenGoc: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG 1,2LI'
    })
  );
  assert.equal(payload.tenGoc, 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG');
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
    'Tấm nhựa đặc màu XDT - 8ZEM - STD - TCMB - 1.22m - 30m'
  );

  const song = productCatalogRowToPayload(
    makeRow({
      code: 'STS06-13s',
      name: 'Nhựa sóng trắng 13 sóng',
      productionName: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 2m',
      group: 'TP; PX Sóng',
      tenGoc: 'NHỰA SÓNG',
      mau: 'TRẮNG',
      soSong: '13 sóng',
      dinhMucKg: '4,8 kg',
      doDaiTamTieuChuan: '6m'
    })
  );
  assert.equal(song.soSong, '13');
  assert.equal(song.dinhMucKg, '(đm 4.8 kg)');
  assert.equal(song.doDaiTamTieuChuan, '6m');
  assert.equal(song.tenGhep, 'NHỰA SÓNG TRẮNG - NP - 13 SÓNG - (đm 4.8 kg/6m) - 2m');

  const duplicatedKg = productCatalogRowToPayload(
    makeRow({
      code: 'STS02-1.5li-NP',
      amisCode: 'STS02-1.5li-NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG XDT - NP - 11 SÓNG - 1.5li - (đm 12 kg) - (đm 12 kg) - 2.5m',
      group: 'TP; PX Sóng'
    })
  );
  assert.equal(duplicatedKg.doLiDm, '');
  assert.equal(duplicatedKg.dinhMucKg, '(đm 12 kg)');
  assert.equal(
    duplicatedKg.tenGhep,
    'NHỰA SÓNG XDT - NP - 11 SÓNG - 1.5li - (đm 12 kg/6m) - 2.5m'
  );

  const gluedKg = productCatalogRowToPayload(
    makeRow({
      code: 'STS02-1.5li-NP',
      amisCode: 'STS02-1.5li-NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG XDT - NP - 11 SÓNG - 1.5li (đm 12 kg) - 1.5li - (đm 12 kg) - (đm 12 kg) - 6m',
      group: 'TP; PX Sóng'
    })
  );
  assert.equal(gluedKg.doLiDm, '');
  assert.equal(gluedKg.dinhMucKg, '(đm 12 kg)');
  assert.equal(
    gluedKg.tenGhep,
    'NHỰA SÓNG XDT - NP - 11 SÓNG - 1.5li - (đm 12 kg/6m) - 6m'
  );

  const midKg = productCatalogRowToPayload(
    makeRow({
      code: 'STS02-1li-NP',
      amisCode: 'STS02-1li-NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG XDT - NP - 9 SÓNG - 1li - (đm 7.8 kg) 2m - 1li - (đm 7.8 kg) - 2m',
      group: 'TP; PX Sóng'
    })
  );
  assert.equal(midKg.dinhMucKg, '(đm 7.8 kg)');
  assert.equal(midKg.tenGhep, 'NHỰA SÓNG XDT - NP - 9 SÓNG - 1li - (đm 7.8 kg/6m) - 2m');

  const duplicateLi = productCatalogRowToPayload(
    makeRow({
      code: 'STS06-1.5li- NP',
      amisCode: 'STS06-1.5li- NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1.5li - (đm 12 kg) - 1.5li - 2.4m',
      group: 'TP; PX Sóng'
    })
  );
  assert.equal(duplicateLi.tenGhep, 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1.5li - (đm 12 kg/6m) - 2.4m');

  const mixedLi = productCatalogRowToPayload(
    makeRow({
      code: 'STS02-1li-NP',
      amisCode: 'STS02-1li-NP',
      name: 'Tấm nhựa sóng',
      productionName: 'NHỰA SÓNG XDT - NP - 9 SÓNG - 1.5li - 1li - (đm 12 kg) - 6m',
      group: 'TP; PX Sóng'
    })
  );
  assert.equal(mixedLi.doLi, '1li');
  assert.equal(mixedLi.tenGhep, 'NHỰA SÓNG XDT - NP - 9 SÓNG - 1li - (đm 12 kg/6m) - 6m');
});

test('import: đọc đúng header miền nam v2 + Mét dài ĐM / ZEM / Số sóng / TCMB', async () => {
  const headers: string[] = [...PRODUCT_CATALOG_EXCEL_HEADERS];
  const row = headers.map(() => '');
  const set = (header: string, value: string) => {
    const index = headers.indexOf(header);
    assert.ok(index >= 0, `Thiếu header ${header}`);
    row[index] = value;
  };
  set('Mã AMIS', 'SP-HDR');
  set('Tên sản phẩm', 'Sản phẩm header mới');
  set('Tên sản xuất mới', 'Tấm nhựa đặc màu XDT - STD - 2li - 1.22m - 30m');
  set('Loại', 'TP; PX Đặc');
  set('ĐVT', 'Tấm');
  set('Tên gốc', 'Tấm nhựa đặc');
  set('Độ li', '2li');
  set('ZEM', '8');
  set('Số sóng', '11');
  set('ĐM (đm li)', '(đm 1.8 li)');
  set('ĐM (đm kg)', '(đm 4,8 kg)');
  set('Mét dài ĐM (m)', '6m');
  set('TCMB', 'x');
  set('Màu', 'XDT');

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, row]), 'Sản phẩm');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const [parsed] = await parseProductCatalogExcel(
    new File([new Uint8Array(buffer)], 'danh-muc.xlsx')
  );

  assert.equal(parsed.code, 'SP-HDR');
  assert.equal(parsed.amisCode, 'SP-HDR');
  assert.equal(parsed.tenGoc, 'Tấm nhựa đặc');
  assert.equal(parsed.group, 'TP; PX Đặc');
  assert.equal(parsed.unit, 'Tấm');
  assert.equal(parsed.mau, 'XDT');
  assert.equal(parsed.doLi, '2li');
  assert.equal(parsed.zem, '8');
  assert.equal(parsed.soSong, '11');
  assert.equal(parsed.doLiDm, '(đm 1.8 li)');
  assert.equal(parsed.dinhMucKg, '(đm 4,8 kg)');
  assert.equal(parsed.doDaiTamTieuChuan, '6m');
  assert.equal(parsed.tcmb, 'x');
});

test('import: ưu tiên sheet Sản phẩm trong file 2 sheet; Mã AMIS đủ để import', async () => {
  const catalogHeaders = [...PRODUCT_CATALOG_EXCEL_HEADERS];
  const catalogRow = catalogHeaders.map(() => '');
  catalogRow[catalogHeaders.indexOf('Mã AMIS')] = 'STS02-11s';
  catalogRow[catalogHeaders.indexOf('Tên sản phẩm')] = 'Nhựa sóng xanh';
  catalogRow[catalogHeaders.indexOf('Tên sản xuất mới')] = 'NHỰA SÓNG XANH - 11 SÓNG - 6ZEM - (đm 5.2 kg/6m) - 2m';
  catalogRow[catalogHeaders.indexOf('Loại')] = 'TP; PX Sóng';
  catalogRow[catalogHeaders.indexOf('Tên gốc')] = 'NHỰA SÓNG';
  catalogRow[catalogHeaders.indexOf('ĐM (đm kg)')] = '(đm 5.2 kg)';
  catalogRow[catalogHeaders.indexOf('Mét dài ĐM (m)')] = '6m';

  const convHeaders = [
    'Mã amis',
    'Tên sản phẩm',
    'Tên sản xuất',
    'Trọng lượng (kg/Tấm)'
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([catalogHeaders, catalogRow]), 'Sản phẩm');
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([convHeaders, ['STS02-11s', 'Nhựa sóng xanh', 'NHỰA SÓNG XANH', '1.73']]),
    'Import quy doi'
  );
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const rows = await parseProductCatalogExcel(new File([new Uint8Array(buffer)], 'mix.xlsx'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tenGoc, 'NHỰA SÓNG');
  assert.equal(rows[0].dinhMucKg, '(đm 5.2 kg)');
  assert.equal(rows[0].doDaiTamTieuChuan, '6m');
});
