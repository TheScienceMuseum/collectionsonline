'use strict';

// Tests for lib/ai/finding-filters — display-time filter that drops
// review findings whose claimSignature no longer maps to any current
// sentence. Filters are pure functions; no fixtures needed.

const test = require('tape');
const { filterToCurrentSentences, countStale, collectStale } = require('../lib/ai/finding-filters');

const sig = function (s) { return s; }; // signatures are opaque strings in these tests

// --- filterToCurrentSentences ---------------------------------------

test('filter: keeps findings whose signature matches a current sentence', function (t) {
  const sentences = [{ claimSignature: sig('a') }, { claimSignature: sig('b') }];
  const findings = [
    { claimSignature: sig('a'), concern: 'x' },
    { claimSignature: sig('c'), concern: 'stale' },
    { claimSignature: sig('b'), concern: 'y' }
  ];
  const out = filterToCurrentSentences(findings, sentences);
  t.equal(out.length, 2);
  t.deepEqual(out.map(function (f) { return f.claimSignature; }), ['a', 'b']);
  t.end();
});

test('filter: preserves input ordering (does not resort)', function (t) {
  const sentences = [{ claimSignature: 'a' }, { claimSignature: 'b' }, { claimSignature: 'c' }];
  const findings = [
    { claimSignature: 'c' },
    { claimSignature: 'a' },
    { claimSignature: 'b' }
  ];
  const out = filterToCurrentSentences(findings, sentences);
  t.deepEqual(out.map(function (f) { return f.claimSignature; }), ['c', 'a', 'b']);
  t.end();
});

test('filter: drops findings without a claimSignature', function (t) {
  const sentences = [{ claimSignature: 'a' }];
  const findings = [
    { claimSignature: 'a', concern: 'ok' },
    { concern: 'missing sig' },
    { claimSignature: null, concern: 'null sig' }
  ];
  const out = filterToCurrentSentences(findings, sentences);
  t.equal(out.length, 1);
  t.equal(out[0].concern, 'ok');
  t.end();
});

test('filter: no sentences → all findings dropped as stale', function (t) {
  const findings = [{ claimSignature: 'a' }, { claimSignature: 'b' }];
  t.equal(filterToCurrentSentences(findings, []).length, 0);
  t.equal(filterToCurrentSentences(findings, null).length, 0);
  t.end();
});

test('filter: no findings → empty', function (t) {
  const sentences = [{ claimSignature: 'a' }];
  t.deepEqual(filterToCurrentSentences([], sentences), []);
  t.deepEqual(filterToCurrentSentences(null, sentences), []);
  t.end();
});

// --- countStale ------------------------------------------------------

test('countStale: counts filtered-out findings', function (t) {
  const sentences = [{ claimSignature: 'a' }];
  const findings = [
    { claimSignature: 'a' },
    { claimSignature: 'b' },
    { claimSignature: 'c' }
  ];
  t.equal(countStale(findings, sentences), 2);
  t.end();
});

test('countStale: findings without a signature count as stale', function (t) {
  const sentences = [{ claimSignature: 'a' }];
  const findings = [
    { claimSignature: 'a' },
    { concern: 'orphan' }
  ];
  t.equal(countStale(findings, sentences), 1);
  t.end();
});

test('countStale: all-fresh → 0', function (t) {
  const sentences = [{ claimSignature: 'a' }, { claimSignature: 'b' }];
  const findings = [{ claimSignature: 'a' }, { claimSignature: 'b' }];
  t.equal(countStale(findings, sentences), 0);
  t.end();
});

// --- collectStale ---------------------------------------------------

test('collectStale: returns findings whose signature is not in sentences', function (t) {
  const sentences = [{ claimSignature: 'a' }];
  const findings = [
    { claimSignature: 'a', concern: 'fresh' },
    { claimSignature: 'b', concern: 'gone' },
    { claimSignature: 'c', concern: 'also gone' }
  ];
  const out = collectStale(findings, sentences);
  t.equal(out.length, 2);
  t.equal(out[0].concern, 'gone');
  t.equal(out[1].concern, 'also gone');
  t.end();
});

test('collectStale: findings without a signature are included as stale', function (t) {
  const sentences = [{ claimSignature: 'a' }];
  const findings = [
    { claimSignature: 'a', concern: 'fresh' },
    { concern: 'orphan' }
  ];
  const out = collectStale(findings, sentences);
  t.equal(out.length, 1);
  t.equal(out[0].concern, 'orphan');
  t.end();
});

test('collectStale: all-fresh → empty array', function (t) {
  const sentences = [{ claimSignature: 'a' }, { claimSignature: 'b' }];
  const findings = [{ claimSignature: 'a' }, { claimSignature: 'b' }];
  t.deepEqual(collectStale(findings, sentences), []);
  t.end();
});

test('collectStale: length matches countStale (paired helpers)', function (t) {
  const sentences = [{ claimSignature: 'a' }];
  const findings = [{ claimSignature: 'a' }, { claimSignature: 'b' }, { concern: 'orphan' }];
  t.equal(collectStale(findings, sentences).length, countStale(findings, sentences));
  t.end();
});

// --- Behavioural / regression -------------------------------------

test('filter is display-time: does not mutate inputs', function (t) {
  const sentences = [{ claimSignature: 'a' }];
  const findings = [{ claimSignature: 'a' }, { claimSignature: 'b' }];
  const beforeSentences = JSON.stringify(sentences);
  const beforeFindings = JSON.stringify(findings);
  filterToCurrentSentences(findings, sentences);
  countStale(findings, sentences);
  collectStale(findings, sentences);
  t.equal(JSON.stringify(sentences), beforeSentences, 'sentences unchanged');
  t.equal(JSON.stringify(findings), beforeFindings, 'findings unchanged');
  t.end();
});

test('filter: resurfacing scenario — sentence removed then returns', function (t) {
  // Simulates the plan's "resurface" behaviour: a claim was pending,
  // sentence rewritten (different signature), old finding filtered
  // out. Later regen re-emits the original claim — same signature —
  // finding resurfaces. This test proves the filter is stateless:
  // it produces the same output for the same input regardless of
  // any prior call.
  const findings = [{ claimSignature: 'a', concern: 'pending forever' }];

  // T1: sentence set doesn't include 'a'
  const t1 = filterToCurrentSentences(findings, [{ claimSignature: 'x' }]);
  t.equal(t1.length, 0, 'finding filtered out — sentence gone');

  // T2: regen brings the same claim back
  const t2 = filterToCurrentSentences(findings, [{ claimSignature: 'a' }]);
  t.equal(t2.length, 1, 'finding automatically resurfaces');
  t.equal(t2[0].concern, 'pending forever', 'same finding, unchanged');
  t.end();
});
