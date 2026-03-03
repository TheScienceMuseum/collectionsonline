const test = require('tape');
const queryString = require('querystring');
const createFilters = require('../../lib/facets/create-filters');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Maker filter with comma in name is not split when building ES query', (t) => {
  // Simulates the value after parse-params + uppercaseFirstChar + comma escaping
  // e.g. URL: /search/objects/makers/science-museum,-london -> 'Science Museum\\, London'
  const query = { 'filter[makers]': 'Science Museum\\, London' };

  const htmlQueryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  t.deepEqual(
    htmlQueryParams.filter.objects.makers,
    ['Science Museum, London'],
    'HTML: maker name with escaped comma is unescaped to a single value'
  );
  const htmlFilters = createFilters(htmlQueryParams, 'object');
  const makerFilter = htmlFilters.bool.filter.find((f) => f.terms && f.terms['creation.maker.summary.title.lower']);
  t.ok(makerFilter, 'HTML: maker terms filter is present');
  t.ok(
    makerFilter.terms['creation.maker.summary.title.lower'].includes('science museum, london'),
    'HTML: ES terms includes the full maker name with comma, not split parts'
  );
  t.notOk(
    makerFilter.terms['creation.maker.summary.title.lower'].includes('science museum'),
    'HTML: ES terms does not contain the incorrectly split first part'
  );

  const jsonQueryParams = createQueryParams('json', { query, params: { type: 'objects' } });
  t.deepEqual(
    jsonQueryParams.filter.objects.makers,
    ['Science Museum, London'],
    'JSON string input: maker name with escaped comma is unescaped to a single value'
  );
  const jsonFilters = createFilters(jsonQueryParams, 'object');
  const jsonMakerFilter = jsonFilters.bool.filter.find((f) => f.terms && f.terms['creation.maker.summary.title.lower']);
  t.ok(jsonMakerFilter, 'JSON string input: maker terms filter is present');
  t.ok(
    jsonMakerFilter.terms['creation.maker.summary.title.lower'].includes('science museum, london'),
    'JSON string input: ES terms includes the full maker name with comma, not split parts'
  );

  // Simulates the route handler path: URL path categories go through filterSchema('html') resultSchema
  // which uses Joi .single() to wrap the string into an array before createQueryParams is called.
  // This is what actually happens when a JSON API client requests /search/objects/makers/science-museum,-london
  const queryWithArray = { 'filter[makers]': ['Science Museum\\, London'] };
  const jsonArrayQueryParams = createQueryParams('json', { query: queryWithArray, params: { type: 'objects' } });
  t.deepEqual(
    jsonArrayQueryParams.filter.objects.makers,
    ['Science Museum, London'],
    'JSON array input (URL path route): array with escaped comma is unescaped to a single value'
  );
  const jsonArrayFilters = createFilters(jsonArrayQueryParams, 'object');
  const jsonArrayMakerFilter = jsonArrayFilters.bool.filter.find((f) => f.terms && f.terms['creation.maker.summary.title.lower']);
  t.ok(jsonArrayMakerFilter, 'JSON array input: maker terms filter is present');
  t.ok(
    jsonArrayMakerFilter.terms['creation.maker.summary.title.lower'].includes('science museum, london'),
    'JSON array input: ES terms includes the full maker name without backslash'
  );
  t.notOk(
    jsonArrayMakerFilter.terms['creation.maker.summary.title.lower'].some((v) => v.includes('\\')),
    'JSON array input: ES terms do not contain backslash characters'
  );

  t.plan(11);
  t.end();
});

test(file + 'The filters date are included in the array filter', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=1800&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  const filters = createFilters(queryParams, 'object');
  const expected = {
    bool: {
      filter: [
        { term: { '@datatype.base': 'object' } },
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
  t.deepEqual(filters, expected, 'The dates are part of the filter array');
  t.plan(1);
  t.end();
});

test(file + 'The filter people array do not include a term filter of a wrong date format - filter by queryParams', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongDate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  const filters = createFilters(queryParams, 'object');
  const expected = { bool: { filter: [{ term: { '@datatype.base': 'object' } }] } };
  t.deepEqual(filters, expected, 'The wrong date format are not included in the filter array');
  t.plan(1);
  t.end();
});

test(file + 'The filter people array do not include a term filter of a wrong date format - fiter by create-filter', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongDate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  queryParams.filter.objects.dateFrom = new Date('wrongDate');
  queryParams.filter.objects.dateTo = new Date('wrongDate');
  const filters = createFilters(queryParams, 'object');
  const expected = { bool: { filter: [{ term: { '@datatype.base': 'object' } }] } };
  t.deepEqual(filters, expected, 'The wrong date format are not included in the filter array');
  t.plan(1);
  t.end();
});
