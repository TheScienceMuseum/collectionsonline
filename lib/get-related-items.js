const TypeMapping = require('./type-mapping.js');
const searchWeights = require('./search-weights');

module.exports = async (elastic, id, count) => {
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
              term: { 'type.base': 'agent' }
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

  try {
    const result = await elastic.search(searchOpts);
    return result.hits.hits;
  } catch (err) {
    throw err;
  }
};
