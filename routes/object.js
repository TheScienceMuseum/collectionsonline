const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const contentType = require('./route-helpers/content-type.js');
const getSimilarObjects = require('../lib/get-similar-objects');
const sortRelated = require('../lib/sort-related-items');
const response = require('./route-helpers/response');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/objects/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: async function (request, h) {
      var responseType = contentType(request);

      if (responseType !== 'notAcceptable') {
        try {
          const result = await elastic.get({ index: 'ciim', type: 'object', id: TypeMapping.toInternal(request.params.id) });

          const relatedItems = await getSimilarObjects(result, elastic);

          const sortedRelatedItems = sortRelated(relatedItems);
          const JSONData = buildJSONResponse(result, config, sortedRelatedItems);

          return response(h, JSONData, 'object', responseType);
        } catch (err) {
          console.log(err);
          if (err.status === 404) {
            return Boom.notFound(err);
          }
          return Boom.serverUnavailable('unavailable');
        }
      } else {
        return h.response('Not Acceptable').code(406);
      }
    }
  }
});
