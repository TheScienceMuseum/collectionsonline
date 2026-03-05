'use strict';

const crypto = require('crypto');
const config = require('../config');
const endpoints = require('../fixtures/article-endpoints');

// ---------------------------------------------------------------------------
// Article endpoint host helpers
// ---------------------------------------------------------------------------

// Extract the hostname from a URL string.
// e.g. 'https://www.sciencemuseum.org.uk/...' → 'www.sciencemuseum.org.uk'
function hostFromUrl (url) {
  try {
    return new URL(url).host;
  } catch (_) {
    return null;
  }
}

// Returns all article feed endpoints (used by /clearcache/articles/all to
// re-warm every endpoint after a full cache drop).
exports.allEndpoints = function () {
  return endpoints;
};

// Returns all endpoints whose URL hostname matches the given host string.
// Returns an empty array if the host is not recognised.
// e.g. 'www.sciencemuseum.org.uk' → [{ label: 'Science Museum', url: '...' }]
exports.endpointsForHost = function (host) {
  return endpoints.filter(ep => hostFromUrl(ep.url) === host);
};

// Returns a sorted list of all known article feed hostnames.
// Used to populate the 'available' list in 404 responses.
exports.allHosts = function () {
  return [...new Set(endpoints.map(ep => hostFromUrl(ep.url)).filter(Boolean))].sort();
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

// Delete all feed keys whose Catbox Redis key contains the given hostname.
// The hostname appears literally in the URL-encoded key because encodeURIComponent
// only encodes :// and path separators, not the hostname characters or dots.
// e.g. 'www.sciencemuseum.org.uk' → SCAN 'catbox:feed:*www.sciencemuseum.org.uk*'
// Returns the number of keys deleted.
exports.deleteFeedsByHost = async function (redis, host) {
  const keys = await scanKeys(redis, `catbox:feed:*${host}*`);
  if (keys.length === 0) return 0;
  for (let i = 0; i < keys.length; i += 100) {
    await redis.del(...keys.slice(i, i + 100));
  }
  return keys.length;
};
