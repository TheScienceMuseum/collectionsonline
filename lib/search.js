const TypeMapping = require('./type-mapping');
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

  const searchOpts = {
    index: 'smg',
    q: queryParams.q,
    from: pageNumber * pageSize,
    size: pageSize,
    body: {
      aggs: {
        total_per_categories: {
          terms: { field: 'type.base' }
        },
        total: {
          filter: {
            terms: {
              'type.base': ['agent', 'archive', 'object']
            }
          },
          aggs: {
            total: {
              value_count: {field: 'admin.id'}
            }
          }
        }
      }
    }
  };

  if (queryParams.type !== 'all') {
    // Use post filter to not change the aggregations numbers
    searchOpts.body.post_filter = {
      term: {
        'type.base': TypeMapping.toInternal(queryParams.type)
      }
    };
  }

  if (queryParams.type === 'people') {
    searchOpts.body.aggs.people = {
      filter: {
        term: {'type.base': 'agent'}
      },
      aggs: {
        occupation: {
          // TODO create filter aggregation in here if the filter doens' belong to occupation then filter it!
          terms: {field: 'occupation'}
        },
        place_born: {
          terms: {field: 'lifecycle.birth.location.name.value'}
        },
        organisation: {
          terms: {field: 'type.sub_type'}
        }
      }
    };
  }

  elastic.search(searchOpts, (err, result) => {
    return next(err, result);
  });
};
