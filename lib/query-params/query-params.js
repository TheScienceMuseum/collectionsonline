/**
* Create a query params Object
* Joi is already converting the query and params for the short name to the JSONAPI format
* ex: occupation to filter[occupation]
*/
const queryParamsAll = require('./query-params-all');
const queryParamsObjects = require('./query-params-objects');
const queryParamsPeople = require('./query-params-people');
const queryParmasDocuments = require('./query-params-documents');

module.exports = (typeFormat, queryParams) => {
  var result = {};

  // Main values
  result.query = queryParams.query;
  result.q = queryParams.query.q ? queryParams.query.q.trim() : undefined;
  result.pageNumber = parseInt(queryParams.query['page[number]']) || 0;
  result.pageSize = parseInt(queryParams.query['page[size]']) || 50;
  result.pageType = queryParams.query['page[type]'] || 'search';
  result.pageSort = queryParams.query['page[sort]'] || 'default';
  result.type = queryParams.params.type || queryParams.query['fields[type]'] || 'all';
  result.random = queryParams.query.random;

  result.filter = {all: {}, objects: {}, people: {}, documents: {}};

  // All
  Object.assign(result.filter.all, queryParamsAll(typeFormat, queryParams));

  // Objects
  Object.assign(result.filter.objects, queryParamsObjects(typeFormat, queryParams));

  // People
  Object.assign(result.filter.people, queryParamsPeople(typeFormat, queryParams));

  // Documents
  Object.assign(result.filter.documents, queryParmasDocuments(typeFormat, queryParams));

  return result;
};
