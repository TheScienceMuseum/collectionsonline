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
    synonyms: ['cinema', 'film']
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
    synonyms: ['locomotives', 'train', 'trains', 'rolling stock', 'choo choo']
  },
  {
    category: 'Railway Posters, Notices & Handbills',
    synonyms: ['railway posters', 'railway poster', 'handbills', 'notices']
  },
  {
    category: 'radio communication',
    synonyms: ['radio', 'wireless']
  },
  {
    category: 'television',
    synonyms: ['tv']
  },
  {
    category: 'computing & data processing',
    synonyms: ['computing', 'data processing', 'computer', 'computers']
  },
  {
    category: 'classical & medieval medicine',
    synonyms: ['medieval medicine', 'classical medicine']
  },
  {
    category: 'textile industry',
    synonyms: ['textiles']
  },
  {
    category: 'laboratory medicine',
    synonyms: []
  },
  {
    category: 'radiomedicine',
    synonyms: ['radiology']
  },
  {
    category: 'therapeutics',
    synonyms: ['medicine', 'therapy', 'drugs']
  },
  {
    category: 'orthopaedics',
    synonyms: ['artificial limbs', 'artificial limb', 'artificial arm', 'artificial hand', 'prosthesis', 'prosthetic', 'prosthetics']
  },
  {
    category: 'anatomy & pathology',
    synonyms: ['anatomy', 'pathology']
  },
  {
    category: 'astronomy',
    synonyms: ['planetaria']
  },
  {
    category: 'acoustics',
    synonyms: ['synthesizers', 'music']
  }
];
