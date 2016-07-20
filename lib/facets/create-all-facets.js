module.exports = function createAllFacets (results) {
  const a = results.aggregations.all;
  return {
    category: a.category.category_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    maker: a.maker.maker_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    type: a.type.type_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    place: a.place.place_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    user: a.user.user_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; })
  };
};
