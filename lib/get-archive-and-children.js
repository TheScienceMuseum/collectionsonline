const Boom = require('boom');
const TypeMapping = require('../lib/type-mapping');
const JSONToHTML = require('../lib/transforms/json-to-html-data.js');
const getChildArchives = require('../lib/get-child-files.js');
const buildJSONResponse = require('../lib/jsonapi-response');
const sortRelated = require('../lib/sort-related-items');
const async = require('async');

/**
* Finds all of a documents children, and their chidren if specified
*
* Returns a callback with either an 'error' or the 'HTMLData' and 'JSONData' as properties of a 'data' object
*
* @param {Object} elastic - the elasticsearch client
* @param {Object} config - the config file
* @param {Object} request - the request object, containing the id of the parent file as a param, and the ids of the children that need to be searched for as a query with the key 'expanded'
* @param {Function} callback - the callback function - returns data when all the children have been found, error if there was an error
*/
module.exports = (elastic, config, request, callback) => {
  const data = {
    page: 'archive'
  };

  elastic.get({index: 'smg', type: 'archive', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
    if (err) {
      if (err.status === 404) {
        return callback(Boom.notFound(), null);
      }
      return callback(Boom.serverUnavailable('unavailable'), null);
    }

    getChildArchives(elastic, request.params.id, function (err, children) {
      if (err) {
        children = {};
      } else {
        children = sortRelated(children, 'children');
      }

      const JSONData = buildJSONResponse(result, config, children);

      // Get nested children if 'expanded' exists as a query
      if (request.query.expanded) {
        async.map(request.query.expanded, function (id, callback) {
          return getChildArchives(elastic, id, callback);
        }, function (err, returned) {
          if (err) return callback(err, null);

          JSONData.included.forEach((el, i) => {
            var childMatch = request.query.expanded.findIndex(e => e === el.id);
            if (childMatch > -1) {
              el.children = sortRelated(returned[childMatch], 'children').relatedChildren;
            }
          });

          const HTMLData = JSONToHTML(JSONData);

          return callback(null, {HTMLData: Object.assign(HTMLData, data), JSONData: JSONData});
        });
      } else {
        const HTMLData = JSONToHTML(JSONData);

        return callback(null, {HTMLData: Object.assign(HTMLData, data), JSONData: JSONData});
      }
    });
  });
};
