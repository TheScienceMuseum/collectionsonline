const config = require('../config');

// Analytics boost: excluded in test so result ordering stays stable against fixtures.
// Uses field_value_factor (native Java) instead of Painless script_score — same ordering,
// no per-document script execution overhead.
const analyticsBoost = config.NODE_ENV === 'test'
  ? []
  : [{
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
  filter: {
    term: { 'level.value': 'fonds' }
  },
  weight: 6
}, {
  filter: {
    exists: { field: 'multimedia.@processed.large.location' }
  },
  weight: 60
}].concat(analyticsBoost);
