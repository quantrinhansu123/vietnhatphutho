import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveSoTronPrevTonFromReports,
  lookupSoTronPrevTon,
  soTronMachineMatches,
  soTronReportMatchesMachine
} from './soTronPrevShiftTon.ts';
import type { ShiftOption, ShiftSetting } from './shiftSettings.ts';

const shiftOptions: ShiftOption[] = [
  { value: '12C1', label: '12C1 (06:00 - 18:00)' },
  { value: '12C2', label: '12C2 (18:00 - 06:00)' }
];

const shiftSettings: ShiftSetting[] = [
  {
    id: '1',
    code: '12C1',
    name: '12C1',
    loaiCaiDat: 'ca',
    timeFrame: '06:00-18:00',
    startTime: '06:00',
    endTime: '18:00',
    loaiCa: 'Ca12H',
    thuTu: 1
  },
  {
    id: '2',
    code: '12C2',
    name: '12C2',
    loaiCaiDat: 'ca',
    timeFrame: '18:00-06:00',
    startTime: '18:00',
    endTime: '06:00',
    loaiCa: 'Ca12H',
    thuTu: 2
  }
];

test('soTronMachineMatches: ten may PTDM khop so tron', () => {
  assert.equal(soTronMachineMatches('Máy Sóng 2', 'Máy Sóng 2 (máy mới)', 'Máy Sóng 2 (máy mới)'), true);
  assert.equal(soTronMachineMatches('Sóng 2', 'Máy Sóng 2 (máy mới)', ''), true);
  assert.equal(
    soTronReportMatchesMachine(
      { ma_may: 'S2', ten_may: 'Máy Sóng 2' },
      'Máy Sóng 2 (máy mới)',
      'Máy Sóng 2 (máy mới)'
    ),
    true
  );
});

test('resolveSoTronPrevTonFromReports: 12C1 lay ton cuoi 12C2 ngay truoc', () => {
  const result = resolveSoTronPrevTonFromReports({
    ngay: '2026-09-21',
    ca: '12C1',
    maMay: 'Máy Sóng 2 (máy mới)',
    tenMay: 'Máy Sóng 2 (máy mới)',
    shiftOptions,
    shiftSettings,
    reports: [
      {
        id: 'a',
        ngay: '2026-09-20',
        ca: '12C2',
        ma_may: 'S2',
        ten_may: 'Máy Sóng 2',
        bang_ban_giao: [
          { material_id: 'mid-hm09', ma_nvl: 'HM09', ton_cuoi_ca: 42.5 }
        ]
      },
      {
        id: 'b',
        ngay: '2026-09-21',
        ca: '12C1',
        ten_may: 'Máy Sóng 2',
        bang_ban_giao: [{ ma_nvl: 'HM09', ton_cuoi_ca: 1 }]
      }
    ]
  });

  assert.deepEqual(result.source, { ngay: '2026-09-20', ca: '12C2' });
  assert.equal(lookupSoTronPrevTon(result.tonByMaterialKey, 'mid-hm09', 'HM09'), 42.5);
  assert.equal(lookupSoTronPrevTon(result.tonByMaterialKey, '', 'HM09'), 42.5);
});

test('resolveSoTronPrevTonFromReports: 12C2 cung ngay lay 12C1', () => {
  const result = resolveSoTronPrevTonFromReports({
    ngay: '2026-09-21',
    ca: '12C2',
    maMay: 'Máy Sóng 2',
    shiftOptions,
    shiftSettings,
    reports: [
      {
        id: 'c',
        ngay: '2026-09-21',
        ca: '12C1',
        ten_may: 'Máy Sóng 2',
        bang_ban_giao: [{ ma_nvl: 'HM09', ton_cuoi_ca: 10 }]
      }
    ]
  });
  assert.deepEqual(result.source, { ngay: '2026-09-21', ca: '12C1' });
  assert.equal(lookupSoTronPrevTon(result.tonByMaterialKey, null, 'HM09'), 10);
});

test('buildTonMap: chap nhan alias ma_npl (ngoai ma_nvl)', () => {
  const result = resolveSoTronPrevTonFromReports({
    ngay: '2026-09-22',
    ca: '12C2',
    maMay: 'M1',
    tenMay: 'Máy 1',
    shiftOptions,
    shiftSettings,
    reports: [
      {
        id: 'd',
        ngay: '2026-09-22',
        ca: '12C1',
        ma_may: 'M1',
        ten_may: 'Máy 1',
        bang_ban_giao: [{ material_id: '', ma_npl: 'NPL-001', ton_cuoi_ca: 55 }]
      }
    ]
  });
  assert.deepEqual(result.source, { ngay: '2026-09-22', ca: '12C1' });
  assert.equal(lookupSoTronPrevTon(result.tonByMaterialKey, '', 'NPL-001'), 55);
});
