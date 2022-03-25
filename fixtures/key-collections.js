/*
  A list of named collections that when searched for, will redirect to
  the filter of that collection.
  Collections should be objects with the collection name,
  and an optional array of synonyms.
*/

module.exports = [
  {
    collection: 'BBC Heritage Collection',
    synonyms: ['BBC Heritage Collection']
  },
  {
    collection: 'Stephen Hawking’s Office',
    synonyms: [
      'Stephen Hawking',
      'Stephen Hawkings'
    ]
  }
];
