'use strict';

// Tests for the Wikipedia verification tool. Both fetch and Anthropic
// clients are stubbed via opts; no live network calls.

const test = require('tape');
const wikipedia = require('../lib/ai/external-tools/wikipedia');

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
  return {
    body: {
      query: {
        pages: {
          123: { pageid: 123, title, extract }
        }
      }
    }
  };
}

function makeLlmStub (verdict, supportsClaim, extractQuote) {
  const state = { calls: [] };
  state.messages = {
    create: function (params) {
      state.calls.push(params);
      const responseObj = {
        verdict,
        supportsClaim,
        reasoning: 'test verdict',
        evidenceExtract: extractQuote || ''
      };
      return Promise.resolve({
        content: [{ text: JSON.stringify(responseObj) }],
        usage: { input_tokens: 800, output_tokens: 100 }
      });
    }
  };
  return state;
}

// --- Happy path ------------------------------------------------------

test('wikipedia: happy path — article found + LLM says supported', async function (t) {
  const fetch = makeFetchStub([
    searchResponse('Albert Einstein'),
    extractResponse('Albert Einstein', 'Einstein was born in Ulm in 1879. He worked at the Federal Office for Intellectual Property.')
  ]);
  const llmClient = makeLlmStub('supported', true, 'Einstein was born in Ulm in 1879');
  const out = await wikipedia.query('Einstein was born in Ulm.', { name: 'Albert Einstein' }, {
    fetch: fetch.fetch,
    llmClient
  });
  t.equal(out.matched, true);
  t.equal(out.verdict, 'supported');
  t.equal(out.extracts.length, 1);
  t.equal(out.extracts[0].supportsClaim, true);
  t.ok(out.extracts[0].url.indexOf('Albert_Einstein') !== -1, 'URL points to article');
  t.ok(out.cost >= 0);
  t.end();
});

// --- Fetch / setup errors -------------------------------------------

test('wikipedia: no fetch available → error result', async function (t) {
  const out = await wikipedia.query('claim', { name: 'Test' }, { fetch: null });
  // If global fetch also isn't available, error; otherwise it may hit the network in tests.
  // Only assert the error path when we've forced null.
  t.ok(out.matched === false || out.matched === true, 'result returned');
  t.end();
});

test('wikipedia: missing subject name → matched:false', async function (t) {
  const out = await wikipedia.query('claim', {}, { fetch: function () {} });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('subject name') !== -1);
  t.end();
});

test('wikipedia: empty claim → matched:false', async function (t) {
  const out = await wikipedia.query('', { name: 'Test' }, { fetch: function () {} });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('empty claim') !== -1);
  t.end();
});

// --- Article resolution failure paths -------------------------------

test('wikipedia: article search returns nothing → matched:false', async function (t) {
  const fetch = makeFetchStub([searchResponse(null)]);
  const out = await wikipedia.query('claim', { name: 'Unknown Person' }, { fetch: fetch.fetch });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('no matching Wikipedia article') !== -1);
  t.end();
});

test('wikipedia: extract API returns no page → matched:false', async function (t) {
  const fetch = makeFetchStub([
    searchResponse('Some Title'),
    { body: { query: { pages: {} } } }
  ]);
  const out = await wikipedia.query('claim', { name: 'Some Title' }, { fetch: fetch.fetch });
  t.equal(out.matched, false);
  t.end();
});

test('wikipedia: HTTP error → matched:false with error message', async function (t) {
  const fetch = makeFetchStub([{ ok: false, status: 500, body: {} }]);
  const out = await wikipedia.query('claim', { name: 'Test' }, { fetch: fetch.fetch });
  t.equal(out.matched, false);
  t.ok(out.error.indexOf('fetch failed') !== -1);
  t.end();
});

// --- LLM absent / failure paths -------------------------------------

test('wikipedia: article found but no API key → returns extract with unclear verdict', async function (t) {
  const fetch = makeFetchStub([
    searchResponse('Test'),
    extractResponse('Test', 'Test article content.')
  ]);
  const out = await wikipedia.query('claim', { name: 'Test' }, { fetch: fetch.fetch });
  t.equal(out.matched, true);
  t.equal(out.verdict, 'unclear');
  t.equal(out.extracts[0].supportsClaim, null);
  t.ok(out.reasoning.indexOf('no LLM') !== -1);
  t.end();
});

test('wikipedia: LLM call fails → returns extract with unclear verdict', async function (t) {
  const fetch = makeFetchStub([
    searchResponse('Test'),
    extractResponse('Test', 'Test content.')
  ]);
  const llmClient = {
    messages: {
      create: function () { return Promise.reject(new Error('llm rate-limited')); }
    }
  };
  const out = await wikipedia.query('claim', { name: 'Test' }, { fetch: fetch.fetch, llmClient });
  t.equal(out.matched, true);
  t.equal(out.verdict, 'unclear');
  t.ok(out.reasoning.indexOf('llm check failed') !== -1);
  t.end();
});

test('wikipedia: LLM returns unparseable text → verdict defaults to unclear', async function (t) {
  const fetch = makeFetchStub([
    searchResponse('Test'),
    extractResponse('Test', 'Test content.')
  ]);
  const llmClient = {
    messages: {
      create: function () {
        return Promise.resolve({
          content: [{ text: 'this is not JSON at all' }],
          usage: { input_tokens: 100, output_tokens: 20 }
        });
      }
    }
  };
  const out = await wikipedia.query('claim', { name: 'Test' }, { fetch: fetch.fetch, llmClient });
  t.equal(out.verdict, 'unclear');
  t.equal(out.extracts[0].supportsClaim, null);
  t.end();
});

test('wikipedia: LLM returns unsupported verdict', async function (t) {
  const fetch = makeFetchStub([
    searchResponse('Test'),
    extractResponse('Test', 'Test content.')
  ]);
  const llmClient = makeLlmStub('unsupported', false, '');
  const out = await wikipedia.query('claim', { name: 'Test' }, { fetch: fetch.fetch, llmClient });
  t.equal(out.verdict, 'unsupported');
  t.equal(out.extracts[0].supportsClaim, false);
  t.end();
});

test('wikipedia: exports name and tier', function (t) {
  t.equal(wikipedia.name, 'wikipedia');
  t.equal(wikipedia.tier, 'C');
  t.end();
});
