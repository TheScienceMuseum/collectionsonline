const createFilters = require('./facets/create-filters');
const createFiltersAll = require('./facets/create-filter-all');
const aggregationTotalCategories = require('./facets/aggs-total-categories');
const createAggregations = require('./facets/create-aggregations');
const createPostFilter = require('./facets/create-post-filter');
const searchWeights = require('./search-weights');
/**
 * Search with aggregations
 * The total aggregation is a filter bucket. It excludes data which are not agents archives or objects
 * @param {Object} elastic - the elasticsearch client
 * @param {Object} queryParams - the queryParams Object
 * @param {Function} next - the callback with error and response as parameters
 */
module.exports = async (elastic, queryParams) => {
  const pageNumber =
    queryParams.pageNumber <= 150 ? queryParams.pageNumber : 150;
  const pageSize = queryParams.pageSize;
  const escapedQuery = queryParams.q
    ? queryParams.q.replace(/\//g, '\\$1')
    : '';
  const body = {
    size: pageSize,
    query: {
      function_score: {
        query: {
          bool: {
            filter: {
              terms: {
                '@datatype.base': ['agent', 'archive', 'object']
              }
            },
            should: [
              {
                query_string: {
                  query: escapedQuery,
                  fields: [
                    'name.value',
                    'title.value',
                    'summary.title',
                    'creation.maker.summary.title'
                  ]
                }
              },
              {
                match: {
                  'identifier.value': {
                    query: queryParams.q,
                    boost: 200
                  }
                }
              },
              {
                prefix: {
                  'identifier.value': {
                    value: queryParams.q,
                    boost: 200
                  }
                }
              },
              {
                match_phrase: {
                  'title.value': {
                    query: queryParams.q,
                    slop: 10,
                    boost: 150
                  }
                }
              },
              {
                match_phrase: {
                  'name.value': {
                    query: queryParams.q,
                    slop: 10
                  }
                }
              },
              {
                match_phrase: {
                  'summary.title': {
                    query: queryParams.q,
                    slop: 10
                  }
                }
              },
              {
                match_phrase: {
                  'description.value': {
                    query: queryParams.q,
                    slop: 20,
                    boost: 2
                  }
                }
              },
              {
                match_phrase: {
                  'note.value': {
                    query: queryParams.q,
                    slop: 150,
                    boost: 2
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
    body
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
    { terms: { '@datatype.base': ['agent', 'archive', 'object'] } },

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
  const filters = {
    type: filtersType,
    people: filtersPeople,
    objects: filtersObjects,
    documents: filterDocuments
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
  return await elastic.search(searchOpts);
};
