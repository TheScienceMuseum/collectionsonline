const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');
const contentType = require('./route-helpers/content-type.js');
const response = require('./route-helpers/response');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/people/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: async function (request, h) {
      const responseType = contentType(request);

      if (responseType !== 'notAcceptable') {
        try {
          const result = await elastic.get({ index: 'ciim', id: TypeMapping.toInternal(request.params.id) });

          let relatedItems;
          let sortedRelatedItems;

          try {
            relatedItems = await getRelatedItems(elastic, request.params.id);
            sortedRelatedItems = sortRelated(relatedItems, request.params.id);
          } catch (err) {
            sortedRelatedItems = null;
          }

          const JSONData = buildJSONResponse(result.body, config, sortedRelatedItems);

          return response(h, JSONData, 'person', responseType);
        } catch (err) {
          if (err.statusCode === 404) {
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
