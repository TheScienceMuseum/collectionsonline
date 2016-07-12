module.exports = function (queryParams) {
  const aggregationObjects = {
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
            must: filter(queryParams, 'category')
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
            must: filter(queryParams, 'maker')
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
            must: filter(queryParams, 'type')
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
            must: filter(queryParams, 'place')
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
            must: filter(queryParams, 'user')
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

  return aggregationObjects;
};

function filter (queryParams, exclude) {
  var filters = [];
  // category
  const categories = queryParams.filter.objects.categories;
  if (categories) {
    filters.push({ terms: { 'categories.value': categories } });
  }

  // maker
  const makers = queryParams.filter.objects.makers;
  if (makers) {
    filters.push({ terms: { 'lifecycle.creation.maker.name.value': makers } });
  }

  // type
  const type = queryParams.filter.objects.type;
  if (type) {
    filters.push({ terms: { 'name.value': type } });
  }

  // places
  const places = queryParams.filter.all.places;
  if (places) {
    filters.push({ terms: { 'lifecycle.creation.places.name.value': places } });
  }

  // user
  const user = queryParams.filter.objects.user;
  if (user) {
    filters.push({ terms: { 'agents.summary_title': user } });
  }

  return filters.map(el => {
    var filt = {
      terms: {}
    };
    if (el.terms && Array.isArray(el.terms[Object.keys(el.terms)[0]])) {
      filt.terms[Object.keys(el.terms)[0]] = el.terms[Object.keys(el.terms)[0]].map(el => {
        return el.replace(/\\,/g, ',');
      });
    }
    return filt;
  });
}
