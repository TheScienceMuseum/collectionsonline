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

// --- Section parsing + priority + budget assembly ------------------
//
// These exercise the pure functions that assemble a budget-capped
// extract from a MediaWiki plaintext article: section splitting,
// priority classification, and byte-budget assembly. They protect
// the section-prioritisation logic that ensures Marketing content
// (like the 1914 flight sponsorship on Lipton) lands above product-
// catalogue trivia when budget is tight.

const wiki = require('../lib/ai/fetch-wikipedia-summary');

test('parseSections: LEAD gets empty heading, real sections get their name', function (t) {
  const text = 'Lead paragraph here. Continues with more prose.\n\nHistory\n\nThe subject was founded in 1890.';
  const s = wiki.parseSections(text);
  t.equal(s.length, 2);
  t.equal(s[0].heading, '', 'LEAD has empty heading');
  t.ok(s[0].body.indexOf('Lead paragraph') === 0);
  t.equal(s[1].heading, 'History');
  t.ok(s[1].body.indexOf('1890') !== -1);
  t.end();
});

test('parseSections: handles single-newline heading→body spacing (Wikipedia quirk)', function (t) {
  // Some articles put a single newline between heading and body
  // rather than the more common double. Both must parse cleanly.
  const text = 'Lead sentence spanning enough to look like real prose content.\n\nHistory\nThe subject was founded in 1890 and grew rapidly over the following decades.\n\nDevelopment\nExpansion to global markets began in 1900 with the establishment of overseas offices.';
  const s = wiki.parseSections(text);
  t.equal(s.length, 3, 'three sections: LEAD + History + Development');
  t.equal(s[1].heading, 'History');
  t.equal(s[2].heading, 'Development');
  t.end();
});

test('priorityOf: LEAD is 0, then HIGH (1), MEDIUM (2), LOW (3), SKIP (99)', function (t) {
  t.equal(wiki.priorityOf(''), 0, 'LEAD');
  t.equal(wiki.priorityOf('History'), 1, 'HIGH');
  t.equal(wiki.priorityOf('Early life'), 1, 'HIGH — early prefix');
  t.equal(wiki.priorityOf('Development'), 1, 'HIGH');
  t.equal(wiki.priorityOf('Marketing and advertising'), 2, 'MEDIUM — compound heading');
  t.equal(wiki.priorityOf('Today'), 2, 'MEDIUM');
  t.equal(wiki.priorityOf('Products'), 2, 'MEDIUM');
  t.equal(wiki.priorityOf('Death'), 2, 'MEDIUM — biographical framing');
  t.equal(wiki.priorityOf('Death and legacy'), 2, 'MEDIUM — compound');
  t.equal(wiki.priorityOf('Uncategorised section name'), 3, 'LOW (fallthrough)');
  t.equal(wiki.priorityOf('References'), 99, 'SKIP');
  t.equal(wiki.priorityOf('See also'), 99, 'SKIP');
  t.equal(wiki.priorityOf('Lipton\'s Seat'), 99, 'SKIP — tourism trivia');
  t.equal(wiki.priorityOf('Product quality controversy'), 99, 'SKIP');
  t.equal(wiki.priorityOf('Personal life'), 99, 'SKIP');
  t.end();
});

test('assembleWithBudget: LEAD always first, then HIGH before MEDIUM before LOW', function (t) {
  const text = [
    'Lead paragraph sentence one about the subject and its origins.',
    '', 'Uncategorised', '', 'A LOW-priority subsection that would come first in original order but shouldn\'t appear before HIGH.',
    '', 'History', '', 'HIGH-priority content about when and where the subject was founded and by whom.',
    '', 'Marketing and advertising', '', 'MEDIUM-priority content about how the subject was promoted over the years.'
  ].join('\n');
  const out = wiki.assembleWithBudget(text, 2000);
  const leadIdx = out.indexOf('Lead paragraph');
  const historyIdx = out.indexOf('History');
  const marketingIdx = out.indexOf('Marketing');
  const uncategorisedIdx = out.indexOf('Uncategorised');
  t.ok(leadIdx < historyIdx, 'LEAD before HIGH');
  t.ok(historyIdx < marketingIdx, 'HIGH before MEDIUM');
  t.ok(marketingIdx < uncategorisedIdx, 'MEDIUM before LOW');
  t.end();
});

test('assembleWithBudget: SKIP sections dropped regardless of budget', function (t) {
  const text = [
    'Lead paragraph sentence about the subject and its founding history.',
    '', 'History', '', 'The subject was founded in 1890 as detailed here.',
    '', 'References', '', 'These references would fit within budget but should be dropped.',
    '', 'See also', '', 'This See also content should also be dropped despite budget space.'
  ].join('\n');
  const out = wiki.assembleWithBudget(text, 10000);
  t.ok(out.indexOf('Lead paragraph') !== -1, 'LEAD kept');
  t.ok(out.indexOf('1890') !== -1, 'HIGH kept');
  t.equal(out.indexOf('References would fit'), -1, 'References dropped');
  t.equal(out.indexOf('See also content'), -1, 'See also dropped');
  t.end();
});

test('assembleWithBudget: respects budget, stops mid-section only when >=100 chars fit', function (t) {
  const text = [
    'Short lead.',
    '', 'History', '', 'A'.repeat(500),
    '', 'Marketing', '', 'B'.repeat(500)
  ].join('\n');
  // 400 char budget: lead (11) + \n\n (2) + History (7) + \n\n (2) + 378 chars of body = 400
  const out = wiki.assembleWithBudget(text, 400);
  t.ok(out.length <= 400, 'respects budget');
  t.ok(out.indexOf('Short lead') !== -1, 'LEAD included');
  t.ok(out.indexOf('History') !== -1, 'History header included');
  t.ok(out.indexOf('AAAA') !== -1, 'History body partially included');
  t.equal(out.indexOf('BBBB'), -1, 'Marketing body not reached');
  t.end();
});

test('assembleWithBudget: falls back to plain truncation when no sections detected', function (t) {
  // Article that's a single wall of text with no headings — should
  // still return SOMETHING (the raw start), not empty.
  const wall = 'This is a plain wall of text without any section headings. '.repeat(50);
  const out = wiki.assembleWithBudget(wall, 200);
  t.ok(out.length > 0);
  t.ok(out.length <= 200);
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
