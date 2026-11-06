import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMaAmisMoi, buildCutAmisCodeFull, productionNameAmisGrade } from './productProductionName';

for (const [label, build] of [['miền nam', buildMaAmisMoi], ['cắt lẻ', buildCutAmisCodeFull]] as const) {
  for (const [name, grade] of [['Tấm đặc - NP - STD - 2li - 3m', 'NP'], ['Tấm đặc - OFF - STD - 2li - 3m', 'NP2'], ['Tấm đặc - off - STD - 2li - 3m', 'NP2'], ['Tấm đặc - NP - off - STD - 2li - 3m', 'NP2']] as const) {
    test(`${label}: ${name} → đúng một ${grade}`, () => {
      const code = build({ baseMaAmis: 'STD06-2li*1.22m', nhomVthh: 'TP; PX Đặc', tenSanXuat: name, cutLengthM: 3, mang: 'STD' });
      assert.deepEqual(code.match(/\bNP2?\b/giu), [grade]);
      assert.equal(code.includes('100PHE'), false);
    });
  }
  test(`${label}: OFF thay NP cũ, không tạo NP-NP2 hoặc NP2 lặp`, () => {
    const input = { baseMaAmis: 'STD06-2li*1.22m-NP-STD-3m', nhomVthh: 'TP; PX Đặc', tenSanXuat: 'Tấm đặc - off - STD - 2li - 3m' };
    const first = build(input);
    assert.deepEqual(first.match(/\bNP2?\b/giu), ['NP2']);
    const second = build({ ...input, baseMaAmis: first });
    assert.deepEqual(second.match(/\bNP2?\b/giu), ['NP2']);
  });
  test(`${label}: tên NP giữ đúng một NP khi mã gốc đã có NP`, () => {
    const code = build({ baseMaAmis: 'STD06-2li*1.22m-NP', nhomVthh: 'TP; PX Đặc', tenSanXuat: 'Tấm đặc - NP - STD - 2li' });
    assert.deepEqual(code.match(/\bNP2?\b/giu), ['NP']);
  });
  test(`${label}: tên NP không làm mất phân loại NP2 đã lưu`, () => {
    const code = build({ baseMaAmis: 'STD06-2li*1.22m-NP2', nhomVthh: 'TP; PX Đặc', tenSanXuat: 'Tấm đặc - NP - STD - 2li' });
    assert.deepEqual(code.match(/\bNP2?\b/giu), ['NP2']);
  });
}
test('chỉ nhận token NP/OFF tường minh; giữ quy tắc GIÁ RẺ → NP2', () => {
  assert.equal(productionNameAmisGrade('OFFICE - NPL - NSOFF'), '');
  assert.equal(productionNameAmisGrade('NP - (GIÁ RẺ)'), 'NP2');
});
