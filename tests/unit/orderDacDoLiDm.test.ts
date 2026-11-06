import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  doLiTokenNumber,
  orderDacDoLiRealNumber,
  type OrderProductOption
} from '../../src/features/_shared/orderHelpers';
import {
  buildOrderTenGhep,
  doLiDmWeightScale
} from '../../src/utils/productProductionName';
import {
  catalogWeightLi,
  dacDoLiRealForProduct,
  resolveOrderDoLiDmField
} from '../../src/features/don-hang/dacDoLiDm';

const dacProduct: OrderProductOption = {
  id: 'p-dac',
  code: 'STD06-2li*1.82m',
  name: 'Tấm nhựa đặc màu TRẮNG',
  productionName: 'Tấm nhựa đặc màu TRẮNG - 2li ( đm 1.9 li ) - 1.82m - STD',
  group: 'TP; PX Đặc',
  unit: 'Tấm',
  newCode: '',
  tenGhep: 'Tấm nhựa đặc màu TRẮNG - 2li ( đm 1.9 li ) - 1.82m - STD',
  doDaiM: '1.82m',
  doDayM: '1.82m',
  doLiDm: '(đm 1.9 li)',
  doLi: '2li'
};

function dacField(fieldText: string, extra: Partial<Parameters<typeof resolveOrderDoLiDmField>[0]> = {}) {
  return resolveOrderDoLiDmField({
    isCutLikeOrder: true,
    group: dacProduct.group,
    nameHasZem: false,
    fieldText,
    savedDoLi: dacProduct.doLi,
    productionName: dacProduct.productionName,
    tenGhep: dacProduct.tenGhep,
    maAmis: dacProduct.code,
    savedDoLiDm: '(đm 1.9 li)',
    ...extra
  });
}

describe('ô Độ li ĐM hiển thị độ li định mức', () => {
  it('doLiTokenNumber đọc token li / số trần / (đm …), chặn kg', () => {
    assert.equal(doLiTokenNumber('2li'), '2');
    assert.equal(doLiTokenNumber('11.2li'), '11.2');
    assert.equal(doLiTokenNumber('(đm 1.9 li)'), '1.9');
    assert.equal(doLiTokenNumber('1,2'), '1.2');
    assert.equal(doLiTokenNumber('(đm 4.8 kg)'), '');
  });

  it('ưu tiên do_li, rồi token chính ngoài ngoặc, rồi mã AMIS', () => {
    assert.equal(
      orderDacDoLiRealNumber({
        doLi: '2.0li',
        tenSanXuat: 'Tấm nhựa đặc màu TRẮNG - 2li ( đm 1.9 li ) - 30m - 1.82m',
        savedDoLiDm: '(đm 1.8 li)'
      }),
      '2'
    );
    assert.equal(
      orderDacDoLiRealNumber({
        tenSanXuat: 'Tấm nhựa đặc màu TRẮNG - 2li ( đm 1.9 li ) - 30m - 1.82m',
        savedDoLiDm: '(đm 1.9 li)'
      }),
      '2'
    );
    assert.equal(
      orderDacDoLiRealNumber({ tenGhep: 'NHỰA ĐẶC - 11.2li - 3m (Dán Tem 5li)' }),
      '11.2'
    );
    assert.equal(
      orderDacDoLiRealNumber({ tenGhep: 'NHỰA ĐẶC - 3m (Dán Tem 5li) - 8li - (đm 7.7 li)' }),
      '8'
    );
    assert.equal(orderDacDoLiRealNumber({ maAmis: 'STD06-1.2li*1.22m' }), '1.2');
  });

  it('dacDoLiRealForProduct chỉ áp cho nhóm Đặc, bỏ hàng ZEM', () => {
    assert.equal(dacDoLiRealForProduct(dacProduct), '2');
    assert.equal(dacDoLiRealForProduct({ ...dacProduct, doLi: '', group: 'TP; PX Sóng' }), '');
    assert.equal(
      dacDoLiRealForProduct({
        ...dacProduct,
        code: 'STD06-6ZEM',
        productionName: 'Tấm nhựa đặc - 6ZEM - 1.82m',
        doLi: '',
        doLiDm: ''
      }),
      ''
    );
  });

  it('catalogWeightLi lấy (đm …) cả nhóm Đặc, không lấy độ li thực', () => {
    assert.equal(catalogWeightLi(dacProduct), '(đm 1.9 li)');
    assert.equal(catalogWeightLi({ ...dacProduct, doLi: '' }), '(đm 1.9 li)');
    assert.equal(catalogWeightLi({ ...dacProduct, group: 'TP; PX Rỗng', doLiDm: '(đm 1.4 li)' }), '(đm 1.4 li)');
  });

  it('hệ số trọng lượng nhận token li hai bên và vẫn chặn kg', () => {
    assert.equal(doLiDmWeightScale('2', '2li'), 1);
    assert.equal(doLiDmWeightScale('1.05', '2li'), 0.525);
    assert.ok(Math.abs((doLiDmWeightScale('1.05li', '(đm 1.2 li)') ?? 0) - 0.875) < 1e-9);
    assert.equal(doLiDmWeightScale('(đm 4.8 kg)', '2li'), null);
  });

  it('ô số 1.9 lưu thành (đm 1.9 li) và không đụng độ li thực', () => {
    const fields = dacField('1.9');
    assert.equal(fields.isDacField, false);
    assert.equal(fields.changed, false);
    assert.equal(fields.doLiDmValue, '(đm 1.9 li)');
    assert.equal(fields.doLiStored, '');
  });

  it('sửa ô thành 1.4 chỉ đổi độ li định mức, giữ token độ li chính', () => {
    const fields = dacField('1.4');
    assert.equal(fields.doLiDmValue, '(đm 1.4 li)');
    assert.equal(fields.doLiStored, '');
    assert.equal(fields.fieldToken, '');

    const tenGhep = buildOrderTenGhep(dacProduct.productionName, {
      nhomVthh: dacProduct.group,
      cutLengthM: 30,
      doLiDm: fields.doLiDmValue
    });
    assert.match(tenGhep, /2li/);
    assert.match(tenGhep, /\(đm 1\.4 li\)/);
  });

  it('nhóm khác giữ nguyên luật đọc (đm …) từ ô', () => {
    const fields = resolveOrderDoLiDmField({
      isCutLikeOrder: true,
      group: 'TP; PX Rỗng',
      nameHasZem: false,
      fieldText: '1.4',
      savedDoLi: '2li',
      productionName: 'Tấm nhựa rỗng - 2li ( đm 1.8 li ) - 1.82m'
    });
    assert.equal(fields.isDacField, false);
    assert.equal(fields.doLiDmValue, '(đm 1.4 li)');
    assert.equal(fields.doLiStored, '');
  });
});
