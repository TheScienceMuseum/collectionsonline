const axios = require('axios');
const Boom = require('boom');

// Article endpoints on each museum website
var endpoints = [
  { label: 'National Science and Media Museum', url: 'https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science and Industry Musem', url: 'https://www.scienceandindustrymuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science Museum', url: 'https://www.sciencemuseum.org.uk/collection-media/collection-usage/objects' }
];

module.exports = () => ({
  method: 'GET',
  path: '/articles/{id}',
  config: {
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

async function fetchArticles(endpoint, id) {
  try {
    const response = await axios.get(endpoint.url);

    const data = response.data.filter(e => e.collection_objects.indexOf(id) > -1);

    return {
      museum: endpoint.label,
      data: data
    };
  } catch (err) {
    throw err;
  }
}
