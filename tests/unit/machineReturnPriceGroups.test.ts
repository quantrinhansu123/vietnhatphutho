import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findExceededMachinePriceGroup, machinePriceGroupKey } from '../../src/features/xuat-nhap-tong-hop/machineReturnPriceGroups';

const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('vi');

describe('Sổ trộn: nhập lại được giới hạn theo mã + kho đã cấp + đơn giá', () => {
  const issued = new Map<string, number>();
  const requested: Array<{ code: string; warehouse: string; unitPrice: number; quantity: number }> = [];
  for (let product = 1; product <= 10; product += 1) {
    for (let priceIndex = 1; priceIndex <= 4; priceIndex += 1) {
      const row = {
        code: `NVL-${String(product).padStart(2, '0')}`,
        warehouse: 'Kho NVL chính',
        unitPrice: priceIndex * 1000,
        quantity: 8
      };
      issued.set(machinePriceGroupKey(row.code, row.warehouse, row.unitPrice, normalize), 10);
      requested.push(row);
    }
  }

  it('chấp nhận 10 mã × 4 giá khi từng lớp còn đủ lượng đã cấp', () => {
    assert.equal(findExceededMachinePriceGroup(requested, issued, new Map(), normalize), null);
  });

  it('tính nhập lại trước theo đúng giá, không lấy nhầm lượng của giá khác', () => {
    const key = machinePriceGroupKey('NVL-01', 'Kho NVL chính', 1000, normalize);
    const exceeded = findExceededMachinePriceGroup(
      [{ code: 'NVL-01', warehouse: 'Kho NVL chính', unitPrice: 1000, quantity: 6 }],
      issued,
      new Map([[key, 5]]),
      normalize
    );
    assert.deepEqual(exceeded, {
      code: 'NVL-01', warehouse: 'Kho NVL chính', unitPrice: 1000, quantity: 6, available: 5
    });
  });

  it('không gộp hai kho hoặc hai đơn giá của cùng mã', () => {
    const sameMaterial = [
      { code: 'NVL-01', warehouse: 'Kho NVL chính', unitPrice: 1000, quantity: 10 },
      { code: 'NVL-01', warehouse: 'Kho NVL phụ', unitPrice: 1000, quantity: 1 }
    ];
    assert.equal(findExceededMachinePriceGroup(sameMaterial, issued, new Map(), normalize)?.available, 0);
  });

  it('cho phép lớp giá nhập tay khi mã cũ chưa có lịch sử cấp theo giá', () => {
    assert.equal(
      findExceededMachinePriceGroup(
        [{ code: 'NVL-LEGACY', warehouse: 'Kho NVL chính', unitPrice: 7000, quantity: 2 }],
        new Map(),
        new Map(),
        normalize
      ),
      null
    );
  });

  it('làm tròn khóa giá nhất quán đến bốn chữ số thập phân', () => {
    assert.equal(
      machinePriceGroupKey('NVL-01', 'Kho NVL chính', 1234.56789, normalize),
      machinePriceGroupKey('NVL-01', 'Kho NVL chính', 1234.5679, normalize)
    );
  });
});
