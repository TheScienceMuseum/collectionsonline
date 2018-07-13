const fs = require('fs');
const path = require('path');
const galleries = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/galleries.json')));

module.exports = function createAllFacets (results) {
  const a = results.aggregations.all || results.aggregations.people || results.aggregations.objects || results.aggregations.documents;
  return {
    category: a.category.category_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    maker: a.maker.maker_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    object_type: a.object_type.object_type_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    place: a.place.place_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    user: a.user.user_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    archive: a.archive.archive_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    occupation: a.occupation.occupation_filters.buckets
      .map(v => { return {value: v.key, count: v.doc_count}; })
      .filter(v => { return v.value.indexOf(';') === -1 && v.value.indexOf(',') === -1; }),
    place_born: a.place_born.place_born_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    organisation: a.organisation.organisations_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    material: a.material.material_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    museum: a.museum.museum_filters.buckets.map(v => {
      if (v.key === 'Science Museum' || v.key === 'National Railway Museum' || v.key === 'Museum of Science and Industry' || v.key === 'National Media Museum' || v.key === 'National Science and Media Museum') {
        return {
          value: v.key,
          // really don't like this 'fix' but can't think of a better (short term) solution?
          // displayValue is used in the search/filters-all.html and search/filters-objects.html partials
          displayValue: (v.key === 'National Media Museum') ? 'National Science and Media Museum' : v.key,
          count: v.doc_count,
          galleries: a.gallery.gallery_filters.buckets.filter(g => {
            return galleries[g.key] === v.key;
          })};
      }
    }).filter(Boolean),
    image_license: [a.image_license.image_license_filters.buckets.reduce((a, b) => {
      a.count += b.doc_count;
      return a;
    }, {value: 'Non-Commercial Use', count: 0})],
    has_image: [a.has_image.has_image_filters.buckets.reduce((a, b) => {
      a.count += b.doc_count;
      return a;
    }, {value: 'Has Image', count: 0})]
  };
};
