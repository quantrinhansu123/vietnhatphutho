/**
 * In đơn cắt lẻ — tên hàng là mã AMIS mới; khổ giữ gốc; dài theo ô Dài (m) khi đổi.
 * Chạy: npx tsx --test tests/unit/cutOrderPrint.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cutOrderPrintSize, cutOrderPrintTenHang } from '../../src/components/cutOrderPrint';

const base = {
  productionName: 'NĐ 8li trà - 1.82m - 6m',
  productCode: 'ND-8LI',
  maAmisCu: 'ND-8LI'
};

describe('in đơn cắt lẻ', () => {
  it('tên hàng ưu tiên mã AMIS mới', () => {
    assert.equal(cutOrderPrintTenHang({ productCode: 'ND-8LI', maAmis: 'ND-8LI-2.6m (đm 0.7 li)' }), 'ND-8LI-2.6m (đm 0.7 li)');
    assert.equal(cutOrderPrintTenHang({ productCode: 'ND-8LI', maAmis: '' }), 'ND-8LI');
  });

  it('không đổi dài thì giữ khổ và mét dài gốc', () => {
    const size = cutOrderPrintSize({ ...base, daiM: '6' });
    assert.equal(size.kho, '1.82');
    assert.equal(size.dai, '6');
  });

  it('đổi Dài (m) thì in số mới, khổ giữ nguyên', () => {
    const size = cutOrderPrintSize({ ...base, daiM: '2.6' });
    assert.equal(size.kho, '1.82');
    assert.equal(size.dai, '2.6');
  });
});
