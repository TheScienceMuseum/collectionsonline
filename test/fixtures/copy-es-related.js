const getRelatedItems = require('../../lib/get-related-items');
const TypeMapping = require('../../lib/type-mapping');

module.exports = function (elastic, related, database, next) {
  database.related.error = {error: {'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request'}, response: null};
  var count = 0;
  related.forEach(item => {
    getRelatedItems(elastic, item.id, (error, items) => {
      var response = {};
      response.hits = {hits: items};
      database.related[TypeMapping.toInternal(item.id)] = {error: error, response: response};
      database.related[TypeMapping.toInternal('smga-people-24329')] = { error: { 'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request' } };
      count += 1;
      if (count === related.length) {
        return next();
      }
    });
  });
};
