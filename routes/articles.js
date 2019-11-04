const axios = require('axios');
const Boom = require('boom');

// Article endpoints on each museum website
var endpoints = [
  { label: 'National Science and Media Museum', url: 'https://www.scienceandmediamuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science and Industry Musem', url: 'https://www.scienceandindustrymuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Science Museum', url: 'https://www.sciencemuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Railway Museum', url: 'https://www.railwaymuseum.org.uk/collection-media/collection-usage/objects' },
  { label: 'Learning Resources', url: 'https://learning-resources.sciencemuseum.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Science Musuem Blog', url: 'https://blog.sciencemuseum.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Science and Media Museum Blog', url: 'https://blog.scienceandmediamuseum.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Science and Industry Museum Blog', url: 'https://blog.scienceandindustrymuseum.org.uk/wp-json/collection-media/collection-usage' },
  { label: 'Railway Musuem Blog', url: 'https://blog.railwaymuseum.org.uk/wp-json/collection-media/collection-usage' }
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

async function fetchArticles (endpoint, id) {
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
