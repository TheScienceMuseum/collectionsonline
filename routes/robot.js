const config = require('../config.js');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = () => ({
  method: 'GET',
  path: '/robots.txt',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: function (req, h) {
      return h.response(
        'sitemap: ' + config.sitemapUrl + '/sitemap.xml\n' +
        'User-agent: *\n' +
        'Crawl-Delay: 1\n' +
        'Disallow: /api/\n' +
        'Disallow: /iiif/\n' +
        'Disallow: /iris/\n' +
        'Disallow: /categories/\n' +
        'User-agent: AhrefsBot\n' +
        'Disallow: /'
      ).type('text/plain');
    }
  }
});
