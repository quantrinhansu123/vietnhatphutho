import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { calculateProductConversionFormulas } from '../../src/utils/productConversionCalculation';

// Chạy handler thực với kho dữ liệu giả lập; không khởi động server hoặc ghi Supabase.
const source = ts.createSourceFile('server.ts', fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
let handler = '';
const functions = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(source));
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'post'
    && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/api/san-pham') handler = node.arguments[1].getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(handler);

async function invoke(options: { reuse?: boolean; conversionError?: boolean; insertError?: boolean; conversions?: unknown[] } = {}) {
  const calls: { kind: string; value?: any }[] = [];
  const conversion = { sheetWidthM: '1', sheetLengthM: '3', rollWidthM: '1', rollLengthM: '30', areaM2: '30', kgPerLinearM: '0.617', kgPerM2: '0.617', kgPerSheet: '1.851', kgPerRoll: '18.518' };
  const body = { createOrReuse: true, amisCode: 'AMIS-SAME', name: 'Tấm đặc', productionName: 'Tấm đặc 1m 3m', conversions: options.conversions ?? [conversion] };
  const context = vm.createContext({
    crypto, console, calculateProductConversionFormulas,
    SUPABASE_PRODUCTS_TABLE: 'san_pham', SUPABASE_PRODUCT_CONVERSIONS_TABLE: 'san_pham_quy_doi',
    supabase: { from(table: string) { return { delete() { return { async eq(key: string, value: string) { calls.push({ kind: `delete:${table}`, value }); return { error: null }; } }; } }; } },
    readProductActor: () => ({ id: 'test', name: 'Kiểm thử', username: 'test' }),
    parseProductPatchBody: () => ({ record: { ma_sp: 'AMIS-SAME', ma_amis: body.amisCode, ten_sp: body.name, ten_san_xuat: body.productionName, don_vi: 'Tấm' } }),
    withProductActorStamp: (record: unknown) => record,
    findDuplicateProductIdentity: async () => options.reuse ? { duplicate: 'exists', duplicateId: 'existing-id' } : {},
    insertSanPhamWithActorCompat: async (record: unknown) => { calls.push({ kind: 'insert', value: record }); return options.insertError ? { error: { code: '23505', message: 'ma_sp conflict' } } : { data: { ...(record as object), id: 'new-id' }, error: null }; },
    syncProductConversions: async (id: string, records: unknown) => { calls.push({ kind: 'conversions', value: { id, records } }); return options.conversionError ? { message: 'test failure' } : null; },
    productWriteErrorMessage: (error: { message: string }) => error.message,
    writeSanPhamAuditLog: async () => { calls.push({ kind: 'audit' }); }
  });
  const code = ['parsePositiveConversionNumber', 'parseProductConversionBody', 'parseProductConversionsInput'].map(name => functions.get(name)).join('\n') + `\n(${handler})`;
  const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const run = vm.runInContext(compiled, context);
  let status = 200;
  let response: any;
  const res = { status(value: number) { status = value; return res; }, json(value: unknown) { response = value; return res; } };
  await run({ body, headers: {} }, res);
  return { status, response, calls };
}

test('tạo mới giữ mã AMIS, cấp mã nội bộ riêng, lưu đủ 9 trường theo ID mới', async () => {
  const result = await invoke();
  assert.equal(result.status, 201);
  const inserted = result.calls.find(call => call.kind === 'insert')!.value;
  assert.equal(inserted.ma_amis, 'AMIS-SAME');
  assert.match(inserted.ma_sp, /^VAR-/);
  assert.equal(inserted.ton_dau_ky, 0);
  const saved = result.calls.find(call => call.kind === 'conversions')!.value;
  assert.equal(saved.id, 'new-id');
  assert.deepEqual(JSON.parse(JSON.stringify(saved.records)), [{ kho_tam_rong_m: 1, kho_tam_dai_m: 3, kho_cuon_rong_m: 1, kho_cuon_dai_m: 30, dien_tich_m2: 30, trong_luong_kg_m_dai: 0.617, trong_luong_kg_m2: 0.617, trong_luong_kg_tam: 1.851, trong_luong_kg_cuon: 18.518 }]);
});
test('đúng bộ nhận diện thì dùng lại ID, không ghi đè quy đổi', async () => {
  const result = await invoke({ reuse: true });
  assert.equal(result.response.reused, true);
  assert.equal(result.response.product.id, 'existing-id');
  assert.equal(result.calls.length, 0);
});
test('lỗi quy đổi hoàn tác đúng ID mới, xóa quy đổi trước để không vướng FK', async () => {
  const result = await invoke({ conversionError: true });
  assert.equal(result.status, 500);
  assert.deepEqual(result.calls.filter(call => call.kind.startsWith('delete:')).map(call => [call.kind, call.value]), [['delete:san_pham_quy_doi', 'new-id'], ['delete:san_pham', 'new-id']]);
  assert.equal(result.calls.some(call => call.kind === 'audit'), false);
});
test('trùng mã nội bộ không chạy nhánh upsert sản phẩm gốc', async () => {
  const result = await invoke({ insertError: true });
  assert.equal(result.status, 409);
  assert.deepEqual(result.calls.map(call => call.kind), ['insert']);
});
test('không âm thầm lấy dòng đầu hoặc lưu bộ quy đổi rỗng', async () => {
  for (const conversions of [[], [{}, {}], [{}]]) {
    const result = await invoke({ conversions });
    assert.equal(result.status, 400);
    assert.equal(result.calls.length, 0);
  }
});
