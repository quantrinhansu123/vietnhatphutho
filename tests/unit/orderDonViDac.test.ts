/**
 * Unit test ĐVT đơn hàng theo nhóm Đặc: npx tsx --test tests/unit/orderDonViDac.test.ts
 * SP Đặc (mọi biến thể nhóm) → ĐVT cho chọn Tấm, Cuộn.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedOrderUnits,
  calculateOrderConversion,
  classifyProductGroupKind,
  type OrderProductConversion
} from '../../src/features/_shared/orderHelpers';

const conv: OrderProductConversion = {
  id: 1,
  sanPhamId: 'sp-1',
  maSp: 'SP-DAC',
  maAmis: 'SP-DAC',
  donViTinh: 'Tấm',
  khoTamRongM: 1.2,
  khoTamDaiM: 2,
  khoCuonRongM: null,
  khoCuonDaiM: null,
  dienTichM2: 2.4,
  trongLuongKgMDai: 1,
  trongLuongKgM2: 1,
  trongLuongKgTam: 2,
  trongLuongKgCuon: 20
};

describe('don-hang — classifyProductGroupKind', () => {
  it('nhận mọi biến thể nhóm Đặc', () => {
    for (const group of ['TP; PX Đặc', 'TP;PX Đặc', 'tp;pxđặc', 'Đặc', 'TP; PX ĐẶC (cũ)', 'TP;PX Dac']) {
      assert.equal(classifyProductGroupKind(group), 'dac', group);
    }
  });

  it('nhận Sóng / Rỗng / nhóm khác', () => {
    assert.equal(classifyProductGroupKind('TP; PX Sóng'), 'song');
    assert.equal(classifyProductGroupKind('TP;PX Rỗng'), 'rong');
    assert.equal(classifyProductGroupKind('TP; PX Thường'), '');
    assert.equal(classifyProductGroupKind(''), '');
  });
});

describe('don-hang — ĐVT SP Đặc', () => {
  it('cho chọn Tấm, Cuộn với mọi biến thể nhóm Đặc', () => {
    for (const group of ['TP; PX Đặc', 'TP;PX Đặc', 'Đặc']) {
      assert.deepEqual(allowedOrderUnits({ group, unit: '' }), ['Tấm', 'Cuộn'], group);
    }
  });

  it('giữ hành vi Sóng / Rỗng / khác', () => {
    assert.deepEqual(allowedOrderUnits({ group: 'TP; PX Sóng', unit: '' }), ['Tấm', 'Cuộn']);
    assert.deepEqual(allowedOrderUnits({ group: 'TP; PX Rỗng', unit: '' }), ['Tấm']);
    assert.deepEqual(allowedOrderUnits({ group: 'TP; PX Thường', unit: '' }), ['kg']);
  });

  it('giữ ĐVT lạ đang dùng lên đầu danh sách', () => {
    assert.deepEqual(allowedOrderUnits({ group: 'Đặc', unit: 'm' }), ['m', 'Tấm', 'Cuộn']);
    assert.deepEqual(allowedOrderUnits({ group: 'Đặc', unit: 'Cuộn' }), ['Tấm', 'Cuộn']);
  });

  it('quy đổi nhóm Đặc ra kg/m2/m dài', () => {
    const units = calculateOrderConversion('10', 'Tấm', conv, 'TP;PX Đặc').map(([, , unit]) => unit);
    assert.ok(units.includes('kg'));
    assert.ok(units.includes('m2'));
    assert.ok(units.includes('m dài'));
  });
});
