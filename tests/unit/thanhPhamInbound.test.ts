import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterLenhSxForTpInbound,
  mergeProductsFromLenhSx,
  tpInboundMachineMatches
} from '../../src/features/phieu-xuat-nhap-kho/thanhPhamInbound';

describe('tp inbound lệnh SX', () => {
  const machines = [
    { code: 'M01', name: 'Máy 01' },
    { code: 'M02', name: 'Máy 02' }
  ];

  const orders = [
    {
      orderCode: 'LSX-1',
      machine: 'Máy 01',
      startDate: '2026-09-22',
      endDate: '2026-09-22',
      lines: [
        { code: 'SP1', name: 'Tam A', unit: 'Tấm', quantity: 10 },
        { code: 'SP2', name: 'Tam B', unit: 'Tấm', quantity: 5 }
      ]
    },
    {
      orderCode: 'LSX-2',
      machine: 'M02',
      startDate: '2026-09-20',
      endDate: '2026-09-25',
      lines: [{ code: 'SP3', name: 'Cuon C', unit: 'Cuộn', quantity: 2 }]
    },
    {
      orderCode: 'LSX-3',
      machine: 'Máy 01',
      startDate: '2026-09-21',
      endDate: '2026-09-21',
      lines: [{ code: 'SP9', name: 'Khac', unit: 'Tấm', quantity: 1 }]
    }
  ];

  it('matches machine by name or code', () => {
    assert.equal(tpInboundMachineMatches('Máy 01', 'M01 · Máy 01', machines), true);
    assert.equal(tpInboundMachineMatches('M02', 'Máy 02', machines), true);
    assert.equal(tpInboundMachineMatches('Máy 01', 'Máy 02', machines), false);
  });

  it('filters lệnh SX by date + machine', () => {
    const filtered = filterLenhSxForTpInbound(orders, '2026-09-22', ['Máy 01'], machines);
    assert.deepEqual(
      filtered.map(order => order.orderCode),
      ['LSX-1']
    );

    const byRange = filterLenhSxForTpInbound(orders, '2026-09-22', ['Máy 02'], machines);
    assert.deepEqual(
      byRange.map(order => order.orderCode),
      ['LSX-2']
    );

    const multi = filterLenhSxForTpInbound(orders, '2026-09-22', ['Máy 01', 'Máy 02'], machines);
    assert.deepEqual(
      multi.map(order => order.orderCode).sort(),
      ['LSX-1', 'LSX-2']
    );
  });

  it('merges products from selected lệnh SX', () => {
    const merged = mergeProductsFromLenhSx([
      {
        ...orders[0],
        lines: [
          {
            code: 'SP1',
            name: 'Tam A',
            productionName: 'Tam A 0.1×2m',
            unit: 'Tấm',
            quantity: 10,
            weightKg: 20,
            areaM2: 5,
            lengthM: 30,
            kgPerUnit: 2,
            m2PerUnit: 0.5,
            mDaiPerUnit: 3
          },
          {
            code: 'SP2',
            name: 'Tam B',
            productionName: 'Tam B ghép',
            unit: 'Tấm',
            quantity: 5,
            weightKg: 5,
            areaM2: 1,
            lengthM: 5,
            kgPerUnit: 1,
            m2PerUnit: 0.2,
            mDaiPerUnit: 1
          }
        ]
      },
      {
        ...orders[0],
        orderCode: 'LSX-1b',
        lines: [
          {
            code: 'SP1',
            name: 'Tam A',
            productionName: 'Tam A 0.1×2m',
            unit: 'Tấm',
            quantity: 3,
            weightKg: 6,
            areaM2: 1.5,
            lengthM: 9,
            kgPerUnit: 2,
            m2PerUnit: 0.5,
            mDaiPerUnit: 3
          }
        ]
      }
    ]);
    assert.equal(merged.length, 2);
    const sp1 = merged.find(row => row.code === 'SP1');
    assert.equal(sp1?.quantity, 13);
    assert.equal(sp1?.productionName, 'Tam A 0.1×2m');
    assert.equal(sp1?.weightKg, 26);
    assert.equal(sp1?.areaM2, 6.5);
    assert.equal(sp1?.lengthM, 39);
  });

  it('không gộp cùng mã khác tên ghép (2 variant mét cắt khác nhau)', () => {
    const merged = mergeProductsFromLenhSx([
      {
        orderCode: 'LSX-A',
        machine: 'Máy 01',
        startDate: '2026-09-22',
        endDate: '2026-09-22',
        lines: [
          {
            code: 'SP1',
            name: 'Tam A',
            productionName: 'Tam A - 6m',
            unit: 'Tấm',
            quantity: 100,
            weightKg: 500,
            kgPerUnit: 5
          }
        ]
      },
      {
        orderCode: 'LSX-B',
        machine: 'Máy 01',
        startDate: '2026-09-22',
        endDate: '2026-09-22',
        lines: [
          {
            code: 'SP1',
            name: 'Tam A',
            productionName: 'Tam A - 8m',
            unit: 'Tấm',
            quantity: 50,
            weightKg: 300,
            kgPerUnit: 6
          }
        ]
      }
    ]);
    assert.equal(merged.length, 2);
    const v6m = merged.find(row => row.productionName === 'Tam A - 6m');
    const v8m = merged.find(row => row.productionName === 'Tam A - 8m');
    assert.equal(v6m?.quantity, 100);
    assert.equal(v6m?.weightKg, 500);
    assert.equal(v6m?.kgPerUnit, 5);
    assert.equal(v8m?.quantity, 50);
    assert.equal(v8m?.weightKg, 300);
    assert.equal(v8m?.kgPerUnit, 6);
  });

  it('không gộp cùng mã + tên ghép nhưng khác hệ số 1 SP', () => {
    const merged = mergeProductsFromLenhSx([
      {
        orderCode: 'LSX-A',
        machine: 'Máy 01',
        startDate: '2026-09-22',
        endDate: '2026-09-22',
        lines: [
          { code: 'SP1', name: 'Tam A', productionName: 'Tam A', unit: 'Tấm', quantity: 10, weightKg: 50, kgPerUnit: 5 }
        ]
      },
      {
        orderCode: 'LSX-B',
        machine: 'Máy 01',
        startDate: '2026-09-22',
        endDate: '2026-09-22',
        lines: [
          { code: 'SP1', name: 'Tam A', productionName: 'Tam A', unit: 'Tấm', quantity: 10, weightKg: 60, kgPerUnit: 6 }
        ]
      }
    ]);
    assert.equal(merged.length, 2);
  });
});
