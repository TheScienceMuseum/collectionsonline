'use strict';

// Tests for the Grace's Guide verification tool. Same fetch + LLM
// stubbing pattern as ai-external-wikipedia.test.js. Live HTTP
// deliberately never fires.

const test = require('tape');
const gracesGuide = require('../lib/ai/external-tools/graces-guide');

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

function searchResponse (title) {
  return { body: { query: { search: title ? [{ title }] : [] } } };
}

function extractResponse (title, extract) {
  return { body: { query: { pages: { 42: { pageid: 42, title, extract } } } } };
}

function makeLlmStub (verdict, supportsClaim, extractQuote) {
  const state = { calls: [] };
  state.messages = {
    create: function (params) {
      state.calls.push(params);
      return Promise.resolve({
        content: [{ text: JSON.stringify({ verdict, supportsClaim, reasoning: 'test', evidenceExtract: extractQuote || '' }) }],
        usage: { input_tokens: 500, output_tokens: 80 }
      });
    }
  };
  return state;
}

test('gracesGuide: happy path via subject.name search', async function (t) {
  const fetch = makeFetchStub([
    searchResponse('Robert Stephenson'),
    extractResponse('Robert Stephenson', 'Robert Stephenson was a mechanical engineer born in 1803.')
  ]);
  const llmClient = makeLlmStub('supported', true, 'was a mechanical engineer');
  const out = await gracesGuide.query('Stephenson was a mechanical engineer.', { name: 'Robert Stephenson' }, {
    fetch: fetch.fetch,
    llmClient
  });
  t.equal(out.matched, true);
  t.equal(out.verdict, 'supported');
  t.equal(out.extracts.length, 1);
  t.ok(out.extracts[0].url.indexOf('Robert_Stephenson') !== -1);
  t.end();
});

test('gracesGuide: skips search when P3074 present in wikidataContext', async function (t) {
  const fetch = makeFetchStub([
    // Only one fetch expected — no search call because P3074 gives the title directly.
    extractResponse('Robert Stephenson', 'Robert Stephenson was a mechanical engineer.')
  ]);
  const llmClient = makeLlmStub('supported', true, 'was a mechanical engineer');
  const out = await gracesGuide.query('mechanical engineer', { name: 'Robert Stephenson' }, {
    fetch: fetch.fetch,
    llmClient,
    wikidataContext: { P3074: 'Robert Stephenson' }
  });
  t.equal(out.matched, true);
  t.equal(fetch.calls.length, 1, 'search step skipped when P3074 gives the title');
  t.end();
});

test('gracesGuide: titleFromWikidata handles the three shapes', function (t) {
  t.equal(gracesGuide.titleFromWikidata({ P3074: 'Foo' }), 'Foo', 'string shape');
  t.equal(gracesGuide.titleFromWikidata({ P3074: { value: 'Bar' } }), 'Bar', 'value shape');
  t.equal(gracesGuide.titleFromWikidata({ P3074: { claims: [{ value: 'Baz' }] } }), 'Baz', 'claims shape');
  t.equal(gracesGuide.titleFromWikidata({}), null, 'no P3074 → null');
  t.equal(gracesGuide.titleFromWikidata(null), null, 'null context → null');
  t.end();
});

test('gracesGuide: missing subject name → matched:false', async function (t) {
  const out = await gracesGuide.query('claim', {}, { fetch: function () {} });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('subject name') !== -1);
  t.end();
});

test('gracesGuide: empty claim → matched:false', async function (t) {
  const out = await gracesGuide.query('', { name: 'Test' }, { fetch: function () {} });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('empty claim') !== -1);
  t.end();
});

test('gracesGuide: article search returns nothing → matched:false', async function (t) {
  const fetch = makeFetchStub([searchResponse(null)]);
  const out = await gracesGuide.query('claim', { name: 'Nobody' }, { fetch: fetch.fetch });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('no matching Grace\'s Guide article') !== -1);
  t.end();
});

test('gracesGuide: no LLM configured → returns extract with unclear verdict', async function (t) {
  const fetch = makeFetchStub([
    searchResponse('Robert Stephenson'),
    extractResponse('Robert Stephenson', 'A mechanical engineer.')
  ]);
  const out = await gracesGuide.query('claim', { name: 'Robert Stephenson' }, { fetch: fetch.fetch });
  t.equal(out.matched, true);
  t.equal(out.verdict, 'unclear');
  t.equal(out.extracts[0].supportsClaim, null);
  t.end();
});

test('gracesGuide: exports name + tier', function (t) {
  t.equal(gracesGuide.name, 'gracesGuide');
  t.equal(gracesGuide.tier, 'B', 'community-edited but subject-expert — above wikipedia');
  t.end();
});
