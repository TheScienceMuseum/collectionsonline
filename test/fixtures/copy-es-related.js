const getRelatedItems = require('../../lib/get-related-items');
const TypeMapping = require('../../lib/type-mapping');

module.exports = function (elastic, related, database, next) {
  database.related.error = {error: {'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request'}, response: null};
  var count = 0;
  related.forEach(item => {
    getRelatedItems(elastic, item.id, (error, response) => {
      response.hits = {hits: []};
      database.related[TypeMapping.toInternal(item.id)] = {error: error, response: response};
      count += 1;
      if (count === related.length) {
        return next();
      }
    });
  });
};
