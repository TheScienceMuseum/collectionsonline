const config = require('../config');

// Quality weights — used with score_mode:'sum' (explicitly set in search.js). Each
// matching filter adds into the combined function score; non-matching filters contribute
// nothing. boost_mode:'multiply' then multiplies the combined function score against the
// text query score, so a record with a strong quality signal gets a proportional uplift.
//
// Analytics uses cumulative_views (lifetime total) rather than current.views (a short
// rolling window that resets and varies in length per record — unreliable for ranking).
// log1p prevents explosive scores for very high-traffic records while preserving the
// popularity ordering: 4608 cumulative → +42.2 vs 1662 → +37.1 vs 298 → +28.6.
//
// Category demotions: records in high-volume lower-relevance categories (art, railway
// photographs, models, pictorial collections) score ~3 points below equivalent records
// in general categories (see the non-demoted boost filter below for details).
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
  // analytics and facility, imaged popular on-display records score well above plain text.
  filter: {
    exists: { field: 'multimedia.@processed.large.location' }
  },
  weight: 8
}, {
  // Mild positive for archives so they aren't at zero in the sum. The archive analytics
  // exclusion on all-tab (below) prevents fonds inflation from child-aggregated views.
  filter: {
    term: { '@datatype.base': 'archive' }
  },
  weight: 0.8
// Boost records NOT in high-volume but lower-relevance categories. ES function_score
// does not support negative weights, so we invert the logic: add +3 to everything
// except art, railway models/photographs, pictorial collections and documents.
// Net effect is identical to a -3 demotion for those categories — they score ~3 points
// lower than equivalent records in general categories, pushing them below specific
// title/identifier matches for searches like "next" (NeXT company vs railway photos).
}, {
  filter: {
    bool: {
      must_not: [{
        terms: {
          'category.value': [
            'SCM - Art',
            'NRM - Railway Models',
            'NRM - Photographs',
            'NRM - Railway Posters, Notices & Handbills',
            'NRM - Pictorial Collection (Railway)',
            'NRM - Documents'
          ]
        }
      }]
    }
  },
  weight: 3
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

  // Lifetime cumulative views: stable signal unaffected by the rolling current-window
  // reset. current.views varies in window length per record (e.g. 7 days for Rocket
  // locomotive vs years for newly-ingested records), making it unreliable for ranking.
  // sqrt modifier: analytics = sqrt(factor × cv). With factor:0.01, a 4608-view record
  // contributes sqrt(46.08)=6.79, vs a 21-view record sqrt(0.21)=0.46 — a 15× spread.
  // This is far more discriminating than log1p (which gives only ~2× spread), so
  // popularity meaningfully separates high- and low-traffic records with similar text
  // scores. For rare-term queries (identifier matches, multi-word phrases), text scores
  // are 10–100× larger than function_sum, so they still dominate completely.
  // missing:1 → sqrt(0.01)=0.1 as a near-zero floor for records with no analytics.
  const analyticsFunc = Object.assign(
    analyticsFilter ? { filter: analyticsFilter } : {},
    {
      field_value_factor: {
        field: 'enhancement.analytics.current.cumulative_views',
        factor: 0.01,
        modifier: 'sqrt',
        missing: 1
      }
    }
  );

  return qualityWeights.concat([analyticsFunc]);
};
