/**
* Create an aggregation object for creating facets
*/
module.exports = function (queryParams) {
  const aggregationPeople = {
    filter: {
      term: {'type.base': 'agent'}
    },
    aggs: {
      occupation: {
        filter: {
          bool: {
            must: filter(queryParams)
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
            must: filter(queryParams)
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
            must: filter(queryParams)
          }
        },
        aggs: {
          organisations_filters: {
            terms: {field: 'type.sub_type'}
          }
        }
      },
      count: {
        filter: {
          bool: {
            must: filter(queryParams)
          }
        },
        aggs: {
          count_filters: {
            value_count: {field: 'admin.id'}
          }
        }
      }
    }
  };

  return aggregationPeople;
};

function filter (queryParams) {
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

  // birth date
  const birthDate = queryParams.filter.people.birthDate;
  if (Object.prototype.toString.call(birthDate) === '[object Date]') {
    if (!isNaN(birthDate.getTime())) {
      filters.push({ range: { 'lifecycle.birth.date.earliest': { 'gte': birthDate.getFullYear() } } });
    }
  }

  // death date
  const deathDate = queryParams.filter.people.deathDate;
  if (Object.prototype.toString.call(deathDate) === '[object Date]') {
    if (!isNaN(deathDate.getTime())) {
      filters.push({ range: { 'lifecycle.death.date.latest': { 'lte': deathDate.getFullYear() } } });
    }
  }
  return filters;
}
