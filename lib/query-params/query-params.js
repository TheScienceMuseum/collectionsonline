/**
 * Create a query params Object
 * Joi is already converting the query and params for the short name to the JSONAPI format
 * ex: occupation to filter[occupation]
 */
const queryParamsAll = require('./query-params-all');
const queryParamsObjects = require('./query-params-objects');
const queryParamsPeople = require('./query-params-people');
const queryParamsDocuments = require('./query-params-documents');
const queryParamsGroup = require('./query-params-group');
const formatFilterNames = require('../helpers/format-filter-names');
module.exports = (typeFormat, queryParams) => {
  const result = {};

  // Main values
  result.query = queryParams.query;
  result.q = queryParams.query.q && typeof queryParams.query.q === 'string' ? queryParams.query.q.trim() : undefined;
  result.pageNumber = parseInt(queryParams.query['page[number]']) || 0;
  result.pageSize = parseInt(queryParams.query['page[size]']) || 50;
  result.pageType = queryParams.query['page[type]'] || 'search';
  result.pageSort = queryParams.query['page[sort]'] || 'default';
  result.type =
    queryParams.params.type || queryParams.query['fields[type]'] || 'all';
  result.random = queryParams.query.random;

  result.filter = {
    all: {},
    objects: {},
    people: {},
    documents: {},
    group: {}
  };

  // All
  Object.assign(result.filter.all, queryParamsAll(typeFormat, queryParams));
  if (result.filter.all.places) {
    result.filter.all.places = formatFilterNames('places', result.filter.all.places);
  }

  // Objects
  Object.assign(
    result.filter.objects,
    queryParamsObjects(typeFormat, queryParams)
  );
  if (result.filter.objects.categories) {
    result.filter.objects.categories = formatFilterNames('categories', result.filter.objects.categories);
  }
  if (result.filter.objects.object_type) {
    result.filter.objects.object_type = formatFilterNames('object_type', result.filter.objects.object_type);
  }
  if (result.filter.objects.material) {
    result.filter.objects.material = formatFilterNames('material', result.filter.objects.material);
  }
  if (result.filter.objects.makers) {
    result.filter.objects.makers = formatFilterNames('makers', result.filter.objects.makers);
  }
  if (result.filter.objects.collection) {
    result.filter.objects.collection = formatFilterNames('collection', result.filter.objects.collection);
  }

  // People
  Object.assign(
    result.filter.people,
    queryParamsPeople(typeFormat, queryParams)
  );
  if (result.filter.people.occupation) {
    result.filter.people.occupation = formatFilterNames('occupation', result.filter.people.occupation);
  }
  if (result.filter.people.birthPlace) {
    result.filter.people.birthPlace = formatFilterNames('birth_place', result.filter.people.birthPlace);
  }

  // Documents
  Object.assign(
    result.filter.documents,
    queryParamsDocuments(typeFormat, queryParams)
  );
  if (result.filter.documents.archive) {
    result.filter.documents.archive = formatFilterNames('archive', result.filter.documents.archive);
  }

  // Groups
  Object.assign(result.filter.group, queryParamsGroup(typeFormat, queryParams));

  return result;
};
