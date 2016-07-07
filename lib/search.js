const TypeMapping = require('./type-mapping');
const createFiltersPeople = require('./facets/create-filter-people');
const createFiltersObjects = require('./facets/create-filter-objects');
const aggregationPeople = require('./facets/aggs-people');
const aggregationObjects = require('./facets/aggs-objects');
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

  /**
  * Post filter the values depending of the category
  */
  if (queryParams.type !== 'all') {
    // Use post filter to not change the aggregations numbers
    searchOpts.body.post_filter = {
      bool: {
        must: [
          { term: {'type.base': TypeMapping.toInternal(queryParams.type)} }
        ]
      }
    };
  }

  /**
  * All aggregations
  */
  if (queryParams.type === 'all') {
    searchOpts.body.aggs.all = {
      filter: {
        bool: {
          should: [
            { term: {'type.base': 'agent'} },
            { term: {'type.base': 'object'} },
            { term: {'type.base': 'archive'} }
          ]
        }
      },
      aggs: {
        category: {
          filter: {
            bool: {
              must: []
            }
          },
          aggs: {
            category_filters: {
              terms: { field: 'categories.value' }
            }
          }
        },
        maker: {
          filter: {
            bool: {
              must: []
            }
          },
          aggs: {
            maker_filters: {
              terms: { field: 'lifecycle.creation.maker.name.value' }
            }
          }
        }
      }
    };
  }

  /**
  * People Aggregations
  */
  if (queryParams.type === 'people') {
    /**
    * build the filter depending on the filters selected
    */
    const filtersPeople = createFiltersPeople(queryParams);
    searchOpts.body.post_filter.bool.must = searchOpts.body.post_filter.bool.must.concat(filtersPeople);
    searchOpts.body.aggs.people = aggregationPeople(queryParams);
  }

  /**
  * Objects aggregations
  */
  if (queryParams.type === 'objects') {
    const filtersObjects = createFiltersObjects(queryParams);
    searchOpts.body.post_filter.bool.must = searchOpts.body.post_filter.bool.must.concat(filtersObjects);
    searchOpts.body.aggs.objects = aggregationObjects(queryParams);
  }

  /**
  * Documents aggregation
  */
  if (queryParams.type === 'documents') {
    searchOpts.body.aggs.documents = {
      filter: {
        term: {'type.base': 'archive'}
      },
      aggs: {
        archive: {
          filter: {
            bool: {
              must: []
            }
          },
          aggs: {
            archive_filters: {
              terms: { field: 'fonds.summary_title' }
            }
          }
        },
        organisation: {
          filter: {
            bool: {
              must: []
            }
          },
          aggs: {
            organisation_filters: {
              terms: { field: 'organisations.name.value' }
            }
          }
        }
      }
    };
  }

  elastic.search(searchOpts, (err, result) => {
    return next(err, result);
  });
};
