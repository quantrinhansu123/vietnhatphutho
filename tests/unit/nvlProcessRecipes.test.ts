import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  machineNeedsLoaiSanXuat,
  NVL_PROCESS_RECIPES,
  suggestedKhoForPheMa,
  transformMa
} from '../../src/features/xuat-nhap-tong-hop/nvlProcessRecipes';

describe('nvlProcessRecipes', () => {
  it('có đủ 7 quy trình', () => {
    assert.equal(NVL_PROCESS_RECIPES.length, 7);
    assert.ok(NVL_PROCESS_RECIPES.every(item => item.steps.length > 0));
  });

  it('đổi mã tạo hạt / băm', () => {
    assert.equal(transformMa('MN02'), 'MN06');
    assert.equal(transformMa('MN05'), 'MN04');
    assert.equal(transformMa('SX02'), 'SX03');
    assert.equal(transformMa('SX06'), 'SX03');
  });

  it('rule kho phế SX01 / SX06', () => {
    assert.equal(suggestedKhoForPheMa('SX01'), 'Kho PC');
    assert.equal(suggestedKhoForPheMa('SX06'), 'Kho NVL Chính');
    assert.equal(suggestedKhoForPheMa('MN03'), null);
  });

  it('Máy Sóng cần Loại sản xuất', () => {
    assert.equal(machineNeedsLoaiSanXuat('Máy Sóng 1'), true);
    assert.equal(machineNeedsLoaiSanXuat('Máy Đặc 1'), false);
  });
});
