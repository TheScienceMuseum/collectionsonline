'use strict';

const crypto = require('crypto');
const config = require('../config');
const endpoints = require('../fixtures/article-endpoints');

// ---------------------------------------------------------------------------
// Article endpoint slug helpers
// ---------------------------------------------------------------------------

// Slugify an endpoint label for use as a URL path segment.
// e.g. "Science Museum Blog" → "science-museum-blog"
function slugify (label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Map of slug → endpoint object, built once at module load.
// e.g. { 'science-museum': { label: 'Science Museum', url: 'https://...' }, ... }
const endpointsBySlug = endpoints.reduce((map, ep) => {
  map[slugify(ep.label)] = ep;
  return map;
}, {});

// Returns the endpoint object for a given slug, or null if not found.
exports.endpointForSlug = function (slug) {
  return endpointsBySlug[slug] || null;
};

// Returns the full slug→endpoint map (used by /listcache/articles to show
// the available slugs alongside the cached URLs).
exports.allSlugs = function () {
  return endpointsBySlug;
};

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

// Constant-time comparison so token length doesn't leak via timing.
// Returns true if the supplied token matches the configured cacheClearToken.
exports.isValidToken = function (token) {
  const expected = config.cacheClearToken;
  if (!expected || !token) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(String(token)),
      Buffer.from(String(expected))
    );
  } catch (_) {
    // Buffers of different lengths throw — tokens don't match.
    return false;
  }
};

// ---------------------------------------------------------------------------
// Redis SCAN helpers
// ---------------------------------------------------------------------------

// Catbox key format (default partition 'catbox'):
//   catbox:{segment}:{encodeURIComponent(id)}
//
// SCAN patterns per segment:
const SCAN_PATTERNS = {
  wikidata: 'catbox:wikidata:*',
  documents: 'catbox:documents:*',
  feed: 'catbox:feed:*'
};

// Strip the "catbox:{segment}:" prefix and URI-decode the remainder to get
// back the original ID (Q-code, fondsId, or feed URL).
function extractId (redisKey, segment) {
  const prefix = `catbox:${segment}:`;
  return decodeURIComponent(redisKey.slice(prefix.length));
}

// Iterate Redis SCAN cursor until exhausted, collecting all matching keys.
// Returns an array of raw Redis key strings.
async function scanKeys (redis, pattern) {
  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}

// Return the decoded IDs currently in Redis for the given segment.
// e.g. listSegment(redis, 'wikidata') → ['Q937', 'Q42', ...]
exports.listSegment = async function (redis, segment) {
  const pattern = SCAN_PATTERNS[segment];
  if (!pattern) throw new Error(`Unknown segment: ${segment}`);
  const keys = await scanKeys(redis, pattern);
  return keys.map(k => extractId(k, segment));
};

// Delete all keys in a segment. Returns the number of keys deleted.
exports.deleteSegment = async function (redis, segment) {
  const pattern = SCAN_PATTERNS[segment];
  if (!pattern) throw new Error(`Unknown segment: ${segment}`);
  const keys = await scanKeys(redis, pattern);
  if (keys.length === 0) return 0;
  // DEL accepts multiple keys — batch in groups of 100 to avoid huge commands.
  for (let i = 0; i < keys.length; i += 100) {
    await redis.del(...keys.slice(i, i + 100));
  }
  return keys.length;
};
