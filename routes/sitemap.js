const Path = require('path');

module.exports = (config) => ({
  method: 'GET',
  path: '/sitemap.xml',
  handler: (request, reply) => {
    if (!config.sitemapUrl || config.sitemapUrl === config.rootUrl) {
      return reply.file(Path.join(__dirname, '..', 'public', 'sitemap.xml'));
    }

    reply.proxy({ uri: `${config.sitemapUrl}/sitemap.xml`, passThrough: true });
  },
  config: {
    plugins: {
      'hapi-negotiator': false
    }
  }
});
