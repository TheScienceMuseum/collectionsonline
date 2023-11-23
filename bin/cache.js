const Catbox = require('@hapi/catbox');
const CatboxRedis = require('@hapi/catbox-redis');
let elasticacheHost = '127.0.0.1';
let elasticachePort = '6379';

if (process.env.ELASTICACHE_EP) {
  const config = process.env.ELASTICACHE_EP.split(':');
  elasticacheHost = config[0];
  elasticachePort = config[1];
}

module.exports = new Catbox.Client(CatboxRedis, { host: elasticacheHost, port: elasticachePort });
