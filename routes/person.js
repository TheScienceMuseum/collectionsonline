const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');
const contentType = require('./route-helpers/content-type.js');
const response = require('./route-helpers/response');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/people/{id}/{slug?}',
  config: {
    handler: function (request, reply) {
      var responseType = contentType(request);
      if (responseType !== 'notAcceptable') {
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

            return response(reply, JSONData, 'person', responseType);
          });
        });
      } else {
        return reply('Not Acceptable').code(406);
      }
    }
  }
});
