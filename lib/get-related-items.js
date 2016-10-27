const TypeMapping = require('./type-mapping.js');

module.exports = (elastic, id, next, count) => {
  const body = {
    size: count || 24,
    query: {
      constant_score: {
        filter: {
          bool: {
            must: {
              term: {
                'lifecycle.creation.maker.admin.uid': TypeMapping.toInternal(id)
              }
            },
            must_not: {
              term: {'type.base': 'agent'}
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
