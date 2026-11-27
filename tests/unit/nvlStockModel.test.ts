import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isIsoDate } from '../../src/utils/isoDate';
import {
  movementOf,
  reconcilePhysicalStock,
  scopeBalance,
  slipDotKey
} from '../../src/features/thong-ke-nvl/stockModel';
import { compareNormCoverage, orderLineIdentity, orderQuantity } from '../../src/utils/mixingNormCoverage';
import {
  buildNvlPriceHistoryOptions,
  distinctPrices
} from '../../src/features/xuat-nhap-tong-hop/nvlPriceHistory';

const line = (qty: number, extra: Record<string, unknown> = {}) => ({
  ma_hang: 'NVL-01', ten_nvl_sx: 'Hạt nhựa', don_vi: 'kg', so_luong: qty, ...extra
});
const header = (ngay: string, loai: string, extra: Record<string, unknown> = {}) => ({ ngay, loai, ...extra });

test('nhập NCC, cấp máy, dùng một lần, nhập lại: tồn kho/máy/gộp', () => {
  const movements = [
    movementOf(header('2026-01-01', 'nhap', { nguon_loai: 'ncc', nguon_id: 'NCC', dich_loai: 'kho' }),
      line(100, { kho_dong_id: 'Kho 1' })),
    movementOf(header('2026-01-02', 'xuat'),
      line(40, { src_loai: 'kho', src_id: 'Kho 1', dich_dong_loai: 'may', dich_dong_id: 'M1' })),
    movementOf(header('2026-01-03', 'xuat', { loai_xuat: 'Nhập lại từ máy vào kho' }),
      line(10, { src_loai: 'may', src_id: 'M1', dich_dong_loai: 'kho', dich_dong_id: 'Kho 1', so_tron_id: 'ST1' }))
  ];
  assert.deepEqual(movements[2].from, { kind: 'may', id: 'M1' });
  assert.deepEqual(movements[2].to, { kind: 'kho', id: 'Kho 1' });
  const reports = [{ id: 'ST1', ngay: '2026-01-02', ca: '1', ma_may: 'M1',
    bang_ban_giao: [{ ma_nvl: 'NVL-01', ten_nvl_sx: 'Hạt nhựa', dvt: 'kg', tong_su_dung: 25 }] }];
  const calculate = (places: string[]) => scopeBalance(movements, reports, '2026-01-02',
    party => places.includes(party.id), machine => machine, '2026-01-03');
  assert.equal(calculate(['Kho 1']).rows[0].closing, 70);
  assert.equal(calculate(['Kho 1']).rows[0].used, 0);
  assert.equal(calculate(['M1']).rows[0].closing, 5);
  assert.equal(calculate(['Kho 1', 'M1']).rows[0].closing, 75);
  assert.equal(calculate(['Kho 1', 'M1']).rows[0].used, 25);
});

test('sổ trộn trùng chọn bản mới, thiếu sử dụng không coi là 0', () => {
  const movement = movementOf(header('2026-01-02', 'xuat'), line(10, {
    src_loai: 'kho', src_id: 'Kho', dich_dong_loai: 'may', dich_dong_id: 'M1'
  }));
  const report = (id: string, updated_at: string, tong_su_dung: number | null) => ({
    id, updated_at, ngay: '2026-01-02', ca: '1', ma_may: 'M1',
    bang_ban_giao: [{ ma_nvl: 'NVL-01', ten_nvl_sx: 'Hạt nhựa', tong_su_dung }]
  });
  const scope = (reports: ReturnType<typeof report>[]) => scopeBalance([movement], reports, '2026-01-01',
    party => party.id === 'M1', machine => machine, '2026-01-05');
  const dup = scope([report('a', '2026-01-02', 8), report('b', '2026-01-03', 5)]);
  assert.equal(dup.rows[0].closing, 5);
  assert.equal(dup.duplicateShifts, 1);
  assert.equal(scope([report('a', '2026-01-02', null)]).rows[0].closing, null);
});

test('phiếu xuất legacy nguon_dong_loai=may và biên ngày bao hàm [from, to]', () => {
  const legacyIssue = movementOf(
    header('2026-01-02', 'xuat', { nguon_loai: 'kho', nguon_id: 'Kho 1' }),
    line(30, { nguon_dong_loai: 'may', nguon_dong_id: 'M2' })
  );
  assert.deepEqual(legacyIssue.from, { kind: 'kho', id: 'Kho 1' });
  assert.deepEqual(legacyIssue.to, { kind: 'may', id: 'M2' });
  const futureIssue = movementOf(
    header('2026-01-10', 'xuat'),
    line(99, { src_loai: 'kho', src_id: 'Kho 1', dich_dong_loai: 'may', dich_dong_id: 'M2' })
  );
  const reports = [{ id: 'S2', ngay: '2026-01-02', ca: '1', ma_may: 'M2',
    bang_ban_giao: [{ ma_nvl: 'NVL-01', ten_nvl_sx: 'Hạt nhựa', dvt: 'kg', tong_su_dung: 12 }] }];
  const res = scopeBalance([legacyIssue, futureIssue], reports, '2026-01-02',
    party => party.id === 'M2', machine => machine, '2026-01-02');
  assert.equal(res.rows[0].inbound, 30);
  assert.equal(res.rows[0].used, 12);
  assert.equal(res.rows[0].closing, 18);
});

test('tồn theo đợt chỉ lấy chứng từ khớp đợt và bỏ trừ sổ trộn', () => {
  const dotA = 'dot-a';
  const movements = [
    movementOf(header('2026-01-01', 'nhap', { nguon_loai: 'ncc', dich_loai: 'kho', dot_san_xuat_id: dotA, dot_so: 1 }),
      line(50, { kho_dong_id: 'Kho 1' })),
    movementOf(header('2026-01-01', 'nhap', { nguon_loai: 'ncc', dich_loai: 'kho', dot_san_xuat_id: 'dot-b', dot_so: 2 }),
      line(80, { kho_dong_id: 'Kho 1' })),
    movementOf(header('2026-01-02', 'xuat', { dot_san_xuat_id: dotA, dot_so: 1 }),
      line(20, { src_loai: 'kho', src_id: 'Kho 1', dich_dong_loai: 'may', dich_dong_id: 'M1' }))
  ];
  assert.equal(slipDotKey({ dot_san_xuat_id: dotA, dot_so: 1 }), dotA);
  assert.equal(slipDotKey({ dot_so: 3 }), 'legacy:3');
  assert.equal(movements[0].dot, dotA);
  const filtered = movements.filter(item => item.dot === dotA);
  const reports = [{ id: 'ST', ngay: '2026-01-02', ca: '1', ma_may: 'M1',
    bang_ban_giao: [{ ma_nvl: 'NVL-01', ten_nvl_sx: 'Hạt nhựa', tong_su_dung: 99 }] }];
  // Phạm vi kho: xuất sang máy là outbound (không gộp kho+máy kẻo chuyển nội bộ bị khử).
  const res = scopeBalance(filtered, reports, '2026-01-01',
    party => party.id === 'Kho 1', machine => machine, '2026-01-02',
    { excludeUsage: true });
  assert.equal(res.usageExcluded, true);
  assert.equal(res.rows[0].used, null);
  assert.equal(res.rows[0].inbound, 50);
  assert.equal(res.rows[0].outbound, 20);
  assert.equal(res.rows[0].closing, 30);
});

test('đối chiếu tồn vật lý với phần còn theo chứng từ cấp', () => {
  const rows = reconcilePhysicalStock([
    { code: 'A', physical: 12, issued: 40, returned: 10 },
    { code: 'B', physical: 5, issued: 5, returned: 0 }
  ]);
  assert.equal(rows[0].remainingByDocs, 30);
  assert.equal(rows[0].delta, -18);
  assert.equal(rows[1].delta, 0);
});

test('giữ chi phí gốc trước làm tròn giá hiển thị (12 × 120.000 + 200.000 = 1.640.000)', () => {
  const qty = 12;
  const price = 120000;
  const kemPerKg = 200000 / 12;
  const importPrice = Math.round((price + kemPerKg) * 1000) / 1000;
  const importAmount = Math.round(qty * (price + kemPerKg) * 1000) / 1000;
  assert.equal(Math.round(importPrice), 136667);
  assert.equal(qty * price, 1440000);
  assert.equal(importAmount, 1640000);
});

test('đối soát PTĐM tách theo từng lệnh kể cả cùng mã SP và gắn cờ trùng mơ hồ', () => {
  const mk = (orderCode: string, quantity: number, ghiChu = '') => orderQuantity({
    orderCode,
    productId: 'SP-ID-1',
    productCode: 'SP01',
    productName: 'Tấm đặc',
    productionName: 'Tấm đặc 2mm',
    quantity,
    unit: 'Tấm',
    quyCachMDai: 2.44,
    ghiChu
  } as Parameters<typeof orderQuantity>[0])!;

  const current = [mk('LSX-01', 15), mk('LSX-02', 20)];
  const saved = [mk('LSX-01', 10), mk('LSX-02', 20)];
  const diff = compareNormCoverage(current, saved);
  assert.equal(diff.length, 2);
  assert.equal(diff.find(d => d.label.startsWith('LSX-01'))?.delta, 5);
  assert.equal(diff.find(d => d.label.startsWith('LSX-02'))?.delta, 0);

  const dupDiff = compareNormCoverage([mk('LSX-01', 5), mk('LSX-01', 7)], [mk('LSX-01', 5)]);
  assert.equal(dupDiff[0].ambiguous, true);
});

test('ID dòng lệnh bền vững: không phụ thuộc STT; cùng mã khác lệnh vẫn tách', () => {
  const base = {
    productId: 'SP-1',
    productCode: 'SP01',
    productName: 'Tấm',
    productionName: 'Tấm 2mm',
    quantity: 10,
    unit: 'Tấm',
    quyCachMDai: 2.44,
    ghiChu: ''
  };
  const a = orderLineIdentity({ ...base, orderCode: 'LSX-01', stt: 1 } as Parameters<typeof orderLineIdentity>[0]);
  const b = orderLineIdentity({ ...base, orderCode: 'LSX-01', stt: 99 } as Parameters<typeof orderLineIdentity>[0]);
  const c = orderLineIdentity({ ...base, orderCode: 'LSX-02', stt: 1 } as Parameters<typeof orderLineIdentity>[0]);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('bộ chọn giá tách từng lần nhập theo ngày và diễn giải; cùng mã giữ nhiều giá', () => {
  const options = buildNvlPriceHistoryOptions([
    { id: '1', don_gia: 12000000, ngay_phieu: '2026-01-10', ly_do: 'Nhập mua ngoài đợt 1', ma_phieu: 'PN1', so_luong: 5 },
    { id: '2', don_gia: 12000000, ngay_phieu: '2026-01-20', ly_do: 'Nhập mua ngoài đợt 2', ma_phieu: 'PN2', so_luong: 3 },
    { id: '3', don_gia: 15000000, ngay_phieu: '2026-01-15', ghi_chu: 'Giá mới', ma_phieu: 'PN3', so_luong: 2 }
  ]);
  assert.equal(options.length, 3);
  assert.ok(options.some(item => item.label.includes('10/01/2026') && item.label.includes('đợt 1')));
  assert.ok(options.some(item => item.label.includes('20/01/2026') && item.label.includes('đợt 2')));
  assert.deepEqual(distinctPrices(options), [15000000, 12000000]);
});

test('ngày ISO kiểm năm nhuận và giới hạn năm', () => {
  assert.equal(isIsoDate('2000-02-29'), true);
  assert.equal(isIsoDate('2100-02-29'), false);
  assert.equal(isIsoDate('2999-12-31'), true);
  assert.equal(isIsoDate('3000-01-01'), false);
  assert.equal(isIsoDate('0000-01-01'), false);
  assert.equal(isIsoDate('2026-02-29'), false);
});
