const TypeMapping = require('./type-mapping.js');

module.exports = (elastic, id, next, count) => {
  count = count || 10;
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
    return next(err, result.hits.hits);
  });
};
