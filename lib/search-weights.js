// const config = require('../config');

module.exports = [{
  filter: {
    exists: { field: 'facility' }
  },
  weight: 5
}, {
  filter: {
    exists: { field: 'description.biography' }
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
  weight: 8
}, {
  filter: {
    exists: { field: 'multimedia.@processed.large.location' }
  },
  weight: 6
}];

// remoevd filters to improve query speed, 20-08-2024
// {
//   filter: {
//     term: { 'category.value': 'SCM - Art' }
//   },
//   weight: 0.8
// }, {
//   filter: {
//     term: { 'category.value': 'NRM - Railway Models' }
//   },
//   weight: 0.8
// }, {
//   filter: {
//     term: { 'category.value': 'NRM - Photographs' }
//   },
//   weight: 0.8
// }, {
//   filter: {
//     term: { 'category.value': 'NRM - Railway Posters, Notices & Handbills' }
//   },
//   weight: 0.8
// }, {
//   filter: {
//     term: { 'category.value': 'NRM - Pictorial Collection (Railway)' }
//   },
//   weight: 0.8
// }, {
//   filter: {
//     term: { 'category.value': 'NRM - Documents' }
//   },
//   weight: 0.8
// }



//, {
//   script_score: {
//     script: {
//       lang: 'expression',
//       params: { base: config.NODE_ENV === 'test' ? 0 : 1 },
//       inline: "_score * (1 + (base * doc['admin.analytics.count.last'].value / 5))"
//     }
//   }

