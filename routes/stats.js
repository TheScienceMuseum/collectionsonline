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
          objects: results.body.responses[0].hits.total.value,
          objectsWithImages: results.body.responses[1].hits.total.value,

          objectsSPH: results.body.responses[2].hits.total.value,
          objectsSPHWithImages: results.body.responses[3].hits.total.value,

          objectsMPH: results.body.responses[4].hits.total.value,
          objectsMPHWithImages: results.body.responses[5].hits.total.value,

          objectsChild: results.body.responses[6].hits.total.value,
          objectsChildWithImages: results.body.responses[7].hits.total.value,

          documents: results.body.responses[8].hits.total.value,
          documentWithImages: results.body.responses[9].hits.total.value,

          agents: results.body.responses[10].hits.total.value,
          date
        });
      } catch (err) { return Boom.serverUnavailable(err); }
    }
  }
});
