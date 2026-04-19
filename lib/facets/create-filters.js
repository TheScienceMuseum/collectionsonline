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
      filters.push(caseInsensitiveTermFilter('category.name.keyword', e));
    });
  }

  // collection
  const collection = queryParams.filter.objects.collection;
  if (collection) {
    collection.forEach((e) => {
      filters.push({
        terms: {
          'cumulation.collector.summary.title.lower': [
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
        terms: {
          'fonds.summary.title.lower': [
            e,
            e.toLowerCase(),
            dashToSpace(e.toLowerCase())
          ]
        }
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
      filters.push(caseInsensitiveTermFilter('name.value.keyword', e));
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
      filters.push(caseInsensitiveTermFilter('occupation.value.keyword', e));
    });
  }

  // birth place
  const birthPlace = queryParams.filter.people.birthPlace;
  if (birthPlace) {
    birthPlace.forEach((e) => {
      filters.push({
        terms: {
          'birth.place.name.value.lower': [
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
      filters.push(caseInsensitiveTermFilter('material.value.keyword', e));
    });
  }

  // multi page hierarchy
  const mphc = queryParams.filter.objects.mphc;

  if (mphc) {
    mphc.forEach((e) => {
      filters.push({
        terms: { 'parent.@admin.uid': [e, dashToSpace(e)] }
      });
    });
  }

  // sub_group for Mimsy Group Records
  const subgroup = queryParams.filter.group.subgroup;
  if (subgroup) {
    subgroup.forEach((e) => {
      filters.push({
        terms: {
          'subgroup.summary.title.lower': [dashToSpace(e.toLowerCase())]
        }
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
  // Gallery filter takes precedence over museum filter.
  // Both location.name (old ES schema) and facility.name (new ES schema) are queried
  // with OR so that records indexed under either schema are matched.
  const museums = queryParams.filter.objects.museum || [];
  const galleries = queryParams.filter.objects.gallery || [];
  const locations = galleries.length > 0 ? galleries : museums;

  if (locations) {
    locations.forEach((e) => {
      filters.push(buildLocationFilter(e, dashToSpace));
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
    filters.push({ exists: { field: 'multimedia.@admin.source' } });
  }

  const hasRotational = queryParams.filter.all.hasRotational;
  if (hasRotational) {
    filters.push({ terms: { 'enhancement.web.platform.keyword': ['3D'] } });
  }

  return { bool: { filter: filters } };
};

// Case-sensitive keyword fields (no .lower normalizer) break when the URL case
// doesn't match the ES-stored case — e.g. "Make-up artist" vs "make-up artist",
// or categories like "Photographic Collections (railway)" vs "(Railway)". Using
// `term` with `case_insensitive: true` (ES 7.10+) lets ES compare case-insensitively.
// `terms` (plural) does not support `case_insensitive` in 7.17, so we wrap one
// `term` per candidate value in a bool.should. Two candidates cover the dash/space
// round-trip (e.g. "Rolls-Royce" vs "Rolls Royce" in stored data).
function caseInsensitiveTermFilter (field, value) {
  const candidates = [value];
  const spaced = dashToSpace(value);
  if (spaced !== value) candidates.push(spaced);
  return {
    bool: {
      should: candidates.map((v) => ({
        term: { [field]: { value: v, case_insensitive: true } }
      })),
      minimum_should_match: 1
    }
  };
}

function buildLocationFilter (location, dashToSpace) {
  const value = location.toLowerCase();
  const valueWithSpaces = dashToSpace(value);
  return {
    bool: {
      should: [
        {
          terms: {
            'location.name.value.lower': [value, valueWithSpaces]
          }
        },
        {
          terms: {
            'facility.name.value.lower': [value, valueWithSpaces]
          }
        }
      ]
    }
  };
}
