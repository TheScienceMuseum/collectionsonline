'use strict';

// Tests for the cross-source contradiction detector. Structured-only
// scope for v1: museum personData ↔ Wikidata P-code fields for six
// fact keys. Wikipedia / ODNB / Grace's Guide extracts are freetext
// and not compared mechanically here.

const test = require('tape');
const detect = require('../lib/ai/detect-contradictions');

// --- Empty inputs ---------------------------------------------------

test('empty inputs return no contradictions', function (t) {
  t.deepEqual(detect({}), []);
  t.deepEqual(detect({ personData: {}, wikidataContext: {} }), []);
  t.deepEqual(detect(), []);
  t.end();
});

test('single-source facts are not contradictions', function (t) {
  const out = detect({
    personData: { birthDate: '1879-03-14' }, // only museum has it
    wikidataContext: {}
  });
  t.equal(out.length, 0);
  t.end();
});

test('agreement across sources is not a contradiction', function (t) {
  const out = detect({
    personData: { birthDate: '1879-03-14' },
    wikidataContext: {
      P569: { label: 'date of birth', value: '+1879-03-14T00:00:00Z' }
    }
  });
  t.equal(out.length, 0, 'exact-date agreement');
  t.end();
});

// --- Dates ----------------------------------------------------------

test('birthDate contradiction: museum vs Wikidata', function (t) {
  const out = detect({
    personData: { birthDate: '1879-03-14' },
    wikidataContext: {
      P569: { label: 'date of birth', value: '+1879-03-15T00:00:00Z' }
    }
  });
  t.equal(out.length, 1);
  t.equal(out[0].factKey, 'birthDate');
  t.equal(out[0].factLabel, 'Date of birth');
  t.equal(out[0].winner, 'museum', 'museum wins per priority ladder');
  t.equal(out[0].winnerValue, '1879-03-14');
  t.equal(out[0].values.length, 2);
  t.end();
});

test('year-only date agrees with a full date in the same year', function (t) {
  const out = detect({
    personData: { birthDate: '1879' },
    wikidataContext: {
      P569: { label: 'date of birth', value: '+1879-03-14T00:00:00Z' }
    }
  });
  t.equal(out.length, 0, 'year-only + full date in the same year are compatible');
  t.end();
});

test('year mismatch flags a contradiction', function (t) {
  const out = detect({
    personData: { birthDate: '1879' },
    wikidataContext: {
      P569: { label: 'date of birth', value: '+1880-03-14T00:00:00Z' }
    }
  });
  t.equal(out.length, 1);
  t.equal(out[0].winner, 'museum');
  t.end();
});

test('freetext date "14 March 1879" parses as year+month+day', function (t) {
  t.deepEqual(detect.parseDateParts('14 March 1879'), { year: 1879, month: 3, day: 14 });
  t.deepEqual(detect.parseDateParts('March 14, 1879'), { year: 1879, month: 3, day: 14 });
  t.true(detect.compareDates('14 March 1879', '1879-03-14'));
  t.false(detect.compareDates('14 March 1879', '1880-03-14'));
  t.end();
});

test('unparseable dates fall back to case-insensitive string equality', function (t) {
  t.true(detect.compareDates('unknown', 'UNKNOWN'));
  t.false(detect.compareDates('unknown', 'circa 1879'));
  t.end();
});

// --- Places ---------------------------------------------------------

test('birthPlace contradiction', function (t) {
  const out = detect({
    personData: { birthPlace: 'Ulm' },
    wikidataContext: {
      P19: { label: 'place of birth', value: 'Munich' }
    }
  });
  t.equal(out.length, 1);
  t.equal(out[0].factKey, 'birthPlace');
  t.equal(out[0].winner, 'museum');
  t.end();
});

test('place: substring match after comma-strip', function (t) {
  // "Ulm" vs "Ulm, Germany" — after normalisePlace both become "ulm"
  const out = detect({
    personData: { birthPlace: 'Ulm' },
    wikidataContext: {
      P19: { label: 'place of birth', value: 'Ulm, Germany' }
    }
  });
  t.equal(out.length, 0, 'comma-strip normalisation catches "Ulm" ≡ "Ulm, Germany"');
  t.end();
});

test('place: token overlap when comma-strip fails', function (t) {
  t.true(detect.comparePlaces('London', 'City of London'));
  t.false(detect.comparePlaces('London', 'Paris'));
  t.end();
});

// --- Occupation / nationality (list-shaped) -------------------------

test('occupation list overlap → no contradiction', function (t) {
  const out = detect({
    personData: { occupation: 'physicist' },
    wikidataContext: {
      P106: { label: 'occupation', value: 'physicist, theoretical physicist, mathematician' }
    }
  });
  t.equal(out.length, 0, 'shared "physicist" token means not contradictory');
  t.end();
});

test('occupation contradiction when no overlap', function (t) {
  const out = detect({
    personData: { occupation: 'physicist' },
    wikidataContext: {
      P106: { label: 'occupation', value: 'chemist, biologist' }
    }
  });
  t.equal(out.length, 1);
  t.equal(out[0].factKey, 'occupation');
  t.end();
});

test('nationality list normalisation', function (t) {
  t.true(detect.compareLists('German', 'german, swiss, american'));
  t.false(detect.compareLists('German', 'French'));
  t.end();
});

// --- Multiple contradictions in one call ----------------------------

test('multiple contradictions collected in one call', function (t) {
  const out = detect({
    personData: {
      birthDate: '1879-03-14',
      deathDate: '1955-04-18',
      birthPlace: 'Ulm'
    },
    wikidataContext: {
      P569: { label: 'date of birth', value: '+1879-03-15T00:00:00Z' },
      P570: { label: 'date of death', value: '+1955-04-19T00:00:00Z' },
      P19: { label: 'place of birth', value: 'Ulm, Germany' } // no contradiction
    }
  });
  t.equal(out.length, 2, 'two dates disagree, place agrees');
  const keys = out.map(function (c) { return c.factKey; }).sort();
  t.deepEqual(keys, ['birthDate', 'deathDate']);
  t.end();
});

// --- Priority ladder -------------------------------------------------

test('priority: museum beats wikidata', function (t) {
  const out = detect({
    personData: { birthDate: '1879-03-14' },
    wikidataContext: {
      P569: { label: 'date of birth', value: '+1879-03-15T00:00:00Z' }
    }
  });
  t.equal(out[0].winner, 'museum');
  t.equal(out[0].winnerValue, '1879-03-14');
  t.end();
});

// --- Wikidata claim shape variations --------------------------------

test('handles wikidata entry with only claims[] (no value)', function (t) {
  const out = detect({
    personData: { birthDate: '1879' },
    wikidataContext: {
      P569: {
        label: 'date of birth',
        claims: [{ value: '+1880-03-15T00:00:00Z' }]
      }
    }
  });
  t.equal(out.length, 1, 'reads value out of claims[] fallback');
  t.end();
});

test('handles wikidata entry as bare string (legacy shape)', function (t) {
  const out = detect({
    personData: { birthDate: '1879' },
    wikidataContext: {
      P569: '+1880-03-15T00:00:00Z'
    }
  });
  t.equal(out.length, 1, 'string entry parsed');
  t.end();
});

// --- Missing values are never contradictions ------------------------

test('missing museum value: no contradiction', function (t) {
  const out = detect({
    personData: {},
    wikidataContext: {
      P569: { label: 'date of birth', value: '+1879-03-14T00:00:00Z' }
    }
  });
  t.equal(out.length, 0);
  t.end();
});

test('missing wikidata: no contradiction', function (t) {
  const out = detect({
    personData: { birthDate: '1879-03-14' },
    wikidataContext: null
  });
  t.equal(out.length, 0);
  t.end();
});

// --- Data-shape defence ---------------------------------------------

test('does not crash on falsy inputs', function (t) {
  t.doesNotThrow(function () { detect(null); });
  t.doesNotThrow(function () { detect(undefined); });
  t.doesNotThrow(function () { detect({ personData: null, wikidataContext: null }); });
  t.end();
});
