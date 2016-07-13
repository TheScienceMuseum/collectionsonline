module.exports = function createPeopleFacets (results) {
  var occupationValues = [];
  results.aggregations.people.occupation.occupation_filters.buckets.forEach(value => {
    occupationValues.push({ value: value.key, count: value.doc_count });
  });

  var placeBorn = [];
  results.aggregations.people.place_born.place_born_filters.buckets.forEach(value => {
    placeBorn.push({ value: value.key, count: value.doc_count });
  });

  var organisation = [];
  results.aggregations.people.organisation.organisations_filters.buckets.forEach(value => {
    organisation.push({ value: value.key, count: value.doc_count });
  });

  return {
    occupation: occupationValues,
    place_born: placeBorn,
    organisation: organisation
  };
};
