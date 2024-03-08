const dashToSpace = require('../helpers/dash-to-space.js');

module.exports = function (queryParams, filterType) {
  const filters = [];
  // type
  if (filterType) {
    filters.push({ term: { '@datatype.base': filterType } });
  }

  // category
  const categories = queryParams.filter.objects.categories;
  if (categories) {
    categories.forEach((e) => {
      filters.push({
        terms: {
          'category.name.keyword': [e, e.toLowerCase(), dashToSpace(e)]
        }
      });
    });
  }

  // collection
  const collection = queryParams.filter.objects.collection;
  if (collection) {
    collection.forEach((e) => {
      filters.push({
        terms: {
          'cumulation.collector.summary.title.keyword': [
            e,
            e.toLowerCase(),
            dashToSpace(e)
          ]
        }
      });
    });
  }

  // archive
  const archive = queryParams.filter.documents.archive;
  if (archive) {
    archive.forEach((e) => {
      filters.push({
        terms: { 'fonds.summary_title.keyword': [e, dashToSpace(e)] }
      });
    });
  }

  // maker
  const makers = queryParams.filter.objects.makers;
  if (makers) {
    makers.forEach((e) => {
      filters.push({
        terms: {
          'creation.maker.summary.title.lower': [
            e,
            e.toLowerCase(),
            dashToSpace(e.toLowerCase())
          ]
        }
      });
    });
  }

  // type
  const objectType = queryParams.filter.objects.object_type;
  if (objectType) {
    objectType.forEach((e) => {
      filters.push({
        terms: {
          'name.value.keyword': [e.toLowerCase(), dashToSpace(e.toLowerCase())]
        }
      });
    });
  }

  // places
  const places = queryParams.filter.all.places;
  if (places) {
    places.forEach((e) => {
      filters.push({
        terms: {
          'creation.place.summary.title.lower': [
            e.toLowerCase(),
            dashToSpace(e.toLowerCase())
          ]
        }
      });
    });
  }

  // user
  const user = queryParams.filter.objects.user;
  if (user) {
    user.forEach((e) => {
      filters.push({
        terms: {
          'agent.summary.title.lower': [
            e.toLowerCase(),
            dashToSpace(e.toLowerCase())
          ]
        }
      });
    });
  }

  // occupation
  const occupation = queryParams.filter.people.occupation;
  if (occupation) {
    occupation.forEach((e) => {
      filters.push({
        terms: { 'occupation.value.keyword': [e, dashToSpace(e)] }
      });
    });
  }

  // birth place
  const birthPlace = queryParams.filter.people.birthPlace;
  if (birthPlace) {
    birthPlace.forEach((e) => {
      filters.push({
        terms: {
          'birth.location.name.value.lower': [
            e.toLowerCase(),
            dashToSpace(e.toLowerCase())
          ]
        }
      });
    });
  }

  // organisation
  const organisations = queryParams.filter.people.organisations;
  if (organisations) {
    organisations.forEach((e) => {
      filters.push({
        terms: {
          '@datatype.actual': [
            e,
            e.toLowerCase(),
            dashToSpace(e.toLowerCase())
          ]
        }
      });
    });
  }

  // Date
  const filterDate = { bool: { should: [] } };

  const dateFrom = queryParams.filter.objects.dateFrom;
  const dateTo = queryParams.filter.objects.dateTo;

  // object dates
  const objectDateFilter = { bool: { filter: [] } };
  if (dateFrom && !isNaN(dateFrom) && dateTo && !isNaN(dateTo)) {
    objectDateFilter.bool.filter.push(
      { range: { 'creation.date.from': { gte: dateFrom } } },
      { range: { 'creation.date.to': { lte: dateTo } } }
    );
  } else if (dateFrom && !isNaN(dateFrom)) {
    objectDateFilter.bool.filter.push({
      range: { 'creation.date.from': { gte: dateFrom } }
    });
  } else if (dateTo && !isNaN(dateTo)) {
    objectDateFilter.bool.filter.push({
      range: { 'creation.date.to': { lte: dateTo } }
    });
  }
  if (objectDateFilter.bool.filter.length > 0) {
    filterDate.bool.should.push(objectDateFilter);
  }

  // agent dates
  const agentDateFilter = { bool: { filter: [] } };
  if (dateFrom && !isNaN(dateFrom) && dateTo && !isNaN(dateTo)) {
    agentDateFilter.bool.filter.push(
      { range: { 'birth.date.from': { gte: dateFrom } } },
      { range: { 'birth.date.to': { lte: dateTo } } }
    );
  } else if (dateFrom && !isNaN(dateFrom)) {
    agentDateFilter.bool.filter.push({
      range: { 'birth.date.from': { gte: dateFrom } }
    });
  } else if (dateTo && !isNaN(dateTo)) {
    agentDateFilter.bool.filter.push({
      range: { 'birth.date.to': { lte: dateTo } }
    });
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
    material.forEach((e) => {
      filters.push({
        terms: { 'material.value.keyword': [e, dashToSpace(e)] }
      });
    });
  }

  // multi page hierarchy
  const mphc = queryParams.filter.objects.mphc;

  // console.log(queryParams.filter.objects, 'checking her');

  if (mphc) {
    mphc.forEach((e) => {
      filters.push({
        terms: { 'parent.@admin.uid': [e, dashToSpace(e)] }
      });
    });
  }

  // imgtag
  const imgtag = queryParams.filter.objects.imgtag;
  if (imgtag) {
    imgtag.forEach((e) => {
      filters.push({
        terms: {
          'multimedia.enhancement.rekognition.labels.value': [
            e,
            dashToSpace(e)
          ]
        }
      });
    });
  }

  // locations
  const museums = queryParams.filter.objects.museum || [];
  const galleries = queryParams.filter.objects.gallery || [];
  const locations = galleries.length > 0 ? galleries : museums;

  if (locations) {
    locations.forEach((e) => {
      filters.push({
        terms: {
          'facility.name.value.lower': [
            e.toLowerCase(),
            dashToSpace(e.toLowerCase())
          ]
        }
      });
    });
  }

  // image license
  const imageLicense = queryParams.filter.all.imageLicense;
  if (imageLicense) {
    filters.push({
      exists: { field: 'multimedia.legal.rights.licence' }
    });
  }

  const hasImage = queryParams.filter.all.hasImage;
  if (hasImage) {
    filters.push({ exists: { field: 'multimedia.publish' } });
  }

  const hasRotational = queryParams.filter.all.hasRotational;
  if (hasRotational) {
    filters.push({ terms: { 'enhancement.web.platform.keyword': ['3D'] } });
  }

  return { bool: { must: filters } };
};
