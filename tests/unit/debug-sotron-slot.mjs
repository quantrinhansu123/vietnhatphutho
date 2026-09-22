import assert from 'node:assert/strict';

const stubReports = {
  reports: [
    {
      id: 's1',
      ngay: '2026-09-22',
      ca: 'HC1',
      ma_may: 'M1',
      ten_may: 'Máy 1',
      bang_ban_giao: [{ material_id: '', ma_npl: 'NPL-001', ton_cuoi_ca: 55 }]
    }
  ]
};

globalThis.fetch = async () => ({
  ok: true,
  json: async () => stubReports
});

const mod = await import('../../src/utils/soTronPrevShiftTon.ts');

// Sanity: Map co ban co hoat dong?
{
  const m = new Map();
  const ln = { material_id: '', ma_npl: 'NPL-001', ton_cuoi_ca: 55 };
  const v = Number(ln.ton_cuoi_ca) || 0;
  const k = String(ln.ma_npl ?? '').trim().toLowerCase();
  console.log('sanity value/key:', v, JSON.stringify(k), 'truthy:', Boolean(k));
  if (k) m.set(k, v);
  console.log('sanity entries:', JSON.stringify([...m.entries()]));
}
const shiftOptions = [
  { value: 'HC1', label: 'HC1' },
  { value: 'HC2', label: 'HC2' },
  { value: 'HC3', label: 'HC3' }
];
const result = await mod.fetchSoTronTonCuoiCaSlot({
  ngay: '2026-09-22',
  ca: 'HC1',
  maMay: 'M1 - Máy 1',
  tenMay: 'M1 - Máy 1',
  shiftOptions
});
console.log('source:', JSON.stringify(result.source));
console.log('keys:', JSON.stringify([...result.tonByMaterialKey.entries()]));
console.log('resolveShiftName check:', mod ? 'mod loaded' : 'no mod');
assert.deepEqual(result.source, { ngay: '2026-09-22', ca: 'HC1' });
assert.equal(result.tonByMaterialKey.get('npl-001'), 55);
console.log('UTIL OK');
