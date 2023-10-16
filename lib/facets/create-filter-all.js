/**
* Create an array of terms to filter objects in elasticsearch
*/
module.exports = function (queryParams, filters) {
  const categories = selectedFiltersCategories(queryParams);
  const result = {
    bool: {
      must: [
        { terms: { 'type.base': categories } }
      ]
    }
  };
  result.bool.must = result.bool.must.concat(
    removeFilterType(filters.people),
    removeFilterType(filters.objects),
    removeFilterType(filters.documents)
  );

  return result;
};

function removeFilterType (filters) {
  if (filters.bool.must) {
    return filters.bool.must.filter(el => {
      return !el.term;
    });
  }
}

function selectedFiltersCategories (queryParams) {
  let categories = [];
  if (hasFilters(queryParams.filter.people)) {
    categories.push('agent');
  }

  if (hasFilters(queryParams.filter.objects)) {
    categories.push('object');
  }

  if (hasFilters(queryParams.filter.documents)) {
    categories.push('archive');
  }

  // if non of the filters are selected select all the type by default
  if (!categories.length) {
    categories = ['agent', 'object', 'archive'];
  }
  return categories;
}

function hasFilters (params) {
  let result = false;
  Object.keys(params).forEach(function (key) {
    if (params[key]) {
      result = true;
    }
  });
  return result;
}
