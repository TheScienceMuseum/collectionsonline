const test = require('tape');
const queryString = require('querystring');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const aggregationObjects = require('../../lib/facets/aggs-all');

test(file + 'The filters date are not included in the aggregation filters', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongdate&filter%5Bdate%5Bto%5D%5D=wrongdate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: {} });
  queryParams.filter.objects.dateFrom = new Date('wrongDate');
  queryParams.filter.objects.dateTo = new Date('wrongDate');
  const aggregation = aggregationObjects(queryParams);
  // When all date filters are invalid, no active clauses → filterQuery becomes match_all
  t.plan(1);
  t.deepEqual(aggregation.aggs.category.filter, { match_all: {} }, 'Filter is match_all when no valid active filters');
  t.end();
});
