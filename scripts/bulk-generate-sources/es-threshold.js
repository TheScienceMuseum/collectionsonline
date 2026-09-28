'use strict';

// ES candidate source — top-N agent records by analytics cumulative views.
//
// Query shape:
//   type: agent (i.e. @datatype.base == 'agent')
//   enhancement.analytics.current.cumulative_views >= opts.minAnalytics
//   sorted by cumulative views desc
//
// Returns a flat array of external IDs (e.g. cp37054, ap12345). Records
// that already have a BIOGRAPHY item in DynamoDB are NOT filtered here —
// the runner does per-subject idempotence checks with GetItem, so this
// source can stay simple. Sort order is analytics-descending so the
// runner processes the most-popular records first (best value if the
// user Ctrl-C's mid-run).
//
// Usage from the CLI:
//   node scripts/bulk-regen.js --source es-threshold --min-analytics 500
//
// The field path `enhancement.analytics.current.cumulative_views` is the
// same signal used by lib/search-weights.js's function_score boost — the
// "popularity" definition is consistent with the site's own ranking.

const TypeMapping = require('../../lib/type-mapping');

// ES pagination cap. 10000 is the default max_result_window; more than
// enough for the pre-launch ~5000 target. If the query ever needs to
// exceed this, add search_after paging — but 10k is deliberately just
// above the target so we notice if a future run outgrows it.
const MAX_HITS = 10000;

module.exports = async function list (elastic, config, opts) {
  const minAnalytics = Number.isInteger(opts.minAnalytics) ? opts.minAnalytics : 500;
  const size = opts.limit && opts.limit < MAX_HITS ? Math.max(opts.limit * 2, 100) : MAX_HITS;

  console.log('es-threshold: querying', config.elasticIndex || 'ciim',
    '· type=agent · min analytics=' + minAnalytics + ' · size=' + size);

  const body = {
    query: {
      bool: {
        must: [
          { term: { '@datatype.base': 'agent' } },
          { range: { 'enhancement.analytics.current.cumulative_views': { gte: minAnalytics } } }
        ]
      }
    },
    sort: [
      { 'enhancement.analytics.current.cumulative_views': { order: 'desc' } }
    ],
    _source: ['@datatype', 'enhancement.analytics.current.cumulative_views'],
    size
  };

  const response = await elastic.search({
    index: config.elasticIndex || 'ciim',
    body
  });

  const hits = (response.body.hits && response.body.hits.hits) || [];
  console.log('es-threshold: ES returned ' + hits.length + ' hits.');

  // The ES _id is the INTERNAL id (e.g. `agent-cp37054`). TypeMapping
  // handles the internal → external conversion used everywhere else
  // (URLs, DynamoDB PK). Skip any record we can't map — likely a schema
  // shape change worth investigating rather than silently included.
  const ids = [];
  hits.forEach(function (hit) {
    try {
      const external = TypeMapping.toExternal(hit._id);
      if (external) ids.push(external);
    } catch (err) {
      console.warn('es-threshold: skipping unmappable id', hit._id, '-', err.message);
    }
  });

  return ids;
};
