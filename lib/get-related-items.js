const TypeMapping = require('./type-mapping.js');

module.exports = (elastic, id, next, count) => {
  count = count || 24;
  const searchOpts = {
    index: 'smg',
    body: {
      size: count,
      query: {
        filtered: {
          filter: {
            bool: {
              should: [
                {
                  term: {
                    'lifecycle.creation.maker.admin.uid': TypeMapping.toInternal(id)
                  }
                },
                {
                  term: {
                    'agents.admin.uid': TypeMapping.toInternal(id)
                  }
                }
              ],
              must_not: {
                term: {'type.base': 'agent'}
              }
            }
          }
        }
      }
    }
  };

  elastic.search(searchOpts, (err, result) => {
    return next(err, result.hits.hits);
  });
};
