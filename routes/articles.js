const Boom = require('@hapi/boom');
const cacheHeaders = require('./route-helpers/cache-control');
const getCachedFeed = require('../lib/cached-feed');
// Article endpoints on each museum website
const endpoints = [
  {
    label: 'National Science and Media Museum',
    url: 'https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Science and Industry Musem',
    url: 'https://www.scienceandindustrymuseum.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Science Museum',
    url: 'https://www.sciencemuseum.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Railway Museum',
    url: 'https://www.railwaymuseum.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Science Museum Blog',
    url: 'https://blog.sciencemuseum.org.uk/wp-json/collection-media/collection-usage'
  },
  {
    label: 'Learning Resources',
    url: 'https://learning.sciencemuseumgroup.org.uk/wp-json/collection-media/collection-usage'
  },
  {
    label: 'Railway Museum Blog',
    url: 'https://blog.railwaymuseum.org.uk/wp-json/collection-media/collection-usage'
  },
  {
    label: 'Science and Media Museum Blog',
    url: 'https://blog.scienceandmediamuseum.org.uk/wp-json/collection-media/collection-usage'
  },
  {
    label: 'Science and Industry Museum Blog',
    url: 'https://blog.scienceandindustrymuseum.org.uk/wp-json/collection-media/collection-usage'
  },
  {
    label: 'Science Museum Group',
    url: 'https://www.sciencemuseumgroup.org.uk/wp-json/collection-media/collection-usage'
  }
];

// Either get the items from the endpoints, or the cache
module.exports = (config) => ({
  method: 'GET',
  path: '/articles/{id}',
  config: {
    cache: cacheHeaders(config, 3600 * 12),
    handler: async function (req, h) {
      try {
        console.log('hiiiiiiiiiiiiiiiiiiiiii');
        const articles = await Promise.all(
          // endpoints.map((e) => fetchArticles(e, req.params.id))
          endpoints.map((e) => getCachedFeed(e, req.params.id))
        );
        console.log(articles, 'checking artilces');
        return h.response({ data: articles.filter((e) => e.data.length > 0) });
      } catch (err) {
        return new Boom.Boom('Cannot parse related objects feed:', err);
      }
    }
  }
});
