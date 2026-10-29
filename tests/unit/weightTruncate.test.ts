/**
 * Quy đổi trọng lượng giữ 3 chữ số sau dấu phẩy bằng CẮT SỐ (không làm tròn).
 * Chạy: npx tsx --test tests/unit/weightTruncate.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { truncateTo3Decimals } from '../../src/utils/weightTruncate';
import { southScaledTlAndTotal, southFallbackTlAndTotal, parseSouthDinhMucKg } from '../../src/features/don-hang/southWeight';
import {
  conversionRatesForEntry,
  scaleProductionEntryQuantity
} from '../../src/features/ke-hoach-san-xuat/entryConversion';
import { calculateCutOrderWeight, type OrderProductConversion } from '../../src/features/_shared/orderHelpers';

describe('truncateTo3Decimals — cắt số, không làm tròn', () => {
  it('cắt phần tử sau chữ số thứ 3 (không tăng lên)', () => {
    assert.equal(truncateTo3Decimals(12.34567), 12.345);
    assert.equal(truncateTo3Decimals(12.3459), 12.345);
    assert.equal(truncateTo3Decimals(0.9999), 0.999);
    assert.equal(truncateTo3Decimals(12), 12);
  });

  it('bù sai số nhị phân của JS', () => {
    // 0.145 × 3 = 0.435 đúng trong thập phân; float JS ra 0.43499999999999994.
    assert.equal(truncateTo3Decimals(0.145 * 3), 0.435);
  });
});

describe('southWeight — cắt 3 số lẻ', () => {
  it('TL/tấm và Tổng KG cắt 3 số lẻ', () => {
    const { tl, total } = southScaledTlAndTotal(0.3333333, 2, 7);
    assert.equal(tl, 0.666);
    assert.equal(total, 4.662);
  });

  it('fallback định mức cắt 3 số lẻ', () => {
    const result = southFallbackTlAndTotal('1.33333', 6);
    assert.deepEqual(result, { tl: 1.333, total: 7.998 });
    // 0.12345 mg… cắt chứ không làm tròn thành 0.124
    assert.equal(parseSouthDinhMucKg('0.12345'), 0.123);
  });
});

describe('calculateCutOrderWeight — cắt 3 số lẻ', () => {
  const conversion: OrderProductConversion = {
    id: 1, sanPhamId: 'sp1', maSp: 'A', maAmis: 'A', donViTinh: 'Tấm',
    khoTamRongM: null, khoTamDaiM: null, khoCuonRongM: null, khoCuonDaiM: null,
    dienTichM2: null, trongLuongKgMDai: 0.3333333, trongLuongKgM2: null,
    trongLuongKgTam: null, trongLuongKgCuon: null
  };

  it('KG/1 SP và Tổng KG cắt 3 số lẻ, không làm tròn', () => {
    const result = calculateCutOrderWeight('2.8', '7', conversion, 'Tấm');
    // 2.8 × 0.3333333 = 0.9333324 → cắt 0.933 (round sẽ cho 0.93/0.94)
    assert.equal(result?.kg1Sp, 0.933);
    // 0.933 × 7 = 6.531
    assert.equal(result?.tongKg, 6.531);
  });

  it('tổng cắt chứ không làm tròn lên', () => {
    const result = calculateCutOrderWeight('1', '1.0001', conversion);
    // 0.3333333 → cắt KG/1 SP = 0.333; 0.333 × 1.0001 = 0.333033 → cắt 0.333
    assert.equal(result?.kg1Sp, 0.333);
    assert.equal(result?.tongKg, 0.333);
  });
});

describe('TL/tấm × SL chẵn — luôn đúng, không lệch float', () => {
  /**
   * So khớp ở thang phần nghìn: kết quả ×1000 (làm tròn về số nguyên) phải bằng
   * đúng tích nguyên của nghìn-lít TL × SL. Bằng cách này mọi phép nhân với SL
   * chẵn (không sinh thêm số lẻ ngoài 3 chữ số) phải cho Tổng chính xác tuyệt đối,
   * không hụt 0.001 do sai số float, kể cả vốn liếng float sát dưới (0.145×3 →
   * 0.43499999999999994) — epsilon bù trong truncateTo3Decimals lo phần này.
   */
  const tlGiaiDoan3So = [0.145, 0.57, 0.29, 0.585, 0.933, 1.234, 0.333, 2.675, 0.123, 0.456, 0.567, 0.789, 0.346, 4.8, 5.7];
  const slChan = [2, 4, 6, 8, 10, 100, 1000];

  const nghinLit = (value: number) => Math.round(value * 1000);

  it('truncateTo3Decimals(tl × SL chẵn) = đúng tích thập phân', () => {
    for (const tl of tlGiaiDoan3So) {
      for (const sl of slChan) {
        const expected = nghinLit(tl) * sl;
        const actual = Math.round(truncateTo3Decimals(tl * sl) * 1000);
        assert.ok(
          actual === expected,
          `TL ${tl} × SL ${sl}: nghìn-lít kỳ vọng ${expected}, thực tế ${actual}`
        );
      }
    }
  });

  it('southScaledTlAndTotal: Tổng × SL chẵn khớp tuyệt đối với TL/tấm', () => {
    const kgPerMeter = 0.2142;
    const daiM = 2.8;
    const { tl, total } = southScaledTlAndTotal(kgPerMeter, daiM, 500);
    // Nghìn-lít Tổng phải bằng nghìn-lít TL × SL chẵn.
    assert.equal(nghinLit(total), nghinLit(tl) * 500);
    // Tích lặp lại nhiều SL chẵn khác nhau vẫn khớp tuyệt đối.
    for (const sl of [2, 4, 6, 10, 48, 150]) {
      const again = southScaledTlAndTotal(kgPerMeter, daiM, sl);
      assert.equal(nghinLit(again.total), nghinLit(again.tl) * sl);
    }
  });

  it('calculateCutOrderWeight: Tổng × SL chẵn khớp tuyệt đối với KG/1 SP', () => {
    const conversion: OrderProductConversion = {
      id: 2, sanPhamId: 'sp2', maSp: 'B', maAmis: 'B', donViTinh: 'Tấm',
      khoTamRongM: null, khoTamDaiM: null, khoCuonRongM: null, khoCuonDaiM: null,
      dienTichM2: null, trongLuongKgMDai: 0.123, trongLuongKgM2: null,
      trongLuongKgTam: null, trongLuongKgCuon: null
    };
    // kg/1 SP = 2.8 × 0.123 = 0.3444 → cắt 0.344; mọi SL chẵn × TL đều chính xác ở thang phần nghìn.
    for (const sl of [2, 4, 6, 8, 10, 100, 320]) {
      const result = calculateCutOrderWeight('2.8', String(sl), conversion, 'Tấm');
      assert.ok(result, `SL ${sl} phải có kết quả`);
      assert.equal(nghinLit(result.tongKg), nghinLit(result.kg1Sp) * sl);
    }
  });

  it('scaleProductionEntryQuantity (lệnh SX đổi SL): suất × SL chẵn không lệch', () => {
    const base = {
      quantity: '100',
      tongKg: '64.2',
      m2: '40',
      mDai: '200',
      conversionResults: [
        { unit: 'kg', value: 64.2 },
        { unit: 'm2', value: 40 },
        { unit: 'm dài', value: 200 }
      ]
    };
    for (const sl of [2, 4, 50, 250, 1000]) {
      const next = scaleProductionEntryQuantity(base as any, String(sl)) as { tongKg?: string; m2?: string; mDai?: string };
      // Suất 1 SP = 64.2 ÷ 100 = 0.642 → × SL chẵn luôn chính xác tới nghìn-lít.
      assert.equal(Number(next.tongKg ? (next.tongKg ?? '0').replace(',', '.') : '0') * 1000, nghinLit(0.642) * sl);
      assert.equal(Number(String(next.m2 ?? '0').replace(',', '.')) * 1000, nghinLit(0.4) * sl);
      assert.equal(Number(String(next.mDai ?? '0').replace(',', '.')) * 1000, nghinLit(2) * sl);
    }
  });
});
