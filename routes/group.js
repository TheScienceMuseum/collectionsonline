const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const TypeMapping = require('../lib/type-mapping.js');
const contentType = require('./route-helpers/content-type.js');
const response = require('./route-helpers/response.js');
const cacheHeaders = require('./route-helpers/cache-control.js');
const getChildRecords = require('../lib/get-child-records.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/group/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: async (request, h) => {
      const responseType = contentType(request);
      if (responseType !== 'notAcceptable') {
        try {
          const result = await elastic.get({
            index: 'ciim',
            id: TypeMapping.toInternal(request.params.id)
          });

          //   const inProduction = config && config.NODE_ENV === 'production';
          const { grouping } = result.body._source['@datatype'];
          const childRecords = await getChildRecords(
            elastic,
            TypeMapping.toInternal(request.params.id),

            undefined,
            grouping
          );

          const JSONData = buildJSONResponse(
            result.body,
            config,
            null,
            childRecords
          );

          return response(h, JSONData, 'group', responseType);
        } catch (err) {
          console.log('Err in groups.js:' + err);
          if (err.statusCode === 404) {
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
