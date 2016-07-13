const unescapeCommas = require('../unescape-commas');
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
            must: filter(queryParams, 'occupation')
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
            must: filter(queryParams, 'birthPlace')
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
            must: filter(queryParams, 'organisations')
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

  return aggregationPeople;
};

function filter (queryParams, exclude) {
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

  return filters.map(unescapeCommas);
}
