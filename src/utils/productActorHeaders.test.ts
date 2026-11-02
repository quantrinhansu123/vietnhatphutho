import assert from 'node:assert/strict';
import test from 'node:test';
import { STORAGE_AUTH_KEY } from '../features/_shared/storageKeys';
import { productApiHeaders } from './productActorHeaders';
import { readProductActor } from './productActor';

test('DELETE sản phẩm gửi được tên tiếng Việt và giữ nguyên người thao tác', () => {
  const actor = { id: 'nv-1', username: 'quản.trị%20', name: 'Nguyễn Văn Đạt 🏭' };
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => key === STORAGE_AUTH_KEY ? JSON.stringify(actor) : null }
  });
  try {
    // Request dùng cùng kiểm tra ByteString cho headers như fetch của trình duyệt.
    assert.throws(() => new Request('http://localhost/api/san-pham', {
      method: 'DELETE', headers: { 'X-Actor-Name': actor.name }
    }), TypeError);
    const request = new Request('http://localhost/api/san-pham', {
      method: 'DELETE', headers: productApiHeaders(), body: JSON.stringify({ ids: ['sp-1'] })
    });
    assert.equal(request.headers.get('content-type'), 'application/json');
    assert.deepEqual(readProductActor({ headers: Object.fromEntries(request.headers) }), actor);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('header cũ không bị giải mã nhầm và header lỗi không làm hỏng thao tác', () => {
  assert.deepEqual(readProductActor({ headers: {
    'x-actor-id': 'nv-1', 'x-actor-username': 'user%20', 'x-actor-name': 'Admin'
  } }), { id: 'nv-1', username: 'user%20', name: 'Admin' });
  assert.deepEqual(readProductActor({ headers: {
    'x-actor-encoding': 'uri-component', 'x-actor-name': '%invalid'
  } }), { id: '', username: 'unknown', name: '%invalid' });
  assert.deepEqual(readProductActor({}), { id: '', username: 'unknown', name: 'Không rõ' });
});
