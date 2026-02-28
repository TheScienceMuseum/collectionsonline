// const Hapi = require('@hapi/hapi');
const Boom = require('@hapi/boom');
const cacheHeaders = require('./route-helpers/cache-control');
const { fetchAndCacheEndpoint } = require('../lib/cached-feed.js');

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
  // {
  //   label: 'Learning Resources',
  //   url: 'https://learning.sciencemuseumgroup.org.uk/wp-json/collection-media/collection-usage'
  // },
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
    url: 'https://www.sciencemuseumgroup.org.uk/collection-media/collection-usage/objects'
  },
  {
    label: 'Science Museum Group Blog',
    url: 'https://blog.sciencemuseumgroup.org.uk/wp-json/collection-media/collection-usage'
  }
];
module.exports = (config) => ({
  method: 'GET',
  path: '/feeds/refresh',
  config: {
    cache: cacheHeaders(config, 3600 * 12),
    handler: async function (req, h) {
      try {
        const allData = [];

        for (const endpoint of endpoints) {
          const data = await fetchAndCacheEndpoint(endpoint);
          allData.push({
            label: endpoint.label,
            url: endpoint.url,
            data
          });
        }

        return h.response({
          message: 'Article feeds cached successfully',
          data: allData
        });
      } catch (err) {
        return new Boom.Boom('Failed to refresh and cache articles:', err);
      }
    }
  }
});
