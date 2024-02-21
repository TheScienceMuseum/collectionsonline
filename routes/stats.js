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
          // Mimsy records
          objects: results.body.responses[0].hits.total.value,
          objectsWithImages: results.body.responses[1].hits.total.value,

          // Records flagged as an SPH layout (parent image)
          recordsSPH: results.body.responses[2].hits.total.value,
          recordsSPHWithImages: results.body.responses[3].hits.total.value,

          // Records flagged as an SPH layout with children (parent image)
          recordsSPHWithChildren: results.body.responses[4].hits.total.value,
          recordsSPHWithChildrenWithImages: results.body.responses[5].hits.total.value,

          // Records flagged as an MPH layout (parent image)
          recordsMPH: results.body.responses[6].hits.total.value,
          recordsMPHWithImages: results.body.responses[7].hits.total.value,

          // Records flagged as an MPH layout with children (parent image)
          recordsMPHWithChildren: results.body.responses[8].hits.total.value,
          recordsMPHWithChildrenWithImages: results.body.responses[9].hits.total.value,

          // Records flagged as children of an SPH record
          childOfSPH: results.body.responses[10].hits.total.value,
          childOfSPHWithImages: results.body.responses[11].hits.total.value,

          // Records flagged as children of an MPH record (can be MPH or SPH themselves)
          childOfMPH: results.body.responses[12].hits.total.value,
          childOfMPHWithImages: results.body.responses[13].hits.total.value,

          // AdLib records
          documents: results.body.responses[14].hits.total.value,
          documentWithImages: results.body.responses[15].hits.total.value,

          agents: results.body.responses[16].hits.total.value,
          date
        });
      } catch (err) { return Boom.serverUnavailable(err); }
    }
  }
});
