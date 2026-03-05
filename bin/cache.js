'use strict';

const Catbox = require('@hapi/catbox');
const CatboxRedis = require('@hapi/catbox-redis');
const config = require('../config');

let host, port;

if (process.env.ELASTICACHE_EP) {
  // Highest priority: ELASTICACHE_EP environment variable (e.g. "127.0.0.1:6379")
  const parts = process.env.ELASTICACHE_EP.split(':');
  host = parts[0];
  port = parseInt(parts[1], 10);
} else if (config.elasticacheEndpoint) {
  // .corc single-key format: elasticacheEndpoint = "host:port"
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

// Expose the underlying ioredis instance for admin SCAN/DEL operations.
// Only available when Redis is actually configured — callers must guard with
// cache.isReady() before using this.
const redis = host ? cache.connection.client : null;

module.exports = cache;
module.exports.redis = redis;
