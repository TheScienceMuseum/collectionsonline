const TypeMapping = require('./type-mapping.js');
const searchWeights = require('./search-weights');
const config = require('../config');

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
            must_not: [
              { term: { '@datatype.base': 'agent' } },
              // SPH child records (parts) don't have their own public page —
              // /objects/{partId} redirects to the parent. Showing them in
              // "Related Objects" produces broken-feeling navigation. Match
              // the exclusion already used by lib/get-similar-objects.js.
              { term: { 'grouping.@link.type': 'SPH' } }
            ],
            minimum_should_match: 1
          }
        },
        functions: searchWeights()
      }
    }
  };

  const searchOpts = {
    index: config.elasticIndex,
    body
  };

  const result = await elastic.search(searchOpts, { requestTimeout: 2000 });
  return result.body.hits.hits;
};
