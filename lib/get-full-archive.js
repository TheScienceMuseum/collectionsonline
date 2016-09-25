const TypeMapping = require('./type-mapping.js');

module.exports = (elastic, id, next, count) => {
  const body = {
    size: count || 10000,
    query: {
      constant_score: {
        filter: {
          bool: {
            must: {
              term: {'fonds.admin.uid': TypeMapping.toInternal(id)}
            }
          }
        }
      }
    }
  };

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
