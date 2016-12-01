const TypeMapping = require('./type-mapping.js');
const searchWeights = require('./search-weights');

module.exports = (elastic, id, next, count) => {
  const body = {
    size: count || 24,
    query: {
      function_score: {
        query: {
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
        },
        functions: searchWeights
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
