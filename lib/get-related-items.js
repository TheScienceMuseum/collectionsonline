const TypeMapping = require('./type-mapping.js');
const searchWeights = require('./search-weights');

module.exports = async (elastic, id, count) => {
  const body = {
    size: count || 24,
    query: {
      function_score: {
        query: {
          bool: {
            should: [
              {
                match: {
                  'lifecycle.creation.maker.admin.uid': TypeMapping.toInternal(id)
                }
              },
              {
                match: {
                  'agents.admin.uid': TypeMapping.toInternal(id)
                }
              }
            ],
            must_not: {
              term: { 'type.base': 'agent' }
            },
            minimum_should_match: 1
          }
        },
        functions: searchWeights
      }
    }
  };

  const searchOpts = {
    index: 'ciim',
    body
  };

  const result = await elastic.search(searchOpts);
  return result.hits.hits;
};
