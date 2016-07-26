/**
* Create an array of terms to filter objects in elasticsearch
*/
module.exports = function (queryParams, filters) {
  const categories = selectedFiltersCategories(queryParams);
  var result = {
    bool: {
      must: [{terms: {'type.base': categories}}],
      should: [
        filters.people,
        filters.objects,
        filters.documents
      ]
    }
  };
  return result;
};

function selectedFiltersCategories (queryParams) {
  var categories = [];
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
  var result = false;
  Object.keys(params).forEach(function (key) {
    if (params[key]) {
      result = true;
    }
  });
  return result;
}
