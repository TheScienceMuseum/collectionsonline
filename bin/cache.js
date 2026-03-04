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

module.exports = host ? new Catbox.Client(CatboxRedis, { host, port }) : NULL_CACHE;
