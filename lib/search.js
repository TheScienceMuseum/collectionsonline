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
module.exports = (elastic, queryParams, next) => {
  const pageNumber = queryParams.pageNumber;
  const pageSize = queryParams.pageSize;
  var body = {
    size: pageSize,
    query: {
      function_score: {
        query: {
          bool: {
            filter: {
              terms: {
                'type.base': ['agent', 'archive', 'object']
              }
            },
            should: [{
              multi_match: {
                query: queryParams.q,
                type: 'best_fields',
                fields: [
                  'name.value_text',
                  'name.value_lower',
                  'title.value_text',
                  'summary_title_stem',
                  'summary_title_lower',
                  'note.value',
                  'description.value',
                  'identifier.value'
                ]
              }
            }, {
              match: {
                'identifier.value': {
                  query: queryParams.q,
                  boost: 200
                }
              }
            }, {
              prefix: {
                'identifier.value': {
                  value: queryParams.q,
                  boost: 200
                }
              }
            }, {
              match_phrase: {
                'title.value_text': {
                  query: queryParams.q,
                  slop: 5
                }
              }
            }, {
              match_phrase: {
                'name.value_text': {
                  query: queryParams.q,
                  slop: 5
                }
              }
            }, {
              match_phrase: {
                'summary_title_stem': {
                  query: queryParams.q,
                  slop: 5
                }
              }
            }]
          }
        },
        functions: searchWeights
      }
    },
    min_score: 0.01
  };

  const searchOpts = {
    index: 'smg',
    from: pageNumber * pageSize,
    body: body
  };

  if (!queryParams.q) {
    searchOpts.body.query.function_score.query = {match_all: {}};
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
          query: {match_all: {}},
          functions: [{
            random_score: {
              seed: Date.now()
            }
          }]
        }
      },
      min_score: 0.01
    };
  }

  const filtersType = [{terms: {'type.base': ['agent', 'archive', 'object']}}];
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
  Object.assign(searchOpts.body.post_filter, createPostFilter(queryParams, filters));

  elastic.search(searchOpts, (err, result) => {
    return next(err, result);
  });
};
