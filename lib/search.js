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

  /**
  * Objects aggregations
  */
  if (queryParams.type === 'objects') {
    searchOpts.body.aggs.objects = {
      filter: {
        term: {'type.base': 'object'}
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
        },
        type: {
          filter: {
            bool: {
              must: []
            }
          },
          aggs: {
            type_filters: {
              terms: { field: 'name.value' }
            }
          }
        },
        place: {
          filter: {
            bool: {
              must: []
            }
          },
          aggs: {
            place_filters: {
              terms: { field: 'lifecycle.creation.places.name.value' }
            }
          }
        },
        user: {
          filter: {
            bool: {
              must: []
            }
          },
          aggs: {
            user_filters: {
              terms: { field: 'agents.summary_title' }
            }
          }
        }
      }
    };
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

  const birthDate = queryParams.filter.people.birthDate;
  if (Object.prototype.toString.call(birthDate) === '[object Date]') {
    if (!isNaN(birthDate.getTime())) {
      filters.push({ range: { 'lifecycle.birth.date.earliest': { 'gte': birthDate.getFullYear() } } });
    }
  }

  const deathDate = queryParams.filter.people.deathDate;
  if (Object.prototype.toString.call(deathDate) === '[object Date]') {
    if (!isNaN(deathDate.getTime())) {
      filters.push({ range: { 'lifecycle.death.date.latest': { 'lte': deathDate.getFullYear() } } });
    }
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

  // birthDate
  if (exclude !== 'birthDate') {
    const birthDate = queryParams.filter.people.birthDate;
    if (Object.prototype.toString.call(birthDate) === '[object Date]') {
      if (!isNaN(birthDate.getTime())) {
        filters.push({ range: { 'lifecycle.birth.date.earliest': { 'gte': birthDate.getFullYear() } } });
      }
    }
  }

  if (exclude !== 'deathDate') {
    const deathDate = queryParams.filter.people.deathDate;
    if (Object.prototype.toString.call(deathDate) === '[object Date]') {
      if (!isNaN(deathDate.getTime())) {
        filters.push({ range: { 'lifecycle.death.date.latest': { 'lte': deathDate.getFullYear() } } });
      }
    }
  }

  return filters;
}
