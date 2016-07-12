const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const JSONToHTML = require('../lib/transforms/json-to-html-data.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/documents/{id}/{slug?}',
  handler: (request, reply) => reply(),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            const data = {
              page: 'archive'
            };

            elastic.get({index: 'smg', type: 'archive', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
              if (err) {
                if (err.status === 404) {
                  return reply(Boom.notFound());
                }
                return reply(Boom.serverUnavailable('unavailable'));
              }

              const JSONData = buildJSONResponse(result, config);
              const HTMLData = JSONToHTML(JSONData);

              reply.view('archive', Object.assign(HTMLData, data));
            });
          },
          'application/vnd.api+json' (req, reply) {
            elastic.get({index: 'smg', type: 'archive', id: TypeMapping.toInternal(req.params.id)}, (err, result) => {
              if (err) {
                return reply(err);
              }

              if (!result) {
                return reply(Boom.notFound('Document not found'));
              }

              reply(buildJSONResponse(result, config)).header('content-type', 'application/vnd.api+json');
            });
          }
        }
      }
    }
  }
});
