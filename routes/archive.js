const archiveSchema = require('../schemas/archive.js');
const getArchiveAndChildren = require('../lib/get-archive-and-children');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/documents/{id}/{slug?}',
  handler: (request, reply) => reply(),
  config: {
    validate: {
      query: archiveSchema
    },
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            return getArchiveAndChildren(elastic, config, request, function (err, data) {
              if (err) return reply(err);

              return reply.view('archive', data.HTMLData);
            });
          },
          'application/vnd.api+json' (request, reply) {
            return getArchiveAndChildren(elastic, config, request, function (err, data) {
              if (err) return reply(err);

              return reply(data.JSONData).header('content-type', 'application/vnd.api+json');
            });
          }
        }
      }
    }
  }
});
