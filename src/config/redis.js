import { Redis } from '@upstash/redis';

const hasRedisConfig = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

// Create a real Upstash Redis client or a no-op fallback
export const redis = hasRedisConfig
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : createNoopRedis();

function createNoopRedis() {
  const noop = () => Promise.resolve(null);
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'ping') return () => Promise.reject(new Error('Redis not configured'));
      return noop;
    },
  });
}

// Cache helpers
const DEFAULT_TTL = 300; // 5 minutes

export async function cacheGet(key) {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttl = DEFAULT_TTL) {
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttl });
  } catch { /* silently fail */ }
}

export async function cacheDel(pattern) {
  try {
    if (pattern.includes('*')) {
      // Upstash supports SCAN-based deletion
      const keys = [];
      let cursor = 0;
      do {
        const [nextCursor, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== 0);
      if (keys.length > 0) {
        await Promise.all(keys.map(k => redis.del(k)));
      }
    } else {
      await redis.del(pattern);
    }
  } catch { /* silently fail */ }
}

export async function cacheGetOrSet(key, fetchFn, ttl = DEFAULT_TTL) {
  const cached = await cacheGet(key);
  if (cached) {
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  }
  const fresh = await fetchFn();
  await cacheSet(key, fresh, ttl);
  return fresh;
}
