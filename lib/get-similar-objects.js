module.exports = (resource, elastic, next) => {
  const body = {
    size: 6,
    query: {
      constant_score: {
        filter: {
          bool: {
            should: [],
            must_not: {
              term: {'admin.uid': resource._source.admin.uid}
            }
          }
        }
      }
    }
  };

  var category = resource._source.categories[0].value;
  var gallery;
  if (resource._source.locations && resource._source.locations[0].name) {
    gallery = resource._source.locations[0].name.find(e => e.type === 'gallery');
  }

  if (category) {
    body.query.constant_score.filter.bool.should.push({
      term: {
        'categories.value': category
      }
    });
  }

  if (gallery) {
    body.query.constant_score.filter.bool.should.push({
      term: {
        'locations.name.value': gallery.value
      }
    });
  }

  const searchOpts = {
    index: 'smg',
    body: body
  };

  elastic.search(searchOpts, (err, result) => {
    if (err) {
      return next(err);
    } else {
      return next(null, result.hits.hits);
    }
  });
};
