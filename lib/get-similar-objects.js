const searchWeights = require('./search-weights');

module.exports = async (resource, elastic) => {
  const body = {
    size: 6,
    query: {
      function_score: {
        query: {
          bool: {
            should: [],
            must_not: {
              term: { 'admin.uid': resource._source.admin.uid }
            }
          }
        },
        functions: searchWeights
      }
    }
  };

  const category = resource._source.categories[0].value;
  let gallery;
  if (resource._source.locations && resource._source.locations[0].name) {
    gallery = resource._source.locations[0].name.find(e => e.type === 'gallery');
  }

  if (category) {
    body.query.function_score.query.bool.should.push({
      term: {
        'categories.value': category
      }
    });
  }

  if (gallery) {
    body.query.function_score.query.bool.should.push({
      term: {
        'locations.name.value': gallery.value
      }
    });
  }

  const searchOpts = {
    index: 'ciim',
    body
  };

  // exclude related items on these pages
  const exclude = ['co8864597', 'co8864595', 'co8864596'];
  if (exclude.includes(resource._source.admin.uid)) {
    return [];
  }

  const result = await elastic.search(searchOpts);
  return result.body.hits.hits;
};
