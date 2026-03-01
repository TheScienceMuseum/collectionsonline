const config = require('../config');

// Quality weights — used with score_mode:'sum' (explicitly set in search.js). Each
// matching filter adds into the combined function score; non-matching filters contribute
// nothing. boost_mode:'multiply' then multiplies the combined function score against the
// text query score, so a record with a strong quality signal gets a proportional uplift.
//
// Analytics uses log1p to cap the contribution: 5000 views → +8.52 (not +1000 with
// modifier:'none'). This keeps text relevance as the primary discriminator while still
// letting popular imaged records rank above equally-relevant but low-traffic ones.
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
  filter: {
    term: { 'level.value': 'fonds' }
  },
  weight: 2
}, {
  // +8 in the function sum — significant uplift for imaged records. Combined with
  // analytics (+3–9) and facility (+5), imaged popular on-display records score ~20+.
  filter: {
    exists: { field: 'multimedia.@processed.large.location' }
  },
  weight: 8
}, {
  // Mild demotion for archives: contributes +0.8 vs the default +0 (no match).
  // Partially offsets the archive analytics exclusion on all-tab browse.
  filter: {
    term: { '@datatype.base': 'archive' }
  },
  weight: 0.8
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

  // Current-month views: log1p compression keeps popular records ahead without
  // overwhelming text relevance. modifier:'none' would give 5000 views → +1000 to
  // function sum, swamping image and title scores. log1p gives 5000 → +8.52 (manageable).
  // factor:1 — a record with 43 views adds log1p(43) = 3.78 to the function sum.
  // missing:1 handles records where the analytics field is absent (adds log1p(1) = 0.69).
  const analyticsFunc = Object.assign(
    analyticsFilter ? { filter: analyticsFilter } : {},
    {
      field_value_factor: {
        field: 'enhancement.analytics.current.views',
        factor: 1,
        modifier: 'log1p',
        missing: 1
      }
    }
  );

  // 6-month cumulative views: stability signal for start-of-month when current views
  // reset to 0. Uses tier weights so non-qualifying records contribute 0 (not a negative).
  // Tier weights only ever add (≥0) — records below each threshold add nothing.
  // 232 records have ≥1000 cumulative views; 64 have ≥2000 (0.07% of the collection).
  const cumulativeTier100 = Object.assign(
    analyticsFilter ? { filter: Object.assign({}, { bool: { must_not: analyticsFilter.bool.must_not, must: [{ range: { 'enhancement.analytics.current.cumulative_views': { gte: 100 } } }] } }) } : { filter: { range: { 'enhancement.analytics.current.cumulative_views': { gte: 100 } } } },
    { weight: 1.5 }
  );

  const cumulativeTier1000 = Object.assign(
    analyticsFilter ? { filter: Object.assign({}, { bool: { must_not: analyticsFilter.bool.must_not, must: [{ range: { 'enhancement.analytics.current.cumulative_views': { gte: 1000 } } }] } }) } : { filter: { range: { 'enhancement.analytics.current.cumulative_views': { gte: 1000 } } } },
    { weight: 2 }
  );

  return qualityWeights.concat([analyticsFunc, cumulativeTier100, cumulativeTier1000]);
};
