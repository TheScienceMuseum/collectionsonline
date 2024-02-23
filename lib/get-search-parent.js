/**
 * Search with aggregations
 * The total aggregation is a filter bucket. It excludes data which are not agents archives or objects
 * @param {Object} elastic - the elasticsearch client
 * @param {Object} queryParams - the queryParams Object
 * @param {Function} next - the callback with error and response as parameters
 */
module.exports = async (elastic, queryParams) => {
  const parentUid = queryParams.query['filter[mphc]'];
  if (!parentUid) {
    return;
  }
  const body = {
    size: 1,
    query: {
      function_score: {
        query: {
          bool: {
            must: [
              {
                match: {
                  '@admin.uid': parentUid
                }
              }
            ],
            must_not: [
              {
                terms: {
                  'grouping.@link.type': ['SPH']
                }
              }
            ]
          }
        }
      }
    }
  };

  const searchOpts = {
    index: 'ciim',
    body
  };

  const result = await elastic.search(searchOpts);

  const res = result.body.hits.hits[0];

  return res;
};
