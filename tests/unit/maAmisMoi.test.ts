import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMaAmisMoi, mvByMauTem } from '../../src/utils/productProductionName';
import { inferKhoChinhTuNhom, variantCodeForCatPiece } from '../../src/features/lenh-cat-le/logic';

describe('mã AMIS mới — buildMaAmisMoi', () => {
  it('Đặc hạ mét + đm + màng + tem đầy đủ', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STD06-0.8li*1.22m',
        nhomVthh: 'TP; PX Đặc',
        cutLengthM: 3,
        doLiDm: '0.75',
        mang: 'ECO',
        tem: '1.2li',
        mauTem: 'Vàng',
        danTem2Dau: true
      }),
      'STD06-0.8li*1.22m-3m (đm 0.75 li) màng ECO - T1.2-MVKH-2DAU'
    );
  });

  it('Sóng NP2 + Giá rẻ chuẩn hóa, thêm mét cắt', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STS06-5.0kg -NP2 Giá rẻ',
        nhomVthh: 'TP; PX Sóng',
        cutLengthM: 6
      }),
      'STS06-5.0kg-6m-NP2'
    );
  });

  it('Rỗng thay mét dài đã có, giữ NP', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'ECR02-5li-5.8m-NP',
        nhomVthh: 'TP; PX Rỗng',
        cutLengthM: 6
      }),
      'ECR02-5li-6m-NP'
    );
  });

  it('Hạ li thật thay token li', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STD06-10li*2.10m',
        nhomVthh: 'TP; PX Đặc',
        doLi: '8li',
        cutLengthM: 3
      }),
      'STD06-8li*2.10m-3m'
    );
  });

  it('Không biến thể nào thì trả mã chuẩn hóa', () => {
    assert.equal(
      buildMaAmisMoi({ baseMaAmis: 'STD02-2.5li*1.52m-NP', nhomVthh: 'TP; PX Đặc' }),
      'STD02-2.5li*1.52m-NP'
    );
  });

  it('màu lạ quy về MVCC', () => {
    assert.equal(mvByMauTem('Vàng'), 'MVKH');
    assert.equal(mvByMauTem('Hồng'), 'MVCC');
    assert.equal(mvByMauTem('Tím lạ'), 'MVCC');
  });

  it('suy kho chính từ nhóm VTHH', () => {
    assert.equal(inferKhoChinhTuNhom('TP; PX Đặc'), 'Kho Đặc');
    assert.equal(inferKhoChinhTuNhom('TP; PX Sóng'), 'Kho Sóng');
    assert.equal(inferKhoChinhTuNhom('TP; PX Rỗng'), 'Kho Sóng');
    assert.equal(inferKhoChinhTuNhom('Khác'), '');
  });

  it('mã biến thể cho SP cắt sau cắt', () => {
    assert.equal(
      variantCodeForCatPiece({
        baseMaAmis: 'STD06-0.8li*1.22m',
        nhomVthh: 'TP; PX Đặc',
        motherDaiM: '30m',
        pieceDaiM: '3m',
        motherLi: '0.8li',
        pieceLi: '0.8li',
        mang: 'ECO'
      }),
      'STD06-0.8li*1.22m-3m màng ECO'
    );
    assert.equal(
      variantCodeForCatPiece({
        baseMaAmis: 'STD06-0.8li*1.22m',
        nhomVthh: 'TP; PX Đặc',
        motherDaiM: '30m',
        pieceDaiM: '30m',
        motherLi: '0.8li',
        pieceLi: '0.8li',
        mang: ''
      }),
      ''
    );
  });
});
