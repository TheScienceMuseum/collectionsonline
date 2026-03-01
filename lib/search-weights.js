const config = require('../config');

// Static quality weights — applied to all searches regardless of type.
// Uses score_mode:'sum' (set in search.js) so each function adds to the score.
// Image boost (+60) is always additive and never wiped out by a zero analytics value.
// Category/archive demotions have been removed: negative weights are not supported by
// Elasticsearch's function_score, and in sum mode weight:0.8 would add a meaningless +0.8.
const qualityWeights = [{
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
}];

/**
 * Returns the full function_score weights array for a given search type.
 *
 * Analytics boost uses field_value_factor (native Java, no script overhead).
 * Excluded in test so result ordering stays stable against fixtures.
 *
 * On the all-tab (type === 'all'), archives are excluded from the analytics boost
 * because the ES field aggregates all child record views into the parent fonds,
 * inflating their scores and pushing them above popular objects. On type-specific
 * paths (/search/documents, /search/people etc.) archives receive analytics so
 * popular collections rank above less-visited ones within that tab.
 *
 * @param {string} [type] - queryParams.type ('all', 'objects', 'people', 'documents', etc.)
 */
module.exports = function (type) {
  if (config.NODE_ENV === 'test') {
    return qualityWeights;
  }

  const analyticsFilter = type === 'all'
    ? { bool: { must_not: [{ term: { '@datatype.base': 'archive' } }] } }
    : null;

  const analyticsFunc = Object.assign(
    analyticsFilter ? { filter: analyticsFilter } : {},
    {
      field_value_factor: {
        field: 'enhancement.analytics.current.views',
        factor: 2,
        modifier: 'log1p',
        missing: 1
      }
    }
  );

  return qualityWeights.concat([analyticsFunc]);
};
