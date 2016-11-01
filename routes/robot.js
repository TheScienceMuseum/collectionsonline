var config = require('../config.js');

module.exports = () => ({
  method: 'GET',
  path: '/robot.txt',
  config: {
    handler: function (req, reply) {
      reply('sitemap: ' + config.sitemapUrl);
    }
  }
});
