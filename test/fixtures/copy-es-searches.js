const search = require('../../lib/search');
const createQueryParams = require('../../lib/query-params/query-params');

module.exports = function (elastic, searchToCopy, database, next) {
  database.search = database.search || {};
  // define a search error response
  database.search.error = {error: {'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request'}, response: null};
  var count = 0;
  searchToCopy.forEach(searchItem => {
    const parameters = {query: {q: searchItem.q}, params: searchItem.params};
    // add other query parameters
    if (searchItem.queryParams) {
      Object.keys(searchItem.queryParams).forEach(param => {
        parameters.query[param] = searchItem.queryParams[param];
      });
    }
    const queryParams = createQueryParams('html', parameters);
    search(elastic, queryParams, (errorSearch, responseSearch) => {
      database.search[searchItem.q] = {error: errorSearch, response: responseSearch};
      count += 1;
      if (count === searchToCopy.length) {
        return next();
      }
    });
  });
};
