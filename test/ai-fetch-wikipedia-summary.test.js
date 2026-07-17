'use strict';

// Tests for the shouldFetchWikipedia decision helper.
//
// The actual fetch logic (title resolution, MediaWiki API call, truncation)
// isn't exercised here — it's straightforward HTTP-plumbing that would need
// network mocks to test meaningfully. What we do test is the gating logic
// added 2026-07-17, which decides whether to fire Wikipedia at all given
// the config flags + the sources already gathered.

const test = require('tape');
const { shouldFetchWikipedia } = require('../lib/ai/fetch-wikipedia-summary');

function makeWd (claimCount) {
  const ctx = {};
  for (let i = 0; i < claimCount; i += 1) {
    const p = 'P' + (100 + i);
    ctx[p] = { label: 'prop-' + i, value: 'v' };
    // Fetcher dual-keys under P-code + label; we only count P-codes so
    // the label key doesn't inflate the count.
    ctx['prop-' + i] = ctx[p];
  }
  return ctx;
}

// --- master flag off ---------------------------------------------------

test('master flag off → no fetch', function (t) {
  const r = shouldFetchWikipedia({ aiBiographyWikipediaEnabled: false }, {}, {});
  t.deepEqual(r, { fire: false, reason: 'flag_off' });
  t.end();
});

test('master flag missing → no fetch (default off as of 2026-07-17)', function (t) {
  const r = shouldFetchWikipedia({}, {}, {});
  t.equal(r.fire, false);
  t.equal(r.reason, 'flag_off');
  t.end();
});

test('null config → no fetch (defensive)', function (t) {
  const r = shouldFetchWikipedia(null, {}, {});
  t.equal(r.fire, false);
  t.end();
});

// --- master flag on + adaptive-disabled → always fire -----------------

test('flag on + adaptive-disabled → fire regardless of source shape', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true,
    aiBiographyWikipediaAdaptiveDisabled: true
  }, { biography: 'x'.repeat(5000) }, makeWd(30));
  t.equal(r.fire, true);
  t.equal(r.reason, 'flag_on_adaptive_disabled');
  t.end();
});

// --- master flag on + adaptive on: gate on Wikidata claim count -------

test('flag on, adaptive on, Wikidata claim count at threshold → gated', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true,
    aiBiographyWikipediaAdaptiveMinWikidataClaims: 8
  }, {}, makeWd(8));
  t.equal(r.fire, false);
  t.equal(r.reason, 'gated_by_wikidata_claims:8');
  t.end();
});

test('flag on, adaptive on, Wikidata claim count above threshold → gated', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true,
    aiBiographyWikipediaAdaptiveMinWikidataClaims: 8
  }, {}, makeWd(20));
  t.equal(r.fire, false);
  t.equal(r.reason, 'gated_by_wikidata_claims:20');
  t.end();
});

// --- master flag on + adaptive on: gate on museum biography chars -----

test('flag on, adaptive on, museum biography above threshold → gated', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true,
    aiBiographyWikipediaAdaptiveMinMuseumChars: 500
  }, { biography: 'x'.repeat(600) }, makeWd(2));
  t.equal(r.fire, false);
  t.equal(r.reason, 'gated_by_museum_chars:600');
  t.end();
});

test('museum biography + briefBiography combined counts', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true,
    aiBiographyWikipediaAdaptiveMinMuseumChars: 500
  }, { biography: 'x'.repeat(300), briefBiography: 'y'.repeat(300) }, makeWd(2));
  t.equal(r.fire, false, 'combined 600 chars ≥ 500 threshold');
  t.equal(r.reason, 'gated_by_museum_chars:600');
  t.end();
});

// --- master flag on + adaptive on: both gates below threshold → fire --

test('flag on, adaptive on, both gates below threshold → fire', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true
  }, { biography: 'short' }, makeWd(2));
  t.equal(r.fire, true);
  t.equal(r.reason, 'adaptive_thin_sources');
  t.end();
});

test('flag on, adaptive on, no wikidata + no biography → fire (thinnest case)', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true
  }, {}, null);
  t.equal(r.fire, true);
  t.equal(r.reason, 'adaptive_thin_sources');
  t.end();
});

// --- config overrides -------------------------------------------------

test('custom Wikidata threshold overrides default 8', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true,
    aiBiographyWikipediaAdaptiveMinWikidataClaims: 20
  }, {}, makeWd(15));
  t.equal(r.fire, true, '15 claims < 20 threshold → below gate');
  t.end();
});

test('custom museum threshold overrides default 500', function (t) {
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true,
    aiBiographyWikipediaAdaptiveMinMuseumChars: 2000
  }, { biography: 'x'.repeat(600) }, {});
  t.equal(r.fire, true, '600 chars < 2000 threshold → below gate');
  t.end();
});

// --- Wikidata claim counting excludes human-label dual-keys ----------

test('dual-keyed Wikidata entries are not double-counted', function (t) {
  const ctx = makeWd(5);
  // makeWd adds both P-code and human-label keys; there are 10 keys
  // total but only 5 real properties.
  t.equal(Object.keys(ctx).length, 10);
  const r = shouldFetchWikipedia({
    aiBiographyWikipediaEnabled: true,
    aiBiographyWikipediaAdaptiveMinWikidataClaims: 8
  }, {}, ctx);
  t.equal(r.fire, true, '5 P-codes < 8 threshold — should fire');
  t.equal(r.reason, 'adaptive_thin_sources');
  t.end();
});
