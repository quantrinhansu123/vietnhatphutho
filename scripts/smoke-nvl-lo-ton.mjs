/**
 * Smoke checks for NVL lot remaining math (mirrors server buildNvlInboundLots).
 * Run: node scripts/smoke-nvl-lo-ton.mjs
 */

function roundQty(value) {
  return Math.round(value * 1000) / 1000;
}

function buildLots(inboundRows, outboundRows, excludeSlipCode = '') {
  const consumedByLot = new Map();
  for (const row of outboundRows) {
    if (excludeSlipCode && row.ma_phieu === excludeSlipCode) continue;
    const lotId = row.id_dong_nhap_nguon;
    if (!lotId) continue;
    consumedByLot.set(lotId, roundQty((consumedByLot.get(lotId) || 0) + Number(row.so_luong || 0)));
  }

  return inboundRows
    .map(row => {
      const so_luong_nhap = roundQty(Number(row.so_luong || 0));
      const so_luong_da_xuat = roundQty(consumedByLot.get(row.id) || 0);
      const so_luong_con = roundQty(so_luong_nhap - so_luong_da_xuat);
      return { ...row, so_luong_nhap, so_luong_da_xuat, so_luong_con };
    })
    .filter(row => row.so_luong_con > 0);
}

const inbound = [
  { id: 'lot1', ma_phieu: 'PN-1', so_luong: 100, don_gia: 20000 },
  { id: 'lot2', ma_phieu: 'PN-2', so_luong: 50, don_gia: 22000 }
];

const outbound = [
  { ma_phieu: 'PX-1', id_dong_nhap_nguon: 'lot1', so_luong: 80 }
];

const afterFirst = buildLots(inbound, outbound);
const lot1 = afterFirst.find(l => l.id === 'lot1');
const lot2 = afterFirst.find(l => l.id === 'lot2');

if (!lot1 || lot1.so_luong_con !== 20) {
  console.error('FAIL lot1 remaining expected 20, got', lot1);
  process.exit(1);
}
if (!lot2 || lot2.so_luong_con !== 50) {
  console.error('FAIL lot2 remaining expected 50, got', lot2);
  process.exit(1);
}

const editing = buildLots(
  inbound,
  [...outbound, { ma_phieu: 'PX-EDIT', id_dong_nhap_nguon: 'lot1', so_luong: 10 }],
  'PX-EDIT'
);
const lot1Edit = editing.find(l => l.id === 'lot1');
if (!lot1Edit || lot1Edit.so_luong_con !== 20) {
  console.error('FAIL exclude slip remaining expected 20, got', lot1Edit);
  process.exit(1);
}

console.log('OK smoke-nvl-lo-ton: remaining qty + exclude slip');
