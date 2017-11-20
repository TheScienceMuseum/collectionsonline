var config = require('../config.js');

module.exports = () => ({
  method: 'GET',
  path: '/robots.txt',
  config: {
    handler: function (req, reply) {
      reply(
        'sitemap: ' + config.sitemapUrl + '/sitemap.xml\n' +
        'User-agent: *\n' +
        'Crawl-Delay: 1' +
        'Disallow: /api/' +
        'User-agent: AhrefsBot' +
        'Disallow: /'
      ).type('text/plain');
    }
  }
});
