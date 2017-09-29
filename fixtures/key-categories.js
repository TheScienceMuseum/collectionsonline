/*
  A list of categories that when searched for, will redirect to
  the filter of that category.
  Categories should be objects with the category name,
  and an optional array of synonyms.
*/

module.exports = [
  {
    category: 'art',
    synonyms: ['artworks', 'paintings', 'painting']
  },
  {
    category: 'telecommunications',
    synonyms: [
      'telecoms',
      'telephones'
    ]
  },
  {
    category: 'cinematography',
    synonyms: ['cinema']
  },
  {
    category: 'photographic technology',
    synonyms: ['cameras']
  },
  {
    category: 'photographs',
    synonyms: ['photography', 'photograph', 'photo', 'photos']
  },
  {
    category: 'locomotives and rolling stock',
    synonyms: ['locomotives', 'train', 'trains', 'rolling stock']
  },
  {
    category: 'Railway Posters, Notices & Handbills',
    synonyms: ['railway posters', 'railway poster', 'handbills', 'notices']
  },
  {
    category: 'radio communication',
    synonyms: ['radio']
  },
  {
    category: 'contemporary art collection',
    synonyms: ['contemporary art']
  },
  {
    category: 'computing & data processing',
    synonyms: ['computing']
  },
  {
    category: 'classical & medieval medicine',
    synonyms: ['medicine']
  },
  {
    category: 'textile industry',
    synonyms: ['textiles']
  }
];
