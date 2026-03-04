// In-memory fallback used when Redis is unavailable (e.g. local dev).
// Keyed by Q-code; each entry carries an expiry timestamp so stale data
// is never returned even if Redis stays down for an extended period.
const memoryCache = new Map();
// 1 minute in development (see Wikidata changes quickly without Redis);
// 5 minutes in all other environments as a graceful fallback.
const MEMORY_TTL_MS = process.env.NODE_ENV === 'development'
  ? 60 * 1000
  : 5 * 60 * 1000;

// Constants for cache configuration — match the pattern in cached-document.js
const CACHE_SEGMENT = 'wikidata';
const CACHE_TTL = 2629746000; // ~30 days in milliseconds

function memGet (key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function memSet (key, data) {
  memoryCache.set(key, { data, expiresAt: Date.now() + MEMORY_TTL_MS });
}

exports.fetchCache = async function (cache, qCode, clearCache = undefined) {
  try {
    if (!cache || !cache.isReady()) {
      if (clearCache !== undefined) {
        memoryCache.delete(qCode);
        return null;
      }
      return memGet(qCode);
    }
    const cached = await cache.get({ segment: CACHE_SEGMENT, id: qCode });
    if (cached && clearCache !== undefined) {
      await cache.drop({ segment: CACHE_SEGMENT, id: qCode });
      return null;
    }
    return cached;
  } catch (err) {
    console.debug("Couldn't fetch from wikidata cache:", err.message);
    return null;
  }
};

exports.setCache = async function (cache, qCode, data, clear = undefined, ttl = CACHE_TTL) {
  try {
    if (!cache || !cache.isReady()) {
      memSet(qCode, data);
      return null;
    }
    // Always write — the old entry was already dropped by fetchCache when clear is set,
    // so skipping the write here (the previous behaviour) left Redis with stale data
    // after a ?clear request.
    await cache.set({ segment: CACHE_SEGMENT, id: qCode }, data, ttl);
    return null;
  } catch (err) {
    console.debug("Couldn't write to wikidata cache:", err.message);
    return null;
  }
};
