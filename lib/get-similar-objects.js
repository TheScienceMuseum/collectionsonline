module.exports = async (resource, elastic) => {
  const body = {
    size: 6,
    query: {
      bool: {
        should: [],
        must_not: [
          { term: { '@admin.uid': resource._source['@admin'].uid } },
          { term: { 'grouping.@link.type': 'SPH' } }
        ]
      }
    }
  };

  const category = resource._source.category?.[0].name;
  let gallery;
  if (resource._source.facility?.[0]?.name) {
    gallery = resource._source.facility[0].name.find(
      (e) => e.type === 'gallery'
    );
  }

  if (category) {
    body.query.bool.should.push({
      term: {
        'category.name.keyword': category
      }
    });
  }

  if (gallery) {
    body.query.bool.should.push({
      term: {
        'facility.name.value.keyword': gallery.value
      }
    });
  }

  // exclude related items on these pages
  const exclude = ['co8864597', 'co8864595', 'co8864596'];
  if (exclude.includes(resource._source['@admin'].uid)) {
    return [];
  }

  const result = await elastic.search({ index: 'ciim', body });
  return result.body.hits.hits;
};
