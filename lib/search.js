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
      bool: {
        must: [
          { term: {'type.base': TypeMapping.toInternal(queryParams.type)} }
        ]
      }
    };
  }

  if (queryParams.type === 'people') {
    const filtersPeople = createFiltersPeople(queryParams);
    searchOpts.body.post_filter.bool.must = searchOpts.body.post_filter.bool.must.concat(filtersPeople);
    searchOpts.body.aggs.people = {
      filter: {
        term: {'type.base': 'agent'}
      },
      aggs: {
        occupation: {
          filter: {
            bool: {
              must: createFilterPeopleAggs(queryParams, 'occupation')
            }
          },
          aggs: {
            occupation_filters: {
              terms: {field: 'occupation'}
            }
          }
        },
        place_born: {
          filter: {
            bool: {
              must: createFilterPeopleAggs(queryParams, 'birthPlace')
            }
          },
          aggs: {
            place_born_filters: {
              terms: {field: 'lifecycle.birth.location.name.value'}
            }
          }
        },
        organisation: {
          filter: {
            bool: {
              must: createFilterPeopleAggs(queryParams, 'organisations')
            }
          },
          aggs: {
            organisations_filters: {
              terms: {field: 'type.sub_type'}
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

/**
* Create an array of terms for filter with elasticsearch
* [{terms: {'occupation': [val1, val2,...]}}, {...}]
* TODO add birth date and death date filters
*/
function createFiltersPeople (queryParams) {
  var filters = [];
  // occupation
  const occupation = queryParams.filter.people.occupation;
  if (occupation) {
    filters.push({ terms: { 'occupation': occupation } });
  }
  // birth place
  const birthPlace = queryParams.filter.people.birthPlace;
  if (birthPlace) {
    filters.push({ terms: { 'lifecycle.birth.location.name.value': birthPlace } });
  }
  // organisation
  const organisations = queryParams.filter.people.organisations;
  if (organisations) {
    filters.push({ terms: {'type.sub_type': organisations} });
  }
  return filters;
}

function createFilterPeopleAggs (queryParams, exclude) {
  var filters = [];
  if (exclude !== 'occupation') {
    const occupation = queryParams.filter.people.occupation;
    if (occupation) {
      filters.push({ terms: { 'occupation': occupation } });
    }
  }

  // birth place
  if (exclude !== 'birthPlace') {
    const birthPlace = queryParams.filter.people.birthPlace;
    if (birthPlace) {
      filters.push({ terms: { 'lifecycle.birth.location.name.value': birthPlace } });
    }
  }

  // organisation
  if (exclude !== 'organisations') {
    const organisations = queryParams.filter.people.organisations;
    if (organisations) {
      filters.push({ terms: {'type.sub_type': organisations} });
    }
  }
  return filters;
}
