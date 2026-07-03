'use strict';

// Tests for the external verification orchestrator. Individual tools
// are stubbed via the REGISTRY export so we don't invoke Wikipedia or
// Wikidata for real.

const test = require('tape');
const verifyExternal = require('../lib/ai/verify-external');

// Rewire the REGISTRY to inject a stub tool set per test. Original is
// restored in the teardown at the end of each test via t.teardown().
function useTools (tools) {
  const original = Object.assign({}, verifyExternal.REGISTRY);
  Object.keys(verifyExternal.REGISTRY).forEach(function (k) { delete verifyExternal.REGISTRY[k]; });
  Object.keys(tools).forEach(function (k) { verifyExternal.REGISTRY[k] = tools[k]; });
  return function restore () {
    Object.keys(verifyExternal.REGISTRY).forEach(function (k) { delete verifyExternal.REGISTRY[k]; });
    Object.keys(original).forEach(function (k) { verifyExternal.REGISTRY[k] = original[k]; });
  };
}

function stubTool (name, tier, response) {
  return {
    name,
    tier,
    query: function () { return Promise.resolve(response); }
  };
}

// --- Happy path (single tool) ---------------------------------------

test('verify: single tool returns supported → verdict supported', async function (t) {
  const restore = useTools({
    wiki: stubTool('wiki', 'C', {
      matched: true,
      verdict: 'supported',
      extracts: [{ text: 'evidence', url: 'https://example.com/a', supportsClaim: true }],
      cost: 0.001
    })
  });
  const out = await verifyExternal('some claim', { name: 'Test', id: 'cp1' });
  t.equal(out.verdict, 'supported');
  t.equal(out.confidence, 'medium', 'single-tool C-tier defaults to medium');
  t.equal(out.evidence.length, 1);
  t.equal(out.sourceUrl, 'https://example.com/a');
  t.ok(out.cost > 0);
  t.ok(out.latencyMs >= 0);
  restore();
  t.end();
});

// --- Two tools agree ------------------------------------------------

test('verify: two tools agree → confidence high', async function (t) {
  const restore = useTools({
    wiki: stubTool('wiki', 'C', {
      matched: true,
      verdict: 'supported',
      extracts: [{ text: 'e1', url: 'https://ex/w', supportsClaim: true }],
      cost: 0
    }),
    wdd: stubTool('wdd', 'B', {
      matched: true,
      verdict: 'supported',
      extracts: [{ text: 'e2', url: 'https://ex/d', supportsClaim: true }],
      cost: 0
    })
  });
  const out = await verifyExternal('some claim', { name: 'Test', id: 'cp1' });
  t.equal(out.verdict, 'supported');
  t.equal(out.confidence, 'high', 'multiple-tool agreement gives high confidence');
  t.equal(out.evidence.length, 2);
  restore();
  t.end();
});

// --- Tier tie-breaking ----------------------------------------------

test('verify: higher-tier verdict wins on contradiction', async function (t) {
  const restore = useTools({
    tierC: stubTool('tierC', 'C', {
      matched: true,
      verdict: 'supported',
      extracts: [{ text: 'C-tier supports', url: 'https://ex/c', supportsClaim: true }],
      cost: 0
    }),
    tierA: stubTool('tierA', 'A', {
      matched: true,
      verdict: 'unsupported',
      extracts: [{ text: 'A-tier refutes', url: 'https://ex/a', supportsClaim: false }],
      cost: 0
    })
  });
  const out = await verifyExternal('claim', { name: 'X', id: 'cp1' });
  t.equal(out.verdict, 'unsupported', 'A-tier wins');
  t.equal(out.sourceUrl, 'https://ex/a', 'A-tier URL surfaced');
  t.ok(out.reasoning.indexOf('tier-A') !== -1);
  t.end();
  restore();
});

// --- No decisive verdicts -------------------------------------------

test('verify: all tools return unclear → verdict unclear', async function (t) {
  const restore = useTools({
    a: stubTool('a', 'C', { matched: true, verdict: 'unclear', extracts: [], cost: 0 }),
    b: stubTool('b', 'B', { matched: true, verdict: 'unclear', extracts: [], cost: 0 })
  });
  const out = await verifyExternal('claim', { name: 'X', id: 'cp1' });
  t.equal(out.verdict, 'unclear');
  t.equal(out.confidence, 'low');
  t.equal(out.sourceUrl, null);
  restore();
  t.end();
});

test('verify: all tools fail → verdict unclear, no crash', async function (t) {
  const restore = useTools({
    broken: {
      name: 'broken',
      tier: 'C',
      query: function () { return Promise.reject(new Error('kaboom')); }
    }
  });
  const out = await verifyExternal('claim', { name: 'X', id: 'cp1' });
  t.equal(out.verdict, 'unclear');
  t.equal(out.toolResults[0].error, 'kaboom');
  restore();
  t.end();
});

// --- Setup errors ---------------------------------------------------

test('verify: empty claim → verdict unclear', async function (t) {
  const out = await verifyExternal('', { name: 'X' });
  t.equal(out.verdict, 'unclear');
  t.ok(out.reasoning.indexOf('empty claim') !== -1);
  t.end();
});

test('verify: no tools registered → verdict unclear', async function (t) {
  const restore = useTools({});
  const out = await verifyExternal('some claim', { name: 'X' });
  t.equal(out.verdict, 'unclear');
  t.ok(out.reasoning.indexOf('no external tools enabled') !== -1);
  restore();
  t.end();
});

test('verify: toolNames option filters registered tools', async function (t) {
  const calls = [];
  const restore = useTools({
    wiki: {
      name: 'wiki', tier: 'C', query: function () { calls.push('wiki'); return Promise.resolve({ matched: false }); }
    },
    other: {
      name: 'other', tier: 'C', query: function () { calls.push('other'); return Promise.resolve({ matched: false }); }
    }
  });
  await verifyExternal('claim', { name: 'X' }, { toolNames: ['wiki'] });
  t.deepEqual(calls, ['wiki']);
  restore();
  t.end();
});

// --- Cache integration ----------------------------------------------

test('verify: cached result returned without invoking the live tool', async function (t) {
  let liveHits = 0;
  const restore = useTools({
    wiki: {
      name: 'wiki',
      tier: 'C',
      query: function () {
        liveHits += 1;
        return Promise.resolve({
          matched: true,
          verdict: 'supported',
          extracts: [{ text: 'live', url: 'https://ex', supportsClaim: true }],
          cost: 0.01
        });
      }
    }
  });
  const store = new Map();
  const cache = {
    isReady: function () { return true; },
    get: function (k) {
      const key = k.segment + ':' + k.id;
      const v = store.get(key);
      return Promise.resolve(v ? { item: v } : null);
    },
    set: function (k, v) {
      const key = k.segment + ':' + k.id;
      store.set(key, v);
      return Promise.resolve();
    }
  };
  const first = await verifyExternal('claim x', { name: 'X', id: 'cp1' }, { cache });
  const second = await verifyExternal('claim x', { name: 'X', id: 'cp1' }, { cache });
  t.equal(liveHits, 1, 'live tool only invoked once');
  t.equal(first.verdict, 'supported');
  t.equal(second.verdict, 'supported');
  t.equal(second.toolResults[0].cached, true, 'second call served from cache');
  restore();
  t.end();
});

test('verify: cache errors are non-fatal', async function (t) {
  const restore = useTools({
    wiki: stubTool('wiki', 'C', {
      matched: true,
      verdict: 'supported',
      extracts: [{ text: 'ok', url: 'https://ex', supportsClaim: true }],
      cost: 0
    })
  });
  const cache = {
    isReady: function () { return true; },
    get: function () { return Promise.reject(new Error('cache down')); },
    set: function () { return Promise.reject(new Error('cache down')); }
  };
  const out = await verifyExternal('claim', { name: 'X', id: 'cp1' }, { cache });
  t.equal(out.verdict, 'supported', 'still returns a verdict when cache fails');
  restore();
  t.end();
});

// --- aggregate() unit tests -----------------------------------------

test('aggregate: no decisive verdicts → unclear/low', function (t) {
  const out = verifyExternal.aggregate([
    { matched: true, verdict: 'unclear', tier: 'C', extracts: [] },
    { matched: false, tier: 'B' }
  ]);
  t.equal(out.verdict, 'unclear');
  t.equal(out.confidence, 'low');
  t.end();
});

test('aggregate: tier A tie-break', function (t) {
  const out = verifyExternal.aggregate([
    { matched: true, verdict: 'supported', tier: 'A', toolName: 'a1', extracts: [{ url: 'https://a1' }] },
    { matched: true, verdict: 'unsupported', tier: 'A', toolName: 'a2', extracts: [{ url: 'https://a2' }] }
  ]);
  t.equal(out.verdict, 'supported', 'tie within top tier → supported wins (defensive-permissive)');
  t.end();
});
