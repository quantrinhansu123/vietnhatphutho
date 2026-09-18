import { calculateLaborCost } from '../src/features/chi-phi-nhan-cong/calculateLabor.js';

console.log('Testing calculateLaborCost logic...');

const allMachines = [
  { code: 'M01', name: 'Máy đùn 01' },
  { code: 'M02', name: 'Máy đùn 02' }
];

const staffList = [
  { code: 'NV001', name: 'Nguyễn Văn A', position: 'Trưởng ca' },
  { code: 'NV002', name: 'Trần Văn B', position: 'Công nhân' }
];

const shiftSettings = [
  { code: 'Ca 1', name: 'Ca 1', startTime: '06:00', endTime: '14:00' },
  { code: 'Ca 2', name: 'Ca 2', startTime: '14:00', endTime: '22:00' }
];

// NV001 scheduled on M01 on 2026-09-01 (06:00 - 14:00 = 8h)
// NV002 scheduled on M02 on 2026-09-01 (06:00 - 14:00 = 8h)
const rawPhanCong = [
  {
    ngay_lam_viec: '2026-09-01',
    ma_nhan_su: 'NV001',
    ma_may: 'M01',
    ca_lam_viec: 'Ca 1',
    thoi_gian_bat_dau: '06:00',
    thoi_gian_ket_thuc: '14:00',
    vai_tro: 'Trưởng ca'
  },
  {
    ngay_lam_viec: '2026-09-01',
    ma_nhan_su: 'NV002',
    ma_may: 'M02',
    ca_lam_viec: 'Ca 1',
    thoi_gian_bat_dau: '06:00',
    thoi_gian_ket_thuc: '14:00',
    vai_tro: 'Công nhân'
  }
];

// NV001 is dispatched from M01 to M02 from 08:00 to 12:00 (4 hours)
const rawDieuDong = [
  {
    ngay_lam_viec: '2026-09-01',
    ma_nhan_su: 'NV001',
    may_goc: 'M01',
    may_dieu_dong: 'M02',
    thoi_gian_bat_dau: '08:00',
    thoi_gian_ket_thuc: '12:00',
    ca: 'Ca 1'
  }
];

const result = calculateLaborCost({
  thang: 9,
  nam: 2026,
  selectedMachineCodes: ['M01', 'M02'],
  allMachines,
  rawPhanCong,
  rawDieuDong,
  staffList,
  shiftSettings,
  hourlyRates: { NV001: 50000, NV002: 40000 }
});

console.log('--- MACHINE DETAILS ---');
for (const mach of result.machineDetails) {
  console.log(`Machine ${mach.machineCode} (${mach.machineName}): totalHours = ${mach.totalHours}h, cost = ${mach.totalCost}đ`);
  for (const p of mach.personnel) {
    console.log(`  -> ${p.personName} (${p.personCode}): ${p.totalHours}h, cost = ${p.totalCost}đ`);
  }
}

console.log('--- DAILY SUMMARY FOR DAY 1 ---');
const day1 = result.dailySummary.find(d => d.dayOfMonth === 1);
console.log(`Day 1: totalPersonnel = ${day1.totalPersonnel}, machineHours =`, day1.machineHours, `totalHours = ${day1.totalHours}h`);

console.log('--- PERSON SUMMARY ---');
for (const p of result.personSummary) {
  console.log(`${p.personName}: totalHours = ${p.totalHours}h, standardWorkDays = ${p.standardWorkDays}, cost = ${p.totalCost}đ`);
}

console.log('--- GRAND TOTAL ---');
console.log(`Total Personnel: ${result.grandTotal.totalPersonnel}`);
console.log(`Total Hours: ${result.grandTotal.totalHours}h`);
console.log(`Total Standard Days: ${result.grandTotal.totalStandardDays}`);
console.log(`Total Cost: ${result.grandTotal.totalCost}đ`);

// Assertions
if (result.grandTotal.totalHours !== 16) {
  console.error('FAIL: Expected total hours to be 16, got', result.grandTotal.totalHours);
  process.exit(1);
}
// NV001 on M01: 8 - 4 = 4h
const m1_nv1 = result.machineDetails.find(m => m.machineCode === 'M01')?.personnel.find(p => p.personCode === 'NV001');
if (m1_nv1?.totalHours !== 4) {
  console.error('FAIL: Expected NV001 on M01 to have 4h, got', m1_nv1?.totalHours);
  process.exit(1);
}
// NV001 on M02: 4h
const m2_nv1 = result.machineDetails.find(m => m.machineCode === 'M02')?.personnel.find(p => p.personCode === 'NV001');
if (m2_nv1?.totalHours !== 4) {
  console.error('FAIL: Expected NV001 on M02 to have 4h, got', m2_nv1?.totalHours);
  process.exit(1);
}
// NV002 on M02: 8h
const m2_nv2 = result.machineDetails.find(m => m.machineCode === 'M02')?.personnel.find(p => p.personCode === 'NV002');
if (m2_nv2?.totalHours !== 8) {
  console.error('FAIL: Expected NV002 on M02 to have 8h, got', m2_nv2?.totalHours);
  process.exit(1);
}

console.log('ALL TESTS PASSED!');
