'use strict';

const Catbox = require('@hapi/catbox');
const CatboxRedis = require('@hapi/catbox-redis');
const config = require('../config');

let host, port;

if (config.elasticacheEndpoint) {
  // Reads from ELASTICACHE_ENDPOINT env var (via config.js default) or
  // elasticacheEndpoint / co_elasticacheEndpoint from .corc / environment.
  const parts = config.elasticacheEndpoint.split(':');
  host = parts[0];
  port = parseInt(parts[1], 10);
} else if (config.elasticacheHost) {
  // Legacy separate-key format: elasticacheHost + elasticachePort
  host = config.elasticacheHost;
  port = config.elasticachePort ? parseInt(config.elasticachePort, 10) : 6379;
}

// When no Redis is configured, export a null-safe stub so callers and sinon
// stubs in tests always get a real object. isReady() returns false so all
// cache operations are skipped gracefully.
const NULL_CACHE = {
  start: async () => {},
  stop: async () => {},
  isReady: () => false,
  get: async () => null,
  set: async () => null,
  drop: async () => null
};

// The Catbox client is the primary interface for all normal cache operations
// (get/set/drop). The raw ioredis client (cache.connection.client) is exposed
// separately so that admin operations (SCAN + bulk DEL) can bypass the
// single-key Catbox API, which has no bulk-drop support.
//
// Catbox key format (default partition 'catbox' is used — no override set):
//   catbox:{segment}:{encodeURIComponent(id)}
// e.g. catbox:wikidata:Q937  |  catbox:documents:aa123456  |  catbox:feed:https%3A%2F%2F...
const cache = host ? new Catbox.Client(CatboxRedis, { host, port }) : NULL_CACHE;

module.exports = cache;

// Expose the underlying ioredis instance for admin SCAN/DEL operations.
// Defined as a getter rather than a static value because cache.connection.client
// is only set DURING cache.start() (called at server boot in bin/server.mjs).
// Capturing it at module-load time would always give undefined. The getter
// is evaluated lazily — at handler invocation time — when start() has already run.
// Callers must still guard with cache.isReady() before using this.
Object.defineProperty(module.exports, 'redis', {
  get () { return host ? cache.connection.client : null; },
  enumerable: true
});
