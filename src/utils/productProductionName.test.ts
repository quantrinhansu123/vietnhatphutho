import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDoLiDm,
  classifyProductPxGroup,
  parseAmisSpecs,
  parseSongLengthMeters,
  pickMaxSongLengthMeters,
  parseProductionNameParts,
  composeProductionDisplayName,
  seedProductionSpecs
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

test('Đặc: hai mét standalone — lớn = dài, nhỏ = dày', () => {
  const a = parseProductionNameParts(
    'Tấm nhựa đặc màu TRẮNG - 8li ( đm 7.7 li ) - 9m - 1.56m - STD',
    'TP; PX Đặc'
  );
  assert.equal(a.doLi, '8li');
  assert.equal(a.doLiDm, '(đm 7.7 li)');
  assert.equal(a.doDayM, '1.56m');
  assert.equal(a.doDaiM, '9m');
  assert.equal(a.mang, 'STD');

  const b = parseProductionNameParts(
    'Tấm nhựa đặc màu TRẮNG - 5li ( đm 4.7 li ) - 2.1m - 30m hàng 100% NS Off - STD',
    'TP; PX Đặc'
  );
  assert.equal(b.doDayM, '2.1m');
  assert.equal(b.doDaiM, '30m');
  assert.equal(b.hangPhe, 'hàng 100% NS Off');

  const c = parseProductionNameParts(
    'Tấm nhựa đặc màu TRẮNG - 6li ( đm 5.7 li ) - 20m - 2.1m - STD',
    'TP; PX Đặc'
  );
  assert.equal(c.doDayM, '2.1m');
  assert.equal(c.doDaiM, '20m');
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

test('Sóng: mét dài = token m cuối; max khi gom; KG không phải độ li', () => {
  assert.equal(parseSongLengthMeters('NHỰA 11 SÓNG XANH 6ZEM -6M'), 6);
  assert.equal(
    parseSongLengthMeters('NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - 3,5M ( GIÁ RẺ )'),
    3.5
  );
  assert.equal(
    parseSongLengthMeters('NHỰA SÓNG XDT - NP -  SÓNG PHẲNG 1.2m - 5,2KG - 30M'),
    30
  );

  const kgName = parseProductionNameParts(
    'NHỰA SÓNG XDT - NP - 11 SÓNG 4,8KG - 3,5M ( GIÁ RẺ )',
    'TP; PX Sóng'
  );
  assert.equal(kgName.doDaiM, '3.5m');
  assert.equal(kgName.doLi, '');
  assert.ok(!/kg/i.test(kgName.doLi));

  const kgFlat = parseProductionNameParts(
    'NHỰA SÓNG XDT - NP -  SÓNG PHẲNG 1.2m - 5,2KG - 30M',
    'TP; PX Sóng'
  );
  assert.equal(kgFlat.doDaiM, '30m');
  assert.equal(kgFlat.doLi, '');

  const seeded = seedProductionSpecs({
    tenSanXuat: 'NHỰA 11 SÓNG XANH 6ZEM -2M',
    maAmis: 'STS02-11s-6zem',
    nhomVthh: 'TP; PX Sóng',
    songLengthNames: [
      'NHỰA 11 SÓNG XANH 6ZEM -2M',
      'NHỰA 11 SÓNG XANH 6ZEM -6M',
      'NHỰA 11 SÓNG XANH 6ZEM -3,5M'
    ]
  });
  assert.equal(seeded.tenGoc, 'NHỰA 11 SÓNG XANH 6ZEM');
  assert.equal(seeded.doLi, '6ZEM');
  assert.equal(seeded.doDaiM, '6m');
  assert.equal(
    pickMaxSongLengthMeters([
      'NHỰA 11 SÓNG XANH 6ZEM -2M',
      'NHỰA 11 SÓNG XANH 6ZEM -6M',
      'NHỰA 11 SÓNG XANH 6ZEM -3,5M'
    ]),
    6
  );
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
