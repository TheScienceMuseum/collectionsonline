const fs = require('fs');
const path = require('path');
const galleries = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/galleries.json')));

module.exports = function createAllFacets (results) {
  const a = results.aggregations.all || results.aggregations.people || results.aggregations.objects || results.aggregations.documents;

  return {
    category: a.category.category_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    maker: a.maker.maker_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
    type: a.type.type_filters.buckets.map(v => { return {value: v.key, count: v.doc_count}; }),
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
      if (v.key === 'Science Museum' || v.key === 'National Railway Museum' || v.key === 'Museum of Science and Industry' || v.key === 'National Media Museum') {
        return {value: v.key, count: v.doc_count, galleries: a.gallery.gallery_filters.buckets.filter(g => {
          return galleries[g.key] === v.key;
        })};
      }
    }).filter(Boolean)
  };
};
