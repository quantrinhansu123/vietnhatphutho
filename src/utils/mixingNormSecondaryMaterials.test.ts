import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNhomVatTuPhuKey,
  resolveWorkshopType,
  calcAuxiliaryWeight,
  getAllowedSecondaryGroups,
  formatMixingNormSlipName
} from './mixingNormAuxiliary.ts';

test('normalizeNhomVatTuPhuKey chuan hoa dung cac nhom vat tu phu', () => {
  assert.equal(normalizeNhomVatTuPhuKey('Băng Dính'), 'Băng Dính');
  assert.equal(normalizeNhomVatTuPhuKey('bang keo'), 'Băng Dính');
  assert.equal(normalizeNhomVatTuPhuKey('Bạt Dọc'), 'Bạt Dọc');
  assert.equal(normalizeNhomVatTuPhuKey('Bạt Bọc'), 'Bạt Dọc');
  assert.equal(normalizeNhomVatTuPhuKey('bat boc'), 'Bạt Dọc');
  assert.equal(normalizeNhomVatTuPhuKey('Màng'), 'Màng');
  assert.equal(normalizeNhomVatTuPhuKey('Tem'), 'Tem');
  assert.equal(normalizeNhomVatTuPhuKey('Mực In'), 'Mực In');
  assert.equal(normalizeNhomVatTuPhuKey('Kẹp Sắt'), 'Kẹp Sắt');
  assert.equal(normalizeNhomVatTuPhuKey('Dây Đai'), 'Dây Đai');
  assert.equal(normalizeNhomVatTuPhuKey('Dung Môi'), 'Dung Môi');
});

test('resolveWorkshopType nhan dien dung phan xuong', () => {
  assert.equal(resolveWorkshopType('TP; PX Rộng'), 'rong');
  assert.equal(resolveWorkshopType('TP; PX Đặc'), 'dac');
  assert.equal(resolveWorkshopType('TP; PX Sóng'), 'song');
  assert.equal(resolveWorkshopType('Khac'), 'unknown');
});

test('allowed groups den tu Bat Doc', () => {
  assert.deepEqual(getAllowedSecondaryGroups('rong'), ['Băng Dính', 'Màng', 'Tem']);
  assert.deepEqual(getAllowedSecondaryGroups('dac'), ['Tem', 'Băng Dính', 'Bạt Dọc', 'Màng', 'Kẹp Sắt', 'Dây Đai']);
  assert.deepEqual(getAllowedSecondaryGroups('song'), ['Tem', 'Băng Dính', 'Bạt Dọc', 'Mực In', 'Dung Môi']);
});

test('calcAuxiliaryWeight tinh dung cho TP; PX Rong', () => {
  assert.equal(calcAuxiliaryWeight('rong', 'Băng Dính', 'Cuộn', 10), 5);
  assert.equal(calcAuxiliaryWeight('rong', 'Tem', 'Cái', 100), 0.23);
  assert.equal(calcAuxiliaryWeight('rong', 'Màng', 'kg', 50), 50);
});

test('calcAuxiliaryWeight tinh dung cho TP; PX Dac', () => {
  assert.equal(calcAuxiliaryWeight('dac', 'Băng Dính', 'Cuộn', 10), 4);
  assert.equal(calcAuxiliaryWeight('dac', 'Tem', 'Cái', 100), 0.13);
  assert.equal(calcAuxiliaryWeight('dac', 'Bạt Dọc', 'kg', 12.5), 12.5);
  assert.equal(calcAuxiliaryWeight('dac', 'Dây Đai', 'kg', 3), 3);
});

test('calcAuxiliaryWeight tinh dung cho TP; PX Song', () => {
  assert.equal(calcAuxiliaryWeight('song', 'Băng Dính', 'Cuộn', 10), 4);
  assert.equal(calcAuxiliaryWeight('song', 'Tem', 'Cái', 100), 0.13);
  assert.equal(calcAuxiliaryWeight('song', 'Mực In', 'kg', 5), 5);
});

test('formatMixingNormSlipName ghep PTDM + ngay + may + LSX/DH + ty le', () => {
  assert.equal(
    formatMixingNormSlipName('2026-09-08', 'Máy Đặc 1', 'LSX-001/DH-01', [1, 2, 3]),
    'PTĐM - 2026-09-08 - Máy Đặc 1 - LSX-001/DH-01 - tỷ lệ 1,2,3'
  );
  assert.equal(
    formatMixingNormSlipName('2026-09-08', 'Máy 2', 'LSX-002', [1]),
    'PTĐM - 2026-09-08 - Máy 2 - LSX-002 - tỷ lệ 1'
  );
  assert.equal(
    formatMixingNormSlipName('2026-09-08', '', 'LSX-002'),
    'PTĐM - 2026-09-08 - LSX-002'
  );
  assert.equal(formatMixingNormSlipName('', '', ''), 'PTĐM');
});

test('mergeNormMaterialLines: Bang Dinh va Tem cung VTHH thi gop, khac VTHH thi tach rieng; NVL phu khac luon gop', async () => {
  const { mergeNormMaterialLines } = await import('./warehouseNormMerge.ts');
  const catalog = [
    { code: 'BD5', name: 'Băng dính 5cm', unit: 'Cuộn', nhomVatTuPhu: 'Băng Dính', phanLoai: 'Nguyên vật liệu phụ' },
    { code: 'TEM01', name: 'Tem nhãn', unit: 'Cái', nhomVatTuPhu: 'Tem', phanLoai: 'Nguyên vật liệu phụ' },
    { code: 'MQ01', name: 'Màng quấn PE', unit: 'Cuộn', nhomVatTuPhu: 'Màng', phanLoai: 'Nguyên vật liệu phụ' }
  ];

  const source = {
    machine: 'Máy Nẹp 1',
    record: {
      chi_tiet: [
        {
          loai: 'nvl_phu',
          nvl_phu: [
            // SP 1: Băng dính TP; PX Rỗng (10 cuộn, 5kg)
            { ma_nvl: 'BD5', ten_nvl: 'Băng dính 5cm', gia_tri: 10, tong_khoi_luong: 5, nhom_vthh: 'TP; PX Rỗng' },
            // SP 1: Tem TP; PX Rỗng (100 cái, 0.23kg)
            { ma_nvl: 'TEM01', ten_nvl: 'Tem nhãn', gia_tri: 100, tong_khoi_luong: 0.23, nhom_vthh: 'TP; PX Rỗng' },
            // SP 1: Màng quấn (2 cuộn, 10kg)
            { ma_nvl: 'MQ01', ten_nvl: 'Màng quấn PE', gia_tri: 2, tong_khoi_luong: 10 }
          ]
        },
        {
          loai: 'nvl_phu',
          nvl_phu: [
            // SP 2: Băng dính CÙNG VTHH TP; PX Rỗng (15 cuộn, 7.5kg) -> PHẢI GỘP VỚI SP 1
            { ma_nvl: 'BD5', ten_nvl: 'Băng dính 5cm', gia_tri: 15, tong_khoi_luong: 7.5, nhom_vthh: 'TP; PX Rỗng' },
            // SP 2: Màng quấn (3 cuộn, 15kg) -> PHẢI GỘP VỚI SP 1
            { ma_nvl: 'MQ01', ten_nvl: 'Màng quấn PE', gia_tri: 3, tong_khoi_luong: 15 }
          ]
        },
        {
          loai: 'nvl_phu',
          nvl_phu: [
            // SP 3: Băng dính KHÁC VTHH (TP; PX Đặc) (8 cuộn, 3.2kg) -> KHÔNG ĐƯỢC GỘP VỚI RỖNG, PHẢI THÀNH DÒNG RIÊNG
            { ma_nvl: 'BD5', ten_nvl: 'Băng dính 5cm', gia_tri: 8, tong_khoi_luong: 3.2, nhom_vthh: 'TP; PX Đặc' },
            // SP 3: Tem CÙNG VTHH TP; PX Rỗng (50 cái, 0.115kg) -> PHẢI GỘP VỚI SP 1
            { ma_nvl: 'TEM01', ten_nvl: 'Tem nhãn', gia_tri: 50, tong_khoi_luong: 0.115, nhom_vthh: 'TP; PX Rỗng' }
          ]
        }
      ]
    }
  };

  const lines = mergeNormMaterialLines([source as any], catalog as any);

  // Mong muốn:
  // 1. Dòng BD5 (TP; PX Rỗng): gộp SP 1 (10) + SP 2 (15) = 25 cuộn, 12.5kg, normWeightPerUnitKg = 0.5
  // 2. Dòng BD5 (TP; PX Đặc): riêng SP 3 = 8 cuộn, 3.2kg, normWeightPerUnitKg = 0.4
  // 3. Dòng TEM01 (TP; PX Rỗng): gộp SP 1 (100) + SP 3 (50) = 150 cái, normWeightPerUnitKg = 0.0023
  // 4. Dòng MQ01: gộp SP 1 (2) + SP 2 (3) = 5 cuộn, 25kg, nhomVthh = ''

  assert.equal(lines.length, 4, `Phải có đúng 4 dòng, nhưng có ${lines.length}`);

  const bdRong = lines.find(l => l.code === 'BD5' && l.nhomVthh === 'TP; PX Rỗng');
  assert.ok(bdRong, 'Phải có dòng Băng dính TP; PX Rỗng');
  assert.equal(bdRong.documentQuantity, 25);
  assert.equal(bdRong.normWeightKg, 12.5);
  assert.equal(bdRong.normWeightPerUnitKg, 0.5);

  const bdDac = lines.find(l => l.code === 'BD5' && l.nhomVthh === 'TP; PX Đặc');
  assert.ok(bdDac, 'Phải có dòng Băng dính TP; PX Đặc tách riêng');
  assert.equal(bdDac.documentQuantity, 8);
  assert.equal(bdDac.normWeightKg, 3.2);
  assert.equal(bdDac.normWeightPerUnitKg, 0.4);

  const temRong = lines.find(l => l.code === 'TEM01' && l.nhomVthh === 'TP; PX Rỗng');
  assert.ok(temRong, 'Phải có dòng Tem TP; PX Rỗng');
  assert.equal(temRong.documentQuantity, 150);
  assert.equal(temRong.normWeightPerUnitKg, 0.0023);

  const mangQuan = lines.find(l => l.code === 'MQ01');
  assert.ok(mangQuan, 'Phải có dòng Màng quấn gộp');
  assert.equal(mangQuan.documentQuantity, 5);
  assert.equal(mangQuan.normWeightKg, 25);
  assert.equal(mangQuan.nhomVthh, '', 'NVL phụ khác không mang nhomVthh');
});

test('mergeNormMaterialLines uu tien material_id thay vi ma vat tu', async () => {
  const { mergeNormMaterialLines } = await import('./warehouseNormMerge.ts');
  const catalog = [
    { id: 'material-a', code: 'BD02', name: 'Bang dinh A', unit: 'Cuon', nhomVatTuPhu: 'Bang Dinh' },
    { id: 'material-b', code: 'BD02', name: 'Bang dinh B', unit: 'Cuon', nhomVatTuPhu: 'Bang Dinh' }
  ];
  const source = {
    machine: 'May 1',
    record: {
      chi_tiet: [{
        loai: 'nvl_phu',
        nvl_phu: [
          { material_id: 'material-a', ma_nvl: 'BD02', gia_tri: 1, tong_khoi_luong: 0.5, nhom_vthh: 'TP; PX Rong' },
          { material_id: 'material-a', ma_nvl: 'BD02', gia_tri: 2, tong_khoi_luong: 1, nhom_vthh: 'TP; PX Rong' },
          { material_id: 'material-b', ma_nvl: 'BD02', gia_tri: 4, tong_khoi_luong: 2, nhom_vthh: 'TP; PX Rong' }
        ]
      }]
    }
  };

  const lines = mergeNormMaterialLines([source as any], catalog as any);
  assert.equal(lines.length, 2);
  assert.equal(lines.find(line => line.materialId === 'material-a')?.documentQuantity, 3);
  assert.equal(lines.find(line => line.materialId === 'material-b')?.documentQuantity, 4);
});

test('mergeAuxiliaryWarehouseLines cong SL, trong luong va chi tach Bang Dinh/Tem theo VTHH', async () => {
  const { mergeAuxiliaryWarehouseLines } = await import('./warehouseNormMerge.ts');
  const base = {
    code: 'BD02',
    name: 'Bang dinh VN xanh',
    unit: 'Cuon',
    unitPrice: 10,
    materialClass: 'nvl_phu' as const,
    machine: 'May 1',
    auxiliaryGroup: 'Bang Dinh'
  };
  const lines = mergeAuxiliaryWarehouseLines([
    { ...base, materialId: 'material-a', quantity: 1, documentQuantity: 1, weightKg: 0.5, lineAmount: 10, nhomVthh: 'TP; PX Rong' },
    { ...base, materialId: 'material-a', quantity: 2, documentQuantity: 2, weightKg: 1, lineAmount: 20, nhomVthh: 'TP; PX Rỗng' },
    { ...base, materialId: 'material-a', quantity: 4, documentQuantity: 4, weightKg: 1.6, lineAmount: 40, nhomVthh: 'TP; PX Dac' },
    { ...base, materialId: 'material-b', quantity: 8, documentQuantity: 8, weightKg: 4, lineAmount: 80, nhomVthh: 'TP; PX Rong' }
  ]);

  assert.equal(lines.length, 3);
  const mergedRong = lines.find(line => line.materialId === 'material-a' && line.nhomVthh === 'TP; PX Rỗng');
  assert.equal(mergedRong?.quantity, 3);
  assert.equal(mergedRong?.documentQuantity, 3);
  assert.equal(mergedRong?.weightKg, 1.5);
  assert.equal(mergedRong?.lineAmount, 30);
});

test('mergeAuxiliaryWarehouseLines bo qua VTHH voi NVL phu khac', async () => {
  const { mergeAuxiliaryWarehouseLines } = await import('./warehouseNormMerge.ts');
  const lines = mergeAuxiliaryWarehouseLines([
    { materialId: 'film-a', code: 'M01', name: 'Mang', unit: 'kg', quantity: 2, documentQuantity: 2, unitPrice: 5, lineAmount: 10, materialClass: 'nvl_phu' as const, machine: 'May 1', auxiliaryGroup: 'Mang', nhomVthh: 'TP; PX Rong', weightKg: 2 },
    { materialId: 'film-a', code: 'M01', name: 'Mang', unit: 'kg', quantity: 3, documentQuantity: 3, unitPrice: 5, lineAmount: 15, materialClass: 'nvl_phu' as const, machine: 'May 1', auxiliaryGroup: 'Mang', nhomVthh: 'TP; PX Dac', weightKg: 3 }
  ]);

  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.quantity, 5);
  assert.equal(lines[0]?.weightKg, 5);
  assert.equal(lines[0]?.nhomVthh, undefined);
});

