const Catbox = require('catbox');
const CatboxRedis = require('catbox-redis');
var elasticacheHost = '127.0.0.1';
var elasticachePort = '6379';

if (process.env.ELASTICACHE_EP) {
  var config = process.env.ELASTICACHE_EP.split(':');
  elasticacheHost = config[0];
  elasticachePort = config[1];
}

module.exports = new Catbox.Client(CatboxRedis, {host: elasticacheHost, port: elasticachePort});
