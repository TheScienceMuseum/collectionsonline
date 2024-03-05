const test = require('tape');
const queryString = require('querystring');
const createFilterAll = require('../../lib/facets/create-filter-all');
const createFilters = require('../../lib/facets/create-filters');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'The filters date are included in the array filter', (t) => {
  const query = queryString.parse(
    'q=ada&filter%5Bdate%5Bfrom%5D%5D=1800&&filter%5Bdate%5Bto%5D%5D=1900&page%5Bsize%5D=50'
  );
  const queryParams = createQueryParams('html', { query, params: {} });

  const filters = {
    people: createFilters(queryParams, 'agent'),
    objects: createFilters(queryParams, 'object'),
    documents: createFilters(queryParams, 'archive'),
    // mgroup: createFilters(queryParams, 'mgroup'),
  };

  const filtersAll = createFilterAll(queryParams, filters);
  const expected = {
    bool: {
      must: [
        {
          terms: { '@datatype.base': ['agent', 'object'] },
          // terms: { '@datatype.base': ['agent', 'object', 'group'] }
        },
        {
          bool: {
            should: [
              {
                bool: {
                  filter: [
                    { range: { 'creation.date.from': { gte: ['1800'] } } },
                    { range: { 'creation.date.to': { lte: ['1900'] } } },
                  ],
                },
              },
              {
                bool: {
                  filter: [
                    { range: { 'birth.date.from': { gte: ['1800'] } } },
                    { range: { 'birth.date.to': { lte: ['1900'] } } },
                  ],
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                bool: {
                  filter: [
                    { range: { 'creation.date.from': { gte: ['1800'] } } },
                    { range: { 'creation.date.to': { lte: ['1900'] } } },
                  ],
                },
              },
              {
                bool: {
                  filter: [
                    { range: { 'birth.date.from': { gte: ['1800'] } } },
                    { range: { 'birth.date.to': { lte: ['1900'] } } },
                  ],
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                bool: {
                  filter: [
                    { range: { 'creation.date.from': { gte: ['1800'] } } },
                    { range: { 'creation.date.to': { lte: ['1900'] } } },
                  ],
                },
              },
              {
                bool: {
                  filter: [
                    { range: { 'birth.date.from': { gte: ['1800'] } } },
                    { range: { 'birth.date.to': { lte: ['1900'] } } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  t.plan(1);
  t.deepEqual(filtersAll, expected, 'Filter all filters is ok');
  t.end();
});

test(
  file +
    'The filter people array do not include a term filter of a wrong date format',
  (t) => {
    const query = queryString.parse(
      'q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongDate&filter%5Bdate%5Bto%5D%5D=wrongDate&page%5Bsize%5D=50'
    );
    const queryParams = createQueryParams('html', { query, params: {} });

    const filters = {
      people: createFilters(queryParams, 'agent'),
      objects: createFilters(queryParams, 'object'),
      // mgroup: createFilters(queryParams, 'mgroup'),
      documents: createFilters(queryParams, 'archive'),
    };

    const filtersAll = createFilterAll(queryParams, filters);
    const mustExpected = [
      {
        terms: {
          '@datatype.base': ['agent', 'object', 'archive'],
          // '@datatype.base': ['agent', 'object', 'archive', 'group']
        },
      },
    ];

    t.deepEqual(filtersAll.bool.must, mustExpected, 'Must get all they types');
    t.plan(1);
    t.end();
  }
);
