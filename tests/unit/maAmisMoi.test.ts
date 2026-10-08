import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abbreviateHangPhe, buildMaAmisMoi, mvByMauTem, replaceCutWidthMeters } from '../../src/utils/productProductionName';
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
      'STD06-0.75li*1.22m-3m-ECO - TEM1.2li-MVKH-2DAU'
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

  it('độ li ĐM thay token li trong mã, không thêm DM', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STD06-6li',
        nhomVthh: 'TP; PX Đặc',
        doLiDm: '6.7'
      }),
      'STD06-6.7li'
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

  it('tên không có tem thì mã mới không gắn TEM', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STD02-6.0li*1.56m',
        nhomVthh: 'TP; PX Đặc',
        cutLengthM: 10,
        mang: 'STD'
      }),
      'STD02-6.0li*1.56m-10m-STD'
    );
  });

  it('tem + màu + dán 2 đầu thành TEM..-MV..-2DAU', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STD02-6.0li*1.56m',
        nhomVthh: 'TP; PX Đặc',
        cutLengthM: 10,
        mang: 'STD',
        tem: '1.5li',
        mauTem: 'Vàng',
        danTem2Dau: true
      }),
      'STD02-6.0li*1.56m-10m-STD - TEM1.5li-MVKH-2DAU'
    );
  });

  it('100% phế trong tên viết tắt 100PHE trên mã mới', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STD02-6.0li*1.56m',
        nhomVthh: 'TP; PX Đặc',
        cutLengthM: 10,
        doLiDm: '5.7',
        mang: 'STD',
        hangPhe: 'hàng chạy 100% phế'
      }),
      'STD02-5.7li*1.56m-10m-100PHE-STD'
    );
    assert.equal(abbreviateHangPhe('hàng nguyên phế'), 'NGPHE');
    assert.equal(abbreviateHangPhe('(GIÁ RẺ)'), 'NP2');
  });

  it('hạ khổ rộng thay token *m và nằm trong mã mới', () => {
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STD06-0.8li*1.22m',
        nhomVthh: 'TP; PX Đặc',
        cutLengthM: 3,
        cutWidthM: 1
      }),
      'STD06-0.8li*1m-3m'
    );
    assert.equal(
      buildMaAmisMoi({
        baseMaAmis: 'STS06-5.0kg-NP2',
        nhomVthh: 'TP; PX Sóng',
        cutLengthM: 6,
        cutWidthM: 1.2
      }),
      'STS06-5.0kg*1.2m-6m-NP2'
    );
    assert.equal(
      replaceCutWidthMeters('Tấm - 1.22m - 8m', 1, 1.22, 8),
      'Tấm - 1m - 8m'
    );
    assert.equal(
      replaceCutWidthMeters('NHỰA SÓNG - 6m', 1.2, undefined, 6),
      'NHỰA SÓNG - 1.2m - 6m'
    );
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
      'STD06-0.8li*1.22m-3m-ECO'
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
