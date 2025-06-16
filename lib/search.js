const createFilters = require('./facets/create-filters');
const createFiltersAll = require('./facets/create-filter-all');
const aggregationTotalCategories = require('./facets/aggs-total-categories');
const createAggregations = require('./facets/create-aggregations');
const createPostFilter = require('./facets/create-post-filter');
const searchWeights = require('./search-weights');

const escapeQueryString = (str) => {
  if (!str) return '';
  return str.replace(/([+\-=&|><!(){}[\]^"~*?:\\/])/g, '\\$1');
};

/**
 * Validates and sanitizes the search query string
 * @param {string} query - The raw search query
 * @returns {string} - The sanitized query
 */
const validateAndSanitizeQuery = (query) => {
  if (!query) return '';

  // Count quote types to check for mismatches
  const singleQuotes = (query.match(/'/g) || []).length;
  const doubleQuotes = (query.match(/"/g) || []).length;

  // Case 1: Odd number of single quotes
  if (singleQuotes % 2 !== 0) {
    // Remove all single quotes if mismatched
    query = query.replace(/'/g, '');
  }

  // Case 2: Odd number of double quotes
  if (doubleQuotes % 2 !== 0) {
    // Remove all double quotes if mismatched
    query = query.replace(/"/g, '');
  }

  // Case 3: Mixed quotes (both single and double)
  if (singleQuotes > 0 && doubleQuotes > 0) {
    // Keep only the dominant quote type (or remove both if equal)
    if (singleQuotes >= doubleQuotes) {
      query = query.replace(/"/g, '');
    } else {
      query = query.replace(/'/g, '');
    }
  }

  return query;
};

/**
 * Search with aggregations
 * The total aggregation is a filter bucket. It excludes data which are not agents archives or objects
 * @param {Object} elastic - the elasticsearch client
 * @param {Object} queryParams - the queryParams Object
 * @param {Function} next - the callback with error and response as parameters
 */
module.exports = async (elastic, queryParams) => {
  const pageNumber = queryParams.pageNumber <= 150 ? queryParams.pageNumber : 150;
  const pageSize = queryParams.pageSize;
  const MAX_QUERY_LENGTH = 100;
  if (queryParams.q && queryParams.q.length > MAX_QUERY_LENGTH) {
    queryParams.q = queryParams.q.substring(0, MAX_QUERY_LENGTH);
  }
  const sanitizedQuery = validateAndSanitizeQuery(queryParams.q);
  const escapedQuery = sanitizedQuery ? escapeQueryString(sanitizedQuery) : '';
  const body = {
    size: pageSize,
    query: {
      function_score: {
        query: {
          bool: {
            filter: {
              terms: {
                // '@datatype.base': ['agent', 'archive', 'object'],
                '@datatype.base': ['agent', 'archive', 'object', 'group']
              }
            },
            should: [
              // {
              //   query_string: {
              //     query: escapedQuery,
              //     fields: [
              //       'name.value',
              //       'summary.title',
              //       'creation.maker.summary.title',
              //       'creation.place.summary.title'
              //     ]
              //   }
              // },
              {
                multi_match: {
                  query: escapedQuery,
                  fields: [
                    'name.value',
                    'summary.title',
                    'creation.maker.summary.title',
                    'creation.place.summary.title'
                  ],
                  type: 'best_fields',
                  tie_breaker: 0.3,
                  minimum_should_match: '30%'
                }
              },
              {
                match: {
                  'identifier.value': {
                    query: queryParams.q,
                    boost: 250
                  }
                }
              },
              {
                prefix: {
                  'identifier.value': {
                    value: queryParams.q,
                    boost: 150
                  }
                }
              },
              {
                match_phrase: {
                  'summary.title': {
                    query: queryParams.q,
                    slop: 3,
                    boost: 150
                  }
                }
              },
              {
                match_phrase: {
                  'name.value': {
                    query: queryParams.q,
                    slop: 1
                  }
                }
              },
              // {
              //   match_phrase: {
              //     'summary.title': {
              //       query: queryParams.q,
              //       slop: 10
              //     }
              //   }
              // },
              // {
              //   match_phrase: {
              //     'note.value': {
              //       query: queryParams.q,
              //       slop: 150,
              //       boost: 2
              //     }
              //   }
              // },
              {
                match_phrase: {
                  'description.value': {
                    query: queryParams.q,
                    slop: 10,
                    boost: 50
                  }
                }
              }
            ],
            must_not: [
              {
                terms: {
                  'grouping.@link.type': ['SPH']
                }
              }
            ]
          }
        },
        functions: searchWeights
      }
    },
    min_score: 0.01
  };

  const searchOpts = {
    index: 'ciim',
    from: pageNumber * pageSize,
    body,
    timeout: '30s' // Correct parameter name
  };
  if (!queryParams.q) {
    searchOpts.body.query.function_score.query = { match_all: {} };
  }

  // sort by modification or creation date */
  if (queryParams.pageSort) {
    //  searchOpts.body.functions = {}; // drop any other sorting or ordering
    if (queryParams.pageSort === 'created') {
      searchOpts.body.sort = [{ 'admin.created': 'desc' }];
    }
    if (queryParams.pageSort === 'modified') {
      searchOpts.body.sort = [{ 'admin.modified': 'desc' }];
    }
  }

  if (queryParams.random) {
    /* See https://github.com/TheScienceMuseum/collectionsonline/issues/780
      Allows users to request a number (n) of random items using query '?random=n'
      Where 'n' is a number between 1 and 50
    */
    searchOpts.body = {
      size: queryParams.random,
      query: {
        function_score: {
          query: { match_all: {} },
          functions: [
            {
              random_score: {
                seed: Date.now()
              }
            }
          ]
        }
      },
      min_score: 0.01
    };
  }

  const filtersType = [
    { terms: { '@datatype.base': ['agent', 'archive', 'object', 'group'] } },
    // do not return child record of SPH records in regular SERP results
    {
      bool: {
        must_not: {
          match: { 'grouping.@link.type': 'SPH' }
        }
      }
    }
  ];

  const filtersPeople = createFilters(queryParams, 'agent');
  const filtersObjects = createFilters(queryParams, 'object');
  const filterDocuments = createFilters(queryParams, 'archive');
  const filterGroups = createFilters(queryParams, 'group');
  const filters = {
    type: filtersType,
    people: filtersPeople,
    objects: filtersObjects,
    documents: filterDocuments,
    group: filterGroups
  };
  filters.all = createFiltersAll(queryParams, filters);
  /**
   * Build filters for aggregations based on queryParams object
   * queryParams contains a representation of the selected filters by the user
   */
  searchOpts.body.aggs = {};

  /**
   * Total per category aggregations
   */
  Object.assign(searchOpts.body.aggs, aggregationTotalCategories(filters));

  /**
   * Create aggregations
   */
  Object.assign(searchOpts.body.aggs, createAggregations(queryParams));

  /**
   * Create post filter query. This query is going to filter the list of results depending on the category and the filters selected by the user
   */
  searchOpts.body.post_filter = {};
  Object.assign(
    searchOpts.body.post_filter,
    createPostFilter(queryParams, filters)
  );

  try {
    return await elastic.search(searchOpts);
  } catch (error) {
    console.error('Elasticsearch error:', {
      error: error.message,
      meta: error.meta?.body?.error,
      query: searchOpts.body.query,
      sanitizedQuery,
      params: queryParams
    });
    throw new Error('Search service unavailable');
  }
};
