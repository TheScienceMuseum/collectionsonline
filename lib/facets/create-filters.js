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
      filters.push({ terms: { 'categories.name_lower': [e, e.toLowerCase(), dashToSpace(e)] } });
    });
  }

  // archive
  const archive = queryParams.filter.documents.archive;
  if (archive) {
    archive.forEach(e => {
      filters.push({ terms: {'fonds.summary_title.keyword': [e, dashToSpace(e)]} });
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
      filters.push({ terms: { 'occupation.keyword': [e, dashToSpace(e)] } });
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
  var filterDate = {bool: {should: []}};

  const dateFrom = queryParams.filter.objects.dateFrom;
  const dateTo = queryParams.filter.objects.dateTo;

  // object dates
  var objectDateFilter = {bool: {filter: []}};
  if ((dateFrom && !(isNaN(dateFrom))) && (dateTo && !(isNaN(dateTo)))) {
    objectDateFilter.bool.filter.push(
      { range: { 'lifecycle.creation.date.earliest': { 'gte': dateFrom } } },
      { range: { 'lifecycle.creation.date.latest': { 'lte': dateTo } } }
    );
  } else if (dateFrom && !(isNaN(dateFrom))) {
    objectDateFilter.bool.filter.push(
      { range: { 'lifecycle.creation.date.earliest': { 'gte': dateFrom } } }
    );
  } else if (dateTo && !(isNaN(dateTo))) {
    objectDateFilter.bool.filter.push(
      { range: { 'lifecycle.creation.date.latest': { 'lte': dateTo } } }
    );
  }
  if (objectDateFilter.bool.filter.length > 0) {
    filterDate.bool.should.push(objectDateFilter);
  }

  // agent dates
  var agentDateFilter = {bool: {filter: []}};
  if ((dateFrom && !(isNaN(dateFrom))) && (dateTo && !(isNaN(dateTo)))) {
    agentDateFilter.bool.filter.push(
      { range: { 'lifecycle.birth.date.earliest': { 'gte': dateFrom } } },
      { range: { 'lifecycle.birth.date.latest': { 'lte': dateTo } } }
    );
  } else if (dateFrom && !(isNaN(dateFrom))) {
    agentDateFilter.bool.filter.push(
      { range: { 'lifecycle.birth.date.earliest': { 'gte': dateFrom } } }
    );
  } else if (dateTo && !(isNaN(dateTo))) {
    agentDateFilter.bool.filter.push(
      { range: { 'lifecycle.birth.date.latest': { 'lte': dateTo } } }
    );
  }
  if (agentDateFilter.bool.filter.length > 0) {
    filterDate.bool.should.push(agentDateFilter);
  }

  // add object and agent date queries to main query
  if (filterDate.bool.should.length > 0) {
    filters.push(filterDate);
  }

  // materials
  const material = queryParams.filter.objects.material;
  if (material) {
    material.forEach(e => {
      filters.push({ terms: { 'materials.keyword': [e, dashToSpace(e)] } });
    });
  }

  // imgtag
  const imgtag = queryParams.filter.objects.imgtag;
  if (imgtag) {
    imgtag.forEach(e => {
      filters.push({ terms: { 'multimedia.enhancement.rekognition.labels.value': [e, dashToSpace(e)] } });
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
