module.exports = function (queryParams, filterType) {
  var filters = [];
  // type
  filters.push({ term: {'type.base': filterType} });

  // category
  const categories = queryParams.filter.objects.categories;
  if (categories) {
    filters.push({ terms: { 'categories.name': categories } });
  }
  // Date
  const filterDate = {bool: {should: []}};

  const dateFrom = queryParams.filter.objects.dateFrom;
  const birthDate = queryParams.filter.people.birthDate;
  if (filterType !== 'agent' && Object.prototype.toString.call(dateFrom) === '[object Date]') {
    if (!isNaN(dateFrom.getTime())) {
      filterDate.bool.should.push({ range: { 'lifecycle.creation.date.latest': { 'gte': dateFrom.getFullYear() } } });
    }
  } else if (filterType === 'agent' && Object.prototype.toString.call(birthDate) === '[object Date]') {
    if (!isNaN(birthDate.getTime())) {
      filterDate.bool.should.push({ range: { 'lifecycle.birth.date.earliest': { 'gte': birthDate.getFullYear() } } });
    }
  }

  const dateTo = queryParams.filter.objects.dateTo;
  const deathDate = queryParams.filter.people.deathDate;
  if (filterType !== 'agent' && Object.prototype.toString.call(dateTo) === '[object Date]') {
    if (!isNaN(dateTo.getTime())) {
      filterDate.bool.should.push({ range: { 'lifecycle.creation.date.latest': { 'lte': dateTo.getFullYear() } } });
    }
  } else if (filterType === 'agent' && Object.prototype.toString.call(deathDate) === '[object Date]') {
    if (!isNaN(deathDate.getTime())) {
      filterDate.bool.should.push({ range: { 'lifecycle.death.date.latest': { 'lte': deathDate.getFullYear() } } });
    }
  }

  if (filterDate.bool.should.length > 0) {
    filters.push(filterDate);
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

  // archive
  const archive = queryParams.filter.documents.archive;
  if (archive) {
    filters.push({ terms: {'fonds.summary_title': archive} });
  }

  // materials
  const material = queryParams.filter.objects.material;
  if (material) {
    material.forEach(e => {
      filters.push({ terms: { 'materials': [e] } });
    });
  }

  return {bool: {must: filters}};
};
