import { describe, expect, it, beforeEach } from 'vitest';
import {
  getCatalogCache,
  hasFreshCatalogCache,
  invalidateCatalogCache,
  peekCatalogCache
} from './catalogCache';

describe('catalogCache', () => {
  beforeEach(() => {
    invalidateCatalogCache('all');
  });

  it('caches fetcher result and skips second network call', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return ['Kho NVL'];
    };

    const first = await getCatalogCache('warehouses', fetcher);
    const second = await getCatalogCache('warehouses', fetcher);

    expect(first).toEqual(['Kho NVL']);
    expect(second).toEqual(['Kho NVL']);
    expect(calls).toBe(1);
    expect(hasFreshCatalogCache('warehouses')).toBe(true);
    expect(peekCatalogCache<string[]>('warehouses')).toEqual(['Kho NVL']);
  });

  it('dedupes concurrent inflight requests', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, 20));
      return [{ id: '1' }];
    };

    const [a, b] = await Promise.all([
      getCatalogCache('materials', fetcher),
      getCatalogCache('materials', fetcher)
    ]);

    expect(a).toEqual([{ id: '1' }]);
    expect(b).toEqual([{ id: '1' }]);
    expect(calls).toBe(1);
  });

  it('refetches after invalidate or force', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return calls;
    };

    await getCatalogCache('products', fetcher);
    invalidateCatalogCache('products');
    expect(hasFreshCatalogCache('products')).toBe(false);

    const forced = await getCatalogCache('products', fetcher, { force: true });
    expect(forced).toBe(2);
    expect(calls).toBe(2);
  });
});
