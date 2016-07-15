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
<<<<<<< 71dc199dbf29fc7b6df1de42951ce83955fc6af7
=======
    console.log('RERERE', result);
>>>>>>> gets children of an archive and returns them in json response #187
    return next(err, result.hits.hits);
  });
};
