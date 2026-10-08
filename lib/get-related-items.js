const TypeMapping = require('./type-mapping.js');
const searchWeights = require('./search-weights');
const config = require('../config');

module.exports = async (elastic, id, count) => {
  const body = {
    size: count || 24,
    // Ask ES for the full match count regardless of the `size` cap — the AI
    // biography pipeline uses this to pass a volume signal into the writer
    // prompt (so a 400-item maker can read as "the collection holds a
    // substantial run of X's work" rather than describing only the 24 we
    // handed over). Costs nothing extra on the ES side.
    track_total_hits: true,
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
  const hits = result.body.hits.hits;
  // Attach total match count as a non-enumerable property so existing
  // callers (person page, admin, test fixture copier) see the same array
  // shape they always have; the AI biography writer opts in by reading
  // `.totalHits`. ES 7 returns `hits.total` as `{value, relation}` when
  // `track_total_hits: true`; relation is 'eq' (exact) up to 10K and 'gte'
  // above. Prefer the exact value, fall back to the array length.
  const totalRaw = result.body.hits && result.body.hits.total;
  const totalHits = (totalRaw && typeof totalRaw === 'object' && typeof totalRaw.value === 'number')
    ? totalRaw.value
    : (typeof totalRaw === 'number' ? totalRaw : hits.length);
  Object.defineProperty(hits, 'totalHits', { value: totalHits, enumerable: false });
  return hits;
};
