const Boom = require('@hapi/boom');
const cacheHeaders = require('./route-helpers/cache-control');
const getCachedArticles = require('../lib/cached-article');
const { fetchAndCacheEndpoint } = require('../lib/cached-feed.js');
const endpoints = require('../fixtures/article-endpoints');

// Either get the items from the endpoints, or the cache
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
    // attempt to get articles from cache initially
    const cachedArticle = await getCachedArticles(endpoint);

    if (cachedArticle) {
      const filteredArticles = cachedArticle.filter(
        (e) => e.collection_objects.indexOf(id) > -1
      );
      return {
        museum: endpoint.label,
        data: filteredArticles
      };
    }

    // otherwise fetch and cache endpoints here
    const data = await fetchAndCacheEndpoint(endpoint);
    const filteredData = data.filter(
      (e) => e.collection_objects.indexOf(id) > -1
    );

    return {
      museum: endpoint.label,
      data: filteredData
    };
  } catch (err) {
    // ToDo: Explicitly catch errors related to cache.start (and no Redis Server) with Boom to reducxe noise in logs
    // console.log(err);
    // handles dead endpoints, to avoid Promises.all failing
    return {
      museum: endpoint.label,
      data: []
    };
  }
}
