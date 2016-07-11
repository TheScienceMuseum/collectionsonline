/**
* Create an array of terms for filter with elasticsearch
* [{terms: {'occupation': [val1, val2,...]}}, {...}]
*/
module.exports = function (queryParams) {
  var filters = [];
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

  const birthDate = queryParams.filter.people.birthDate;
  if (Object.prototype.toString.call(birthDate) === '[object Date]') {
    if (!isNaN(birthDate.getTime())) {
      filters.push({ range: { 'lifecycle.birth.date.earliest': { 'gte': birthDate.getFullYear() } } });
    }
  }

  const deathDate = queryParams.filter.people.deathDate;
  if (Object.prototype.toString.call(deathDate) === '[object Date]') {
    if (!isNaN(deathDate.getTime())) {
      filters.push({ range: { 'lifecycle.death.date.latest': { 'lte': deathDate.getFullYear() } } });
    }
  }

  return filters.map(el => {
    var filt = {
      terms: {}
    };
    if (el.terms && Array.isArray(el.terms[Object.keys(el.terms)[0]])) {
      filt.terms[Object.keys(el.terms)[0]] = el.terms[Object.keys(el.terms)[0]].map(el => {
        return el.replace(/\\,/g, ',');
      });
    }
    return filt;
  });
};
