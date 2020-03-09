const Path = require('path');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (config) => ({
  method: 'GET',
  path: '/sitemap.xml',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: (request, h) => {
      if (!config.sitemapUrl || config.sitemapUrl === config.rootUrl) {
        return h.file(Path.join(__dirname, '..', 'public', 'sitemap.xml'));
      }

      return h.proxy({ uri: `${config.sitemapUrl}/sitemap.xml`, passThrough: true });
    }
  }
});
