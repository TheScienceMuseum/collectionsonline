const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const JSONToHTML = require('../lib/transforms/json-to-html-data');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/people/{id}/{slug?}',
  handler: (request, reply) => HTMLResponse(request, reply, elastic, config),
  config: {
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            return HTMLResponse(request, reply, elastic, config);
          },
          'application/vnd.api+json' (request, reply) {
            elastic.get({index: 'smg', type: 'agent', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
              if (err) {
                if (err.status === 404) {
                  return reply(Boom.notFound());
                }
                return reply(Boom.serverUnavailable('unavailable'));
              }

              getRelatedItems(elastic, request.params.id, (err, relatedItems) => {
                if (err) {
                  relatedItems = null;
                } else {
                  relatedItems = sortRelated(relatedItems);
                }

                reply(buildJSONResponse(result, config, relatedItems)).header('content-type', 'application/vnd.api+json');
              });
            });
          }
        }
      }
    }
  }
});

function HTMLResponse (request, reply, elastic, config) {
  const data = {
    page: 'person'
  };

  elastic.get({index: 'smg', type: 'agent', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
    if (err) {
      if (err.status === 404) {
        return reply(Boom.notFound());
      }
      return reply(Boom.serverUnavailable('unavailable'));
    }

    getRelatedItems(elastic, request.params.id, (err, relatedItems) => {
      if (err) {
        relatedItems = null;
      } else {
        relatedItems = sortRelated(relatedItems);
      }

      const JSONData = buildJSONResponse(result, config, relatedItems);
      const HTMLData = JSONToHTML(JSONData);

      reply.view('person', Object.assign(HTMLData, data));
    });
  });
}
