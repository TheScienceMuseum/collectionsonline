const Boom = require('@hapi/boom');
const cacheHeaders = require('./route-helpers/cache-control');

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
    url: 'https://www.sciencemuseumgroup.org.uk/collection-media/collection-usage/objects'
  }
];

module.exports = (config) => ({
  method: 'GET',
  path: '/articles/{id}',
  config: {
    cache: cacheHeaders(config, 3600 * 12),
    handler: async function (req, h) {
      try {
        const articlesPromises = endpoints.map((e) =>
          fetchArticles(e, req.params.id)
        );

        const articles = await Promise.all(articlesPromises);

        return h.response({ data: articles.filter((e) => e.data.length > 0) });
      } catch (err) {
        return new Boom.Boom('Cannot parse related objects feed:', err);
      }
    }
  }
});

/**
 * Fetches articles from a given endpoint, filtering them based on a specific ID.
 * @async
 * @function
 * @param {Object} endpoint - The endpoint object containing the URL and label.
 * @param {string} endpoint.url - The URL of the endpoint.
 * @param {string} endpoint.label - The label of the endpoint.
 * @param {string} id - The ID to filter the articles by.
 * @returns {Promise<Object>} A promise that resolves to an object containing the museum label and the filtered data.
 */

async function fetchArticles (endpoint, id) {
  try {
    const response = await fetch(endpoint.url, {
      timeout: 10000,
      headers: { 'User-Agent': 'SMG Collection Site 1.0' }
    });
    const data = await response.json();

    return {
      museum: endpoint.label,
      data: data.filter((e) => e.collection_objects.indexOf(id) > -1)
    };
  } catch (err) {
    console.log(err);
    return {
      museum: endpoint.label,
      data: []
    };
  }
}
