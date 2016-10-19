const Path = require('path');

module.exports = (config) => ({
  method: 'GET',
  path: '/sitemap.xml',

  config: {
    handler: (request, reply) => {
      if (!config.sitemapUrl || config.sitemapUrl === config.rootUrl) {
        return reply.file(Path.join(__dirname, '..', 'public', 'sitemap.xml'));
      }

      return reply.proxy({ uri: `${config.sitemapUrl}/sitemap.xml`, passThrough: true });
    }
  }
});
