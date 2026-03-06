const TypeMapping = require('./type-mapping.js');

module.exports = async (elastic, id, count) => {
  const body = {
    size: count || 10000,
    query: {
      constant_score: {
        filter: {
          bool: {
            must: {
              term: { 'fonds.@admin.uid': TypeMapping.toInternal(id) }
            }
          }
        }
      }
    }
  };

  const searchOpts = {
    index: 'ciim',
    body,
    _source: [
      '@admin',
      'parent',
      'identifier',
      'summary'
    ]
  };

  const result = await elastic.search(searchOpts);
  return result.body.hits.hits;
};
