const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
var beautify = require('json-beautify');
var contentType = require('./route-helpers/content-type.js');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/api/{type}/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600),
    handler: async function (request, h) {
      try {
        const result = await elastic.get({ index: 'ciim', type: TypeMapping.toInternal(request.params.type), id: TypeMapping.toInternal(request.params.id) });

        var responseType = contentType(request);
        var apiData = beautify(buildJSONResponse(result, config), null, 2, 80);

        if (responseType === 'json') {
          return h.response(apiData).header('content-type', 'application/vnd.api+json');
        } else {
          return h.view('api', { api: apiData });
        }
      } catch (err) {
        if (err.status === 404) {
          return Boom.notFound();
        }
        return Boom.serverUnavailable('unavailable');
      }
    }
  }
});
