import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProductConversionFormulas } from './productConversionCalculation.ts';

const baseInput = {
  sheetWidthM: null,
  sheetLengthM: null,
  rollWidthM: null,
  rollLengthM: null,
  areaM2: null,
  kgPerLinearM: null,
  kgPerM2: null
};

test('tính kg/m dài và kg/tấm từ khổ tấm với kg/m²', () => {
  const result = calculateProductConversionFormulas({
    ...baseInput,
    sheetWidthM: 1.2,
    sheetLengthM: 2.5,
    kgPerM2: 0.8
  });

  assert.equal(result.kgPerLinearM, 0.96);
  assert.equal(result.kgPerSheet, 2.4);
});

test('ưu tiên diện tích nhập để tính kg/cuộn', () => {
  const result = calculateProductConversionFormulas({
    ...baseInput,
    rollWidthM: 2,
    rollLengthM: 100,
    areaM2: 120,
    kgPerM2: 0.8
  });

  assert.equal(result.areaM2, 200);
  assert.equal(result.kgPerRoll, 96);
});

test('dùng kg/m dài nhập trực tiếp khi thiếu kg/m²', () => {
  const result = calculateProductConversionFormulas({
    ...baseInput,
    sheetLengthM: 2.5,
    rollLengthM: 100,
    kgPerLinearM: 0.96
  });

  assert.equal(result.kgPerLinearM, null);
  assert.equal(result.kgPerSheet, 2.4);
  assert.equal(result.kgPerRoll, 96);
});

test('ưu tiên kg/m dài nhập trực tiếp để tính kg/tấm', () => {
  const result = calculateProductConversionFormulas({
    ...baseInput,
    sheetWidthM: 1.2,
    sheetLengthM: 2.5,
    kgPerLinearM: 1.1,
    kgPerM2: 0.8
  });

  assert.equal(result.kgPerLinearM, 0.96);
  assert.equal(result.kgPerSheet, 2.75);
});

test('trả về rỗng khi không đủ dữ liệu nguồn', () => {
  assert.deepEqual(calculateProductConversionFormulas(baseInput), {
    areaM2: null,
    kgPerLinearM: null,
    kgPerSheet: null,
    kgPerRoll: null
  });
});
