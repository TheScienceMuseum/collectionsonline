var config = require('../config.js');

module.exports = () => ({
  method: 'GET',
  path: '/robots.txt',
  config: {
    handler: function (req, reply) {
      reply(
        'sitemap: ' + config.sitemapUrl + '/sitemap.xml\n' +
        'User-agent: *\n' +
        'Disallow: /api/'
      ).type('text/plain');
    }
  }
});
