import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNhomVatTuPhuKey,
  resolveWorkshopType,
  calcAuxiliaryWeight,
  getAllowedSecondaryGroups,
  formatMixingNormSlipName
} from './mixingNormAuxiliary';

test('normalizeNhomVatTuPhuKey chuan hoa dung cac nhom vat tu phu', () => {
  assert.equal(normalizeNhomVatTuPhuKey('Băng Dính'), 'Băng Dính');
  assert.equal(normalizeNhomVatTuPhuKey('bang keo'), 'Băng Dính');
  assert.equal(normalizeNhomVatTuPhuKey('Bạt Dọc'), 'Bạt Dọc');
  assert.equal(normalizeNhomVatTuPhuKey('Bạt Bọc'), 'Bạt Dọc');
  assert.equal(normalizeNhomVatTuPhuKey('bat boc'), 'Bạt Dọc');
  assert.equal(normalizeNhomVatTuPhuKey('Màng'), 'Màng');
  assert.equal(normalizeNhomVatTuPhuKey('Tem'), 'Tem');
  assert.equal(normalizeNhomVatTuPhuKey('Mực In'), 'Mực In');
  assert.equal(normalizeNhomVatTuPhuKey('Kẹp Sắt'), 'Kẹp Sắt');
  assert.equal(normalizeNhomVatTuPhuKey('Dây Đai'), 'Dây Đai');
  assert.equal(normalizeNhomVatTuPhuKey('Dung Môi'), 'Dung Môi');
});

test('resolveWorkshopType nhan dien dung phan xuong', () => {
  assert.equal(resolveWorkshopType('TP; PX Rộng'), 'rong');
  assert.equal(resolveWorkshopType('TP; PX Đặc'), 'dac');
  assert.equal(resolveWorkshopType('TP; PX Sóng'), 'song');
  assert.equal(resolveWorkshopType('Khac'), 'unknown');
});

test('allowed groups den tu Bat Doc', () => {
  assert.deepEqual(getAllowedSecondaryGroups('rong'), ['Băng Dính', 'Màng', 'Tem']);
  assert.deepEqual(getAllowedSecondaryGroups('dac'), ['Tem', 'Băng Dính', 'Bạt Dọc', 'Màng', 'Kẹp Sắt', 'Dây Đai']);
  assert.deepEqual(getAllowedSecondaryGroups('song'), ['Tem', 'Băng Dính', 'Bạt Dọc', 'Mực In', 'Dung Môi']);
});

test('calcAuxiliaryWeight tinh dung cho TP; PX Rong', () => {
  assert.equal(calcAuxiliaryWeight('rong', 'Băng Dính', 'Cuộn', 10), 5);
  assert.equal(calcAuxiliaryWeight('rong', 'Tem', 'Cái', 100), 0.23);
  assert.equal(calcAuxiliaryWeight('rong', 'Màng', 'kg', 50), 50);
});

test('calcAuxiliaryWeight tinh dung cho TP; PX Dac', () => {
  assert.equal(calcAuxiliaryWeight('dac', 'Băng Dính', 'Cuộn', 10), 4);
  assert.equal(calcAuxiliaryWeight('dac', 'Tem', 'Cái', 100), 0.13);
  assert.equal(calcAuxiliaryWeight('dac', 'Bạt Dọc', 'kg', 12.5), 12.5);
  assert.equal(calcAuxiliaryWeight('dac', 'Dây Đai', 'kg', 3), 3);
});

test('calcAuxiliaryWeight tinh dung cho TP; PX Song', () => {
  assert.equal(calcAuxiliaryWeight('song', 'Băng Dính', 'Cuộn', 10), 4);
  assert.equal(calcAuxiliaryWeight('song', 'Tem', 'Cái', 100), 0.13);
  assert.equal(calcAuxiliaryWeight('song', 'Mực In', 'kg', 5), 5);
});

test('formatMixingNormSlipName ghep PTDM + ngay + ca + lenh san xuat', () => {
  assert.equal(
    formatMixingNormSlipName('2026-09-08', 'Ca 1', 'LSX-001'),
    'PTĐM - 2026-09-08 - Ca 1 - LSX-001'
  );
  assert.equal(
    formatMixingNormSlipName('2026-09-08', 'Ca 2', ''),
    'PTĐM - 2026-09-08 - Ca 2'
  );
  assert.equal(
    formatMixingNormSlipName('2026-09-08', '', 'LSX-002'),
    'PTĐM - 2026-09-08 - LSX-002'
  );
  assert.equal(formatMixingNormSlipName('', '', ''), 'PTĐM');
});

