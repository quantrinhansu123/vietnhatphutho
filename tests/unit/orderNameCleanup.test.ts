import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanNames,repairDh012} from '../../scripts/remove-order-composed-names.mjs';
test('cleanup removes obsolete keys recursively and preserves current production name',()=>{
  const input=[{ten_san_xuat:'2m',ten_ghep:'6m',tenGhep:'6m',so_luong:100,notes:[{ten_ghep:'old'}]}];
  const next=cleanNames(input);
  assert.equal(next[0].ten_san_xuat,'2m');assert.equal(next[0].so_luong,100);
  assert.equal(JSON.stringify(next).includes('ten_ghep'),false);assert.equal(JSON.stringify(next).includes('tenGhep'),false);
  assert.equal(input[0].ten_ghep,'6m');
});
test('missing production name is recovered before removing the legacy name',()=>{
 assert.deepEqual(cleanNames({ten_ghep:'old name'}),{ten_san_xuat:'old name'});
});
test('DH012 repair switches only confirmed line 6 to 2m, scales conversions once and preserves production allocation',()=>{
 const catalog=[{id:'c3c98494-4a17-4513-9763-1c6d63352026',ma_sp:'STS02',ten_san_xuat:'Nhựa sóng - 2m'}];
 const input=[{stt:6,san_pham_id:'26eba6ad-b646-4302-afc4-358f2c19c3a1',ma_sp:'STS02',so_luong:100,so_luong_bac:100,tong_kg:499.98,tl_tam:4.9998,m2:648,m_dai:600,ket_qua_quy_doi:[{don_vi:'kg',gia_tri:499.98},{don_vi:'m dài',gia_tri:600}],sl_sx:{bac:100}},{stt:5,ten_san_xuat:'Keep'}];
 const next=repairDh012(input,catalog);
 assert.equal(next[0].tong_kg,166.66);assert.equal(next[0].tl_tam,1.6666);assert.equal(next[0].m2,216);assert.equal(next[0].m_dai,200);assert.equal(next[0].dai_m,2);
 assert.equal(next[0].so_luong,100);assert.deepEqual(next[0].sl_sx,{bac:100});assert.equal(next[1],input[1]);
 assert.deepEqual(repairDh012(next,catalog),next);assert.equal(input[0].m_dai,600);
});
