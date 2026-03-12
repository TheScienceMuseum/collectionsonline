const test = require('tape');
const queryString = require('querystring');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const aggregationAll = require('../../lib/facets/aggs-all');

test(file + 'The filters date are not included in the aggregation filters (free-text: sampler wraps inner aggs)', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongdate&filter%5Bdate%5Bto%5D%5D=wrongdate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: {} });
  queryParams.filter.all.dateFrom = new Date('wrongDate');
  queryParams.filter.all.dateTo = new Date('wrongDate');
  // isFreeText=true because q is set — facets are wrapped in a sampler
  const aggregation = aggregationAll(queryParams, true);
  t.plan(3);
  // Sampler wrapper is present
  t.ok(aggregation.aggs.sample, 'sampler wrapper exists for free-text queries');
  t.equal(aggregation.aggs.sample.sampler.shard_size, 200, 'shard_size is 200');
  // When all date filters are invalid, no active clauses → filterQuery becomes match_all
  t.deepEqual(aggregation.aggs.sample.aggs.category.filter, { match_all: {} }, 'Filter is match_all when no valid active filters');
  t.end();
});

test(file + 'No sampler wrapper when browsing without a free-text query', (t) => {
  const query = queryString.parse('page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: {} });
  // isFreeText=false — facets are flat (no sampler)
  const aggregation = aggregationAll(queryParams, false);
  t.plan(2);
  t.notOk(aggregation.aggs.sample, 'no sampler wrapper for browse-only requests');
  t.ok(aggregation.aggs.category, 'category facet is directly under aggs');
  t.end();
});
