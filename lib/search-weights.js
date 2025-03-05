// const config = require('../config');

// var script = `
//   if (doc.containsKey('enhancement.analytics.current.count')) {
//     return doc['enhancement.analytics.current.count'].value
//   } else {
//     return 0
//   }
// `;

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
  weight: 8
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
}
// , {
//   script_score: {
//     script: {
//       source: script
//       // params: { base: config.NODE_ENV === 'test' ? 0 : 1 },
//       // source: "_score * (1 + (base * doc['enhancement.analytics.current.count'].value / 5))"
//     }
//   }
// }
];
