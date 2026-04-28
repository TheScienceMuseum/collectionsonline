// Internal route shapes — used to recognise URLs that point at this app
// (as opposed to external links like wikidata.org / wikipedia.org / VIAF).
// Tight on purpose: matches `/people/cp123`, `/objects/co456`, etc., where
// the prefix is one of our known UID schemes. External URLs, even if they
// happen to contain `/people/` somewhere in the path, won't match because
// of the UID prefix requirement.
const INTERNAL_ROUTE_RE = /^\/(?:people|objects|documents|group)\/(?:cp|ap|co|aa|ag)\w+/i;
const ABSOLUTE_URL_RE = /^https?:\/\//i;

// Walk a cached value and strip any hostname from URLs that point at us.
//
// Why: this cache is shared across staging and production. Older code (or
// any future regression) embedded `${config.rootUrl}` into URLs at write
// time, meaning a write from staging would serve staging URLs to
// production for the 30-day TTL. Read-time normalisation makes the cache
// environment-agnostic without needing a flush — legacy entries quietly
// get the hostname stripped on the way out.
//
// Conservative: only strips when the URL's path matches one of our
// internal route shapes. External URLs (wikidata.org, wikipedia.org,
// gracesguide.co.uk, viaf.org, etc.) pass through untouched.
//
// Mutative — modifies the input in place. Cached objects can be large
// (full Wikidata response with nested arrays) and an immutable deep clone
// would be wasteful for what is effectively a write-during-deserialisation
// step.
//
// === REMOVAL CRITERIA ===
//
// This function is a transitional cleanup, not a long-term part of the
// caching architecture. The forward fix (3 call sites in wikidataQueries.js
// and routes/wiki.js now writing relative paths) means new cache entries
// are correct without it. The normaliser exists only to handle entries
// written BEFORE the forward fix landed.
//
// CACHE_TTL is ~30 days. Once this fix has been deployed to every
// environment that writes to this Redis cache (staging + production) for
// at least 30 days, every legacy entry will have expired and been
// re-written by the new code path. From that point onwards the normaliser
// is dead code and can be removed.
//
// **Safe to remove ~30 days after this PR merges and deploys to all
// environments that share the cache.** Set a reminder when deploying;
// ripping it out is one commit of pure deletion (this function, the two
// call sites in fetchCache / memGet, and the test file
// `test/cached-wikidata-url-normaliser.test.js`).
function normaliseInternalUrls (obj) {
  if (obj == null) return obj;
  if (typeof obj === 'string') {
    if (!ABSOLUTE_URL_RE.test(obj)) return obj;
    try {
      const u = new URL(obj);
      if (INTERNAL_ROUTE_RE.test(u.pathname)) {
        return u.pathname + u.search + u.hash;
      }
    } catch (err) {
      // Unparseable URL string — leave as-is.
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = normaliseInternalUrls(obj[i]);
    }
    return obj;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      obj[k] = normaliseInternalUrls(obj[k]);
    }
    return obj;
  }
  return obj;
}

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
  return normaliseInternalUrls(entry.data);
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
    return normaliseInternalUrls(cached);
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

// Drop a single Q-code from the in-memory fallback cache.
// Called by /clearcache/wikidata/{qcode} alongside the Redis drop.
exports.clearMemoryCache = function (qCode) {
  memoryCache.delete(qCode);
};

// Drop all entries from the in-memory fallback cache.
// Called by /clearcache/wikidata/all alongside the Redis SCAN+DEL.
exports.clearAllMemoryCache = function () {
  memoryCache.clear();
};

// Exported for tests. Production callers go through fetchCache, which
// applies the normaliser automatically.
exports._normaliseInternalUrls = normaliseInternalUrls;
