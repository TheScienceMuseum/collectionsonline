var config = require('../config.js');

module.exports = () => ({
  method: 'GET',
  path: '/robots.txt',
  config: {
    handler: function (req, reply) {
      reply(
        'sitemap: ' + config.sitemapUrl + '/sitemap.xml\n' +
        'User-agent: *\n' +
        'Crawl-Delay: 1\n' +
        'Disallow: /api/\n' +
        'Disallow: /iiif/\n' +
        'Disallow: /iris/\n' +
        'User-agent: AhrefsBot\n' +
        'Disallow: /'
      ).type('text/plain');
    }
  }
});
