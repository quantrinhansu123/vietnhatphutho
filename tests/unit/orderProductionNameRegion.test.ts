import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderProductionName } from '../../src/utils/productProductionName';

const base = { nhomVthh: 'TP; PX Sóng', maAmis: 'STS06-TRẮNG-8 ZEM sóng phẳng NP' };
const name = 'NHỰA SÓNG TRẮNG-SÓNG PHẲNG (ĐM 6,5KG/6M)-20M-NP';

test('miền Bắc giữ nguyên tên danh mục khi thông số không đổi', () => {
  assert.equal(buildOrderProductionName(name, { ...base, mien: 'Miền Bắc', cutLengthM: 20 }), name);
});
test('miền Bắc thay mét dài, giữ Sóng phẳng và định mức /6m, không thêm ZEM', () => {
  const result = buildOrderProductionName(name, { ...base, mien: 'Miền Bắc', cutLengthM: 30 });
  assert.match(result, /SÓNG PHẲNG/iu);
  assert.match(result, /6\.5\s*kg\s*\/\s*6m/iu);
  assert.match(result, /30m/iu);
  assert.doesNotMatch(result, /20m|ZEM/iu);
  assert.match(result, /- NP$/);
});
test('miền Nam tiếp tục lấy ZEM từ mã AMIS', () => {
  const result = buildOrderProductionName(name, { ...base, mien: 'Miền Nam', cutLengthM: 30 });
  assert.match(result, /8ZEM/iu);
  assert.match(result, /SÓNG PHẲNG/iu);
});
test('Sóng Giá rẻ bỏ NP và đưa màng, giá rẻ xuống cuối', () => {
  const result = buildOrderProductionName('NHỰA SÓNG XDT - NP - 11 SÓNG - STD - (ĐM 5.4KG/6M) - 20m - Giá rẻ', {
    ...base, mien: 'Miền Bắc', cutLengthM: 30
  });
  assert.doesNotMatch(result, /\bNP\b|ZEM/iu);
  assert.match(result, /30m - STD - Giá rẻ$/iu);
});

test('hạ khổ/li/mét dài cập nhật cùng một tên và giữ hậu tố', () => {
  const result = buildOrderProductionName('Tấm nhựa đặc màu TRẮNG - 3li - (đm 2.7 li) - 1.82m - 30m - STD - NP', {
    nhomVthh: 'TP; PX Đặc', mien: 'Miền Bắc', maAmis: 'STD06-3li*1.82m-NP',
    doLi: '2li', doLiDm: '1.8', doDayM: 1.22, cutLengthM: 15
  });
  assert.match(result, /- 2li - \(đm 1\.8 li\) - 1\.22m - 15m - STD - NP$/);
  assert.doesNotMatch(result, /3li|1\.82m|30m/);
});
