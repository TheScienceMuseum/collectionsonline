module.exports = (config) => ({
  method: 'GET',
  path: '/sitemap.xml',
  handler: (request, reply) => {
    reply.proxy({ uri: `${config.sitemapUrl}/sitemap.xml`, passThrough: true });
  },
  config: {
    plugins: {
      'hapi-negotiator': false
    }
  }
});
