const Path = require('path');

module.exports = (config) => ({
  method: 'GET',
  path: '/sitemap.xml',

  config: {
    handler: (request, h) => {
      if (!config.sitemapUrl || config.sitemapUrl === config.rootUrl) {
        return h.file(Path.join(__dirname, '..', 'public', 'sitemap.xml'));
      }

      return h.proxy({ uri: `${config.sitemapUrl}/sitemap.xml`, passThrough: true });
    }
  }
});
