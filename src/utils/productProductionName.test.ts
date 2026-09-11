import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDoLiDm,
  classifyProductPxGroup,
  parseAmisSpecs,
  parseSongLengthMeters,
  parseProductionNameParts,
  composeProductionDisplayName,
  seedProductionSpecs,
  buildOrderTenGhep,
  replaceCutLengthMeters
} from './productProductionName.ts';

test('extractDoLiDm bắt (đm n li) và bỏ (đm …kg)', () => {
  assert.equal(extractDoLiDm('Tấm nhựa đặc - 6li ( đm 5.7 li ) - ECO'), '(đm 5.7 li)');
  assert.equal(extractDoLiDm('…(đm5.7li)…'), '(đm 5.7 li)');
  assert.equal(extractDoLiDm('…(đm 9,7 li)…'), '(đm 9,7 li)');
  assert.equal(extractDoLiDm('NHỰA SÓNG ( ĐM 7,8KG ) - 2M'), null);
  assert.equal(extractDoLiDm('…( đm 5kg )…'), null);
});

test('classifyProductPxGroup theo nhom_vthh', () => {
  assert.equal(classifyProductPxGroup('TP; PX Đặc'), 'dac');
  assert.equal(classifyProductPxGroup('TP; PX Sóng'), 'song');
  assert.equal(classifyProductPxGroup('TP; PX Rỗng'), 'rong');
});

test('parseAmisSpecs đọc li*m và zem', () => {
  assert.deepEqual(parseAmisSpecs('STD09-5.0li*1.52m(KT)'), {
    doLi: '5.0li',
    doDayM: '1.52m',
    zem: ''
  });
  assert.equal(parseAmisSpecs('STS02-11s-6zem').zem, '6ZEM');
});

test('Đặc: ưu tiên 8/9/20/30m làm m dài', () => {
  const a = parseProductionNameParts(
    'Tấm nhựa đặc màu TRẮNG - 8li ( đm 7.7 li ) - 8m - 2.1m - ECO',
    'TP; PX Đặc'
  );
  assert.equal(a.doLi, '8li');
  assert.equal(a.doLiDm, '(đm 7.7 li)');
  assert.equal(a.doDayM, '2.1m');
  assert.equal(a.doDaiM, '8m');
  assert.equal(a.mang, 'ECO');

  const b = parseProductionNameParts(
    'Tấm nhựa đặc màu KHUẾCH TÁN - 10li ( đm 9.7 li ) - 9m - 1.56m - ECO',
    'TP; PX Đặc'
  );
  assert.equal(b.doDayM, '1.56m');
  assert.equal(b.doDaiM, '9m');

  const c = parseProductionNameParts(
    'Tấm nhựa đặc màu TRẮNG - 5li ( đm 4.7 li ) - 2.1m - 30m hàng 100% NS Off - STD',
    'TP; PX Đặc'
  );
  assert.equal(c.doDayM, '2.1m');
  assert.equal(c.doDaiM, '30m');

  const d = parseProductionNameParts(
    'Tấm nhựa đặc màu TRẮNG - 6li ( đm 5.7 li ) - 20m - 2.1m - STD',
    'TP; PX Đặc'
  );
  assert.equal(d.doDaiM, '20m');
  assert.equal(d.doDayM, '2.1m');
});

test('Đặc: li x khổ — không có m dài', () => {
  const parts = parseProductionNameParts(
    'Tấm nhựa đặc màu trắng sứ - 2.6li x 1.22m - STD',
    'TP; PX Đặc',
    'STD01-2.6li*1.22m'
  );
  assert.equal(parts.doLi, '2.6li');
  assert.equal(parts.doDayM, '1.22m');
  assert.equal(parts.doDaiM, '');
  assert.equal(parts.mang, 'STD');
});

test('Sóng: mét dài đúng theo tên SX (không max)', () => {
  assert.equal(parseSongLengthMeters('NHỰA 11 SÓNG XANH 6ZEM -6M'), 6);
  assert.equal(
    parseSongLengthMeters('NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - 3,5M ( GIÁ RẺ )'),
    3.5
  );

  const short = seedProductionSpecs({
    tenSanXuat: 'NHỰA 11 SÓNG XANH 6ZEM -2M',
    maAmis: 'STS02-11s-6zem',
    nhomVthh: 'TP; PX Sóng'
  });
  assert.equal(short.tenGoc, 'NHỰA 11 SÓNG XANH 6ZEM');
  assert.equal(short.doLi, '6ZEM');
  assert.equal(short.doDaiM, '2m');

  const kgName = parseProductionNameParts(
    'NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - 3,5M ( GIÁ RẺ )',
    'TP; PX Sóng'
  );
  assert.equal(kgName.doDaiM, '3.5m');
  assert.equal(kgName.doLi, '');
});

test('Rỗng: li x khổ x dài', () => {
  const a = parseProductionNameParts(
    'Tấm nhựa rỗng màu trắng trong - 4.2li x 2.1m x 6m hàng 100% phế - màng STD',
    'TP; PX Rỗng'
  );
  assert.equal(a.doDayM, '2.1m');
  assert.equal(a.doDaiM, '6m');
  assert.equal(a.mang, 'STD');

  const b = parseProductionNameParts(
    'Tấm nhựa rỗng màu trắng trong - 6li x 2.1m x 5.8m - màng ECO',
    'TP; PX Rỗng'
  );
  assert.equal(b.doDaiM, '5.8m');
  assert.equal(b.mang, 'ECO');

  const c = parseProductionNameParts(
    'Tấm nhựa rỗng màu XDT - 4.5li x 2.1m x 5.8m chạy 100% phế - màng LUX',
    'TP; PX Rỗng'
  );
  assert.equal(c.doDaiM, '5.8m');
  assert.equal(c.mang, 'LUX');
  assert.ok(c.hangPhe.includes('phế'));
});

test('compose: độ dày trước, mét dài luôn cuối', () => {
  const name = composeProductionDisplayName(
    {
      tenGoc: 'Tấm nhựa đặc màu TRẮNG',
      doLi: '8li',
      doLiDm: '(đm 7.7 li)',
      doDayM: '1.56m',
      doDaiM: '9m',
      mang: 'STD',
      hangPhe: ''
    },
    'TP; PX Đặc'
  );
  assert.equal(
    name,
    'Tấm nhựa đặc màu TRẮNG - STD - 8li - (đm 7.7 li) - 1.56m - 9m'
  );
  assert.ok(name.endsWith('9m'));

  const song = composeProductionDisplayName(
    { tenGoc: 'NHỰA 11 SÓNG XANH 6ZEM', doLi: '6ZEM', doDaiM: '6m' },
    'TP; PX Sóng'
  );
  assert.equal(song, 'NHỰA 11 SÓNG XANH 6ZEM - 6ZEM - 6m');
});

test('buildOrderTenGhep: cắt lẻ thay mét dài cuối', () => {
  const sx = 'Tấm nhựa đặc màu TRẮNG - 10li ( đm 9,7 li ) - 9m - 1,22m - STD';
  assert.equal(
    buildOrderTenGhep(sx, { nhomVthh: 'TP; PX Đặc' }),
    'Tấm nhựa đặc màu TRẮNG - STD - 10li - (đm 9,7 li) - 1.22m - 9m'
  );
  assert.equal(
    buildOrderTenGhep(sx, { nhomVthh: 'TP; PX Đặc', cutLengthM: 3 }),
    'Tấm nhựa đặc màu TRẮNG - STD - 10li - (đm 9,7 li) - 1.22m - 3m'
  );
});

test('hàng phế: chỉ khi tên SX ghi rõ, không suy diễn từ NP/mã AMIS', () => {
  const seed = (tenSanXuat: string, maAmis = '', nhomVthh = 'TP; PX Sóng') =>
    seedProductionSpecs({ tenSanXuat, maAmis, nhomVthh });

  // Token NP trong tên hoặc mã AMIS không còn gán hàng phế.
  assert.equal(seed('NHỰA 11 SÓNG XANH 6ZEM -2M', 'STS02-11s-6zem').hangPhe, '');
  assert.equal(seed('Màng PE - NP - 2m', 'STD01-NP-2m', 'TP; PX Đặc').hangPhe, '');
  assert.ok(!seed('NHỰA 11 SÓNG XANH 6ZEM -2M', 'STS02-11s-6zem').tenGhep.includes('phế'));

  // Cụm ghi rõ trong tên vẫn nhận + chuẩn hóa.
  assert.equal(
    seed('Tấm nhựa rỗng - 4.5li x 2.1m x 5.8m chạy 100% phế - màng LUX', '', 'TP; PX Rỗng').hangPhe,
    'hàng chạy 100% phế'
  );
  assert.equal(
    seed('Tấm đặc - 8li - 8m - hàng 100% NS Off', '', 'TP; PX Đặc').hangPhe,
    'hàng 100% NS Off'
  );
  assert.equal(
    seed('Tấm đặc - 8li - 8m - hàng nguyên phế', '', 'TP; PX Đặc').hangPhe,
    'hàng nguyên phế'
  );
  assert.ok(
    seed('Tấm đặc - 8li - 8m - hàng nguyên phế', '', 'TP; PX Đặc').tenGhep.includes('hàng nguyên phế')
  );
  // Marker 100%NS giữ nguyên text, không chuẩn hóa.
  assert.equal(seed('Tấm đặc - 8li - 8m - 100%NS - màng STD', '', 'TP; PX Đặc').hangPhe, '100%NS');
  assert.ok(
    seed('Tấm đặc - 8li - 8m - 100%NS - màng STD', '', 'TP; PX Đặc').tenGhep.includes('100%NS')
  );
  // Hàng tiêu chuẩn.
  assert.equal(seed('Tấm đặc - 8li - 8m - hàng tiêu chuẩn', '', 'TP; PX Đặc').hangPhe, 'hàng tiêu chuẩn');
  assert.ok(
    seed('Tấm đặc - 8li - 8m - hàng tiêu chuẩn', '', 'TP; PX Đặc').tenGhep.includes('hàng tiêu chuẩn')
  );
});

test('ZEM lẫn trong tên gốc thì không phải độ li — ưu tiên li tường minh', () => {
  const seeded = seedProductionSpecs({
    tenSanXuat: 'Tấm nhựa đặc màu TRẮNG 8ZEM - hàng tiêu chuẩn - STD - 0.8li - 1.22m - 30m',
    maAmis: '',
    nhomVthh: 'TP; PX Đặc'
  });
  assert.equal(seeded.doLi, '0.8li');
  assert.equal(
    seeded.tenGhep,
    'Tấm nhựa đặc màu TRẮNG 8ZEM - hàng tiêu chuẩn - STD - 0.8li - 1.22m - 30m'
  );
  // Không có li tường minh thì ZEM vẫn làm độ li (Sóng).
  assert.equal(
    seedProductionSpecs({ tenSanXuat: 'NHỰA 11 SÓNG XANH 6ZEM -2M', maAmis: 'STS02-11s-6zem', nhomVthh: 'TP; PX Sóng' }).doLi,
    '6ZEM'
  );
});

test('replaceCutLengthMeters: thay mét cuối, thiếu thì thêm - Nm', () => {
  assert.equal(
    replaceCutLengthMeters('Tấm nhựa đặc màu TRẮNG 8ZEM - hàng tiêu chuẩn - STD - 0.8li - 1.22m - 30m', 15),
    'Tấm nhựa đặc màu TRẮNG 8ZEM - hàng tiêu chuẩn - STD - 0.8li - 1.22m - 15m'
  );
  assert.equal(
    replaceCutLengthMeters('Tấm đặc - 8li - ECO', 3),
    'Tấm đặc - 8li - ECO - 3m'
  );
  assert.equal(
    replaceCutLengthMeters('Hàng mẫu - test', 2.5),
    'Hàng mẫu - test - 2.5m'
  );
  assert.equal(replaceCutLengthMeters('Tấm đặc - 8li', 0), 'Tấm đặc - 8li');
  assert.equal(replaceCutLengthMeters('', 5), '');
});

test('replaceCutLengthMeters: ưu tiên thay token m dài chính (lỗi 6m-8m)', () => {
  // M dài chính 6m không đứng cuối (cuối là khổ 2.1m): thay đúng 6m, không đụng 2.1m.
  assert.equal(
    replaceCutLengthMeters('Băng keo X - 6m - 2.1m', 8, 6),
    'Băng keo X - 8m - 2.1m'
  );
  // M dài chính đứng cuối: thay như thường.
  assert.equal(
    replaceCutLengthMeters('Tấm - 2.1m - 30m', 15, 30),
    'Tấm - 2.1m - 15m'
  );
  // Không truyền m dài chính: giữ hành vi cũ (thay token mét cuối).
  assert.equal(
    replaceCutLengthMeters('Băng keo X - 6m - 2.1m', 8),
    'Băng keo X - 6m - 8m'
  );
  // Không tìm thấy m dài chính trong chuỗi: fallback token cuối.
  assert.equal(
    replaceCutLengthMeters('Tấm - 2.1m - 9m', 3, 30),
    'Tấm - 2.1m - 3m'
  );
});
