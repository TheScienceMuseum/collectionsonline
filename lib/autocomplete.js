const TypeMapping = require('../lib/type-mapping');
const searchWeights = require('./search-weights');
const config = require('../config');

module.exports = async (elastic, queryParams) => {
  const must = [
    {
      match_phrase_prefix: {
        'summary.title': { query: queryParams.q }
      }
    }
  ];

  if (queryParams.type) {
    must.push({
      term: { '@datatype.base': TypeMapping.toInternal(queryParams.type) }
    });
  }

  const searchOpts = {
    index: config.elasticIndex,
    size: queryParams.size || 3,
    body: {
      query: {
        function_score: {
          query: {
            bool: {
              must,
              filter: {
                terms: {
                  '@datatype.base': ['agent', 'archive', 'object', 'group']
                }
              },
              must_not: {
                term: {
                  'grouping.@link.type': 'SPH'
                }
              }
            }
          },
          functions: searchWeights()
        }
      }
    }
  };

  return await elastic.search(searchOpts, { requestTimeout: 5000 });
};
