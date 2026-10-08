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

describe('don-hang miền nam — cột Màng và trích xuất màng', () => {
  it('extractMang trích xuất đúng màng từ tên sản xuất', async () => {
    const { extractMang } = await import('../../src/utils/productProductionName');
    assert.equal(extractMang('Nhựa Đặc Trắng 1.1li (1.22x30m) Màng SUNPC (Dán Tem 1.5li) Màu Hồng MVCC'), 'SUN PC');
    assert.equal(extractMang('Tấm nhựa đặc màu XDT 8ZEM - 1.22m - 30m hàng nguyên phế - SUN PC'), 'SUN PC');
    assert.equal(extractMang('Nhựa Đặc 1.1li Trắng (1.22x30m) Màng STANDA (Dán Tem 1.2li) MVCC'), 'STD');
    assert.equal(extractMang('Nhựa Đặc 1.1li Trắng (1.22x30m) ECO'), 'ECO');
    assert.equal(extractMang('Nhựa Đặc 1.1li Trắng (1.22x30m)'), '');
  });

  it('normalizeOrderProducts map đúng cột mang và totalWeight từ danh mục', async () => {
    const { normalizeOrderProducts } = await import('../../src/features/_shared/orderHelpers');
    const mockProducts = [
      {
        id: 'sp1',
        ma_amis: 'STD06-0.8li*1.22m',
        ten_san_pham: 'Tấm nhựa đặc',
        ten_san_xuat: 'Tấm nhựa đặc - SUN PC',
        mang: 'SUN PC',
        tong_trong_luong: '5.7',
        don_vi: 'Tấm',
        nhom_vthh: 'TP; PX Đặc'
      }
    ];
    const normalized = normalizeOrderProducts(mockProducts);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].mang, 'SUN PC');
    assert.equal(normalized[0].totalWeight, '5.7');
  });

  it('buildMaAmisMoi sinh mã đúng với màng', async () => {
    const { buildMaAmisMoi } = await import('../../src/utils/productProductionName');
    const code = buildMaAmisMoi({
      baseMaAmis: 'STD06-0.8li*1.22m',
      nhomVthh: 'TP; PX Đặc',
      mang: 'SUN PC'
    });
    assert.ok(code.includes('SUNPC'));
  });

  it('replaceMangInName thay thế hoặc xóa màng chính xác trong tên sản xuất và tên ghép', async () => {
    const { replaceMangInName } = await import('../../src/utils/productProductionName');

    // Dạng segment "- SUN PC" -> đổi sang màng khác
    assert.equal(
      replaceMangInName('TRẮNG 8ZEM - 30m - SUN PC', 'STD'),
      'TRẮNG 8ZEM - 30m - STD'
    );
    assert.equal(
      replaceMangInName('TẤM LẤY SÁNG ĐẶC 1.22M - 30M - SUN PC (đm 0.75 li)', 'ECO'),
      'TẤM LẤY SÁNG ĐẶC 1.22M - 30M - ECO (đm 0.75 li)'
    );

    // Dạng "Màng SUNPC" -> đổi sang màng khác
    assert.equal(
      replaceMangInName('Nhựa Đặc Trắng 1.1li (1.22x30m) Màng SUNPC (Dán Tem 1.5li) Màu Hồng MVCC', 'STD'),
      'Nhựa Đặc Trắng 1.1li (1.22x30m) Màng STD (Dán Tem 1.5li) Màu Hồng MVCC'
    );

    // Xóa màng khi newMang rỗng
    assert.equal(
      replaceMangInName('TRẮNG 8ZEM - 30m - SUN PC', ''),
      'TRẮNG 8ZEM - 30m'
    );
    assert.equal(
      replaceMangInName('TẤM LẤY SÁNG ĐẶC 1.22M - 30M - SUN PC (đm 0.75 li)', ''),
      'TẤM LẤY SÁNG ĐẶC 1.22M - 30M (đm 0.75 li)'
    );
    assert.equal(
      replaceMangInName('Nhựa Đặc Trắng 1.1li (1.22x30m) Màng SUNPC (Dán Tem 1.5li) Màu Hồng MVCC', ''),
      'Nhựa Đặc Trắng 1.1li (1.22x30m) (Dán Tem 1.5li) Màu Hồng MVCC'
    );

    // Tên ban đầu chưa có màng -> thêm màng
    assert.equal(
      replaceMangInName('TẤM NHỰA THÔNG MINH - 6M', 'SUN PC'),
      'TẤM NHỰA THÔNG MINH - 6M - SUN PC'
    );
    assert.equal(
      replaceMangInName('TẤM LẤY SÁNG ĐẶC 1.22M - 30M (đm 0.75 li)', 'SUN PC'),
      'TẤM LẤY SÁNG ĐẶC 1.22M - 30M - SUN PC (đm 0.75 li)'
    );

    // Màng tùy ý theo oldMangHint
    assert.equal(
      replaceMangInName('TẤM NHỰA THÔNG MINH - 6M - PE', 'HA', 'PE'),
      'TẤM NHỰA THÔNG MINH - 6M - HA'
    );
  });

  it('buildOrderTenGhep hỗ trợ override màng mới và xóa màng', async () => {
    const { buildOrderTenGhep } = await import('../../src/utils/productProductionName');
    const base = 'TRẮNG 8ZEM - 30m - SUN PC';
    const updated = buildOrderTenGhep(base, {
      nhomVthh: 'TP; PX Đặc',
      mang: 'ECO'
    });
    assert.ok(updated.includes('ECO'));
    assert.ok(!updated.includes('SUN PC'));

    const cleared = buildOrderTenGhep(base, {
      nhomVthh: 'TP; PX Đặc',
      mang: ''
    });
    assert.ok(!cleared.includes('SUN PC'));
  });
});


