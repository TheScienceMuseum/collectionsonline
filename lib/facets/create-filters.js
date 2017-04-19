var dashToSpace = require('../helpers/dash-to-space.js');

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
      filters.push({ terms: { 'categories.name': [e, dashToSpace(e)] } });
    });
  }

  // archive
  const archive = queryParams.filter.documents.archive;
  if (archive) {
    archive.forEach(e => {
      filters.push({ terms: {'fonds.summary_title': [e, dashToSpace(e)]} });
    });
  }

  // maker
  const makers = queryParams.filter.objects.makers;
  if (makers) {
    makers.forEach(e => {
      filters.push({ terms: { 'lifecycle.creation.maker.summary_title_lower': [e.toLowerCase(), dashToSpace(e.toLowerCase())] } });
    });
  }

  // type
  const objectType = queryParams.filter.objects.object_type;
  if (objectType) {
    objectType.forEach(e => {
      filters.push({ terms: { 'name.value_lower': [e.toLowerCase(), dashToSpace(e.toLowerCase())] } });
    });
  }

  // places
  const places = queryParams.filter.all.places;
  if (places) {
    places.forEach(e => {
      filters.push({ terms: { 'lifecycle.creation.places.summary_title_lower': [e.toLowerCase(), dashToSpace(e.toLowerCase())] } });
    });
  }

  // user
  const user = queryParams.filter.objects.user;
  if (user) {
    user.forEach(e => {
      filters.push({ terms: { 'agents.summary_title_lower': [e.toLowerCase(), dashToSpace(e.toLowerCase())] } });
    });
  }

  // occupation
  const occupation = queryParams.filter.people.occupation;
  if (occupation) {
    occupation.forEach(e => {
      filters.push({ terms: { 'occupation': [e, dashToSpace(e)] } });
    });
  }

  // birth place
  const birthPlace = queryParams.filter.people.birthPlace;
  if (birthPlace) {
    birthPlace.forEach(e => {
      filters.push({ terms: { 'lifecycle.birth.location.name.value_lower': [e.toLowerCase(), dashToSpace(e.toLowerCase())] } });
    });
  }

  // organisation
  const organisations = queryParams.filter.people.organisations;
  if (organisations) {
    organisations.forEach(e => {
      filters.push({ terms: {'type.sub_type': [e, dashToSpace(e)]} });
    });
  }

  // Date
  var filterDate = {bool: {must: []}};

  const dateFrom = queryParams.filter.objects.dateFrom;
  const dateTo = queryParams.filter.objects.dateTo;

  if (dateFrom && !(isNaN(dateFrom))) {
    if (dateTo) {
      filterDate.bool.must.push({ or: [ { range: { 'lifecycle.death.date.latest': { 'gte': dateFrom } } }, { range: { 'lifecycle.creation.date.latest': { 'gte': dateFrom } } } ] });
    } else {
      filterDate.bool.must.push({ or: [ { range: { 'lifecycle.birth.date.latest': { 'gte': dateFrom } } }, { range: { 'lifecycle.creation.date.latest': { 'gte': dateFrom } } } ] });
    }
  }

  if (dateTo && !(isNaN(dateTo))) {
    if (dateFrom) {
      filterDate.bool.must.push({ or: [ { range: { 'lifecycle.birth.date.latest': { 'lte': dateTo } } }, { range: { 'lifecycle.creation.date.latest': { 'lte': dateTo } } } ] });
    } else {
      filterDate.bool.must.push({ or: [ { range: { 'lifecycle.death.date.latest': { 'lte': dateTo } } }, { range: { 'lifecycle.creation.date.latest': { 'lte': dateTo } } } ] });
    }
  }

  if (filterDate.bool.must.length > 0) {
    filters.push(filterDate);
  }

  // materials
  const material = queryParams.filter.objects.material;
  if (material) {
    material.forEach(e => {
      filters.push({ terms: { 'materials': [e, dashToSpace(e)] } });
    });
  }

  // locations
  const museums = queryParams.filter.objects.museum || [];
  const galleries = queryParams.filter.objects.gallery || [];
  const locations = museums.concat(galleries);

  if (locations) {
    locations.forEach(e => {
      filters.push({ terms: { 'locations.name.value_lower': [e.toLowerCase(), dashToSpace(e.toLowerCase())] } });
    });
  }

  // image license
  const imageLicense = queryParams.filter.all.imageLicense;
  if (imageLicense) {
    filters.push({ exists: { field: 'multimedia.source.legal.rights.usage_terms' } });
  }

  const hasImage = queryParams.filter.all.hasImage;
  if (hasImage) {
    filters.push({ exists: { field: 'multimedia.publish' } });
  }

  return {bool: {must: filters}};
};
