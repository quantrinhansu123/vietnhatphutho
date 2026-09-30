import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySoTronScopes,
  assertSoTron,
  canDeleteSoTron,
  canSeeSoTronThanhPham,
  resolveSoTronRoles,
  type SoTronActor
} from './soTronPhanQuyen.ts';
import { signSoTronToken, verifySoTronToken } from './soTronToken.ts';

const mixer: SoTronActor = {
  id: 'nv-1',
  username: 'to.tron',
  name: 'Tổ trộn',
  roles: ['TO_TRON'],
  ca: '12C1'
};
const px: SoTronActor = { ...mixer, id: 'nv-2', username: 'px', name: 'PX', roles: ['NV_PX'] };
const lead: SoTronActor = {
  id: 'tc-1',
  username: 'truong.ca',
  name: 'Trưởng ca',
  roles: ['TRUONG_CA'],
  ca: '12C1'
};
const admin: SoTronActor = { id: 'admin', username: 'admin', name: 'Admin', roles: ['ADMIN'], ca: '' };

test('TO_TRON gọi ghi thành phẩm bị 403, TRUONG_CA gọi ghi vật tư bị 403', () => {
  const tp = assertSoTron(mixer, 'create', 'thanh_pham', { ca: '12C1', khoa_ca: false, vat_tu_owner_id: '' });
  assert.equal(tp.ok, false);
  if (!tp.ok) assert.equal(tp.status, 403);

  const vt = assertSoTron(lead, 'create', 'vat_tu', { ca: '12C1', khoa_ca: false, vat_tu_owner_id: '' });
  assert.equal(vt.ok, false);
  if (!vt.ok) assert.equal(vt.status, 403);

  assert.equal(assertSoTron(mixer, 'create', 'vat_tu').ok, true);
  assert.equal(assertSoTron(px, 'update', 'vat_tu', { ca: '12C1', khoa_ca: false, vat_tu_owner_id: 'nv-2' }).ok, true);
  assert.equal(assertSoTron(lead, 'update', 'thanh_pham', { ca: '12C1', khoa_ca: false, vat_tu_owner_id: '' }).ok, true);
});

test('sửa phiếu của người khác, khác ca, hoặc sau khi chốt đều bị chặn', () => {
  const other = assertSoTron(mixer, 'update', 'vat_tu', {
    ca: '12C1',
    khoa_ca: false,
    vat_tu_owner_id: 'nv-9'
  });
  assert.equal(other.ok, false);

  const otherCa = assertSoTron(lead, 'update', 'thanh_pham', {
    ca: '12C2',
    khoa_ca: false,
    vat_tu_owner_id: ''
  });
  assert.equal(otherCa.ok, false);

  const locked = assertSoTron(mixer, 'update', 'vat_tu', {
    ca: '12C1',
    khoa_ca: true,
    vat_tu_owner_id: 'nv-1'
  });
  assert.equal(locked.ok, false);
  if (!locked.ok) assert.match(locked.error, /chốt/);
});

test('xóa là trưởng ca và quản trị, mở khóa chỉ ADMIN, kiêm nhiệm được cả hai trang', () => {
  assert.equal(assertSoTron(mixer, 'delete', 'vat_tu').ok, false);
  assert.equal(assertSoTron(lead, 'delete', 'vat_tu').ok, true);
  assert.equal(assertSoTron(admin, 'delete', 'vat_tu').ok, true);
  assert.equal(canDeleteSoTron(lead.roles), true);
  assert.equal(canDeleteSoTron(mixer.roles), false);
  assert.equal(assertSoTron(lead, 'lock', 'thanh_pham', { ca: '12C1', khoa_ca: false, vat_tu_owner_id: '' }).ok, true);
  assert.equal(assertSoTron(mixer, 'lock', 'vat_tu').ok, false);
  assert.equal(assertSoTron(lead, 'unlock', 'thanh_pham').ok, false);
  assert.equal(assertSoTron(admin, 'unlock', 'vat_tu').ok, true);
  assert.equal(assertSoTron(null, 'view', 'vat_tu').ok, false);

  assert.deepEqual(
    resolveSoTronRoles({ role: 'Nhân Viên', extra: ['Phân xưởng sản xuất'] }),
    ['NV_PX']
  );
  assert.deepEqual(
    resolveSoTronRoles({ role: 'Trưởng Phòng', extra: ['Phân xưởng sản xuất'] }),
    ['TRUONG_CA']
  );
  assert.deepEqual(resolveSoTronRoles({ role: 'Trộn', extra: ['Phân xưởng sản xuất'] }), ['TO_TRON']);
  assert.deepEqual(resolveSoTronRoles({ role: 'Nhân Viên', extra: ['Kinh doanh'] }), []);

  const both = resolveSoTronRoles({ role: 'Trưởng ca kiêm Tổ trộn' });
  assert.deepEqual(both, ['TRUONG_CA', 'TO_TRON']);
  const dual: SoTronActor = { ...lead, roles: both };
  assert.equal(assertSoTron(dual, 'create', 'vat_tu').ok, true);
  assert.equal(assertSoTron(dual, 'create', 'thanh_pham', { ca: '12C1', khoa_ca: false, vat_tu_owner_id: '' }).ok, true);
  assert.equal(canSeeSoTronThanhPham(['TO_TRON']), false);
  assert.equal(canSeeSoTronThanhPham(['NV_PX']), false);
  assert.equal(canSeeSoTronThanhPham(['TRUONG_CA']), true);
  assert.equal(canSeeSoTronThanhPham(['TRUONG_CA', 'TO_TRON']), true);
});

test('ghi thành phẩm không đè vật tư đã lưu', () => {
  const merged = applySoTronScopes(
    { bang_nvl: [{ ma_nvl: 'A' }], bang_san_pham: [], ca: '12C1', ghi_chu: 'cũ' },
    { bang_nvl: [{ ma_nvl: 'B' }], bang_san_pham: [{ ten_sp: 'Tấm' }], ca: '12C2', ghi_chu: 'mới' },
    ['thanh_pham']
  );
  assert.deepEqual(merged.bang_nvl, [{ ma_nvl: 'A' }]);
  assert.deepEqual(merged.bang_san_pham, [{ ten_sp: 'Tấm' }]);
  assert.equal(merged.ca, '12C1');
  assert.equal(merged.ghi_chu, 'mới');
});

test('JWT hết hạn hoặc sai chữ ký không thành actor', () => {
  const token = signSoTronToken(lead, 'secret', 60);
  assert.equal(verifySoTronToken(token, 'secret')?.id, 'tc-1');
  assert.equal(verifySoTronToken(token, 'khac'), null);
  const expired = signSoTronToken(lead, 'secret', -10);
  assert.equal(verifySoTronToken(expired, 'secret'), null);
});
