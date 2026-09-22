/**
 * Unit test logic phiếu NVL — chạy: npx tsx --test tests/unit/nvlSlipLogic.test.ts
 * Không cần DB / backend.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAI_NHAP_KHO_OPTIONS,
  isMachineSuggestedInboundKind,
  computeWarehouseLineTonCuoi,
  resolveShiftLoaiCa,
  validateWarehouseShiftsSameLoaiCa,
  computeNvlClosingStock,
  resolveWarehouseLineProductionName,
  resolveDefaultTonDauRef,
  warehouseLineClassRank,
  insertWarehouseLineByClass
} from '../../src/features/phieu-xuat-nhap-kho/nvlSlipLogic';

const SETTINGS = [
  { code: 'HC1', name: 'HC1', loaiCa: 'Ca8H' },
  { code: 'HC2', name: 'HC2', loaiCa: 'Ca8H' },
  { code: 'HC3', name: 'HC3', loaiCa: 'Ca8H' },
  { code: '12C1', name: '12C1', loaiCa: 'Ca12H' },
  { code: '12C2', name: '12C2', loaiCa: 'Ca12H' },
  { code: 'HC', name: 'HC', loaiCa: '' }
];

describe('nvlSlipLogic — loai nhap kho', () => {
  it('goi y dung 4 gia tri chot', () => {
    assert.deepEqual([...LOAI_NHAP_KHO_OPTIONS], [
      'NVL mua ngoài',
      'Phế mua ngoài',
      'Nhập kho tạo hạt',
      'Nhập lại vật tư sản xuất'
    ]);
  });

  it('chi goi y May khi Nhap lai VTSX / Tao hat', () => {
    assert.equal(isMachineSuggestedInboundKind('Nhập kho tạo hạt'), true);
    assert.equal(isMachineSuggestedInboundKind('Nhập lại vật tư sản xuất'), true);
    assert.equal(isMachineSuggestedInboundKind('NVL mua ngoài'), false);
    assert.equal(isMachineSuggestedInboundKind(''), false);
    assert.equal(isMachineSuggestedInboundKind(null), false);
  });
});

describe('nvlSlipLogic — Ton cuoi = Ton dau + Nhap − SL thuc', () => {
  it('du 3 so: 100 + 20 − 30 = 90', () => {
    assert.equal(
      computeWarehouseLineTonCuoi({ tonDauCaMay: '100', documentQuantity: '20', quantity: '30' }),
      90
    );
  });

  it('thieu SL CT: 100 + 0 − 30 = 70', () => {
    assert.equal(computeWarehouseLineTonCuoi({ tonDauCaMay: '100', quantity: '30' }), 70);
  });

  it('chua nhap SL thuc → null (khong hien Ton cuoi)', () => {
    assert.equal(computeWarehouseLineTonCuoi({ tonDauCaMay: '100', quantity: '' }), null);
    assert.equal(computeWarehouseLineTonCuoi({ tonDauCaMay: '100', quantity: '0' }), null);
  });

  it('ton am → cho phep hien so am (bao loi ton kho)', () => {
    assert.equal(computeWarehouseLineTonCuoi({ tonDauCaMay: '10', quantity: '30' }), -20);
  });
});

describe('nvlSlipLogic — multi-ca cung loai_ca', () => {
  it('0/1 ca → hop le', () => {
    assert.equal(validateWarehouseShiftsSameLoaiCa([], SETTINGS), '');
    assert.equal(validateWarehouseShiftsSameLoaiCa(['HC1'], SETTINGS), '');
  });

  it('HC1 + HC2 (cung Ca8H) → hop le', () => {
    assert.equal(validateWarehouseShiftsSameLoaiCa(['HC1', 'HC2'], SETTINGS), '');
  });

  it('HC1 + 12C1 (khac loai) → bao loi', () => {
    const message = validateWarehouseShiftsSameLoaiCa(['HC1', '12C1'], SETTINGS);
    assert.match(message, /cùng Loại ca/);
    assert.match(message, /Ca8H \+ Ca12H/);
  });

  it('ca chua xep loai → bo qua, khong chan', () => {
    assert.equal(validateWarehouseShiftsSameLoaiCa(['HC', 'HC1'], SETTINGS), '');
    assert.equal(resolveShiftLoaiCa('HC', SETTINGS), '');
    assert.equal(resolveShiftLoaiCa('hc1', SETTINGS), 'Ca8H');
  });
});

describe('nvlSlipLogic — bao cao Kho NVL hard Ton dau = 0', () => {
  it('Ton cuoi = Nhap − Xuat', () => {
    assert.equal(computeNvlClosingStock(150, 60), 90);
    assert.equal(computeNvlClosingStock(0, 0), 0);
  });
});

describe('nvlSlipLogic — ten SX read-only theo ma kho', () => {
  const options = [
    { code: 'NPL-001', productionName: 'Hạt A SX' },
    { code: 'NPL-002', productionName: '' }
  ];
  it('uu tien productionName cua dong', () => {
    assert.equal(
      resolveWarehouseLineProductionName({ code: 'NPL-001', productionName: 'Ten tay' }, options),
      'Ten tay'
    );
  });
  it('fallback ten_nvl_sx trong kho theo ma (khong phan biet hoa thuong)', () => {
    assert.equal(resolveWarehouseLineProductionName({ code: 'npl-001' }, options), 'Hạt A SX');
  });
  it('khong co ma → chuoi rong', () => {
    assert.equal(resolveWarehouseLineProductionName({ code: '' }, options), '');
    assert.equal(resolveWarehouseLineProductionName({ code: 'NPL-999' }, options), '');
  });
});

describe('nvlSlipLogic — mac dinh Ngay + Ca truoc cho Ton dau ca', () => {
  const shiftOptions = [
    { value: 'HC1', label: 'HC1' },
    { value: 'HC2', label: 'HC2' },
    { value: 'HC3', label: 'HC3' }
  ];
  const shiftSettings = [
    { id: '1', code: 'HC1', name: 'HC1', loaiCaiDat: 'Thời gian', timeFrame: '', startTime: '', endTime: '', loaiCa: 'Ca8H', thuTu: 1 },
    { id: '2', code: 'HC2', name: 'HC2', loaiCaiDat: 'Thời gian', timeFrame: '', startTime: '', endTime: '', loaiCa: 'Ca8H', thuTu: 2 },
    { id: '3', code: 'HC3', name: 'HC3', loaiCaiDat: 'Thời gian', timeFrame: '', startTime: '', endTime: '', loaiCa: 'Ca8H', thuTu: 3 }
  ];
  it('ca giua chuoi → ca truoc cung ngay', () => {
    assert.deepEqual(resolveDefaultTonDauRef('2026-09-22', 'HC2', shiftOptions, shiftSettings), {
      ngay: '2026-09-22',
      ca: 'HC1'
    });
  });
  it('ca dau chuoi → ca cuoi ngay hom truoc', () => {
    assert.deepEqual(resolveDefaultTonDauRef('2026-09-22', 'HC1', shiftOptions, shiftSettings), {
      ngay: '2026-09-21',
      ca: 'HC3'
    });
  });
  it('chua chon ca → giu ngay phieu, ca trong', () => {
    assert.deepEqual(resolveDefaultTonDauRef('2026-09-22', '', shiftOptions, shiftSettings), {
      ngay: '2026-09-22',
      ca: ''
    });
  });
});

describe('nvlSlipLogic — chen dong chinh tren, phu duoi', () => {
  const line = (warehouseClass?: string) => ({ key: Math.random().toString(), warehouseClass });
  it('rank: chinh 0, phu 1, chua 2', () => {
    assert.equal(warehouseLineClassRank('nvl_chinh'), 0);
    assert.equal(warehouseLineClassRank('nvl_phu'), 1);
    assert.equal(warehouseLineClassRank('chua_phan_loai'), 2);
    assert.equal(warehouseLineClassRank(undefined), 2);
  });
  it('dong chinh chen sau dong chinh cuoi', () => {
    const current = [line('nvl_chinh'), line('nvl_phu'), line('chua_phan_loai')];
    const next = insertWarehouseLineByClass(current, line('nvl_chinh'));
    assert.deepEqual(
      next.map(item => item.warehouseClass),
      ['nvl_chinh', 'nvl_chinh', 'nvl_phu', 'chua_phan_loai']
    );
  });
  it('dong phu them cuoi', () => {
    const current = [line('nvl_chinh')];
    const next = insertWarehouseLineByClass(current, line('nvl_phu'));
    assert.deepEqual(next.map(item => item.warehouseClass), ['nvl_chinh', 'nvl_phu']);
  });
});
