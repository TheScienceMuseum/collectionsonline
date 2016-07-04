const TypeMapping = require('./type-mapping');
/**
* Search with aggregations
* The total aggregation is a filter bucket. It exclude data which are not an agents archives or objects
* @param {Object} elastic - the elasticsearch client
* @param {Object} requrest - the request Object
* @param {Function} next - the callback with error and response as parameters
*/
module.exports = (elastic, request, next) => {
  const pageNumber = request.query['page[number]'] || 0;
  const pageSize = request.query['page[size]'] || 50;

  const searchOpts = {
    index: 'smg',
    from: pageNumber * pageSize,
    size: pageSize,
    body: {
      query: {
        multi_match: {
          query: request.query.q,
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

  if (request.params.type) {
    // Use post filter to not change the aggregations numbers
    searchOpts.body.post_filter = {
      term: {
        'type.base': TypeMapping.toInternal(request.params.type)
      }
    };
    // Params type filter trumps query type filter
    request.query['filter[type]'] = request.params.type;
  }

  elastic.search(searchOpts, (err, result) => {
    return next(err, result);
  });
};
