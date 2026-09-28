'use strict';

// Tests for the input-mode ODNB fetcher. Live HTTP not exercised —
// the fetch impl is injected so we can control every response.
//
// The adapter has a strict gating contract: master flag OFF or
// credentials missing or subject has no Wikidata P1415 → returns
// null without making any HTTP call. When all three gates open, it
// fires ONE request with the ODNB id extracted from Wikidata's
// P1415 property.

const test = require('tape');
const fetchOdnbSummary = require('../lib/ai/fetch-odnb-summary');
const extractOdnbId = fetchOdnbSummary.extractOdnbIdFromWikidata;

// A fake fetch that captures the URL + headers it was called with
// and returns a canned JSON response. Never invoked when the adapter
// is supposed to short-circuit.
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
  const out = await fetchOdnbSummary({
    config: { aiBiographyOdnbEnabled: false, aiBiographyOdnbApiUrl: 'https://example', aiBiographyOdnbApiToken: 'x' },
    wikidataContext: { P1415: { value: '32615', claims: [{ value: '32615' }] } },
    fetch: impl
  });
  t.equal(out, null);
  t.equal(impl.calls.length, 0, 'no HTTP call made');
  t.end();
});

test('returns null when API URL missing', async function (t) {
  const impl = makeFetch({});
  const out = await fetchOdnbSummary({
    config: { aiBiographyOdnbEnabled: true, aiBiographyOdnbApiUrl: '', aiBiographyOdnbApiToken: 'x' },
    wikidataContext: { P1415: { claims: [{ value: '32615' }] } },
    fetch: impl
  });
  t.equal(out, null);
  t.equal(impl.calls.length, 0);
  t.end();
});

test('returns null when API token missing', async function (t) {
  const impl = makeFetch({});
  const out = await fetchOdnbSummary({
    config: { aiBiographyOdnbEnabled: true, aiBiographyOdnbApiUrl: 'https://example', aiBiographyOdnbApiToken: '' },
    wikidataContext: { P1415: { claims: [{ value: '32615' }] } },
    fetch: impl
  });
  t.equal(out, null);
  t.equal(impl.calls.length, 0);
  t.end();
});

test('returns null when subject has no Wikidata P1415 (no ODNB entry)', async function (t) {
  const impl = makeFetch({});
  const out = await fetchOdnbSummary({
    config: { aiBiographyOdnbEnabled: true, aiBiographyOdnbApiUrl: 'https://example', aiBiographyOdnbApiToken: 'x' },
    wikidataContext: { P108: { claims: [{ value: 'ETH' }] } }, // No P1415
    fetch: impl
  });
  t.equal(out, null);
  t.equal(impl.calls.length, 0, 'no HTTP call — skip subjects without ODNB entries');
  t.end();
});

// --- Fetch happy path -------------------------------------------------

test('fires request with Bearer token when all gates open', async function (t) {
  const impl = makeFetch({
    title: 'Einstein, Albert',
    url: 'https://www.oxforddnb.com/view/article/999',
    extract: 'Einstein, Albert (1879-1955), theoretical physicist…'
  });
  const out = await fetchOdnbSummary({
    config: {
      aiBiographyOdnbEnabled: true,
      aiBiographyOdnbApiUrl: 'https://example/api',
      aiBiographyOdnbApiToken: 'secret-token'
    },
    wikidataContext: { P1415: { claims: [{ value: '32615' }] } },
    fetch: impl
  });
  t.equal(impl.calls.length, 1, 'one HTTP call');
  t.equal(impl.calls[0].opts.headers.Authorization, 'Bearer secret-token');
  t.ok(impl.calls[0].url.indexOf('id=32615') !== -1, 'ODNB id in query string');
  t.equal(out.title, 'Einstein, Albert');
  t.equal(out.extract, 'Einstein, Albert (1879-1955), theoretical physicist…');
  t.end();
});

test('appends id param correctly when URL already has query string', async function (t) {
  const impl = makeFetch({ title: 'X', extract: 'x' });
  await fetchOdnbSummary({
    config: {
      aiBiographyOdnbEnabled: true,
      aiBiographyOdnbApiUrl: 'https://example/api?foo=bar',
      aiBiographyOdnbApiToken: 't'
    },
    wikidataContext: { P1415: { claims: [{ value: '123' }] } },
    fetch: impl
  });
  t.equal(impl.calls.length, 1);
  t.ok(impl.calls[0].url.indexOf('?foo=bar&id=123') !== -1, 'appended with &, not ?');
  t.end();
});

test('response with no extract → null', async function (t) {
  const impl = makeFetch({ title: 'X' });
  const out = await fetchOdnbSummary({
    config: {
      aiBiographyOdnbEnabled: true,
      aiBiographyOdnbApiUrl: 'https://example',
      aiBiographyOdnbApiToken: 't'
    },
    wikidataContext: { P1415: { claims: [{ value: '1' }] } },
    fetch: impl
  });
  t.equal(out, null);
  t.end();
});

test('response truncated when longer than EXTRACT_MAX_CHARS', async function (t) {
  const longText = 'Einstein was a physicist. '.repeat(500); // ~12500 chars
  const impl = makeFetch({ title: 'X', extract: longText });
  const out = await fetchOdnbSummary({
    config: {
      aiBiographyOdnbEnabled: true,
      aiBiographyOdnbApiUrl: 'https://example',
      aiBiographyOdnbApiToken: 't'
    },
    wikidataContext: { P1415: { claims: [{ value: '1' }] } },
    fetch: impl
  });
  t.ok(out.extract.length <= 2600, 'truncated to ~2500 chars with sentence boundary tolerance');
  t.end();
});

// --- extractOdnbIdFromWikidata ---------------------------------------

test('extractOdnbIdFromWikidata: null / undefined → null', function (t) {
  t.equal(extractOdnbId(null), null);
  t.equal(extractOdnbId(undefined), null);
  t.equal(extractOdnbId({}), null);
  t.end();
});

test('extractOdnbIdFromWikidata: string entry (legacy shape)', function (t) {
  t.equal(extractOdnbId({ P1415: '32615' }), '32615');
  t.end();
});

test('extractOdnbIdFromWikidata: post-upgrade shape with claims[]', function (t) {
  t.equal(
    extractOdnbId({ P1415: { label: 'ODNB ID', value: '32615', claims: [{ value: '32615', qCode: null }] } }),
    '32615'
  );
  t.end();
});

test('extractOdnbIdFromWikidata: falls back to entry.value when claims[] empty', function (t) {
  t.equal(extractOdnbId({ P1415: { value: '32615' } }), '32615');
  t.end();
});
