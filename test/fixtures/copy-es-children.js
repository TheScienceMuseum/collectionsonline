const getChildren = require('../../lib/get-child-files');
const TypeMapping = require('../../lib/type-mapping');

module.exports = function (elastic, children, database, next) {
  database.children.error = {error: {'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request'}, response: null};
  var count = 0;
  children.forEach(item => {
    getChildren(elastic, item.id, (error, childrenResponse) => {
      var response = {};
      response.hits = {hits: childrenResponse};
      database.children[TypeMapping.toInternal(item.id)] = {error: error, response: response};
      database.children[TypeMapping.toInternal('smga-documents-110066453')] = { error: { 'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request' } };
      count += 1;
      if (count === children.length) {
        return next();
      }
    });
  });
};
