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
  if (result.filter.objects.categories) {
    Object.assign(result.filter.objects.categories, formatCategoryNames(result.filter.objects.categories));
  }
  // People
  Object.assign(result.filter.people, queryParamsPeople(typeFormat, queryParams));

  // Documents
  Object.assign(result.filter.documents, queryParmasDocuments(typeFormat, queryParams));

  return result;
};

/*
Some cateogires contains a dash in their name.
By default the application convert space to dash on the front end
and dash to space on the backend. This function add dash for the
specific categories.
see issue #1008
*/
function formatCategoryNames (categories) {
  const categoryNames = {
    'x rays': 'x-rays',
    'medical ceramic ware': 'medical ceramic-ware',
    'medical glass ware': 'medical glass-ware',
    'pharmacy ware': 'pharmacy ware',
    'penn gaskell collection': 'penn-gaskell collection'
  };
  return categories.map(c => {
    return categoryNames[c.toLowerCase()] || c;
  });
}
