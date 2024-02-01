const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const beautify = require('json-beautify');
const contentType = require('./route-helpers/content-type.js');
const cacheHeaders = require('./route-helpers/cache-control');
const getChildRecords = require('../lib/get-child-records.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/api/{type}/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600),
    handler: async function (request, h) {
      try {
        const result = await elastic.get({
          index: 'ciim',
          id: TypeMapping.toInternal(request.params.id)
        });

        const responseType = contentType(request);

        const childRecords = await getChildRecords(
          elastic,
          TypeMapping.toInternal(request.params.id)
        );
        // TODO: come back and fix this
        const apiData = beautify(
          buildJSONResponse(result.body, config, null, childRecords),
          null,
          2,
          80
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
