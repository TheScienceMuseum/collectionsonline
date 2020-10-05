const axios = require('axios');
const Boom = require('boom');
const cacheHeaders = require('./route-helpers/cache-control');

// Article endpoints on each museum website
var endpoints = [
  { label: 'National Science and Media Museum', url: 'https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science and Industry Musem', url: 'https://www.scienceandindustrymuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science Museum', url: 'https://www.sciencemuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Railway Museum', url: 'https://www.railwaymuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science Museum Blog', url: 'https://blog.sciencemuseum.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Learning Resources', url: 'https://learning.sciencemuseumgroup.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Railway Museum Blog', url: 'https://blog.railwaymuseum.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Science and Media Museum Blog', url: 'https://blog.scienceandmediamuseum.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Science and Industry Museum Blog', url: 'https://blog.scienceandindustrymuseum.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Science Museum Group', url: 'https://www.sciencemuseumgroup.org.uk/wp-json/collection-media/collection-usage' }];

module.exports = (config) => ({
  method: 'GET',
  path: '/articles/{id}',
  config: {
    cache: cacheHeaders(config, 3600 * 12),
    handler: async function (req, h) {
      try {
        const articles = await Promise.all(endpoints.map(e => fetchArticles(e, req.params.id)));
        return h.response({ data: articles.filter(e => e.data.length > 0) });
      } catch (err) {
        return new Boom('Cannot parse related objects feed:', err);
      }
    }
  }
});

async function fetchArticles (endpoint, id) {
  try {
    const aclient = axios.create({
      timeout: 10000,
      headers: { 'User-Agent': 'SMG Collection Site 1.0' }
    });
    const response = await aclient.get(endpoint.url);
    const data = response.data ? response.data.filter(e => e.collection_objects.indexOf(id) > -1) : [];

    return {
      museum: endpoint.label,
      data: data
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
}
