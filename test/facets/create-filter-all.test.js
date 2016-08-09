const test = require('tape');
const queryString = require('querystring');
const createFilterAll = require('../../lib/facets/create-filter-all');
const createFilterPeople = require('../../lib/facets/create-filter-people');
const createFiltersObjects = require('../../lib/facets/create-filter-objects');
const createFiltersDocuments = require('../../lib/facets/create-filter-documents');
const createQueryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'The filters date are included in the array filter', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=1800&&filter%5Bdate%5Bto%5D%5D=1900&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', {query: query, params: {}});

  const filters = {
    people: createFilterPeople(queryParams),
    objects: createFiltersObjects(queryParams),
    documents: createFiltersDocuments(queryParams)
  };

  const filtersAll = createFilterAll(queryParams, filters);
  var expected = {bool: {
    must: [
      {
        terms: {'type.base': ['agent', 'object']}
      }
    ],
    should: [
      {
        bool: {
          must: [
            {term: {'type.base': 'agent'}},
            {
              bool: {
                should: [
                  {range: {'lifecycle.birth.date.earliest': {'gte': 1800}}},
                  {range: {'lifecycle.death.date.latest': {lte: 1900}}}
                ]
              }
            }
          ]
        }
      },
      {
        bool: {
          must: [
            {term: {'type.base': 'object'}},
            {
              bool: {
                should: [
                  {range: {'lifecycle.creation.date.latest': {'gte': 1800}}},
                  {range: {'lifecycle.creation.date.latest': {'lte': 1900}}}
                ]
              }
            }
          ]
        }
      },
      {
        bool: {
          must: [
            {
              term: {
                'type.base': 'archive'
              }
            }
          ]
        }
      }
    ]
  }
};

  t.plan(1);
  t.deepEqual(filtersAll, expected, 'Filter all filters is ok');
  t.end();
});

test(file + 'The filter people array do not include a term filter of a wrong date format', (t) => {
  const query = queryString.parse('q=ada&filter%5Bdate%5Bfrom%5D%5D=wrongDate&filter%5Bdate%5Bto%5D%5D=wrongDate&page%5Bsize%5D=50');
  const queryParams = createQueryParams('html', {query: query, params: {}});

  const filters = {
    people: createFilterPeople(queryParams),
    objects: createFiltersObjects(queryParams),
    documents: createFiltersDocuments(queryParams)
  };

  const filtersAll = createFilterAll(queryParams, filters);
  const mustExpected = [
    {
      terms: {
        'type.base': ['agent', 'object', 'archive']
      }
    }
  ];

  t.deepEqual(filtersAll.bool.must, mustExpected, 'Must get all they types');
  t.plan(1);
  t.end();
});
