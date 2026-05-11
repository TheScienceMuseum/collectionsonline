const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const beautify = require('json-beautify');
const contentType = require('./route-helpers/content-type.js');
const cacheHeaders = require('./route-helpers/cache-control');
const getChildRecords = require('../lib/get-child-records.js');

// NOTE: This route negotiates response shape via the Accept header
// (HTML wrapper for browsers — which fires GTM pageview tracking — vs
// JSON for `Accept: application/vnd.api+json` clients). This relies on
// CloudFront's `/api/*` behaviour forwarding the Accept header to
// origin (origin request policy: Managed-AllViewer or equivalent).
// Without that, CloudFront strips Accept, every request looks like a
// browser hit, and the client SPA route's JSON fetch receives HTML —
// causing `JSON.parse('<...')` to throw `SyntaxError: Unrecognized
// token '<'` on the "Download catalogue entry as JSON" link.
// See PRs #2151 / #2153 / #2154 for history.
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

        const apiData = beautify(
          buildJSONResponse(
            result.body,
            config,
            null,
            null,
            childRecords
          ), null, 2, 80
        );

        if (responseType === 'json') {
          return h
            .response(apiData)
            .header('content-type', 'application/vnd.api+json');
        } else {
          return h.view('api', { api: apiData });
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
