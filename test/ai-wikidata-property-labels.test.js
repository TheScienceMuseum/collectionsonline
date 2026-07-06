'use strict';

// Tests for the shared Wikidata property label module. Two APIs:
//   labelFor(propId) — atomic lookup, returns human label or null.
//   formatSourceDetail(str) — walks a full sourceDetail string,
//     translating each wikidata:pXXX citation while leaving other
//     citation kinds (relateditem:*, existingbiography, etc.) alone.

const test = require('tape');
const { labelFor, formatSourceDetail, PROPERTIES } = require('../lib/ai/wikidata-property-labels');

// --- labelFor -------------------------------------------------------

test('labelFor: known property → label', function (t) {
  t.equal(labelFor('P106'), 'occupation');
  t.equal(labelFor('P108'), 'employer');
  t.equal(labelFor('P452'), 'industry');
  t.end();
});

test('labelFor: case-insensitive', function (t) {
  t.equal(labelFor('p106'), 'occupation', 'lowercase');
  t.equal(labelFor('P106'), 'occupation', 'uppercase');
  t.end();
});

test('labelFor: unknown property → null', function (t) {
  t.equal(labelFor('P99999999'), null);
  t.end();
});

test('labelFor: bad input → null (not a throw)', function (t) {
  t.equal(labelFor(null), null);
  t.equal(labelFor(undefined), null);
  t.equal(labelFor(''), null);
  t.equal(labelFor(42), null);
  t.end();
});

test('labelFor: PROPERTIES map covers the common writer emissions', function (t) {
  // These are the property IDs seen in the actual writer output
  // from the Task 56 verification cycle across the 5 test subjects
  // — regression guard so pruning the map doesn't accidentally
  // drop a code the writer routinely uses.
  const observedInCorpus = ['P106', 'P108', 'P69', 'P166', 'P800', 'P463', 'P101', 'P452'];
  observedInCorpus.forEach(function (id) {
    t.ok(labelFor(id), 'labelled: ' + id);
  });
  t.end();
});

// --- formatSourceDetail --------------------------------------------

test('formatSourceDetail: single wikidata citation → labelled', function (t) {
  t.equal(formatSourceDetail('wikidata:p106'), 'wikidata:P106 (occupation)');
  t.end();
});

test('formatSourceDetail: multiple wikidata citations comma-separated', function (t) {
  const out = formatSourceDetail('wikidata:p106, wikidata:p101');
  t.ok(out.indexOf('P106 (occupation)') !== -1);
  t.ok(out.indexOf('P101 (field of work)') !== -1);
  // Preserves the comma-and-space separator
  t.ok(out.indexOf(', ') !== -1);
  t.end();
});

test('formatSourceDetail: semicolon separator between different citation kinds', function (t) {
  const out = formatSourceDetail('wikidata:p800; existingbiography');
  t.ok(out.indexOf('P800 (notable work)') !== -1);
  t.ok(out.indexOf('existingbiography') !== -1, 'non-wikidata piece survives');
  t.end();
});

test('formatSourceDetail: leaves relateditem citations untouched', function (t) {
  const out = formatSourceDetail('relateditem:co12345');
  t.equal(out, 'relateditem:co12345');
  t.end();
});

test('formatSourceDetail: leaves persondata citations untouched', function (t) {
  const out = formatSourceDetail('persondata.birthdate, persondata.birthplace');
  t.equal(out, 'persondata.birthdate, persondata.birthplace');
  t.end();
});

test('formatSourceDetail: unknown wikidata property → uppercased but no label', function (t) {
  const out = formatSourceDetail('wikidata:p99999999');
  t.equal(out, 'wikidata:P99999999', 'renders without parenthetical label');
  t.end();
});

test('formatSourceDetail: mixed citation kinds', function (t) {
  const out = formatSourceDetail('wikidata:p108, wikidata:p106; relateditem:co66082');
  t.ok(out.indexOf('P108 (employer)') !== -1);
  t.ok(out.indexOf('P106 (occupation)') !== -1);
  t.ok(out.indexOf('relateditem:co66082') !== -1);
  t.end();
});

test('formatSourceDetail: bad input → safe passthrough', function (t) {
  t.equal(formatSourceDetail(null), '');
  t.equal(formatSourceDetail(undefined), '');
  t.equal(formatSourceDetail(''), '');
  t.end();
});

test('formatSourceDetail: does not mutate the input', function (t) {
  const input = 'wikidata:p106';
  formatSourceDetail(input);
  t.equal(input, 'wikidata:p106', 'string unchanged');
  t.end();
});

// --- Map contents / regression guards ------------------------------

test('PROPERTIES: reasonable coverage of common museum-subject fields', function (t) {
  // Property counts should stay north of 30 or something's been
  // accidentally trimmed. Not a hard cap — if we prune to 20 later
  // this test should be updated deliberately.
  t.ok(Object.keys(PROPERTIES).length >= 30, 'at least 30 properties');
  t.end();
});
