const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const contentType = require('./route-helpers/content-type.js');
const getSimilarObjects = require('../lib/get-similar-objects');
const sortRelated = require('../lib/sort-related-items');
const response = require('./route-helpers/response');
const cacheHeaders = require('./route-helpers/cache-control');
const getChildRecords = require('../lib/get-child-records.js');
const checkRecordType = require('./route-helpers/recordType.js');
// const { log } = require('handlebars');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/objects/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: async function (request, h) {
      const responseType = contentType(request);

      if (responseType !== 'notAcceptable') {
        try {
          const result = await elastic.get({
            index: 'ciim',
            id: TypeMapping.toInternal(request.params.id)
          });
          const relatedItems = await getSimilarObjects(result.body, elastic);

          // handles different properties on parent/child records
          const { grouping, sub } = result.body._source['@datatype'];
          const groupingType = checkRecordType(grouping, sub);

          const childRecords = await getChildRecords(
            elastic,
            TypeMapping.toInternal(request.params.id),
            undefined,
            groupingType
          );

          const sortedRelatedItems = sortRelated(relatedItems);
          const JSONData = buildJSONResponse(
            result.body,
            config,
            sortedRelatedItems,
            childRecords
          );
          // handles redirect to parent record if child record is part of SPH grouping
          const childRecord = JSONData.data.record.groupingType;

          const recordType = JSONData.data.record.recordType;
          const parentRedirect = JSONData.data.links.parent;
          if (
            childRecord === 'SPH' &&
            recordType === 'child'
          ) {
            return h.redirect(parentRedirect).permanent();
          }
          return response(h, JSONData, 'object', responseType);
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
    }
  }
});
