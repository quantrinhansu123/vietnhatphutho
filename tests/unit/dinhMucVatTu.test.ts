import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auxiliaryLineWeightKg,
  auxiliaryNormWeightIndex,
  formatNormWeight,
  lookupAuxiliaryNormWeight,
  mainLineTotalWeightKg,
  selectCurrentMixingNormRecords
} from '../../src/features/so-tron/dinhMucVatTu.ts';

test('tong trong luong nvl phu uu tien tong_khoi_luong, bo so luong cuon', () => {
  assert.equal(auxiliaryLineWeightKg({ tong_khoi_luong: 5, gia_tri: 10, don_vi: 'Cuộn' }), 5);
  assert.equal(auxiliaryLineWeightKg({ gia_tri: 12, don_vi: 'Cuộn' }), 0);
  assert.equal(auxiliaryLineWeightKg({ gia_tri: 3.5, don_vi: 'kg' }), 3.5);
});

test('tong trong luong nvl chinh lay tong_khoi_luong, khong lay kg/coi', () => {
  assert.equal(mainLineTotalWeightKg({ tong_khoi_luong: 19.25, khoi_luong: 50, gia_tri: 50, don_vi: 'kg' }), 19.25);
  assert.equal(mainLineTotalWeightKg({ ty_le_tong: 4.76, gia_tri: 5, don_vi: 'kg' }, 40.431), 1.92);
  assert.equal(mainLineTotalWeightKg({ gia_tri: 50, khoi_luong: 50, don_vi: 'kg' }, 40.431), 0);
});

test('dinh muc lay tong trong luong nvl chinh va nvl phu, bo ban ty le cu', () => {
  const records = [
    {
      id: 'goc',
      ten_phieu: 'PTĐM - Máy 1 - LSX-1',
      created_at: '2026-09-01T00:00:00.000Z',
      chi_tiet: [
        {
          ma_sp: 'SP1',
          tong_trong_luong: 40.431,
          nvl: [{ material_id: 'chinh-1', ma_nvl: 'NHUA', tong_khoi_luong: 800 }]
        },
        {
          loai: 'nvl_phu',
          nvl: [
            { material_id: 'phu-1', ma_nvl: 'BD5', tong_khoi_luong: 5, gia_tri: 10, don_vi: 'Cuộn' },
            { material_id: 'phu-2', ma_nvl: 'MQ01', tong_khoi_luong: 10 }
          ]
        }
      ]
    },
    {
      id: 'ty-le-2',
      id_phieu_tron_dm_ban_dau: 'goc',
      ten_phieu: 'PTĐM - Máy 1 - LSX-1 - tỷ lệ 2',
      created_at: '2026-09-02T00:00:00.000Z',
      chi_tiet: [
        {
          ma_sp: 'SP1',
          tong_trong_luong: 40.431,
          nvl: [
            { material_id: 'chinh-1', ma_nvl: 'NHUA', tong_khoi_luong: 19.25, khoi_luong: 50, gia_tri: 50, don_vi: 'kg' },
            { material_id: 'chinh-2', ma_nvl: 'HM09', ty_le_tong: 4.76, gia_tri: 5, khoi_luong: 5, don_vi: 'kg' }
          ]
        },
        {
          loai: 'nvl_phu',
          nvl_phu: [
            { material_id: 'phu-1', ma_nvl: 'BD5', tong_khoi_luong: 7.5 },
            { ma_nvl: 'MQ01', tong_khoi_luong: 4.25 }
          ]
        }
      ]
    },
    {
      id: 'phieu-khac',
      ten_phieu: 'PTĐM - Máy 1 - LSX-2',
      chi_tiet: [
        {
          ma_sp: 'SP2',
          nvl_phu: [{ material_id: 'phu-1', ma_nvl: 'BD5', tong_khoi_luong: 1.5 }]
        }
      ]
    }
  ];

  const current = selectCurrentMixingNormRecords(records);
  assert.equal(current.length, 2);
  assert.ok(current.some(row => row.id === 'ty-le-2'));
  assert.ok(current.every(row => row.id !== 'goc'));

  const index = auxiliaryNormWeightIndex(records);
  assert.equal(lookupAuxiliaryNormWeight(index, 'phu-1', 'BD5'), 9);
  assert.equal(lookupAuxiliaryNormWeight(index, '', 'MQ01'), 4.25);
  assert.equal(lookupAuxiliaryNormWeight(index, 'chinh-1', 'NHUA'), 19.25);
  assert.equal(lookupAuxiliaryNormWeight(index, 'chinh-2', 'HM09'), 1.92);
  assert.equal(index.lines.find(line => line.code === 'BD5')?.weightKg, 9);
  assert.equal(index.lines.find(line => line.code === 'NHUA')?.source, 'chinh');
  assert.equal(index.lines.find(line => line.code === 'BD5')?.source, 'phu');
  assert.equal(formatNormWeight(9), '9');
  assert.equal(formatNormWeight(4.25), '4.25');
  assert.equal(formatNormWeight(0), '');
});
