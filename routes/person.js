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
    handler: async function (request, h) {
      var responseType = contentType(request);

      if (responseType !== 'notAcceptable') {
        try {
          const result = await elastic.get({ index: 'smg', type: 'agent', id: TypeMapping.toInternal(request.params.id) });

          const relatedItems = await getRelatedItems(elastic, request.params.id);

          const sortedRelatedItems = sortRelated(relatedItems);
          const JSONData = buildJSONResponse(result, config, sortedRelatedItems);

          return response(h, JSONData, 'person', responseType);
        } catch (err) {
          if (err.status === 404) {
            return Boom.notFound();
          }
          return Boom.serverUnavailable('unavailable');
        }
      } else {
        return h.response('Not Acceptable').code(406);
      }
    }
  }
});
