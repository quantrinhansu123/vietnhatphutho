import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  listProductionNamesByCode,
  matchOrderProductByCodeAndProductionName,
  type OrderProductOption
} from '../../src/features/_shared/orderHelpers';

function option(partial: Partial<OrderProductOption> & { id: string }): OrderProductOption {
  return {
    code: '',
    name: '',
    productionName: '',
    group: '',
    unit: 'Tấm',
    newCode: '',
    tenGhep: '',
    doDaiM: '',
    doLiDm: '',
    ...partial
  };
}

const catalog: OrderProductOption[] = [
  option({ id: 'p1', code: 'STS06-5.0kg-NP', name: 'Tấm nhựa sóng Standar', productionName: 'NHỰA SÓNG TRẮNG - NP' }),
  option({ id: 'p2', code: 'STS06-5.0kg-NP', name: 'Tấm nhựa sóng Khác', productionName: 'NHỰA SÓNG TRẮNG - KHÁC' }),
  option({ id: 'p3', code: 'OTHER-01', name: 'Tấm khác', productionName: 'TÊN SX KHÁC' }),
  option({ id: 'np1', code: 'STD06-0.8li*1.22m-NP', name: 'Tấm nhựa đặc Standard phế', productionName: 'TRẮNG 8ZEM - 30m - STD' }),
  option({ id: 'np2', code: 'STD06-0.8li*1.22m-NP', name: 'Tấm nhựa đặc Standard phế', productionName: 'TRẮNG 8ZEM - 30m - SUN PC' }),
  option({ id: 'np3', code: 'STD06-0.8li*1.22m-NP', name: 'Tấm nhựa đặc Standard phế', productionName: 'TRẮNG 8ZEM - 30m - ECO' })
];

describe('don-hang — tên sản xuất theo mã AMIS', () => {
  it('hiện mọi tên SX của mã, không lọc theo Tên SP', () => {
    assert.deepEqual(listProductionNamesByCode(catalog, 'STS06-5.0kg-NP'), [
      'NHỰA SÓNG TRẮNG - KHÁC',
      'NHỰA SÓNG TRẮNG - NP'
    ]);
  });

  it('mã trống trả rỗng', () => {
    assert.deepEqual(listProductionNamesByCode(catalog, '  '), []);
  });

  it('chọn tên SX thuộc variant khác vẫn lưu đúng dòng danh mục', () => {
    const match = matchOrderProductByCodeAndProductionName(
      catalog,
      'STS06-5.0kg-NP',
      'NHỰA SÓNG TRẮNG - KHÁC',
      'p1',
      'Tấm nhựa sóng Standar'
    );
    assert.equal(match?.id, 'p2');
    assert.equal(match?.name, 'Tấm nhựa sóng Khác');
  });

  it('chọn lại đúng tên cũ giữ nguyên dòng đang chọn', () => {
    const dup: OrderProductOption[] = [
      ...catalog,
      option({ id: 'p4', code: 'STS06-5.0kg-NP', name: 'Tấm nhựa sóng Khác', productionName: 'NHỰA SÓNG TRẮNG - KHÁC' })
    ];
    const match = matchOrderProductByCodeAndProductionName(
      dup,
      'STS06-5.0kg-NP',
      'NHỰA SÓNG TRẮNG - KHÁC',
      'p4',
      'Tấm nhựa sóng Khác'
    );
    assert.equal(match?.id, 'p4');
  });

  it('tên SX không thuộc mã trả null để form không gán nhầm', () => {
    assert.equal(
      matchOrderProductByCodeAndProductionName(catalog, 'STS06-5.0kg-NP', 'TÊN KHÔNG TỒN TẠI', 'p1'),
      null
    );
    assert.equal(matchOrderProductByCodeAndProductionName(catalog, 'STS06-5.0kg-NP', '  '), null);
  });

  it('mã cũ đã đổi (không khớp danh mục): suy mã qua tên SX đang lưu, hiện đủ variant cùng mã', () => {
    assert.deepEqual(
      listProductionNamesByCode(catalog, 'STD06-0.8li*1.22r', 'TRẮNG 8ZEM - 30m - SUN PC'),
      ['TRẮNG 8ZEM - 30m - ECO', 'TRẮNG 8ZEM - 30m - STD', 'TRẮNG 8ZEM - 30m - SUN PC']
    );
  });

  it('mã cũ đã đổi: chọn variant suy ra đúng id dòng danh mục mới', () => {
    const match = matchOrderProductByCodeAndProductionName(
      catalog,
      'STD06-0.8li*1.22r',
      'TRẮNG 8ZEM - 30m - ECO',
      '',
      ''
    );
    assert.equal(match?.id, 'np3');
    assert.equal(match?.code, 'STD06-0.8li*1.22m-NP');
  });
});
