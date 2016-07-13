module.exports = function createObjectFacets (results) {
  var categoryValues = [];
  results.aggregations.objects.category.category_filters.buckets.forEach(value => {
    categoryValues.push({ value: value.key, count: value.doc_count });
  });

  var makerValues = [];
  results.aggregations.objects.maker.maker_filters.buckets.forEach(value => {
    makerValues.push({ value: value.key, count: value.doc_count });
  });

  var typeValues = [];
  results.aggregations.objects.type.type_filters.buckets.forEach(value => {
    typeValues.push({ value: value.key, count: value.doc_count });
  });

  var placeValues = [];
  results.aggregations.objects.place.place_filters.buckets.forEach(value => {
    placeValues.push({ value: value.key, count: value.doc_count });
  });

  var userValues = [];
  results.aggregations.objects.user.user_filters.buckets.forEach(value => {
    userValues.push({ value: value.key, count: value.doc_count });
  });

  return {
    category: categoryValues,
    maker: makerValues,
    type: typeValues,
    place: placeValues,
    user: userValues
  };
};
