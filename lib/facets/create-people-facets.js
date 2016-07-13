module.exports = function createPeopleFacets (results) {
  const p = results.aggregations.people;
  return {
    occupation: p.occupation.occupation_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    place_born: p.place_born.place_born_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    organisation: p.organisation.organisations_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; })
  };
};
