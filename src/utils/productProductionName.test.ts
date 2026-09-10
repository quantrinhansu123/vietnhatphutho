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
  assert.equal(classifyProductPxGroup('Khác'), 'other');
});

test('parseAmisSpecs đọc li*m và zem', () => {
  assert.deepEqual(parseAmisSpecs('STD09-5.0li*1.52m(KT)'), {
    doLi: '5.0li',
    doDayM: '1.52m',
    zem: ''
  });
  assert.deepEqual(parseAmisSpecs('STS02-11s-6zem'), {
    doLi: '',
    doDayM: '',
    zem: '6ZEM'
  });
});

test('pickMaxSongLengthMeters lấy m dài nhất', () => {
  const names = [
    'NHỰA 11 SÓNG XANH 6ZEM -2M',
    'NHỰA 11 SÓNG XANH 6ZEM -3M',
    'NHỰA 11 SÓNG XANH 6ZEM -6M',
    'NHỰA 11 SÓNG XANH 6ZEM -2,5M',
    'NHỰA 11 SÓNG XANH 6ZEM -3,5M'
  ];
  assert.equal(pickMaxSongLengthMeters(names), 6);
  assert.equal(parseSongLengthMeters('NHỰA SÓNG XDT - NP - 11 SÓNG 6ZEM - 2.5M'), 2.5);
});

test('compose Đặc có hang phe / mang / do_li / do_li_dm / m dài', () => {
  const parts = parseProductionNameParts(
    'Tấm nhựa đặc màu trắng sứ - 2.5li x 1.22m - ECO',
    'TP; PX Đặc',
    'STD01-2.5li*1.22m'
  );
  assert.equal(parts.tenGoc, 'Tấm nhựa đặc màu trắng sứ');
  assert.equal(parts.doLi, '2.5li');
  assert.equal(parts.doDayM, '1.22m');
  assert.equal(parts.mang, 'ECO');
  parts.doLiDm = '(đm 5.7 li)';
  parts.doDaiM = '7.9m';
  assert.equal(
    composeProductionDisplayName(parts, 'TP; PX Đặc'),
    'Tấm nhựa đặc màu trắng sứ - ECO - 2.5li - (đm 5.7 li) - 7.9m'
  );
});

test('compose Sóng: ten_goc + do_li; seed max m', () => {
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
  assert.equal(seeded.tenGhep, 'NHỰA 11 SÓNG XANH 6ZEM - 6ZEM');
});

test('compose Rỗng NP', () => {
  const parts = parseProductionNameParts(
    'Tấm nhựa rỗng màu trắng sữa - 4.5li x 2.1m x 5.8m hàng 100% phế - màng STD',
    'TP; PX Rỗng',
    'ECR01-4.5li-5.8m-NP'
  );
  assert.equal(parts.tenGoc, 'Tấm nhựa rỗng màu trắng sữa');
  assert.equal(parts.doLi, '4.5li');
  assert.equal(parts.mang, 'STD');
  assert.ok(parts.hangPhe.includes('phế'));
  const name = composeProductionDisplayName(parts, 'TP; PX Rỗng');
  assert.match(name, /Tấm nhựa rỗng màu trắng sữa/);
  assert.match(name, /4\.5li/);
  assert.match(name, /STD/);
});
