const stats = require('../lib/stats');
const Boom = require('@hapi/boom');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/stats',
  config: {
    handler: async function (request, h) {
      try {
        const results = await stats(elastic);
        const date = new Date().toLocaleDateString();
        return h.response({
          objects: results.responses[0].hits.total,
          objectsWithImages: results.responses[1].hits.total,
          documents: results.responses[2].hits.total,
          documentWithImages: results.responses[3].hits.total,
          agents: results.responses[4].hits.total,
          date
        });
      } catch (err) { return Boom.serverUnavailable(err); }
    }
  }
});
