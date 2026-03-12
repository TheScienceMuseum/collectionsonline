/**
 * Create the facets for each categories
 */
const aggregationAll = require('./aggs-all');

module.exports = function (queryParams) {
  const aggs = {};
  const type = queryParams.type;
  // Wrap facet aggregations in a sampler when the user has typed a free-text
  // query so that facet counts reflect the top-scoring (most relevant) results
  // rather than the full long-tail of weakly-matching documents.
  const isFreeText = Boolean(queryParams.q);

  if (type === 'all') {
    aggs.all = aggregationAll(queryParams, isFreeText);
  }

  if (queryParams.type === 'people') {
    aggs.people = aggregationAll(queryParams, isFreeText);
  }

  if (queryParams.type === 'objects') {
    aggs.objects = aggregationAll(queryParams, isFreeText);
  }

  if (queryParams.type === 'documents') {
    aggs.documents = aggregationAll(queryParams, isFreeText);
  }
  if (queryParams.type === 'group') {
    aggs.group = aggregationAll(queryParams, isFreeText);
  }
  return aggs;
};
