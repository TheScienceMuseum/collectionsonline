module.exports = function createAllFacets (results) {
  const a = results.aggregations.all || results.aggregations.people || results.aggregations.objects || results.aggregations.documents;
  return {
    category: a.category.category_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    maker: a.maker.maker_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    type: a.type.type_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    place: a.place.place_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    user: a.user.user_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    archive: a.archive.archive_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    occupation: a.occupation.occupation_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    place_born: a.place_born.place_born_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    organisation: a.organisation.organisations_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    material: a.material.material_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; })
  };
};
