import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as scope from '../../src/utils/orderScope';
import { filterOrderProductsByRegion, type OrderProductOption } from '../../src/features/_shared/orderHelpers';

const pairs = [
  ['Đơn bán', 'Miền Bắc'], ['Đơn sản xuất', 'Tất cả'],
  ['Đơn theo quy cách của khách đặt', 'Miền Bắc'], ['Đơn cắt lẻ miền Bắc', 'Miền Bắc'],
  ['Đơn miền nam', 'Miền Nam'], ['Đơn cắt lẻ miền Nam', 'Miền Nam']
] as const;

describe('Miền và loại đơn', () => {
  it('ba miền và sáu loại đơn đúng yêu cầu, kể cả admin', () => {
    assert.deepEqual(scope.ORDER_REGION_OPTIONS, ['Tất cả', 'Miền Bắc', 'Miền Nam']);
    for (const region of scope.ORDER_REGION_OPTIONS) {
      assert.deepEqual(scope.orderTypeOptionsForRegion(region, true), pairs.filter(p => p[1] === region).map(p => p[0]));
    }
    assert.deepEqual(scope.orderTypeOptionsForRegion('Tất cả', false), []);
  });

  it('kiểm tra đủ 18 cặp miền/loại đơn, chỉ nhận đúng 6 cặp', () => {
    for (const [type, expected] of pairs) {
      for (const region of scope.ORDER_REGION_OPTIONS) {
        assert.equal(scope.orderScopeValidationError(type, region) === null, region === expected, `${type}/${region}`);
      }
      assert.equal(scope.resolveOrderRegion(type), expected);
      assert.equal(scope.orderScopeValidationError(type, ''), null);
    }
  });

  it('đổi miền tự chọn loại hợp lệ và giữ cắt lẻ khi chuyển Bắc/Nam', () => {
    assert.equal(scope.resolveOrderTypeFromRegion('Tất cả', 'Đơn bán', true), 'Đơn sản xuất');
    assert.equal(scope.resolveOrderTypeFromRegion('Miền Bắc', 'Đơn sản xuất', true), 'Đơn bán');
    assert.equal(scope.resolveOrderTypeFromRegion('Miền Nam', 'Đơn bán', true), 'Đơn miền nam');
    assert.equal(scope.resolveOrderTypeFromRegion('Miền Nam', 'Đơn cắt lẻ', true), 'Đơn cắt lẻ miền Nam');
    assert.equal(scope.resolveOrderTypeFromRegion('Miền Bắc', 'Đơn cắt lẻ miền Nam', true), 'Đơn cắt lẻ miền Bắc');
    assert.equal(scope.resolveOrderTypeFromRegion('Tất cả', 'Đơn bán', false), '');
  });

  it('tương thích cắt lẻ cũ; cả Bắc và Nam đi Lệnh cắt lẻ, chỉ Nam dùng tính toán miền Nam', () => {
    for (const type of ['Đơn cắt lẻ', 'Đơn cắt lẻ miền Bắc', 'Đơn cắt lẻ miền Nam']) {
      assert.equal(scope.isRetailCutOrderType(type), true);
      assert.equal(scope.isCutLikeOrderType(type), true);
    }
    assert.equal(scope.normalizeOrderType('Đơn cắt lẻ'), 'Đơn cắt lẻ miền Bắc');
    assert.equal(scope.isSouthOrderType('Đơn cắt lẻ miền Nam'), true);
    assert.equal(scope.isSouthOrderType('Đơn cắt lẻ miền Bắc'), false);
    assert.equal(scope.isRetailCutOrderType('Đơn theo quy cách của khách đặt'), false);
  });

  it('Miền Tất cả hiện đủ sản phẩm Bắc/Nam', () => {
    const products = [
      { id: 'north', tcmb: true, productionName: 'ĐẶC TCMB', name: '', tenGhep: '', group: '', code: 'B' },
      { id: 'south', tcmn: 'TCMN', productionName: 'ĐẶC TCMN', name: '', tenGhep: '', group: '', code: 'N' }
    ] as OrderProductOption[];
    assert.equal(filterOrderProductsByRegion(products, 'Tất cả').length, 2);
    assert.deepEqual(filterOrderProductsByRegion(products, 'Miền Bắc').map(p => p.id), ['north']);
    assert.deepEqual(filterOrderProductsByRegion(products, 'Miền Nam').map(p => p.id), ['south']);
  });

  it('API và form chọn đúng bảng, không nhận tên bảng tùy ý', () => {
    assert.deepEqual(scope.orderProductTablesForRegion('Miền Bắc'), ['san_pham_mb']);
    assert.deepEqual(scope.orderProductTablesForRegion('Miền Nam'), ['san_pham_mn']);
    assert.deepEqual(scope.orderProductTablesForRegion('Tất cả'), ['san_pham_mb', 'san_pham_mn']);
    assert.throws(() => scope.orderProductTablesForRegion('san_pham'));
    for (const region of scope.ORDER_REGION_OPTIONS) {
      assert.equal(new URL(scope.orderProductLookupUrl(region), 'http://test').searchParams.get('mien'), region);
    }
  });
});

describe('API GET sản phẩm theo miền', () => {
  const source = readFileSync('server.ts', 'utf8');
  const start = source.indexOf("  app.get('/api/san-pham', async");
  const end = source.indexOf("  app.get('/api/san-pham/:id/with-conversions'", start);
  const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

  async function read(region: string, missing = '') {
    let handler: any;
    const calls: string[] = [];
    const data = {
      san_pham_mb: Array.from({ length: 1001 }, (_, i) => ({ id: `B${i}`, ten_sp: `B${i}` })),
      san_pham_mn: [{ id: 'N1', ten_sp: 'N1' }, { id: 'N2', ten_sp: 'N2' }]
    };
    const context = vm.createContext({
      ...scope, SUPABASE_PRODUCTS_TABLE: 'san_pham', console,
      app: { get: (_path: string, fn: any) => { handler = fn; } },
      respondSupabaseReadError: (res: any, _error: any, table: string) => res.status(500).json({ error: table }),
      supabase: { from: (table: string) => {
        calls.push(table);
        const query = { select: () => query, order: () => query,
          range: async (from: number, to: number) => table === missing ? { error: { message: 'missing table' }, data: null }
            : { data: data[table as keyof typeof data]?.slice(from, to + 1) || [], error: null } };
        return query;
      } }
    });
    vm.runInContext(compiled, context);
    const response = { code: 200, body: null as any, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ query: { format: 'table', mien: region } }, response);
    return { ...response, calls };
  }

  it('Bắc/Nam truy vấn bảng riêng; Tất cả phân trang hết cả hai nguồn', async () => {
    const north = await read('Miền Bắc');
    assert.equal(north.body.total, 1001);
    assert.ok(north.calls.every(t => t === 'san_pham_mb'));
    assert.equal(north.body.products[0].mien, 'Miền Bắc');
    const south = await read('Miền Nam');
    assert.equal(south.body.total, 2);
    assert.deepEqual(south.calls, ['san_pham_mn']);
    const all = await read('Tất cả');
    assert.equal(all.body.total, 1003);
    assert.deepEqual([...new Set(all.calls)], ['san_pham_mb', 'san_pham_mn']);
  });

  it('thiếu bảng báo lỗi, không âm thầm quay về san_pham; từ chối miền lạ', async () => {
    const missing = await read('Tất cả', 'san_pham_mn');
    assert.equal(missing.code, 500);
    assert.equal(missing.body.error, 'san_pham_mn');
    assert.ok(!missing.calls.includes('san_pham'));
    const invalid = await read('Miền Trung');
    assert.equal(invalid.code, 400);
    assert.equal(invalid.calls.length, 0);
  });
});

describe('API parseOrderBody dùng chung quy tắc miền', () => {
  const source = readFileSync('server.ts', 'utf8');
  const start = source.indexOf('function parseOrderBody(');
  const end = source.indexOf('function orderWriteErrorMessage(', start);
  const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ ...scope, parseOrderProductsInput: (body: any) => ({ products: body.products || [] }), parseOrderQuantity: Number });
  vm.runInContext(compiled, context);

  it('chặn cặp sai miền, lưu đúng khu_vuc cho sáu loại đơn', () => {
    for (const [orderType, expected] of pairs) {
      for (const region of scope.ORDER_REGION_OPTIONS) {
        const result = context.parseOrderBody({ orderCode: 'DH-TEST', orderType, khu_vuc: region, products: [] });
        if (region !== expected) assert.ok(result.error, `${orderType}/${region}`);
        else {
          assert.equal(result.record.khu_vuc, expected);
          assert.equal(result.record.loai_don_hang, orderType);
        }
      }
    }
  });

  it('chuẩn hóa loại cắt lẻ cũ, suy miền khi thiếu, không đổi kiểu đơn khi đã có kiểu', () => {
    const old = context.parseOrderBody({ orderCode: 'DH-OLD', orderType: 'Đơn cắt lẻ', products: [] });
    assert.equal(old.record.loai_don_hang, 'Đơn cắt lẻ miền Bắc');
    assert.equal(old.record.khu_vuc, 'Miền Bắc');
    const production = context.parseOrderBody({ orderCode: 'DH-SX', orderType: 'Đơn sản xuất', products: [] });
    assert.equal(production.record.khu_vuc, 'Tất cả');
  });
});
