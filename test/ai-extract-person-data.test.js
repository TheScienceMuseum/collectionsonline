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

test('extractPersonData: separates brief biography from main biography', function (t) {
  const source = {
    summary: { title: 'John Smith' },
    description: [
      { type: 'brief biography', value: 'active 1817-1839, optical & mathematical instrument maker, London, England' },
      { type: 'biography', value: 'Traded at 126 High St., Wapping, (1817-39) & 35 Leicester Sq.(1836), both London, England' }
    ]
  };

  const result = extractPersonData(source);
  t.equal(result.briefBiography, 'active 1817-1839, optical & mathematical instrument maker, London, England', 'brief biography exposed separately');
  t.equal(result.biography, 'Traded at 126 High St., Wapping, (1817-39) & 35 Leicester Sq.(1836), both London, England', 'main biography exposed separately');
  t.equal(result.briefBiographyChars, 74, 'brief biography char count');
  t.equal(result.descriptionChars, 89, 'main biography char count');
  t.end();
});

test('extractPersonData: brief-biography-only record (e.g. cp38424)', function (t) {
  const source = {
    summary: { title: 'Lone Brief' },
    description: [
      { type: 'brief biography', value: 'active 1990s, recycled paper product manufacturer, Britain' }
    ]
  };
  const result = extractPersonData(source);
  t.equal(result.briefBiography.indexOf('active 1990s'), 0, 'brief biography captured');
  t.equal(result.biography, '', 'main biography empty');
  t.ok(result.briefBiographyChars > 0, 'brief char count populated');
  // descriptionChars mirrors what the public template renders in the
  // description.primary slot — for brief-only records that's the brief
  // biography text, via getPrimaryValue's getFirst() fallback.
  t.equal(result.descriptionChars, result.briefBiographyChars,
    'descriptionChars reflects rendered text (brief biography)');
  t.end();
});

test('extractPersonData: falls back to first entry when no typed match', function (t) {
  const source = {
    summary: { title: 'Test' },
    description: [
      { type: 'web description', value: 'first-text' }
    ]
  };

  const result = extractPersonData(source);
  t.equal(result.biography, 'first-text', 'falls back to first entry');
  t.equal(result.briefBiography, '', 'no brief biography');
  t.end();
});

test('extractPersonData: handles empty source', function (t) {
  const result = extractPersonData({});
  t.equal(result.name, '', 'empty name');
  t.equal(result.descriptionChars, 0, 'zero chars');
  t.end();
});
