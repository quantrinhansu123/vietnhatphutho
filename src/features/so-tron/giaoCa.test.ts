import assert from 'node:assert/strict';
import test from 'node:test';
import { formatGiaoCaKg, tonCuoiGiaoCa, tongGiaoCaKg } from './giaoCa.ts';

test('Tồn cuối = Tồn đầu + Lấy kho − Tổng SD, làm tròn 1 số', () => {
  assert.equal(tonCuoiGiaoCa(100, 50.25, 20), 130.3);
  assert.equal(tonCuoiGiaoCa('1,000.4', '10', '0.5'), 1009.9);
  assert.equal(tonCuoiGiaoCa(0, 0, 12), -12);
});

test('Giao ca = tổng tồn cuối các dòng', () => {
  const kg = tongGiaoCaKg([
    { tonDau: 100, layKho: 20, tongSd: 30 },
    { tonDau: 10.2, layKho: 0, tongSd: 0.1 }
  ]);
  assert.equal(kg, 100.1);
  assert.equal(formatGiaoCaKg(kg), '100.1 kg');
  assert.equal(formatGiaoCaKg(0), '');
});
