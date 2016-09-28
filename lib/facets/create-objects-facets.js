module.exports = function createObjectFacets (results) {
  const o = results.aggregations.objects;
  return {
    category: o.category.category_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    maker: o.maker.maker_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    type: o.type.type_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    place: o.place.place_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    user: o.user.user_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    material: o.material.material_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; })
  };
};
