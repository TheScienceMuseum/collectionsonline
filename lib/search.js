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
    from: pageNumber * pageSize,
    size: pageSize,
    body: {
      query: {
        multi_match: {
          query: queryParams.q,
          type: 'cross_fields',
          fields: [
            'name.value_text',
            'title.value_text',
            'summary_title_text',
            'note.value',
            'description.value'
          ]
        }
      },
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
    // Params type filter trumps query type filter
    // request.query['filter[type]'] = queryParams.type;
  }

  elastic.search(searchOpts, (err, result) => {
    return next(err, result);
  });
};
