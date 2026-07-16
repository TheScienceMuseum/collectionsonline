'use strict';

// Tests for the input-mode Grace's Guide fetcher. Live HTTP not
// exercised — the fetch impl is injected so we can control every
// response.
//
// Gating contract: master flag OFF → null with zero HTTP.
// Subject has no Wikidata P3074 → null with zero HTTP (no article
// exists, don't waste a request). Otherwise fires one MediaWiki
// query against gracesguide.co.uk/api.php.

const test = require('tape');
const fetchGracesGuideSummary = require('../lib/ai/fetch-graces-guide-summary');
const extractTitle = fetchGracesGuideSummary.extractGracesGuideTitleFromWikidata;

function makeFetch (response) {
  const calls = [];
  const impl = async function (url, opts) {
    calls.push({ url, opts });
    return {
      ok: true,
      json: async function () { return response; }
    };
  };
  impl.calls = calls;
  return impl;
}

// --- Gating -----------------------------------------------------------

test('returns null when master flag is off', async function (t) {
  const impl = makeFetch({});
  const out = await fetchGracesGuideSummary({
    config: { aiBiographyGracesGuideEnabled: false },
    wikidataContext: { P3074: { claims: [{ value: 'Great Northern Railway' }] } },
    fetch: impl
  });
  t.equal(out, null);
  t.equal(impl.calls.length, 0);
  t.end();
});

test('returns null when no Wikidata P3074 (subject has no Grace\'s Guide entry)', async function (t) {
  const impl = makeFetch({});
  const out = await fetchGracesGuideSummary({
    config: { aiBiographyGracesGuideEnabled: true },
    wikidataContext: { P108: { claims: [{ value: 'X' }] } },
    fetch: impl
  });
  t.equal(out, null);
  t.equal(impl.calls.length, 0, 'skip subjects without Grace\'s Guide article');
  t.end();
});

test('defaults to enabled when config flag absent', async function (t) {
  const impl = makeFetch({
    query: { pages: { 42: { extract: 'The Great Northern Railway…' } } }
  });
  const out = await fetchGracesGuideSummary({
    config: {},
    wikidataContext: { P3074: { claims: [{ value: 'Great Northern Railway' }] } },
    fetch: impl
  });
  t.ok(out, 'fires when master flag not set to false');
  t.equal(out.title, 'Great Northern Railway');
  t.end();
});

// --- Fetch happy path -------------------------------------------------

test('fires request against gracesguide.co.uk API when P3074 present', async function (t) {
  const impl = makeFetch({
    query: { pages: { 42: { extract: 'The Great Northern Railway (GNR) was a British railway company incorporated in 1846.' } } }
  });
  const out = await fetchGracesGuideSummary({
    config: { aiBiographyGracesGuideEnabled: true },
    wikidataContext: { P3074: { claims: [{ value: 'Great Northern Railway' }] } },
    fetch: impl
  });
  t.equal(impl.calls.length, 1);
  t.ok(impl.calls[0].url.indexOf('gracesguide.co.uk/api.php') !== -1, 'hits Grace\'s Guide MediaWiki API');
  t.ok(impl.calls[0].url.indexOf('titles=Great+Northern+Railway') !== -1, 'article title in query');
  t.equal(out.title, 'Great Northern Railway');
  t.equal(out.url, 'https://www.gracesguide.co.uk/Great_Northern_Railway');
  t.ok(out.extract.indexOf('incorporated in 1846') !== -1);
  t.end();
});

test('response with no extract → null', async function (t) {
  const impl = makeFetch({ query: { pages: { 42: {} } } });
  const out = await fetchGracesGuideSummary({
    config: {},
    wikidataContext: { P3074: { claims: [{ value: 'X' }] } },
    fetch: impl
  });
  t.equal(out, null);
  t.end();
});

test('response truncated when longer than EXTRACT_MAX_CHARS', async function (t) {
  const longText = 'The railway was long. '.repeat(500);
  const impl = makeFetch({ query: { pages: { 42: { extract: longText } } } });
  const out = await fetchGracesGuideSummary({
    config: {},
    wikidataContext: { P3074: { claims: [{ value: 'X' }] } },
    fetch: impl
  });
  t.ok(out.extract.length <= 2100, 'truncated to ~2000 chars');
  t.end();
});

// --- extractGracesGuideTitleFromWikidata ---------------------------

test('extractGracesGuideTitleFromWikidata: null / undefined → null', function (t) {
  t.equal(extractTitle(null), null);
  t.equal(extractTitle({}), null);
  t.end();
});

test('extractGracesGuideTitleFromWikidata: string entry (legacy shape)', function (t) {
  t.equal(extractTitle({ P3074: 'Great Northern Railway' }), 'Great Northern Railway');
  t.end();
});

test('extractGracesGuideTitleFromWikidata: post-upgrade shape', function (t) {
  t.equal(
    extractTitle({ P3074: { label: 'Grace\'s Guide ID', value: 'Great Northern Railway', claims: [{ value: 'Great Northern Railway' }] } }),
    'Great Northern Railway'
  );
  t.end();
});
