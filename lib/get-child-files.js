const TypeMapping = require('./type-mapping.js');

module.exports = (elastic, id, next, count) => {
  const body = {
    size: count || 100,
    query: {
      constant_score: {
        filter: {
          bool: {
            must: {
              term: {'parent.admin.uid': TypeMapping.toInternal(id)}
            }
          }
        }
      }
    }
  };

  const searchOpts = {
    index: 'ciim',
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
