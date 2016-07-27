const test = require('tape');
const queryString = require('querystring');
const createFiltersObjects = require('../../lib/facets/create-filter-objects');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'The filters date are included in the array filter', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=1800&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', {query: query, params: {type: 'objects'}});
  const filters = createFiltersObjects(queryParams);
  const expected = {bool: {must: [{term: {'type.base': 'object'}}, {range: {'lifecycle.creation.date.latest': {'gte': 1800}}}]}};
  t.deepEqual(filters, expected, 'The dates are part of the filter array');
  t.plan(1);
  t.end();
});

test(file + 'The filter people array do not include a term filter of a wrong date format - filter by queryParams', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongDate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', {query: query, params: {type: 'objects'}});
  const filters = createFiltersObjects(queryParams);
  const expected = { bool: { must: [ { term: { 'type.base': 'object' } } ] } };
  t.deepEqual(filters, expected, 'The wrong date format are not included in the filter array');
  t.plan(1);
  t.end();
});

test(file + 'The filter people array do not include a term filter of a wrong date format - fiter by create-filter', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongDate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', {query: query, params: {type: 'objects'}});
  queryParams.filter.objects.dateFrom = new Date('wrongDate');
  queryParams.filter.objects.dateTo = new Date('wrongDate');
  const filters = createFiltersObjects(queryParams);
  const expected = { bool: { must: [ { term: { 'type.base': 'object' } } ] } };
  t.deepEqual(filters, expected, 'The wrong date format are not included in the filter array');
  t.plan(1);
  t.end();
});
