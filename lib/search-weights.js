const config = require('../config');

// Analytics boost: excluded in test so result ordering stays stable against fixtures.
// Uses field_value_factor (native Java) instead of Painless script_score — same ordering,
// no per-document script execution overhead.
const analyticsBoost = config.NODE_ENV === 'test'
  ? []
  : [{
      field_value_factor: {
        field: 'enhancement.analytics.current.views',
        factor: 0.2,
        modifier: 'log1p',
        missing: 1
      }
    }];

module.exports = [{
  filter: {
    exists: { field: 'facility' }
  },
  weight: 5

}, {
//   filter: {
//     exists: { field: 'options.option1' }
//   },
//   weight: 1.2
// }, {
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
  weight: 30
// reduce weight of objects in these categories and archives under the All tab
}, {
  filter: {
    term: { '@datatype.base': 'archive' }
  },
  weight: 0.8
}, {
  filter: {
    term: { 'category.value': 'SCM - Art' }
  },
  weight: 0.8
}, {
  filter: {
    term: { 'category.value': 'NRM - Railway Models' }
  },
  weight: 0.8
}, {
  filter: {
    term: { 'category.value': 'NRM - Photographs' }
  },
  weight: 0.8
}, {
  filter: {
    term: { 'category.value': 'NRM - Railway Posters, Notices & Handbills' }
  },
  weight: 0.8
}, {
  filter: {
    term: { 'category.value': 'NRM - Pictorial Collection (Railway)' }
  },
  weight: 0.8
}, {
  filter: {
    term: { 'category.value': 'NRM - Documents' }
  },
  weight: 0.8
}].concat(analyticsBoost);
