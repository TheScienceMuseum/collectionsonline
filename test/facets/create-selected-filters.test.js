const test = require('tape');
const queryString = require('querystring');
const createFilters = require('../../lib/transforms/create-selected-filters');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'datefrom and birthdate filters', (t) => {
  t.plan(1);
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=1800&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  const filters = createFilters(queryParams);

  t.equal(filters['date[from]'], '1800', 'The dates are the same');
  t.end();
});

test(file + 'dateto and deathdate filters', (t) => {
  t.plan(1);
  const query = queryString.parse('q=ada&filter%5Bdate%5Bto%5D%5D=1900&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  const filters = createFilters(queryParams);

  t.equal(filters['date[to]'], '1900', 'The dates are the same');
  t.end();
});
