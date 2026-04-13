'use strict';

const test = require('tape');
const extractPersonData = require('../lib/ai/extract-person-data');

test('extractPersonData: extracts Mimsy-style person data', function (t) {
  const source = {
    summary: { title: 'Charles Babbage' },
    birth: {
      date: { value: '1791-12-26' },
      place: { name: [{ value: 'London' }] }
    },
    death: {
      date: { value: '1871-10-18' },
      place: { name: [{ value: 'London' }] }
    },
    occupation: [{ value: 'Mathematician' }, { value: 'Engineer' }],
    nationality: ['British'],
    description: [
      { type: 'biography', value: 'Pioneer of computing.' }
    ],
    wikidata: 'Q12345'
  };

  const result = extractPersonData(source);
  t.equal(result.name, 'Charles Babbage', 'name extracted');
  t.equal(result.birthDate, '1791-12-26', 'birth date extracted');
  t.equal(result.birthPlace, 'London', 'birth place extracted');
  t.equal(result.deathDate, '1871-10-18', 'death date extracted');
  t.equal(result.occupation, 'Mathematician, Engineer', 'occupation joined');
  t.equal(result.nationality, 'British', 'nationality extracted');
  t.equal(result.biography, 'Pioneer of computing.', 'biography extracted');
  t.equal(result.descriptionChars, 21, 'description chars counted');
  t.equal(result.wikidata, 'Q12345', 'wikidata preserved');
  t.end();
});

test('extractPersonData: handles missing fields gracefully', function (t) {
  const source = {
    summary: { title: 'Unknown Person' }
  };

  const result = extractPersonData(source);
  t.equal(result.name, 'Unknown Person', 'name from title');
  t.equal(result.birthDate, '', 'empty birth date');
  t.equal(result.birthPlace, '', 'empty birth place');
  t.equal(result.occupation, '', 'empty occupation');
  t.equal(result.biography, '', 'empty biography');
  t.equal(result.descriptionChars, 0, 'zero description chars');
  t.equal(result.wikidata, null, 'null wikidata');
  t.end();
});

test('extractPersonData: calculates total description chars across all entries', function (t) {
  const source = {
    summary: { title: 'Test' },
    description: [
      { type: 'biography', value: '12345' },
      { type: 'web description', value: '67890' }
    ]
  };

  const result = extractPersonData(source);
  t.equal(result.descriptionChars, 10, 'counts across all entries');
  t.equal(result.biography, '12345', 'gets biography entry');
  t.end();
});

test('extractPersonData: handles empty source', function (t) {
  const result = extractPersonData({});
  t.equal(result.name, '', 'empty name');
  t.equal(result.descriptionChars, 0, 'zero chars');
  t.end();
});
