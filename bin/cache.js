const Catbox = require('@hapi/catbox');
const CatboxRedis = require('@hapi/catbox-redis');
const Redis = require('ioredis'); // or 'redis' if using node_redis

// Create Redis client with all your custom options
const redisClient = new Redis({
  host: process.env.ELASTICACHE_EP ? process.env.ELASTICACHE_EP.split(':')[0] : '127.0.0.1',
  port: process.env.ELASTICACHE_EP ? process.env.ELASTICACHE_EP.split(':')[1] : '6379',
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 100, 5000),
  reconnectOnError: (err) => {
    console.log('Reconnect on error:', err.message);
    return true;
  },
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000
});

// Pass the client to Catbox
module.exports = new Catbox.Client(CatboxRedis, { client: redisClient });
