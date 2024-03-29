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
                  'creation.maker.@admin.uid': TypeMapping.toInternal(id)
                }
              },
              {
                match: {
                  'agent.@admin.uid': TypeMapping.toInternal(id)
                }
              }
            ],
            must_not: {
              term: { '@datatype.base': 'agent' }
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
  return result.body.hits.hits;
};
