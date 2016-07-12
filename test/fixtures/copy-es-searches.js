const search = require('../../lib/search');
const createQueryParams = require('../../lib/query-params');

module.exports = function (elastic, searchToCopy, database, next) {
  // define a search error response
  database.search.error = {error: {'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request'}, response: null};
  var count = 0;
  searchToCopy.forEach(searchItem => {
    const queryParams = createQueryParams('html', {query: {q: searchItem.q}, params: searchItem.params});
    search(elastic, queryParams, (errorSearch, responseSearch) => {
      // delete the list of results as we don't use them in our tests yet
      responseSearch.hits.hits = [];
      database.search[searchItem.q] = {error: errorSearch, response: responseSearch};
      count += 1;
      if (count === searchToCopy.length) {
        return next();
      }
    });
  });
};
