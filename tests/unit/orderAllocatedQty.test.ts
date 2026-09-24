import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAllocatedQtyMap,
  getAllocatedQtyFromMap,
  normalizeAllocatedLenhSxLines
} from '../../src/features/_shared/orderHelpers';

const lenhDon = {
  ma_lenh_sx: 'LSX-DH1',
  ma_don_hang: 'DH1',
  san_pham: [
    { ma_don_hang: 'DH1', san_pham_id: 'sp-1', ma_sp: 'MA-X', ten_san_xuat: 'Ten SX X', so_luong: 100 },
    { ma_don_hang: 'DH1', san_pham_id: 'sp-1', ma_sp: 'MA-X', ten_san_xuat: 'Ten SX X', so_luong: 20 },
    { ma_don_hang: 'DH1', ma_sp: 'MA-Y', ten_san_xuat: 'Ten SX Y', so_luong: 50 }
  ]
};

const lenhGop = {
  ma_lenh_sx: 'LSX-DH1-DH2',
  ma_don_hang: 'DH1, DH2',
  san_pham: JSON.stringify([
    { ma_don_hang: 'DH2', san_pham_id: 'sp-2', ma_sp: 'MA-Z', ten_san_xuat: 'Ten SX Z', so_luong: 30 },
    { ma_sp: 'MA-W', so_luong: 10 }
  ])
};

describe('orderHelpers — SL đã lập lệnh SX', () => {
  it('chuẩn hóa mảng / chuỗi JSON, bỏ dòng thiếu mã đơn hoặc SL', () => {
    const lines = normalizeAllocatedLenhSxLines(lenhGop);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].orderRef, 'DH2');
    assert.equal(lines[0].quantity, 30);
  });

  it('header 1 mã làm fallback, header gộp nhiều mã thì bỏ dòng thiếu ref', () => {
    const single = normalizeAllocatedLenhSxLines({ ma_don_hang: 'DH9', san_pham: [{ ma_sp: 'M', so_luong: 5 }] });
    assert.equal(single[0]?.orderRef, 'DH9');
    const multi = normalizeAllocatedLenhSxLines({ ma_don_hang: 'DH9, DH10', san_pham: [{ ma_sp: 'M', so_luong: 5 }] });
    assert.equal(multi.length, 0);
  });

  it('cộng gộp trùng định danh, tra đúng từng đơn', () => {
    const map = buildAllocatedQtyMap([lenhDon, lenhGop]);
    assert.equal(getAllocatedQtyFromMap(map, 'DH1', { productId: 'sp-1' }), 120);
    assert.equal(getAllocatedQtyFromMap(map, 'DH2', { productId: 'sp-1' }), 0);
    assert.equal(getAllocatedQtyFromMap(map, 'DH2', { productId: 'sp-2' }), 30);
  });

  it('không id thì khớp mã+tên SX, thiếu tên một bên thì khớp theo mã', () => {
    const map = buildAllocatedQtyMap([lenhDon]);
    assert.equal(getAllocatedQtyFromMap(map, 'DH1', { productCode: 'MA-Y', productionName: 'Ten SX Y' }), 50);
    assert.equal(getAllocatedQtyFromMap(map, 'DH1', { productCode: 'MA-Y', productionName: 'Ten khác' }), 0);
    assert.equal(getAllocatedQtyFromMap(map, 'DH1', { productCode: 'MA-Y' }), 50);
  });

  it('dòng đơn có id không khớp dòng lệnh khác id', () => {
    const map = buildAllocatedQtyMap([lenhDon]);
    assert.equal(getAllocatedQtyFromMap(map, 'DH1', { productId: 'sp-zzz', productCode: 'MA-X', productionName: 'Ten SX X' }), 0);
  });

  it('dòng lệnh thiếu tên SX vẫn cộng vào tra theo mã (parity productLineMatches)', () => {
    const map = buildAllocatedQtyMap([
      {
        ma_don_hang: 'DH3',
        san_pham: [
          { ma_don_hang: 'DH3', ma_sp: 'M', so_luong: 10 },
          { ma_don_hang: 'DH3', ma_sp: 'M', ten_san_xuat: 'N', so_luong: 20 }
        ]
      }
    ]);
    assert.equal(getAllocatedQtyFromMap(map, 'DH3', { productCode: 'M', productionName: 'N' }), 30);
    assert.equal(getAllocatedQtyFromMap(map, 'DH3', { productCode: 'M', productionName: 'Khác' }), 10);
    assert.equal(getAllocatedQtyFromMap(map, 'DH3', { productCode: 'M' }), 30);
  });
});
