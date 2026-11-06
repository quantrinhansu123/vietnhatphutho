import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSongCreateDinhMuc } from './OrderProductCreateModal';

const song = {
  group: 'TP; PX Sóng',
  doDaiM: '5.8',
  tenGoc: 'NHỰA SÓNG TRẮNG 4,8KG',
  dinhMucKg: '(đm 4.8 kg)'
};

test('Sóng có kg: mở form thì điền đm tấm 6m và bỏ kg trần khỏi tên gốc', () => {
  const next = resolveSongCreateDinhMuc(song, '11.6', true, false);
  assert.equal(next.dinhMucKg, '(đm 12 kg)');
  assert.equal(next.tenGoc, 'NHỰA SÓNG TRẮNG');
});

test('Sóng: người dùng đã sửa ĐM kg thì giữ số đã gõ', () => {
  const edited = { ...song, dinhMucKg: '(đm 6.8 kg)' };
  const next = resolveSongCreateDinhMuc(edited, '11.6', true, true);
  assert.equal(next.dinhMucKg, '(đm 6.8 kg)');
  assert.equal(next.tenGoc, 'NHỰA SÓNG TRẮNG');
});
