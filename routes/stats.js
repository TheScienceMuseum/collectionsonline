const stats = require('../lib/stats');
const Boom = require('boom');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/stats',
  config: {
    handler: function (request, reply) {
      stats(elastic, (err, results) => {
        if (err) return reply(Boom.serverUnavailable(err));
        return reply({
          objects: results.responses[0].hits.total,
          objectsWithImages: results.responses[1].hits.total,
          documents: results.responses[2].hits.total,
          documentWithImages: results.responses[3].hits.total,
          agents: results.responses[4].hits.total
        });
      });
    }
  }
});
