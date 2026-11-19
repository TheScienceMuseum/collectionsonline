const getAllFromArchive = require('../lib/get-full-archive');
const archiveTree = require('../lib/archive-tree');
const cache = require('../bin/cache');
const getPrimaryValue = require('./get-primary-value');
const config = require('../config');

// Constants for cache configuration
const CACHE_SEGMENT = 'documents';
const DEFAULT_CACHE_TTL = 86400000; // 24 hours in milliseconds
// Allow override via config/env (documentCacheTtl in .corc or co_documentCacheTtl env var)
const CACHE_TTL = config.documentCacheTtl || DEFAULT_CACHE_TTL;

// Rebuilding a tree scrolls the whole fonds (~11.5k records for the largest).
// Concurrent requests for documents in the same fonds share one rebuild
// instead of each running their own scroll.
const inFlight = new Map(); // fondsId -> Promise<tree>

// After a full-archive fetch fails, serve the minimal (incomplete) tree for a
// short while instead of re-scrolling on every page view. Without this an
// Elasticsearch slowdown is multiplied by every request retrying the fetch —
// part of what turned the 19 Nov 2026 slowdown into an outage.
const FAILURE_BACKOFF_MS = 60 * 1000;
const retryAfter = new Map(); // fondsId -> ms timestamp

// sourceBody is the already-fetched elastic.get result.body from the route,
// passed in to avoid a redundant second elastic.get call on cache miss.
module.exports = async (elastic, id, fondsId, sourceBody) => {
  // Try to get from cache
  const cached = await getFromCache(fondsId);
  if (cached) {
    return cached.item;
  }

  // Fall back to direct Elasticsearch query, joining a rebuild of this fonds
  // that another request has already started. Check-and-set is synchronous,
  // so only one rebuild per fonds can be in flight in this process.
  let rebuild = inFlight.get(fondsId);
  if (!rebuild) {
    rebuild = getDataDirectly(elastic, id, fondsId, sourceBody)
      .finally(() => inFlight.delete(fondsId));
    inFlight.set(fondsId, rebuild);
  }
  return rebuild;

  async function getFromCache (fondsId) {
    if (!cache || !cache.isReady()) return null;

    try {
      const envelope = await cache.get({ segment: CACHE_SEGMENT, id: fondsId });
      if (!envelope) return null;

      // If the requested record was reprocessed upstream after the tree was
      // cached, the cached hierarchy may be out of date — drop it and rebuild.
      // sourceBody is optional; callers without it just get TTL-based expiry.
      const admin = sourceBody && sourceBody._source && sourceBody._source['@admin'];
      const processed = admin && admin.processed;
      if (processed && processed > envelope.stored) {
        console.info('Cached archive tree is stale, regenerating', { fondsId, processed, stored: envelope.stored });
        await dropCache(fondsId);
        return null;
      }

      return envelope;
    } catch (err) {
      console.warn('Cache get operation failed', { error: err.message, fondsId });
      return null;
    }
  }

  async function getDataDirectly (elastic, id, fondsId, sourceBody) {
    const backingOff = (retryAfter.get(fondsId) || 0) > Date.now();
    const data = await getFullArchive(elastic, id, sourceBody, { skipFullFetch: backingOff });
    const tree = archiveTree.sortChildren(data);

    if (data.incomplete) {
      // Surface the flag to the route so the response isn't CDN-cached;
      // it lives on the flat array and would otherwise be lost here.
      tree.incomplete = true;
      if (!backingOff) retryAfter.set(fondsId, Date.now() + FAILURE_BACKOFF_MS);
    } else {
      retryAfter.delete(fondsId);
      try {
        await cacheDocument(fondsId, tree);
      } catch (err) {
        console.warn('Failed to cache document', { error: err.message, fondsId });
      }
    }

    return tree;
  }
};

async function getFullArchive (elastic, id, sourceBody, opts = {}) {
  try {
    let fond;
    const data = [];
    const body = sourceBody || (await elastic.get({ index: config.elasticIndex, id })).body;

    if (body._source.level && body._source.level.value === 'fonds') {
      fond = {
        id,
        summary_title: body._source.summary.title,
        identifier: getPrimaryValue(body._source.identifier)
      };
    } else if (body._source.fonds) {
      fond = {
        id: body._source.fonds[0]['@admin'].uid,
        summary_title: body._source.fonds[0].summary.title
      };
    } else {
      return [{ id, summary_title: body._source.summary.title }];
    }

    data.push(fond);

    if (opts.skipFullFetch) {
      data.incomplete = true;
      return data;
    }

    let res;
    try {
      res = await getAllFromArchive(elastic, fond.id);
    } catch (err) {
      console.warn('Full archive fetch failed, returning minimal tree', {
        error: err.message,
        fondsId: fond.id
      });
      data.incomplete = true;
      return data;
    }
    return data.concat(res.map(el => ({
      id: el._source['@admin'].uid,
      parent: el._source.parent,
      identifier: getPrimaryValue(el._source.identifier),
      summary_title: el._source.summary.title
    })));
  } catch (err) {
    console.error('Failed to get full archive', {
      error: err.message,
      documentId: id
    });
    throw err;
  }
}

async function cacheDocument (id, data) {
  if (!cache || !cache.isReady()) return;

  try {
    await cache.set({ segment: CACHE_SEGMENT, id }, data, CACHE_TTL);
  } catch (err) {
    console.error('Failed to cache document', { error: err.message, documentId: id });
    throw err;
  }
}

// Drop a single archive hierarchy from the cache by its fondsId.
// Called by /clearcache/documents/{id} — the hierarchy will be re-fetched
// from Elasticsearch on the next archive page load.
async function dropCache (fondsId) {
  if (!cache || !cache.isReady()) return;
  try {
    await cache.drop({ segment: CACHE_SEGMENT, id: fondsId });
  } catch (err) {
    console.warn('Cache drop operation failed', { error: err.message, fondsId });
  }
}

module.exports.dropCache = dropCache;

// Test hook: forget in-flight rebuilds and failure back-offs.
module.exports._reset = function () {
  inFlight.clear();
  retryAfter.clear();
};
