import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateLots } from '../../src/features/xuat-nhap-tong-hop/lotAllocation';

const lots = [
  { id: 'b', ma_phieu: 'PN2', ngay_phieu: '2026-02-01', don_gia: 12000, so_luong_con: 100 },
  { id: 'a', ma_phieu: 'PN1', ngay_phieu: '2026-01-01', don_gia: 10000, so_luong_con: 40 }
];

test('một lô đủ tồn: giá = giá lô', () => {
  const r = allocateLots(lots, 30, new Map());
  assert.equal(r.allocs.length, 1);
  assert.equal(r.allocs[0].id, 'a');
  assert.equal(r.avgPrice, 10000);
});

test('vắt 2 lô: FIFO và giá trung bình gia quyền', () => {
  const r = allocateLots(lots, 60, new Map());
  assert.deepEqual(r.allocs.map(x => [x.id, x.qty]), [['a', 40], ['b', 20]]);
  assert.equal(r.total, 40 * 10000 + 20 * 12000);
  assert.ok(Math.abs(r.avgPrice - 640000 / 60) < 1e-6);
});

test('chọn lô bắt đầu và trừ phần dòng khác giữ', () => {
  const r = allocateLots(lots, 50, new Map([['b', 70]]), 'b');
  assert.deepEqual(r.allocs.map(x => [x.id, x.qty]), [['b', 30], ['a', 20]]);
});

test('thiếu tồn: allocated < qty', () => {
  const r = allocateLots(lots, 200, new Map());
  assert.equal(r.allocated, 140);
  assert.equal(r.available, 140);
});
