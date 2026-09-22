/** In-memory catalog cache for /kho-hang, /kho-nvl, /san-pham — TTL + inflight dedupe. */

export type CatalogCacheKey = 'warehouses' | 'materials' | 'products';

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  data: unknown;
  at: number;
};

const store = new Map<CatalogCacheKey, CacheEntry>();
const inflight = new Map<CatalogCacheKey, Promise<unknown>>();

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return Boolean(entry && Date.now() - entry.at < TTL_MS);
}

export function hasFreshCatalogCache(key: CatalogCacheKey): boolean {
  return isFresh(store.get(key));
}

export function peekCatalogCache<T>(key: CatalogCacheKey): T | null {
  const entry = store.get(key);
  if (!isFresh(entry)) return null;
  return entry.data as T;
}

export async function getCatalogCache<T>(
  key: CatalogCacheKey,
  fetcher: () => Promise<T>,
  options?: { force?: boolean }
): Promise<T> {
  if (!options?.force) {
    const cached = peekCatalogCache<T>(key);
    if (cached !== null) return cached;

    const pending = inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
  } else {
    inflight.delete(key);
  }

  const promise = fetcher()
    .then(data => {
      store.set(key, { data, at: Date.now() });
      return data;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCatalogCache(key: CatalogCacheKey | 'all' = 'all'): void {
  if (key === 'all') {
    store.clear();
    inflight.clear();
    return;
  }
  store.delete(key);
  inflight.delete(key);
}
