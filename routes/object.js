const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const contentType = require('./route-helpers/content-type.js');
const getSimilarObjects = require('../lib/get-similar-objects');
const getAIRelated = require('../lib/get-ai-related');
const sortRelated = require('../lib/sort-related-items');
const response = require('./route-helpers/response');
const cacheHeaders = require('./route-helpers/cache-control');
const getChildRecords = require('../lib/get-child-records.js');
const checkRecordType = require('./route-helpers/recordType.js');
// const { log } = require('handlebars');

/**
 * Returns true if this record is a child within a Single-Part Hierarchy (SPH).
 * SPH children do not have their own display page — they should redirect to their parent.
 *
 * @param {Object} record - The record object from JSONData.data.record
 * @returns {boolean}
 */
function isSPHChildRecord (record) {
  return record.groupingType === 'SPH' && record.recordType === 'child';
}

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/objects/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: async function (request, h) {
      const responseType = contentType(request);

      if (responseType !== 'notAcceptable') {
        const rawId = request.params.id;
        if (!rawId || rawId === 'false') {
          return Boom.notFound();
        }
        try {
          const result = await elastic.get({
            index: 'ciim',
            id: TypeMapping.toInternal(rawId)
          });
          const relatedItems = await getSimilarObjects(result.body, elastic);
          const relatedAIItems = await getAIRelated(rawId, 'object');

          // handles different properties on parent/child records
          // is this code needlessly complex?
          // can we not just check the SPH / MPH type direct?
          // see api.js which handles this slihgtly differently?
          //  "record": {
          //    "groupingType": "SPH",
          //    "recordType": "parent"
          //  },
          // see ES index for this version which seems to be removed from API
          // "@datatype": {
          //   "scope": "1",
          //   "grouping": "SPH",
          //   "base": "object"
          //  },
          // "options": {
          //   "option13": "WHOLE"
          // },
          // child records held in "child": [] node in ES index
          const { grouping, sub } = result.body._source['@datatype'];
          const groupingType = checkRecordType(grouping, sub);
          const childRecords = await getChildRecords(
            elastic,
            TypeMapping.toInternal(rawId),
            undefined,
            groupingType
          );

          const sortedRelatedItems = sortRelated(relatedItems);
          const JSONData = buildJSONResponse(
            result.body,
            config,
            sortedRelatedItems,
            relatedAIItems,
            childRecords
          );
          // SPH child records are not displayed on their own page — redirect to parent
          if (isSPHChildRecord(JSONData.data.record)) {
            const parentRedirect = JSONData.data.links.parent;
            if (!parentRedirect) {
              return Boom.notFound();
            }
            return h.redirect(parentRedirect).permanent();
          }
          return response(h, JSONData, 'object', responseType);
        } catch (err) {
          console.log('Error in object.js' + err);
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
