/**
 * Quy đổi lệnh SX theo số lượng — chạy: npx tsx --test tests/unit/lenhSxQuyDoi.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  conversionRatesForEntry,
  scaleProductionEntryQuantity,
  type EntryConversionLine
} from '../../src/features/ke-hoach-san-xuat/entryConversion';

function line(partial: Partial<EntryConversionLine> & { quantity?: string }): EntryConversionLine {
  return {
    key: 'k',
    orderRef: 'DH1',
    productCode: 'SP',
    productName: 'SP',
    productionName: 'SP',
    quantity: '100',
    unit: 'Tấm',
    tongKg: '250',
    m2: '40',
    mDai: '200',
    conversionResults: [
      { unit: 'kg', value: 250 },
      { unit: 'm2', value: 40 },
      { unit: 'm dài', value: 200 }
    ],
    ...partial
  };
}

describe('lệnh SX — đổi SL tính lại quy đổi', () => {
  it('gõ 2 rồi 20 vẫn nhân lại KG / M2 / M dài', () => {
    const base = line({
      quyDoiMotDonVi: conversionRatesForEntry(line({}), 100)
    });
    const after2 = { ...base, ...scaleProductionEntryQuantity(base, '2') };
    assert.equal(after2.tongKg, '5');
    assert.equal(after2.m2, '0.8');
    assert.equal(after2.mDai, '4');

    const after20 = { ...after2, ...scaleProductionEntryQuantity(after2, '20') };
    assert.equal(after20.quantity, '20');
    assert.equal(after20.tongKg, '50');
    assert.equal(after20.m2, '8');
    assert.equal(after20.mDai, '40');
    assert.equal(after20.conversionResults?.find(item => item.unit === 'kg')?.value, 50);
  });

  it('xóa SL thì xóa quy đổi, gõ lại vẫn tính theo suất cũ', () => {
    const base = line({
      quyDoiMotDonVi: conversionRatesForEntry(line({}), 100)
    });
    const cleared = { ...base, ...scaleProductionEntryQuantity(base, '') };
    assert.equal(cleared.tongKg, '');
    assert.equal(cleared.m2, '');
    const again = { ...cleared, ...scaleProductionEntryQuantity(cleared, '4') };
    assert.equal(again.tongKg, '10');
    assert.equal(again.mDai, '8');
  });
});
