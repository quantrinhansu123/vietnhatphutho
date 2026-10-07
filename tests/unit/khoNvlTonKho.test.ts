/**
 * Unit test kho NVL — parser số tồn kỳ: npx tsx --test tests/unit/khoNvlTonKho.test.ts
 * Bao: số nghìn EN/VN, Tồn cuối, ẩn dòng 0 trùng mã ở view gộp.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeClosingStock,
  parseInventoryNumber
} from '../../src/features/kho-nvl/index.tsx';
import {
  filterDuplicateZeroWarehouseRows,
  parsePeriodQuantityValue
} from '../../src/features/_shared/recordHelpers.ts';

describe('kho NVL — parse số tồn kỳ', () => {
  it('hiểu phân tách nghìn EN và VN', () => {
    assert.equal(parseInventoryNumber('1,234.5'), 1234.5);
    assert.equal(parseInventoryNumber('1.234,5'), 1234.5);
    assert.equal(parseInventoryNumber('1,234'), 1234);
    assert.equal(parseInventoryNumber('1.234.567'), 1234567);
    assert.equal(parsePeriodQuantityValue('1,234.5'), 1234.5);
    assert.equal(parsePeriodQuantityValue('1.234,5'), 1234.5);
  });

  it('hiểu thập phân phẩy và số âm', () => {
    assert.equal(parseInventoryNumber('1,5'), 1.5);
    assert.equal(parseInventoryNumber('-2,5'), -2.5);
    assert.equal(parseInventoryNumber('1234.5'), 1234.5);
  });

  it('giữ null với ô trống / gạch / rác', () => {
    assert.equal(parseInventoryNumber('-'), null);
    assert.equal(parseInventoryNumber('—'), null);
    assert.equal(parseInventoryNumber(''), null);
    assert.equal(parseInventoryNumber('abc'), null);
    assert.equal(parsePeriodQuantityValue('-'), null);
    assert.equal(parsePeriodQuantityValue('—'), null);
  });
});

describe('kho NVL — Tồn cuối', () => {
  it('tính đúng với số nghìn EN', () => {
    assert.equal(computeClosingStock('1,234.5', '10', '4.5'), '1240');
  });

  it('giữ "-" khi chưa chọn kỳ', () => {
    assert.equal(computeClosingStock('—', '1', '1'), '-');
  });
});

describe('kho NVL — ẩn dòng 0 trùng mã (view gộp)', () => {
  it('ẩn dòng 0/0/0 khi cùng mã đã phát sinh ở kho khác', () => {
    const rows = [
      { code: 'NVL-A', openingStock: '0', inbound: '0', outbound: '0' },
      { code: 'NVL-A', openingStock: '1,234.5', inbound: '0', outbound: '0' }
    ];
    const visible = filterDuplicateZeroWarehouseRows(rows);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].inbound, '0');
    assert.equal(visible[0].openingStock, '1,234.5');
  });

  it('giữ dòng 0 duy nhất của mã', () => {
    const rows = [{ code: 'NVL-B', openingStock: '0', inbound: '0', outbound: '0' }];
    assert.equal(filterDuplicateZeroWarehouseRows(rows).length, 1);
  });
});
