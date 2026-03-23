const TypeMapping = require('./type-mapping.js');
const config = require('../config');

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
    index: config.elasticIndex,
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
