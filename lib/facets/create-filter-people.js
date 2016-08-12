/**
* Create an array of terms for filter with elasticsearch
* [{terms: {'occupation': [val1, val2,...]}}, {...}]
*/
module.exports = function (queryParams) {
  var filters = [];
  // type
  filters.push({ term: {'type.base': 'agent'} });
  // occupation
  const occupation = queryParams.filter.people.occupation;
  if (occupation) {
    filters.push({ terms: { 'occupation': occupation } });
  }
  // birth place
  const birthPlace = queryParams.filter.people.birthPlace;
  if (birthPlace) {
    filters.push({ terms: { 'lifecycle.birth.location.name.value': birthPlace } });
  }
  // organisation
  const organisations = queryParams.filter.people.organisations;
  if (organisations) {
    filters.push({ terms: {'type.sub_type': organisations} });
  }

  const filterDate = {bool: {should: []}};
  const birthDate = queryParams.filter.people.birthDate;
  if (Object.prototype.toString.call(birthDate) === '[object Date]') {
    if (!isNaN(birthDate.getTime())) {
      filterDate.bool.should.push({ range: { 'lifecycle.birth.date.earliest': { 'gte': birthDate.getFullYear() } } });
    }
  }

  const deathDate = queryParams.filter.people.deathDate;
  if (Object.prototype.toString.call(deathDate) === '[object Date]') {
    if (!isNaN(deathDate.getTime())) {
      filterDate.bool.should.push({ range: { 'lifecycle.death.date.latest': { 'lte': deathDate.getFullYear() } } });
    }
  }
  if (filterDate.bool.should.length > 0) {
    filters.push(filterDate);
  }
  return {bool: {must: filters}};
};
