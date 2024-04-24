const Boom = require('@hapi/boom');
const TypeMapping = require('../lib/type-mapping');
const getCachedDocument = require('../lib/cached-document');
const buildJSONResponse = require('../lib/jsonapi-response');
const contentType = require('./route-helpers/content-type.js');
const response = require('./route-helpers/response');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/documents/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: async function (request, h) {
      const responseType = contentType(request);

      if (responseType !== 'notAcceptable') {
        try {
          const result = await elastic.get({ index: 'ciim', id: TypeMapping.toInternal(request.params.id) });
          let fondsId;

          if (result.body._source.fonds) {
            fondsId = result.body._source.fonds[0]['@admin'].uid;
          } else {
            fondsId = result.body._source['@admin'].uid;
          }

          const data = await getCachedDocument(elastic, TypeMapping.toInternal(request.params.id), fondsId);

          const JSONData = Object.assign(buildJSONResponse(result.body, config), { tree: data });

          return response(h, JSONData, 'archive', responseType);
        } catch (err) {
          return elasticError(err);
        }
      } else {
        return h.response('Not Acceptable').code(406);
      }
    }
  }
});

function elasticError (err) {
  if (err.statusCode === 404) {
    return Boom.notFound();
  } else {
    return Boom.serverUnavailable('unavailable', err);
  }
}
