import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderProductsFromRecord } from '../../src/features/_shared/orderRecordHelpers';
import { formatProductionNameWithLength } from '../../src/features/_shared/productionProductHelpers';
import { catalogMatchesProductionName } from '../../src/features/_shared/orderHelpers';

describe('Tên sản xuất là nguồn duy nhất của đơn hàng và lệnh SX', () => {
  it('tên ghép cũ 6m không ghi đè tên sản xuất 2m khi đọc/in', () => {
    const name = 'NHỰA SÓNG XDT - NP - 11 SÓNG - 5.78ZEM - (đm 5 kg/6m) - 2m';
    const oldName = name.replace(/2m$/, '6m');
    const [line] = parseOrderProductsFromRecord({ san_pham: [{
      ma_sp: 'STS02', ten_sp: 'Nhựa sóng', ten_san_xuat: name,
      ten_ghep: oldName, so_luong: 100, don_vi: 'Tấm'
    }] });
    assert.equal(line.productionName, name);
    assert.equal(Object.hasOwn(line, 'tenGhep'), false);
    assert.equal(formatProductionNameWithLength(line.productionName!, 6, { tenGhep: oldName }), name);
  });
  it('tên ghép trên danh mục cũ không được dùng để khớp biến thể', () => {
    assert.equal(catalogMatchesProductionName({ productionName: 'Nhựa sóng - 2m', tenGhep: 'Nhựa sóng - 6m' }, 'Nhựa sóng - 6m'), false);
  });
});
