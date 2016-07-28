const TypeMapping = require('./type-mapping.js');

module.exports = (elastic, id, next, count) => {
  count = count || 100;
  const searchOpts = {
    index: 'smg',
    body: {
      size: count,
      query: {
        filtered: {
          filter: {
            bool: {
              must: {
                term: {'parent.admin.uid': TypeMapping.toInternal(id)}
              }
            }
          }
        }
      }
    }
  };

  elastic.search(searchOpts, (err, result) => {
    if (err) {
      return next(err);
    } else {
      return next(null, result.hits.hits);
    }
  });
};
