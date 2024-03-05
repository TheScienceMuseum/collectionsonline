const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const TypeMapping = require('../lib/type-mapping.js');
const contentType = require('./route-helpers/content-type.js');
const getSimilarObjects = require('../lib/get-similar-objects.js');
const sortRelated = require('../lib/sort-related-items.js');
const response = require('./route-helpers/response.js');
const cacheHeaders = require('./route-helpers/cache-control.js');
const getChildRecords = require('../lib/get-child-records.js');
// const checkRecordType = require('./route-helpers/recordType.js');

// TODO:  add internal/external ids to typmapping file
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
            // id: request.params.id,
            id: TypeMapping.toInternal(request.params.id),
          });
          //   const inProduction = config && config.NODE_ENV === 'production';

          const relatedItems = await getSimilarObjects(result.body, elastic);
          //   console.log(result.body);
          // handles different properties on parent/child records
          //   const { grouping, sub } = result.body._source['@datatype'];
          //   const groupingType = checkRecordType(grouping, sub);

          //   const childRecords = await getChildRecords(
          //     elastic,
          //     TypeMapping.toInternal(request.params.id),

          //     // TypeMapping.toInternal(request.params.id),
          //     undefined,
          //     groupingType
          //   );

          const { grouping } = result.body._source['@datatype'];
          //   console.log(grouping, 'checking the grouping');
          const childRecords = await getChildRecords(
            elastic,
            TypeMapping.toInternal(request.params.id),

            // TypeMapping.toInternal(request.params.id),
            undefined,
            grouping
          );
          const sortedRelatedItems = sortRelated(relatedItems);

          const JSONData = buildJSONResponse(
            result.body,
            config,
            // sortedRelatedItems,
            null,
            // null,
            childRecords
            // null
          );
          //   console.log(
          //     JSONData.data.children.map((child) => child.data.attributes)
          //   );
          return response(h, JSONData, 'group', responseType);
        } catch (err) {
          console.log(err);
          if (err.statusCode === 404) {
            return Boom.notFound(err);
          }
          return Boom.serverUnavailable('unavailable');
        }
      } else {
        return h.response('Not Acceptable').code(406);
      }
    },
  },
});
