const test = require('tape');
const queryString = require('querystring');
const createQueryParams = require('../../lib/query-params/query-params');
const createFilters = require('../../lib/facets/create-filters');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'The filters date are included in the array filter', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=1800&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: { type: 'people' } });
  const expected = {
    bool: {
      must: [
        { term: { '@datatype.base': 'agent' } },
        {
          bool: {
            should: [
              {
                bool: {
                  filter: [
                    { range: { 'creation.date.from': { gte: ['1800'] } } }
                  ]
                }
              },
              {
                bool: {
                  filter: [
                    { range: { 'birth.date.from': { gte: ['1800'] } } }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  };
  const filters = createFilters(queryParams, 'agent');
  t.deepEqual(JSON.stringify(filters), JSON.stringify(expected), 'The dates are part of the filter array');
  t.plan(1);
  t.end();
});

test(file + 'The filter people array do not include a term filter of a wrong date format - filter by queryParams', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongDate&filter%5Bdate%5Bto%5D%5D=wrongDate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  const filters = createFilters(queryParams, 'agent');
  const expected = { bool: { must: [{ term: { '@datatype.base': 'agent' } }] } };
  t.deepEqual(filters, expected, 'The wrong date format are not included in the filter array');
  t.plan(1);
  t.end();
});

test(file + 'The filter people array do not include a term filter of a wrong date format - filter by create-filter', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongDate&filter%5Bdate%5Bto%5D%5D=wrongDate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  queryParams.filter.people.birthDate = new Date('wrongDate');
  queryParams.filter.people.deathDate = new Date('wrongDate');
  const filters = createFilters(queryParams, 'agent');
  const expected = { bool: { must: [{ term: { '@datatype.base': 'agent' } }] } };
  t.deepEqual(filters, expected, 'The wrong date format are not included in the filter array');
  t.plan(1);
  t.end();
});
