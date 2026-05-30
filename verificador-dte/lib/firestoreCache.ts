/**
 * Simple in-memory TTL cache for Firestore reads.
 * Avoids redundant fetches for data that changes infrequently (users, config).
 *
 * Usage:
 *   import { cachedGet } from '@/lib/firestoreCache';
 *   const user = await cachedGet(`users/${uid}`, () => getUser(uid), 60);
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // epoch ms
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Returns a cached value if still fresh, otherwise calls `fetcher`, caches and returns the result.
 * @param key     Unique cache key (e.g. `users/${uid}`)
 * @param fetcher Async function that fetches the real data
 * @param ttlSec  Time-to-live in seconds (default 60)
 */
export async function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSec = 60
): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }
  const value = await fetcher();
  store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  return value;
}

/**
 * Manually invalidate a cache entry (call after writes to keep data consistent).
 */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all entries whose key starts with the given prefix.
 * Useful to bust all entries for a collection, e.g. invalidateCachePrefix('users/').
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
