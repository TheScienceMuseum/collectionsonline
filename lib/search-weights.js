const config = require('../config');

// Analytics boost: excluded in test so result ordering stays stable against fixtures,
// and filtered to non-archive records (see below). Uses field_value_factor (native Java)
// instead of Painless script_score — same ordering, no per-document script execution overhead.
// Analytics boost: excluded in archives because the ES field aggregates all child
// record views into the parent fonds, causing inflated scores that swamp object results
// on the All-tab browse. Archives rank by image + fonds weight alone; objects and people
// rank by those weights plus their own (non-aggregated) page view counts.
const analyticsBoost = config.NODE_ENV === 'test'
  ? []
  : [{
      filter: {
        bool: {
          must_not: [{ term: { '@datatype.base': 'archive' } }]
        }
      },
      field_value_factor: {
        field: 'enhancement.analytics.current.views',
        factor: 2,
        modifier: 'log1p',
        missing: 1
      }
    }];

// Note: these weights use score_mode:'sum' (set in search.js) — each matching function
// adds to the combined score rather than multiplying. This means image boost (+60) is
// always additive and is never wiped out by a zero analytics value.
// Category/archive demotions have been removed: negative weights are not supported by
// Elasticsearch's function_score, and in sum mode weight:0.8 would add a meaningless +0.8.
module.exports = [{
  filter: {
    exists: { field: 'facility' }
  },
  weight: 5

}, {
  filter: {
    exists: { field: 'biography' }
  },
  weight: 1.2
}, {
  filter: {
    exists: { field: 'birth.date' }
  },
  weight: 1.2
}, {
  filter: {
    exists: { field: 'death.date' }
  },
  weight: 1.2
}, {
  // Small boost to rank fonds above child archive records in archive searches.
  // Keep this low so imaged fonds don't float above popular individual objects in
  // all-tab browse (where they'd combine image+fonds vs object with image only).
  filter: {
    term: { 'level.value': 'fonds' }
  },
  weight: 2
}, {
  filter: {
    exists: { field: 'multimedia.@processed.large.location' }
  },
  weight: 60
}].concat(analyticsBoost);
