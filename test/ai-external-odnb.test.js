'use strict';

// Tests for the Oxford DNB verification tool. The adapter self-gates
// on config credentials so most tests exercise those gates first.

const test = require('tape');
const odnb = require('../lib/ai/external-tools/odnb');

function makeFetchStub (responses) {
  const state = { calls: [] };
  state.fetch = function (url, opts) {
    state.calls.push({ url, opts });
    const next = responses.shift();
    if (!next) return Promise.reject(new Error('no more stubbed responses'));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve({
      ok: next.ok !== false,
      status: next.status || 200,
      json: function () { return Promise.resolve(next.body); }
    });
  };
  return state;
}

function makeLlmStub (verdict, supportsClaim, extractQuote) {
  const state = { calls: [] };
  state.messages = {
    create: function (params) {
      state.calls.push(params);
      return Promise.resolve({
        content: [{ text: JSON.stringify({ verdict, supportsClaim, reasoning: 'test', evidenceExtract: extractQuote || '' }) }],
        usage: { input_tokens: 1200, output_tokens: 90 }
      });
    }
  };
  return state;
}

function fullConfig () {
  return {
    aiBiographyOdnbEnabled: true,
    aiBiographyOdnbApiUrl: 'https://odnb.example.com/entries',
    aiBiographyOdnbApiToken: 'test-token'
  };
}

test('odnb: happy path via P1415 identifier', async function (t) {
  const fetch = makeFetchStub([
    { body: { title: 'Einstein, Albert', extract: 'Einstein was a physicist born in Ulm.', url: 'https://odnb.example.com/e/12345' } }
  ]);
  const llmClient = makeLlmStub('supported', true, 'Einstein was a physicist');
  const out = await odnb.query('Einstein was a physicist.', { name: 'Albert Einstein' }, {
    fetch: fetch.fetch,
    llmClient,
    config: fullConfig(),
    wikidataContext: { P1415: '12345' }
  });
  t.equal(out.matched, true);
  t.equal(out.verdict, 'supported');
  t.equal(out.extracts[0].supportsClaim, true);
  t.end();
});

test('odnb: disabled by config → matched:false silently', async function (t) {
  const out = await odnb.query('claim', { name: 'X' }, {
    config: { aiBiographyOdnbEnabled: false, aiBiographyOdnbApiUrl: 'x', aiBiographyOdnbApiToken: 'x' },
    wikidataContext: { P1415: '12345' }
  });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('disabled') !== -1);
  t.end();
});

test('odnb: missing credentials → matched:false silently', async function (t) {
  const out = await odnb.query('claim', { name: 'X' }, {
    config: { aiBiographyOdnbEnabled: true, aiBiographyOdnbApiUrl: '', aiBiographyOdnbApiToken: '' },
    wikidataContext: { P1415: '12345' }
  });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('credentials') !== -1);
  t.end();
});

test('odnb: no P1415 in wikidataContext → matched:false', async function (t) {
  const out = await odnb.query('claim', { name: 'X' }, {
    config: fullConfig(),
    wikidataContext: {}
  });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('P1415') !== -1);
  t.end();
});

test('odnb: empty claim → matched:false', async function (t) {
  const out = await odnb.query('', { name: 'X' }, {
    config: fullConfig(),
    wikidataContext: { P1415: '12345' }
  });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('empty claim') !== -1);
  t.end();
});

test('odnb: 404 from API → matched:false with error', async function (t) {
  const fetch = makeFetchStub([{ ok: false, status: 404, body: {} }]);
  const out = await odnb.query('claim', { name: 'X' }, {
    fetch: fetch.fetch,
    config: fullConfig(),
    wikidataContext: { P1415: '12345' }
  });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('fetch failed') !== -1 || out.error.indexOf('no ODNB entry') !== -1);
  t.end();
});

test('odnb: no LLM configured → returns extract with unclear verdict', async function (t) {
  const fetch = makeFetchStub([{
    body: { title: 'Einstein', extract: 'Physicist.', url: 'https://odnb.example.com/12345' }
  }]);
  const out = await odnb.query('claim', { name: 'X' }, {
    fetch: fetch.fetch,
    config: fullConfig(),
    wikidataContext: { P1415: '12345' }
  });
  t.equal(out.matched, true);
  t.equal(out.verdict, 'unclear');
  t.equal(out.extracts[0].supportsClaim, null);
  t.end();
});

test('odnb: odnbIdFromWikidata handles the three shapes', function (t) {
  t.equal(odnb.odnbIdFromWikidata({ P1415: 'abc' }), 'abc');
  t.equal(odnb.odnbIdFromWikidata({ P1415: { value: 'def' } }), 'def');
  t.equal(odnb.odnbIdFromWikidata({ P1415: { claims: [{ value: 'ghi' }] } }), 'ghi');
  t.equal(odnb.odnbIdFromWikidata({}), null);
  t.equal(odnb.odnbIdFromWikidata(null), null);
  t.end();
});

test('odnb: exports name + tier', function (t) {
  t.equal(odnb.name, 'oxfordDNB');
  t.equal(odnb.tier, 'A', 'peer-reviewed scholarship — the strongest tier');
  t.end();
});
