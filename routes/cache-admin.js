'use strict';

const cache = require('../bin/cache');
// Note: cache.redis is a getter — do NOT destructure it at module load time.
// It must be read inside each handler (after cache.start() has run at boot).
const {
  isValidToken,
  endpointForSlug,
  allSlugs,
  listSegment,
  deleteSegment
} = require('../lib/cache-admin');
const { fetchAndCacheEndpoint, dropFeed } = require('../lib/cached-feed');
const { dropCache: dropDocument } = require('../lib/cached-document');
const { clearMemoryCache, clearAllMemoryCache } = require('../lib/cached-wikidata');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Validate token and return a 401 response if invalid.
// Returns null if the token is valid (caller should proceed).
function unauthorised (req, h) {
  const { token } = req.query;
  if (!isValidToken(token)) {
    return h.response({ error: 'Unauthorised' }).code(401);
  }
  return null;
}

// Return a 503 if Redis is not available (required for SCAN-based bulk ops).
function redisUnavailable (h) {
  return h.response({ error: 'Redis not available' }).code(503);
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

module.exports = () => [

  // ── /listcache ────────────────────────────────────────────────────────────

  // List all wikidata Q-codes currently cached in Redis.
  {
    method: 'GET',
    path: '/listcache/wikidata',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        if (!cache.isReady() || !cache.redis) return redisUnavailable(h);
        try {
          const keys = await listSegment(cache.redis, 'wikidata');
          return h.response({ segment: 'wikidata', count: keys.length, keys }).code(200);
        } catch (err) {
          console.error('[listcache/wikidata]', err.message);
          return h.response({ error: 'Failed to list wikidata cache' }).code(500);
        }
      }
    }
  },

  // List all article feed URLs currently cached in Redis, alongside their slugs.
  {
    method: 'GET',
    path: '/listcache/articles',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        if (!cache.isReady() || !cache.redis) return redisUnavailable(h);
        try {
          const cachedUrls = await listSegment(cache.redis, 'feed');
          // Annotate each URL with its human-readable label and slug where known.
          const slugMap = allSlugs();
          const urlToMeta = Object.entries(slugMap).reduce((m, [slug, ep]) => {
            m[ep.url] = { slug, label: ep.label };
            return m;
          }, {});
          const keys = cachedUrls.map(url => ({
            url,
            ...(urlToMeta[url] || {})
          }));
          return h.response({ segment: 'articles', count: keys.length, keys }).code(200);
        } catch (err) {
          console.error('[listcache/articles]', err.message);
          return h.response({ error: 'Failed to list articles cache' }).code(500);
        }
      }
    }
  },

  // List all document/archive fondsIds currently cached in Redis.
  {
    method: 'GET',
    path: '/listcache/documents',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        if (!cache.isReady() || !cache.redis) return redisUnavailable(h);
        try {
          const keys = await listSegment(cache.redis, 'documents');
          return h.response({ segment: 'documents', count: keys.length, keys }).code(200);
        } catch (err) {
          console.error('[listcache/documents]', err.message);
          return h.response({ error: 'Failed to list documents cache' }).code(500);
        }
      }
    }
  },

  // ── /clearcache/wikidata ──────────────────────────────────────────────────

  // Clear ALL wikidata entries from Redis and the in-memory fallback.
  {
    method: 'GET',
    path: '/clearcache/wikidata/all',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        if (!cache.isReady() || !cache.redis) return redisUnavailable(h);
        try {
          const deleted = await deleteSegment(cache.redis, 'wikidata');
          clearAllMemoryCache();
          console.log(`[clearcache] Cleared ${deleted} wikidata entries from Redis`);
          return h.response({ cleared: 'wikidata', count: deleted }).code(200);
        } catch (err) {
          console.error('[clearcache/wikidata/all]', err.message);
          return h.response({ error: 'Failed to clear wikidata cache' }).code(500);
        }
      }
    }
  },

  // Clear a single wikidata entry from Redis and the in-memory fallback.
  {
    method: 'GET',
    path: '/clearcache/wikidata/{qcode}',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        const { qcode } = req.params;
        try {
          if (cache.isReady()) {
            await cache.drop({ segment: 'wikidata', id: qcode });
          }
          clearMemoryCache(qcode);
          console.log(`[clearcache] Cleared wikidata entry: ${qcode}`);
          return h.response({ cleared: 'wikidata', qcode }).code(200);
        } catch (err) {
          console.error(`[clearcache/wikidata/${qcode}]`, err.message);
          return h.response({ error: 'Failed to clear wikidata entry' }).code(500);
        }
      }
    }
  },

  // ── /clearcache/articles ──────────────────────────────────────────────────

  // Clear ALL article feeds from Redis then immediately re-warm them.
  // Re-warming runs sequentially (matching startup behaviour) to avoid
  // Cloudflare rate-limiting on the external feed endpoints.
  {
    method: 'GET',
    path: '/clearcache/articles/all',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        if (!cache.isReady() || !cache.redis) return redisUnavailable(h);
        try {
          const deleted = await deleteSegment(cache.redis, 'feed');
          console.log(`[clearcache] Dropped ${deleted} article feed entries from Redis — re-warming`);

          const slugMap = allSlugs();
          const results = [];
          for (const [slug, endpoint] of Object.entries(slugMap)) {
            const data = await fetchAndCacheEndpoint(endpoint);
            results.push({ slug, label: endpoint.label, url: endpoint.url, warmed: !!data });
          }

          return h.response({ cleared: 'articles', dropped: deleted, rewarmed: results }).code(200);
        } catch (err) {
          console.error('[clearcache/articles/all]', err.message);
          return h.response({ error: 'Failed to clear articles cache' }).code(500);
        }
      }
    }
  },

  // Clear a single article feed by its label slug, then re-warm it.
  // Slugs map to the labels in fixtures/article-endpoints.js, e.g.:
  //   "Science Museum Blog" → science-museum-blog
  //   "Railway Museum"      → railway-museum
  {
    method: 'GET',
    path: '/clearcache/articles/{slug}',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        const { slug } = req.params;
        const endpoint = endpointForSlug(slug);
        if (!endpoint) {
          const available = Object.keys(allSlugs());
          return h.response({ error: `Unknown article slug: "${slug}"`, available }).code(404);
        }
        try {
          await dropFeed(endpoint.url);
          const data = await fetchAndCacheEndpoint(endpoint);
          console.log(`[clearcache] Cleared and re-warmed article feed: ${endpoint.label}`);
          return h.response({
            cleared: 'articles',
            slug,
            label: endpoint.label,
            url: endpoint.url,
            warmed: !!data
          }).code(200);
        } catch (err) {
          console.error(`[clearcache/articles/${slug}]`, err.message);
          return h.response({ error: 'Failed to clear article feed' }).code(500);
        }
      }
    }
  },

  // ── /clearcache/documents ─────────────────────────────────────────────────

  // Clear ALL document/archive hierarchy entries from Redis.
  // Individual entries are re-fetched from Elasticsearch on the next page load.
  {
    method: 'GET',
    path: '/clearcache/documents/all',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        if (!cache.isReady() || !cache.redis) return redisUnavailable(h);
        try {
          const deleted = await deleteSegment(cache.redis, 'documents');
          console.log(`[clearcache] Cleared ${deleted} document entries from Redis`);
          return h.response({ cleared: 'documents', count: deleted }).code(200);
        } catch (err) {
          console.error('[clearcache/documents/all]', err.message);
          return h.response({ error: 'Failed to clear documents cache' }).code(500);
        }
      }
    }
  },

  // Clear a single document/archive hierarchy entry by fondsId.
  {
    method: 'GET',
    path: '/clearcache/documents/{id}',
    config: {
      handler: async (req, h) => {
        const denied = unauthorised(req, h);
        if (denied) return denied;
        const { id } = req.params;
        try {
          await dropDocument(id);
          console.log(`[clearcache] Cleared document entry: ${id}`);
          return h.response({ cleared: 'documents', id }).code(200);
        } catch (err) {
          console.error(`[clearcache/documents/${id}]`, err.message);
          return h.response({ error: 'Failed to clear document entry' }).code(500);
        }
      }
    }
  }

];
