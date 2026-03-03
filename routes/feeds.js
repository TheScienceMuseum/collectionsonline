// const Hapi = require('@hapi/hapi');
const Boom = require('@hapi/boom');
const cacheHeaders = require('./route-helpers/cache-control');
const { fetchAndCacheEndpoint } = require('../lib/cached-feed.js');
const endpoints = require('../fixtures/article-endpoints');
module.exports = (config) => ({
  method: 'GET',
  path: '/feeds/refresh',
  config: {
    cache: cacheHeaders(config, 3600 * 12),
    handler: async function (req, h) {
      try {
        const allData = [];

        for (const endpoint of endpoints) {
          const data = await fetchAndCacheEndpoint(endpoint);
          allData.push({
            label: endpoint.label,
            url: endpoint.url,
            data
          });
        }

        return h.response({
          message: 'Article feeds cached successfully',
          data: allData
        });
      } catch (err) {
        return new Boom.Boom('Failed to refresh and cache articles:', err);
      }
    }
  }
});
