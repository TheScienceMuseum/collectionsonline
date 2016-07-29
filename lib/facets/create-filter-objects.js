/**
* Create an array of terms to filter objects in elasticsearch
*/
module.exports = function (queryParams) {
  var filters = [];
  // type
  filters.push({ term: {'type.base': 'object'} });

  // category
  const categories = queryParams.filter.objects.categories;
  if (categories) {
    filters.push({ terms: { 'categories.value': categories } });
  }
  // Date
  const dateFrom = queryParams.filter.objects.dateFrom;
  if (Object.prototype.toString.call(dateFrom) === '[object Date]') {
    if (!isNaN(dateFrom.getTime())) {
      filters.push({ range: { 'lifecycle.creation.date.latest': { 'gte': dateFrom.getFullYear() } } });
    }
  }

  const dateTo = queryParams.filter.objects.dateTo;
  if (Object.prototype.toString.call(dateTo) === '[object Date]') {
    if (!isNaN(dateTo.getTime())) {
      filters.push({ range: { 'lifecycle.creation.date.latest': { 'lte': dateTo.getFullYear() } } });
    }
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

  return {bool: {must: filters}};
};
