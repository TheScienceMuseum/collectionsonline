module.exports = function createAllFacets (results) {
  var categoryValues = [];
  results.aggregations.all.category.category_filters.buckets.forEach(value => {
    categoryValues.push({ value: value.key, count: value.doc_count });
  });

  var makerValues = [];
  results.aggregations.all.maker.maker_filters.buckets.forEach(value => {
    makerValues.push({ value: value.key, count: value.doc_count });
  });

  var typeValues = [];
  results.aggregations.all.type.type_filters.buckets.forEach(value => {
    typeValues.push({ value: value.key, count: value.doc_count });
  });

  var placeValues = [];
  results.aggregations.all.place.place_filters.buckets.forEach(value => {
    placeValues.push({ value: value.key, count: value.doc_count });
  });

  var userValues = [];
  results.aggregations.all.user.user_filters.buckets.forEach(value => {
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
