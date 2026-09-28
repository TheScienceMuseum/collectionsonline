const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const beautify = require('json-beautify');
const contentType = require('./route-helpers/content-type.js');
const cacheHeaders = require('./route-helpers/cache-control');
const addCacheValidators = require('./route-helpers/cache-validators.js');
const getChildRecords = require('../lib/get-child-records.js');

// Negotiates response shape via the Accept header (HTML wrapper for browsers
// — which fires GTM pageview tracking — vs JSON for `Accept:
// application/vnd.api+json` clients). The `/api/*` CloudFront behaviour uses
// the `OriginControlled-QueryStrings-Accept-CO` cache policy and
// `Managed-AllViewer` origin request policy, so Accept is both forwarded to
// origin AND included in the cache key.
module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/api/{type}/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600),
    handler: async function (request, h) {
      try {
        const result = await elastic.get({
          index: config.elasticIndex,
          id: TypeMapping.toInternal(request.params.id)
        });

        const responseType = contentType(request);
        const { grouping } = result.body._source['@datatype'];

        let childRecords = [];
        try {
          childRecords = await getChildRecords(
            elastic,
            TypeMapping.toInternal(request.params.id),
            undefined,
            grouping
          );
        } catch (err) {
          console.warn(`[api/${request.params.id}] child records failed: ${err}`);
        }

        const jsonData = buildJSONResponse(
          result.body,
          config,
          null,
          null,
          childRecords
        );
        const apiData = beautify(jsonData, null, 2, 80);
        const lastModified = jsonData.meta && jsonData.meta.lastModified;

        if (responseType === 'json') {
          const response = h
            .response(apiData)
            .header('content-type', 'application/vnd.api+json');
          return addCacheValidators(response, { variant: 'api-json', payload: apiData, lastModified });
        } else {
          const view = h.view('api', { api: apiData });
          return addCacheValidators(view, { variant: 'api-html', payload: apiData, lastModified });
        }
      } catch (err) {
        if (err.statusCode === 404) {
          return Boom.notFound();
        }
        console.log('The error:', err);
        return Boom.serverUnavailable('unavailable');
      }
    }
  }
});
