/**
* Create the facets for each categories
*/
const aggregationAll = require('./aggs-all');

module.exports = function (queryParams) {
  var aggs = {};
  const type = queryParams.type;
  if (type === 'all') {
    aggs.all = aggregationAll(queryParams);
  }

  if (queryParams.type === 'people') {
    aggs.people = aggregationAll(queryParams);
  }

  if (queryParams.type === 'objects') {
    aggs.objects = aggregationAll(queryParams);
  }

  if (queryParams.type === 'documents') {
    aggs.documents = aggregationAll(queryParams);
  }
  return aggs;
};
