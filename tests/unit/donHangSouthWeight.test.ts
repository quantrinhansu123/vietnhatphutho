/**
 * Đơn miền nam: kg/1m và số đơn hàng (phần nghìn `,`, thập phân `.`).
 * npx tsx --test tests/unit/donHangSouthWeight.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  orderDuplicateDecimalText,
  southKgPerStandardMeter,
  southLengthScaledTotalKg,
  southOrderKgPerMeter
} from '../../src/features/don-hang/southWeight';

describe('don-hang — phần nghìn phẩy, thập phân chấm', () => {
  it('giữ thập phân là dấu chấm và đổi hàng nghìn cũ sang phẩy', () => {
    assert.equal(orderDuplicateDecimalText('2.8'), '2.8');
    assert.equal(orderDuplicateDecimalText('5,7'), '5.7');
    assert.equal(orderDuplicateDecimalText('1.250.000'), '1,250,000');
  });

  it('đưa số cũ dùng phẩy thập phân về chuẩn mới', () => {
    assert.equal(orderDuplicateDecimalText('1,234.5'), '1,234.5');
    assert.equal(orderDuplicateDecimalText('12,5'), '12.5');
    assert.equal(orderDuplicateDecimalText('10'), '10');
  });
});

describe('don-hang miền nam — kg/1m × dài × SL', () => {
  it('kg/1m = định mức tiêu chuẩn (kg) / độ dài tấm tiêu chuẩn', () => {
    assert.equal(southKgPerStandardMeter('5.7', '10'), 0.57);
    assert.equal(southLengthScaledTotalKg('5.7', '10', '3', '6'), 10.26);
  });

  it('thiếu độ dài tấm thì không chia', () => {
    assert.equal(southKgPerStandardMeter('5.7', ''), null);
    assert.equal(southLengthScaledTotalKg('5.7', '', '3', '6'), null);
  });

  it('ưu tiên kg nhập, không có thì lấy TL tấm hoặc kg/1m danh mục', () => {
    assert.equal(southOrderKgPerMeter('5.7', 9, 1, '10'), 0.57);
    assert.equal(southOrderKgPerMeter('', 5.7, 1, '10'), 0.57);
    assert.equal(southOrderKgPerMeter('', '', 0.57, ''), 0.57);
  });
});
