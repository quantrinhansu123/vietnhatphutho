import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDoLiDm,
  calculateDoLiDm,
  classifyProductPxGroup,
  isDiscontinuedWhiteSuProduct,
  normalizeDoLiToken,
  parseAmisSpecs,
  parseSongLengthMeters,
  parseProductionNameParts,
  composeProductionDisplayName,
  seedProductionSpecs,
  buildOrderTenGhep,
  replaceCutLengthMeters,
  replaceDoLiDmInTenGhep,
  normalizeDoLiDm,
  extractDoLiDmNumber,
  stripDuplicateLiFromTenGoc,
  parseDoDaiMLength
} from './productProductionName.ts';

test('extractDoLiDm bắt (đm n li) và (đm n kg)', () => {
  assert.equal(extractDoLiDm('Tấm nhựa đặc - 6li ( đm 5.7 li ) - ECO'), '(đm 5.7 li)');
  assert.equal(extractDoLiDm('…(đm5.7li)…'), '(đm 5.7 li)');
  assert.equal(extractDoLiDm('…(đm 9,7 li)…'), '(đm 9,7 li)');
  assert.equal(extractDoLiDm('NHỰA SÓNG ( ĐM 7,8KG ) - 2M'), '(đm 7,8 kg)');
  assert.equal(extractDoLiDm('…( đm 5kg )…'), '(đm 5 kg)');
  assert.equal(extractDoLiDm('không có đm'), null);
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
  assert.equal(short.doLi, '', 'ZEM không phải độ li');
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
  // Marker 100%NS chuẩn hóa về `100% NS`.
  assert.equal(seed('Tấm đặc - 8li - 8m - 100%NS - màng STD', '', 'TP; PX Đặc').hangPhe, '100% NS');
  assert.ok(
    seed('Tấm đặc - 8li - 8m - 100%NS - màng STD', '', 'TP; PX Đặc').tenGhep.includes('100% NS')
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
  assert.equal(seeded.doLiDm, '(đm 0.75 li)');
  assert.equal(
    seeded.tenGhep,
    'Tấm nhựa đặc màu TRẮNG 8ZEM - hàng tiêu chuẩn - STD - 0.8li - (đm 0.75 li) - 1.22m - 30m'
  );
  // ZEM không bao giờ là độ li — kể cả khi không có li tường minh.
  assert.equal(
    seedProductionSpecs({ tenSanXuat: 'NHỰA 11 SÓNG XANH 6ZEM -2M', maAmis: 'STS02-11s-6zem', nhomVthh: 'TP; PX Sóng' }).doLi,
    ''
  );
  assert.equal(
    seedProductionSpecs({ tenSanXuat: 'NHỰA 11 SÓNG XANH 6ZEM -2M', maAmis: 'STS02-11s-6zem', nhomVthh: 'TP; PX Sóng' }).tenGhep,
    'NHỰA 11 SÓNG XANH 6ZEM - 2m'
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

test('stripDuplicateLiFromTenGoc: cắt đuôi li trùng độ li', () => {
  assert.equal(
    stripDuplicateLiFromTenGoc('NHỰA SÓNG TRẮNG - NP - 11 SÓNG 1,2LI', '1.2li'),
    'NHỰA SÓNG TRẮNG - NP - 11 SÓNG'
  );
  // Khác số thì giữ nguyên.
  assert.equal(
    stripDuplicateLiFromTenGoc('Tấm đặc - 5li', '8li'),
    'Tấm đặc - 5li'
  );
  // Trong ngoặc (đm) thì giữ nguyên.
  assert.equal(
    stripDuplicateLiFromTenGoc('Tấm đặc (đm 5.7 li)', '5.7li'),
    'Tấm đặc (đm 5.7 li)'
  );
  // Không có độ li thì giữ nguyên.
  assert.equal(
    stripDuplicateLiFromTenGoc('NHỰA 11 SÓNG XANH 6ZEM', ''),
    'NHỰA 11 SÓNG XANH 6ZEM'
  );
});

test('seed Sóng STS06: tên gốc cắt đuôi li, tên ghép đúng', () => {
  const seeded = seedProductionSpecs({
    tenSanXuat: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG 1,2LI - 4M',
    maAmis: 'STS06-1.2li- NP',
    nhomVthh: 'TP; PX Sóng'
  });
  assert.equal(seeded.tenGoc, 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG');
  assert.equal(seeded.doLi, '1.2li');
  assert.equal(seeded.tenGhep, 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1.2li - 4m');
});

test('parseDoDaiMLength đọc số m dài từ ô Mét dài (SP cắt lẻ)', () => {
  assert.equal(parseDoDaiMLength('6m'), 6);
  assert.equal(parseDoDaiMLength('5.8m'), 5.8);
  assert.equal(parseDoDaiMLength('5,8m'), 5.8);
  assert.equal(parseDoDaiMLength('5.8'), 5.8);
  assert.equal(parseDoDaiMLength(' 9M '), 9);
  assert.equal(parseDoDaiMLength(''), null);
  assert.equal(parseDoDaiMLength('abc'), null);
  assert.equal(parseDoDaiMLength('0m'), null);
});

test('sóng NP2 (GIÁ RẺ): giữ marker vào hàng phế + tên ghép', () => {
  const parts = parseProductionNameParts(
    'NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - 2M ( GIÁ RẺ )',
    'TP; PX Sóng',
    'STS02-4.8kg-6m NP2'
  );
  assert.equal(parts.hangPhe, '(GIÁ RẺ)');
  assert.equal(parts.doDaiM, '2m');
  const seeded = seedProductionSpecs({
    tenSanXuat: 'NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - 2M ( GIÁ RẺ )',
    maAmis: 'STS02-4.8kg-6m NP2',
    nhomVthh: 'TP; PX Sóng'
  });
  assert.equal(seeded.tenGhep, 'NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - (GIÁ RẺ) - 2m');
});

test('replaceCutLengthMeters: giữ (GIÁ RẺ) ở cuối tên', () => {
  assert.equal(
    replaceCutLengthMeters('NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - 2M ( GIÁ RẺ )', 3),
    'NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - 3m (GIÁ RẺ)'
  );
});

test('Rỗng: tên ghép bỏ khổ 2.1m mặc định nhưng vẫn lưu DB', () => {
  const seeded = seedProductionSpecs({
    tenSanXuat: 'Tấm nhựa rỗng màu trà - 4.5li x 2.1m x 6m - màng ECO',
    maAmis: 'ECR05-4.5li-6m',
    nhomVthh: 'TP; PX Rỗng'
  });
  assert.equal(seeded.doDayM, '2.1m');
  assert.equal(seeded.tenGhep, 'Tấm nhựa rỗng màu trà - ECO - 4.5li - 6m');
  // Khổ khác 2.1m thì giữ lại.
  assert.equal(
    composeProductionDisplayName(
      { tenGoc: 'Tấm nhựa rỗng', doLi: '4.5li', doDayM: '1.5m', doDaiM: '6m', mang: 'ECO' },
      'TP; PX Rỗng'
    ),
    'Tấm nhựa rỗng - ECO - 4.5li - 1.5m - 6m'
  );
  // Nhóm khác không bị bỏ khổ.
  assert.equal(
    composeProductionDisplayName(
      { tenGoc: 'Tấm nhựa đặc', doLi: '4.5li', doDayM: '2.1m', doDaiM: '30m', mang: 'ECO' },
      'TP; PX Đặc'
    ),
    'Tấm nhựa đặc - ECO - 4.5li - 2.1m - 30m'
  );
});

test('calculateDoLiDm: bảng trừ lùi theo mốc đã đối chiếu', () => {
  assert.equal(calculateDoLiDm('0.8li', 'TP; PX Đặc'), '(đm 0.75 li)');
  assert.equal(calculateDoLiDm('1.2li', 'TP; PX Đặc'), '(đm 1.1 li)');
  assert.equal(calculateDoLiDm('2.5li', 'TP; PX Đặc'), '(đm 2.4 li)');
  assert.equal(calculateDoLiDm('2.8li', 'TP; PX Đặc'), '(đm 2.6 li)');
  assert.equal(calculateDoLiDm('3li', 'TP; PX Đặc'), '(đm 2.8 li)');
  assert.equal(calculateDoLiDm('4li', 'TP; PX Đặc'), '(đm 3.8 li)');
  assert.equal(calculateDoLiDm('5li', 'TP; PX Đặc'), '(đm 4.7 li)');
  assert.equal(calculateDoLiDm('10li', 'TP; PX Đặc'), '(đm 9.7 li)');
  assert.equal(calculateDoLiDm('2.5li', 'TP; PX Rỗng'), '');
  assert.equal(calculateDoLiDm('', 'TP; PX Đặc'), '');
  assert.equal(calculateDoLiDm('6ZEM', 'TP; PX Đặc'), '');
});

test('Đặc thiếu đm trong tên: tự tính, tên có sẵn thì giữ', () => {
  const auto = seedProductionSpecs({
    tenSanXuat: 'Tấm nhựa đặc màu XDT - 5li - 1.52m - 30m - STD',
    maAmis: 'STD02-5.0li*1.52m',
    nhomVthh: 'TP; PX Đặc'
  });
  assert.equal(auto.doLiDm, '(đm 4.7 li)');
  assert.ok(auto.tenGhep.includes('(đm 4.7 li)'));
  const kept = seedProductionSpecs({
    tenSanXuat: 'Tấm nhựa đặc màu XDT - 1.2li ( đm 1,1li ) - 1.56m - 30m - STD',
    maAmis: 'STD02-1.2li*1.56m',
    nhomVthh: 'TP; PX Đặc'
  });
  assert.equal(kept.doLiDm, '(đm 1,1 li)');
  // Tên ghi đm thiếu chữ li `( đm 1,1 )` → extract bỏ qua, auto tính đúng giá trị.
  const autoFromUnitless = seedProductionSpecs({
    tenSanXuat: 'Tấm nhựa đặc màu XDT - 1.2li ( đm 1,1 ) - 1.56m - 30m - STD',
    maAmis: 'STD02-1.2li*1.56m',
    nhomVthh: 'TP; PX Đặc'
  });
  assert.equal(autoFromUnitless.doLiDm, '(đm 1.1 li)');
});

test('ZEM chuẩn: 8ZEM + 0.8li + đm 0.75 theo mẫu chốt', () => {
  const seeded = seedProductionSpecs({
    tenSanXuat: 'Tấm nhựa đặc màu XDT 8ZEM - 1.22m - 30m hàng nguyên phế - SUN PC',
    maAmis: 'STD02-0.8li*1.22m NP',
    nhomVthh: 'TP; PX Đặc'
  });
  assert.equal(seeded.doLi, '0.8li');
  assert.equal(seeded.doLiDm, '(đm 0.75 li)');
  assert.equal(
    seeded.tenGhep,
    'Tấm nhựa đặc màu XDT 8ZEM - hàng nguyên phế - SUN PC - 0.8li - (đm 0.75 li) - 1.22m - 30m'
  );
});

test('độ li dạng Ni (10i) vẫn nhận', () => {
  assert.equal(normalizeDoLiToken('10i'), '10li');
  assert.equal(normalizeDoLiToken('2.0li'), '2.0li');
  assert.equal(normalizeDoLiToken('6ZEM'), '');
  const seeded = seedProductionSpecs({
    tenSanXuat: 'Tấm nhựa đặc XDT - 10i ( đm 9,7 li ) - 9m - 1,22m - STD',
    maAmis: '',
    nhomVthh: 'TP; PX Đặc'
  });
  assert.equal(seeded.doLi, '10li');
});

test('isDiscontinuedWhiteSuProduct: chặn trắng sứ Đặc', () => {
  assert.equal(
    isDiscontinuedWhiteSuProduct({ group: 'TP; PX Đặc', maAmis: 'STD01-2.5li*1.22m', names: [] }),
    true
  );
  assert.equal(
    isDiscontinuedWhiteSuProduct({ group: 'TP; PX Đặc', maAmis: '', names: ['Tấm nhựa đặc màu trắng sứ'] }),
    true
  );
  assert.equal(
    isDiscontinuedWhiteSuProduct({ group: 'TP; PX Đặc', maAmis: 'STD02-1.2li*1.56m', names: ['Tấm XDT'] }),
    false
  );
  assert.equal(
    isDiscontinuedWhiteSuProduct({ group: 'TP; PX Rỗng', maAmis: 'STD01-2.5li*1.22m', names: [] }),
    false
  );
});

test('sóng đm-kg cuối tên được lưu doLiDm + tên ghép', () => {
  const seeded = seedProductionSpecs({
    tenSanXuat: 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG 1LI - 6M ( đm 7,8kg )',
    maAmis: '',
    nhomVthh: 'TP; PX Sóng'
  });
  assert.equal(seeded.doLi, '1li');
  assert.equal(seeded.doLiDm, '(đm 7,8 kg)');
  assert.equal(seeded.doDaiM, '6m');
  assert.equal(seeded.tenGhep, 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG - 1li - (đm 7,8 kg) - 6m');
});

test('normalizeDoLiDm: nhận số trần hoặc chuỗi đm', () => {
  assert.equal(normalizeDoLiDm('0.75'), '(đm 0.75 li)');
  assert.equal(normalizeDoLiDm('7,8 kg'), '(đm 7.8 kg)');
  assert.equal(normalizeDoLiDm('(đm 0.9 li)'), '(đm 0.9 li)');
  assert.equal(normalizeDoLiDm('8', 'kg'), '(đm 8 kg)');
  assert.equal(normalizeDoLiDm(''), '');
  assert.equal(normalizeDoLiDm('2.5li'), '');
});

test('extractDoLiDmNumber: form đơn miền nam chỉ hiện số', () => {
  assert.equal(extractDoLiDmNumber('(đm 0.75 li)'), '0.75');
  assert.equal(extractDoLiDmNumber('(đm 7,8 kg)'), '7.8');
  assert.equal(extractDoLiDmNumber('0.9'), '0.9');
  assert.equal(extractDoLiDmNumber(''), '');
});

test('replaceDoLiDmInTenGhep: chỉ thay (đm …), giữ token do_li', () => {
  assert.equal(
    replaceDoLiDmInTenGhep(
      'Tấm nhựa đặc - STD - 0.8li - (đm 0.75 li) - 1.22m - 30m',
      '0.9'
    ),
    'Tấm nhựa đặc - STD - 0.8li - (đm 0.9 li) - 1.22m - 30m'
  );
  assert.equal(
    replaceDoLiDmInTenGhep(
      'NHỰA SÓNG - 1li - (đm 7,8 kg) - 6m (Dán Tem 5li)',
      '8 kg'
    ),
    'NHỰA SÓNG - 1li - (đm 8 kg) - 6m (Dán Tem 5li)'
  );
  assert.equal(
    replaceDoLiDmInTenGhep('Tấm nhựa - ECO - 0.8li - 1.22m - 30m', '0.7'),
    'Tấm nhựa - ECO - 0.8li - (đm 0.7 li) - 1.22m - 30m'
  );
});

test('buildOrderTenGhep: ghi đè do_li_dm, không đổi do_li', () => {
  const name = buildOrderTenGhep('Tấm nhựa đặc màu TRẮNG 8ZEM - hàng tiêu chuẩn - STD - 0.8li - 1.22m - 30m', {
    nhomVthh: 'TP; PX Đặc',
    cutLengthM: 15,
    doLiDm: '0.9'
  });
  assert.match(name, /0\.8li/);
  assert.match(name, /\(đm 0\.9 li\)/);
  assert.match(name, /15m/);
  assert.doesNotMatch(name, /\(đm 0\.75 li\)/);
});
