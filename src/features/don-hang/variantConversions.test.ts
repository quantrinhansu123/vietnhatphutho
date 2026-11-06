import assert from 'node:assert/strict';
import test from 'node:test';
import { variantConversion, editVariantConversion, validateVariantConversions } from './variantConversions';

const source = {
  khoTamRongM: '2', khoTamDaiM: '6', khoCuonRongM: '2', khoCuonDaiM: '30', dienTichM2: '60',
  trongLuongKgMDai: '2.469', trongLuongKgM2: '1.23456', trongLuongKgTam: '14.814', trongLuongKgCuon: '74.073'
};
test('không đổi thông số thì giữ nguyên toàn bộ quy đổi đã lưu, không làm tròn lại', () => {
  assert.deepEqual(variantConversion(source, { width: '2m', length: '6', weightScale: 1 }), source);
});
test('hạ khổ, mét dài và độ li ĐM tính đủ 9 trường, cắt 3 số lẻ cho kg', () => {
  const result = variantConversion(source, { width: '1', length: '3', weightScale: 0.5 });
  assert.deepEqual(result, {
    khoTamRongM: '1', khoTamDaiM: '3', khoCuonRongM: '1', khoCuonDaiM: '30', dienTichM2: '30',
    trongLuongKgMDai: '0.617', trongLuongKgM2: '0.617', trongLuongKgTam: '1.851', trongLuongKgCuon: '18.518'
  });
  assert.equal(source.khoTamRongM, '2');
});
test('đổi mét dài hoặc khổ rộng (không khóa kgPerSheet) phải đổi kg/Tấm và kg/Cuộn', () => {
  const longer = variantConversion(source, { width: '2', length: '12', weightScale: 1 });
  assert.equal(longer.trongLuongKgTam, '29.629');
  assert.equal(longer.trongLuongKgCuon, '74.073');
  assert.notEqual(longer.trongLuongKgTam, source.trongLuongKgTam);
  const narrower = variantConversion(source, { width: '1', length: '6', weightScale: 1 });
  assert.equal(narrower.trongLuongKgTam, '7.407');
  assert.equal(narrower.trongLuongKgMDai, '1.234');
  assert.equal(narrower.trongLuongKgCuon, '37.036');
  assert.notEqual(narrower.trongLuongKgTam, source.trongLuongKgTam);
});
test('đổi ĐM (weightScale) phải đổi kg/Tấm và kg/Cuộn', () => {
  const result = variantConversion(source, { width: '2', length: '6', weightScale: 0.5 });
  assert.equal(result.trongLuongKgTam, '7.407');
  assert.equal(result.trongLuongKgCuon, '37.036');
  assert.equal(result.trongLuongKgM2, '0.617');
});
test('định mức nhập tay là kg/tấm, không nhân số lượng đơn', () => {
  const result = variantConversion(source, { width: '1', length: '3', kgPerSheet: '5.7899' });
  assert.equal(result.trongLuongKgTam, '5.789');
  assert.equal(result.trongLuongKgMDai, '1.929');
  assert.equal(result.trongLuongKgCuon, '57.899');
});
test('suy suất trọng lượng từ kg/tấm khi danh mục thiếu kg/m²', () => {
  const result = variantConversion({ ...source, trongLuongKgM2: '', trongLuongKgMDai: '', trongLuongKgTam: '12' }, { width: '1', length: '3' });
  assert.equal(result.trongLuongKgM2, '1');
  assert.equal(result.trongLuongKgTam, '3');
});
test('thiếu căn cứ đổi độ li phải xóa quy đổi cũ và yêu cầu bổ sung', () => {
  const result = variantConversion(source, { weightScale: null, width: '1' });
  assert.equal(result.trongLuongKgTam, '');
  assert.match(validateVariantConversions([result], 'Tấm'), /bổ sung/);
});
test('sửa kích thước/nguồn trong modal không để sót trọng lượng dẫn xuất cũ', () => {
  const result = editVariantConversion(source, 'trongLuongKgM2', '');
  assert.equal(result.trongLuongKgMDai, '');
  assert.equal(result.trongLuongKgTam, '');
  assert.equal(result.trongLuongKgCuon, '');
});
test('quy đổi tấm và cuộn phải có đủ thông số; không bỏ qua các dòng ngoài schema', () => {
  assert.equal(validateVariantConversions([source], 'Tấm'), '');
  assert.equal(validateVariantConversions([source], 'Cuộn'), '');
  assert.match(validateVariantConversions([{ ...source, khoCuonDaiM: '' }], 'Cuộn'), /bổ sung/);
  assert.match(validateVariantConversions([{ ...source, trongLuongKgTam: '0' }], 'Tấm'), /lớn hơn 0/);
  assert.match(validateVariantConversions([source, source], 'Tấm'), /đúng một bộ/);
});
