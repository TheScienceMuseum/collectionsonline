const cache = require('../bin/cache.js');
const fetch = require('fetch-ponyfill')().fetch;
const config = require('../config');

const DEFAULT_FEED_TTL = 86400000; // 24 hours in milliseconds
// Allow override via config/env (articleCacheTtl in .corc or co_articleCacheTtl env var)
const FEED_TTL = config.articleCacheTtl || DEFAULT_FEED_TTL;

// Deduplicates concurrent fetches for the same URL.
// If a fetch is already in flight, callers await the same promise
// rather than each firing their own outbound HTTP request.
const inFlight = new Map();

// Tracks endpoints that recently failed. After a failure, the endpoint
// is skipped for FAILURE_COOLDOWN_MS to prevent hammering unavailable URLs.
const failureCooldown = new Map();
const FAILURE_COOLDOWN_MS = 60000; // 60 seconds

// Function to fetch and cache data from an endpoint
exports.fetchAndCacheEndpoint = async function (endpoint) {
  // Skip endpoints that failed recently
  const lastFailure = failureCooldown.get(endpoint.url);
  if (lastFailure && (Date.now() - lastFailure) < FAILURE_COOLDOWN_MS) {
    return null;
  }

  const existing = inFlight.get(endpoint.url);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const response = await fetch(endpoint.url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SMGCollectionBot/1.0; +https://collection.sciencemuseumgroup.org.uk)' }
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('json')) {
        const text = await response.text();
        const isCloudflare = /cf-ray|cloudflare|just a moment|\bcf_chl\b/i.test(text);
        if (isCloudflare) {
          console.error(`Failed to fetch ${endpoint.label}: blocked by Cloudflare Bot Protection (HTTP ${response.status}) at: ${endpoint.url}`);
        } else {
          console.error(`Failed to fetch ${endpoint.label}: unexpected response HTTP ${response.status} (${contentType || 'no content-type'}) at: ${endpoint.url}`);
        }
        failureCooldown.set(endpoint.url, Date.now());
        return null;
      }
      const data = await response.json();
      failureCooldown.delete(endpoint.url);
      await cacheEndpoints(cache, endpoint, data);
      return data;
    } catch (err) {
      console.error(`Failed to fetch ${endpoint.label}:`, err.message);
      failureCooldown.set(endpoint.url, Date.now());
      return null;
    } finally {
      inFlight.delete(endpoint.url);
    }
  })();

  inFlight.set(endpoint.url, promise);
  return promise;
};

// Drop a single feed entry from the cache by its URL.
// Called by /clearcache/articles/{label} — the feed will be re-fetched and
// re-warmed immediately after dropping so it remains available.
exports.dropFeed = async function (url) {
  if (!cache || !cache.isReady()) return;
  try {
    await cache.drop({ segment: 'feed', id: url });
  } catch (err) {
    console.warn('Feed cache drop failed', { error: err.message, url });
  }
};

// Function to cache data in the cache
async function cacheEndpoints (cache, endpoint, data) {
  try {
    if (!cache || !cache.isReady()) {
      return;
    }
    const url = endpoint.url;
    const cached = await cache.get({ segment: 'feed', id: url });

    if (cached) {
      await cache.drop({ segment: 'feed', id: url });
    }
    await cache.set({ segment: 'feed', id: url }, data, FEED_TTL);
    console.log(`Successfully cached ${endpoint.label}`);
  } catch (err) {
    console.error(`Couldn't cache ${endpoint.label}:`, err.message);
  }
}
