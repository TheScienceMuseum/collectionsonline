module.exports = function (queryParams, filterType) {
  var filters = [];
  // type
  if (filterType) {
    filters.push({ term: {'type.base': filterType} });
  }

  // category
  const categories = queryParams.filter.objects.categories;
  if (categories) {
    categories.forEach(e => {
      filters.push({ terms: { 'categories.name': [e] } });
    });
  }

  // archive
  const archive = queryParams.filter.documents.archive;
  if (archive) {
    archive.forEach(e => {
      filters.push({ terms: {'fonds.summary_title': [e]} });
    });
  }

  // maker
  const makers = queryParams.filter.objects.makers;
  if (makers) {
    makers.forEach(e => {
      filters.push({ terms: { 'lifecycle.creation.maker.summary_title': [e] } });
    });
  }

  // type
  const type = queryParams.filter.objects.type;
  if (type) {
    type.forEach(e => {
      filters.push({ terms: { 'name.value_lower': [e] } });
    });
  }

  // places
  const places = queryParams.filter.all.places;
  if (places) {
    places.forEach(e => {
      filters.push({ terms: { 'lifecycle.creation.places.summary_title': [e] } });
    });
  }

  // user
  const user = queryParams.filter.objects.user;
  if (user) {
    user.forEach(e => {
      filters.push({ terms: { 'agents.summary_title': [e] } });
    });
  }

  // occupation
  const occupation = queryParams.filter.people.occupation;
  if (occupation) {
    occupation.forEach(e => {
      filters.push({ terms: { 'occupation': [e] } });
    });
  }

  // birth place
  const birthPlace = queryParams.filter.people.birthPlace;
  if (birthPlace) {
    birthPlace.forEach(e => {
      filters.push({ terms: { 'lifecycle.birth.location.name.value': [e] } });
    });
  }

  // organisation
  const organisations = queryParams.filter.people.organisations;
  if (organisations) {
    organisations.forEach(e => {
      filters.push({ terms: {'type.sub_type': [e]} });
    });
  }

  // Date
  const filterDate = {bool: {should: []}};

  const dateFrom = queryParams.filter.objects.dateFrom;
  const birthDate = queryParams.filter.people.birthDate;

  if (dateFrom && filterType !== 'agent' && !(isNaN(dateFrom))) {
    filterDate.bool.should.push({ range: { 'lifecycle.creation.date.latest': { 'gte': dateFrom.getFullYear() } } });
  } else if (dateFrom && filterType === 'agent' && !(isNaN(dateFrom))) {
    filterDate.bool.should.push({ range: { 'lifecycle.birth.date.earliest': { 'gte': dateFrom.getFullYear() } } });
  } else if (birthDate && !isNaN(birthDate)) {
    filterDate.bool.should.push({ range: { 'lifecycle.birth.date.earliest': { 'gte': birthDate.getFullYear() } } });
  }

  const dateTo = queryParams.filter.objects.dateTo;
  const deathDate = queryParams.filter.people.deathDate;

  if (dateTo && filterType !== 'agent' && !(isNaN(dateTo))) {
    filterDate.bool.should.push({ range: { 'lifecycle.creation.date.latest': { 'lte': dateTo.getFullYear() } } });
  } else if (dateTo && filterType === 'agent' && !(isNaN(dateTo))) {
    filterDate.bool.should.push({ range: { 'lifecycle.death.date.latest': { 'lte': dateTo.getFullYear() } } });
  } else if (deathDate && !isNaN(deathDate)) {
    filterDate.bool.should.push({ range: { 'lifecycle.death.date.latest': { 'lte': deathDate.getFullYear() } } });
  }

  if (filterDate.bool.should.length > 0) {
    filters.push(filterDate);
  }

  // materials
  const material = queryParams.filter.objects.material;
  if (material) {
    material.forEach(e => {
      filters.push({ terms: { 'materials': [e] } });
    });
  }

  // locations
  const museums = queryParams.filter.objects.museum || [];
  const galleries = queryParams.filter.objects.gallery || [];
  const locations = museums.concat(galleries);

  if (locations) {
    locations.forEach(e => {
      filters.push({ terms: { 'locations.name.value': [e] } });
    });
  }

  return {bool: {must: filters}};
};
