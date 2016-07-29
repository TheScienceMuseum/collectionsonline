/**
* Create the facets for each categories
*/
const aggregationAll = require('./aggs-all');
const aggregationPeople = require('./aggs-people');
const aggregationObjects = require('./aggs-objects');
const aggregationDocuments = require('./aggs-documents');

module.exports = function (queryParams) {
  var aggs = {};
  const type = queryParams.type;
  if (type === 'all') {
    aggs.all = aggregationAll(queryParams);
  }

  if (queryParams.type === 'people') {
    aggs.people = aggregationPeople(queryParams);
  }

  if (queryParams.type === 'objects') {
    aggs.objects = aggregationObjects(queryParams);
  }

  if (queryParams.type === 'documents') {
    aggs.documents = aggregationDocuments(queryParams);
  }
  return aggs;
};
