module.exports = function (queryParams) {
  const aggregationObjects = {
    filter: {
      term: {'type.base': 'object'}
    },
    aggs: {
      category: {
        filter: {
          bool: {
            must: filter(queryParams)
          }
        },
        aggs: {
          category_filters: {
            terms: { field: 'categories.name' }
          }
        }
      },
      maker: {
        filter: {
          bool: {
            must: filter(queryParams)
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
            must: filter(queryParams)
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
            must: filter(queryParams)
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
            must: filter(queryParams)
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

function filter (queryParams) {
  var filters = [];
  // category
  const categories = queryParams.filter.objects.categories;
  if (categories) {
    filters.push({ terms: { 'categories.name': categories } });
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

  const filterDate = {bool: {should: []}};
  const dateFrom = queryParams.filter.objects.dateFrom;
  if (Object.prototype.toString.call(dateFrom) === '[object Date]') {
    if (!isNaN(dateFrom.getTime())) {
      filterDate.bool.should.push({ range: { 'lifecycle.creation.date.latest': { 'gte': dateFrom.getFullYear() } } });
    }
  }

  const dateTo = queryParams.filter.objects.dateTo;
  if (Object.prototype.toString.call(dateTo) === '[object Date]') {
    if (!isNaN(dateTo.getTime())) {
      filterDate.bool.should.push({ range: { 'lifecycle.creation.date.latest': { 'lte': dateTo.getFullYear() } } });
    }
  }

  if (filterDate.bool.should.length > 0) {
    filters.push(filterDate);
  }

  // user
  const user = queryParams.filter.objects.user;
  if (user) {
    filters.push({ terms: { 'agents.summary_title': user } });
  }

  return filters;
}
