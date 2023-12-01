const TypeMapping = require('../lib/type-mapping');
const searchWeights = require('./search-weights');

module.exports = async (elastic, queryParams) => {
  const must = [{
    match_phrase_prefix: {
      'summary.title': { query: queryParams.q }
    }
  }];

  if (queryParams.type) {
    must.push({
      term: { '@datatype.base': TypeMapping.toInternal(queryParams.type) }
    });
  }

  const searchOpts = {
    index: 'ciim',
    size: queryParams.size || 3,
    body: {
      query: {
        function_score: {
          query: {
            bool: {
              must,
              filter: {
                terms: { '@datatype.base': ['agent', 'archive', 'object'] }
              }
            }
          },
          functions: searchWeights
        }
      }
    }
  };

  return await elastic.search(searchOpts);
};
