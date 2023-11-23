const test = require('tape');
const queryString = require('querystring');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const aggregationPeople = require('../../lib/facets/aggs-all');

test(file + 'The filters date are not included in the aggregation filters', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongdate&filter%5Bdate%5Bto%5D%5D=wrongdate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: {} });
  // queryParams filter already the wrong date so we need to force it to be able to test that aggs filter also the wrong date
  queryParams.filter.people.birthDate = new Date('wrongDate');
  queryParams.filter.people.deathDate = new Date('wrongDate');
  const aggregation = aggregationPeople(queryParams);
  // select the filters array
  const filter = aggregation.aggs.occupation.filter.bool.must;
  t.plan(1);
  t.deepEqual(filter, [], 'Filter is empty and doens\'t contain the dates');
  t.end();
});
