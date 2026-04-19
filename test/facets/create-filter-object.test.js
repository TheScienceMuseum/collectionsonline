const test = require('tape');
const queryString = require('querystring');
const createFilters = require('../../lib/facets/create-filters');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'Maker filter with comma in name is not split when building ES query', (t) => {
  // Simulates the value after parse-params decodes the encoded URL segment.
  // e.g. URL: /search/objects/makers/science-museum%252c-london
  //   Hapi pre-decodes %25→%:  science-museum%2c-london
  //   parse-params dashToSpace + decodeURIComponent × 2: 'Science Museum, London'
  const query = { 'filter[makers]': 'Science Museum, London' };

  const htmlQueryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  t.deepEqual(
    htmlQueryParams.filter.objects.makers,
    ['Science Museum, London'],
    'HTML: maker name with comma is preserved as a single value'
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

  // JSON/SPA path: space-after-comma heuristic — 'Science Museum, London' splits to
  // ['Science Museum', ' London']; the leading space on ' London' signals a literal
  // comma, so the whole string is kept as one value.
  const jsonQueryParams = createQueryParams('json', { query, params: { type: 'objects' } });
  t.deepEqual(
    jsonQueryParams.filter.objects.makers,
    ['Science Museum, London'],
    'JSON string input: maker name with comma (space after) is preserved as a single value'
  );
  const jsonFilters = createFilters(jsonQueryParams, 'object');
  const jsonMakerFilter = jsonFilters.bool.filter.find((f) => f.terms && f.terms['creation.maker.summary.title.lower']);
  t.ok(jsonMakerFilter, 'JSON string input: maker terms filter is present');
  t.ok(
    jsonMakerFilter.terms['creation.maker.summary.title.lower'].includes('science museum, london'),
    'JSON string input: ES terms includes the full maker name with comma, not split parts'
  );

  // Array input: simulates the URL-path route where Joi .single() wraps the string in an array.
  const queryWithArray = { 'filter[makers]': ['Science Museum, London'] };
  const jsonArrayQueryParams = createQueryParams('json', { query: queryWithArray, params: { type: 'objects' } });
  t.deepEqual(
    jsonArrayQueryParams.filter.objects.makers,
    ['Science Museum, London'],
    'JSON array input (URL path route): array value with comma is preserved as a single value'
  );
  const jsonArrayFilters = createFilters(jsonArrayQueryParams, 'object');
  const jsonArrayMakerFilter = jsonArrayFilters.bool.filter.find((f) => f.terms && f.terms['creation.maker.summary.title.lower']);
  t.ok(jsonArrayMakerFilter, 'JSON array input: maker terms filter is present');
  t.ok(
    jsonArrayMakerFilter.terms['creation.maker.summary.title.lower'].includes('science museum, london'),
    'JSON array input: ES terms includes the full maker name with comma'
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

test(file + 'Category filter is case-insensitive via term + case_insensitive (not a plain terms query)', (t) => {
  // category.name.keyword has no lowercase normalizer, so a plain `terms` query
  // was case-sensitive and relied on our title-case heuristic matching the exact ES
  // value. The bool.should / term / case_insensitive form removes that dependency —
  // e.g. "Photographic Collections (railway)" (from the URL) will match the ES
  // value "Photographic Collections (Railway)" regardless of the parenthesised word's case.
  const query = { 'filter[categories]': 'Photographic Collections (railway)' };
  const queryParams = createQueryParams('html', { query, params: { type: 'objects' } });
  const filters = createFilters(queryParams, 'object');

  const categoryFilter = filters.bool.filter.find(
    (f) => f.bool && f.bool.should && f.bool.should[0] && f.bool.should[0].term && f.bool.should[0].term['category.name.keyword']
  );
  t.ok(categoryFilter, 'category filter is a bool.should of term queries');
  t.ok(
    categoryFilter.bool.should.every((c) => c.term['category.name.keyword'].case_insensitive === true),
    'every term candidate has case_insensitive: true'
  );
  t.ok(
    categoryFilter.bool.should.some((c) => c.term['category.name.keyword'].value === 'Photographic Collections (railway)'),
    'original value is a candidate'
  );
  t.notOk(
    filters.bool.filter.some((f) => f.terms && f.terms['category.name.keyword']),
    'no legacy terms query for category.name.keyword remains'
  );
  t.end();
});

test(file + 'Occupation, material and object_type keyword filters use case_insensitive term queries', (t) => {
  // occupation.value.keyword, material.value.keyword and name.value.keyword (for object_type)
  // are case-sensitive keyword fields in ES with no .lower normalizer. A plain `terms`
  // query would require the URL/user case to exactly match the stored case — e.g.
  // "Make-up artist" vs "make-up artist", "Copper alloy" vs "copper alloy". Using
  // term + case_insensitive: true wrapped in bool.should removes this dependency.
  const cases = [
    { filter: 'occupation', queryType: 'people', value: 'Make-up Artist', field: 'occupation.value.keyword' },
    { filter: 'material', queryType: 'objects', value: 'Copper Alloy', field: 'material.value.keyword' },
    { filter: 'object_type', queryType: 'objects', value: 'Film Poster', field: 'name.value.keyword' }
  ];

  cases.forEach(({ filter, queryType, value, field }) => {
    const query = { ['filter[' + filter + ']']: value };
    const queryParams = createQueryParams('html', { query, params: { type: queryType } });
    const filters = createFilters(queryParams, queryType === 'people' ? 'agent' : 'object');

    const match = filters.bool.filter.find(
      (f) => f.bool && f.bool.should && f.bool.should[0] && f.bool.should[0].term && f.bool.should[0].term[field]
    );
    t.ok(match, filter + ': filter uses bool.should of term queries');
    t.ok(
      match.bool.should.every((c) => c.term[field].case_insensitive === true),
      filter + ': every term candidate has case_insensitive: true'
    );
    t.ok(
      match.bool.should.some((c) => c.term[field].value === value),
      filter + ': original value is a candidate'
    );
    t.notOk(
      filters.bool.filter.some((f) => f.terms && f.terms[field]),
      filter + ': no legacy terms query for ' + field + ' remains'
    );
  });
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
