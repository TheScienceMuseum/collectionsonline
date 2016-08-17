const createFiltersPeople = require('./facets/create-filter-people');
const createFiltersObjects = require('./facets/create-filter-objects');
const createFiltersDocuments = require('./facets/create-filter-documents');
const createFiltersAll = require('./facets/create-filter-all');
const aggregationTotalCategories = require('./facets/aggs-total-categories');
const createAggregations = require('./facets/create-aggregations');
const createPostFilter = require('./facets/create-post-filter');
/**
* Search with aggregations
* The total aggregation is a filter bucket. It exclude data which are not an agents archives or objects
* @param {Object} elastic - the elasticsearch client
* @param {Object} queryParams - the queryParams Object
* @param {Function} next - the callback with error and response as parameters
*/
module.exports = (elastic, queryParams, next) => {
  const pageNumber = queryParams.pageNumber;
  const pageSize = queryParams.pageSize;
  const body = {
    query: {
      function_score: {
        query: {
          bool: {
            must: {
              multi_match: {
                query: queryParams.q,
                type: 'cross_fields',
                fields: [
                  'name.value_text',
                  'title.value_text',
                  'summary_title_text',
                  'note.value',
                  'description.value',
                  'identifier.value'
                ]
              }
            },
            filter: {
              terms: {
                'type.base': ['agent', 'archive', 'object']
              }
            },
            should: [{
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
                'summary_title_text': {
                  query: queryParams.q,
                  slop: 5
                }
              }
            }]
          }
        },
        functions: [{
          filter: {
            term: {'location.purpose': 'on display'}
          },
          weight: 1.2
        }, {
          filter: {
            exists: {field: 'options.option1'}
          },
          weight: 1.2
        }, {
          filter: {
            exists: {field: 'note'}
          },
          weight: 1.2
        }, {
          filter: {
            exists: {field: 'lifecycle.birth.date'}
          },
          weight: 1.2
        }, {
          filter: {
            exists: {field: 'lifecycle.death.date'}
          },
          weight: 1.2
        }, {
          filter: {
            term: {'type.base': 'archive'}
          },
          weight: 0.8
        }, {
          filter: {
            exists: {field: 'multimedia.processed'}
          },
          weight: 1.4
        }]
      }
    }
  };

  const searchOpts = {
    index: 'smg',
    from: pageNumber * pageSize,
    size: pageSize,
    body: body,
    searchName: 'defaultSearch'
  };

  if (!queryParams.q) {
    searchOpts.body.query.function_score.query = {match_all: {}};
  }

  const filtersType = [{terms: {'type.base': ['agent', 'archive', 'object']}}];
  const filtersPeople = createFiltersPeople(queryParams);
  const filtersObjects = createFiltersObjects(queryParams);
  const filterDocuments = createFiltersDocuments(queryParams);
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
  * Create post filter query. This queyr is going to filter the list of results depending on the category and the filters selected by the user
  */
  searchOpts.body.post_filter = {};
  Object.assign(searchOpts.body.post_filter, createPostFilter(queryParams, filters));

  elastic.search(searchOpts, (err, result) => {
    return next(err, result);
  });
};
