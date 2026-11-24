'use strict';

// dashboard-stats: how the full-table scan runs and how its result is
// cached. The scan is slow on a big table, so:
//   - it runs in parallel segments and fetches only SCAN_ATTRIBUTES
//   - a request gets the previous result at once and the refresh runs in
//     the background; only a request with nothing cached waits
// No AWS SDK: see test/helpers/fake-stats-dynamo.js.

const test = require('tape');
const dashboardStats = require('../lib/ai/dashboard-stats');
const makeFakeStatsDynamo = require('./helpers/fake-stats-dynamo').makeFakeStatsDynamo;

const CONFIG = { aiBiographyGbpPerUsd: 0.8 };
const NOW = new Date().toISOString();
const BIG = 'x'.repeat(2000); // stands in for systemPrompt / prompt / rawResponse

function bio (pk, overrides) {
  return Object.assign({
    entityType: 'BIOGRAPHY',
    PK: pk,
    SK: 'BIOGRAPHY',
    status: 'live',
    model: 'claude-haiku-5-5',
    inputTokens: 3000,
    outputTokens: 9000,
    generatedAt: NOW,
    subjectStatus: { subjectType: 'person', isLiving: false },
    sentences: [{ text: 'A.', source: 'museum' }, { text: 'B.', source: 'wikidata' }],
    systemPrompt: BIG,
    prompt: BIG,
    rawResponse: BIG
  }, overrides);
}

// One of every item type and branch the stats read.
function richItems () {
  return [
    bio('cp1'),
    bio('cp2', { status: 'hidden' }),
    bio('cp3', { status: 'flagged', subjectStatus: { subjectType: 'person', isLiving: true } }),
    bio('cp4', { subjectStatus: { subjectType: 'company', isLiving: true } }),
    bio('cp5', { status: 'insufficient_data', sentences: [], skipReason: 'Low confidence (2/10) — thin record' }),
    bio('cp6', { status: 'admin_only', skipReason: 'Existing description takes over' }),
    bio('cp7', {
      sentences: [{ text: 'C.', source: 'llm:validated:wikipedia' }, { text: 'D.', source: 'llm:general_knowledge' }],
      verificationCandidates: { generalKnowledgeCount: 2, contextualisingCount: 1, inferredCount: 1, estimatedExternalValidationCost: 0.03 }
    }),
    bio('cp8', { model: 'retired-model-x' }),
    bio('cp9', { generatedAt: '2026-01-05T10:00:00Z', subjectStatus: undefined }),
    { entityType: 'REVIEW', PK: 'cp1', SK: 'REVIEW#1', reviewerModel: 'claude-sonnet-4-6', inputTokens: 1500, outputTokens: 400, reviewedAt: NOW, findings: [{ resolution: 'pending' }], prompt: BIG },
    { entityType: 'REVIEW', PK: 'cp7', SK: 'REVIEW#2', reviewModel: 'claude-sonnet-4-6', inputTokens: 900, outputTokens: 200, createdAt: NOW },
    { entityType: 'CURATOR_DECISIONS', PK: 'cp1', SK: 'CURATOR_DECISIONS', approvals: [{ i: 0 }], rejections: [], clarifications: [] },
    { entityType: 'PUBLIC_FLAG', PK: 'cp1', SK: 'FLAGS', totalFlags: 3, pendingFlags: 2, lastFlaggedAt: NOW, count_factually_incorrect: 2, count_pending_factually_incorrect: 2, count_other: 1, pendingMessages: [{ m: 'visitor text' }] },
    { entityType: 'PUBLIC_FLAG', PK: 'cp2', SK: 'FLAGS', totalFlags: 1, pendingFlags: 1, lastFlaggedAt: NOW, count_offensive: 1, count_pending_offensive: 1 },
    { entityType: 'STAFF_FLAG', PK: 'cp4', SK: 'STAFF_FLAG#1' },
    { entityType: 'STAFF_NOTE', PK: 'cp2', SK: 'STAFF_NOTE#1', text: 'hidden' }
  ];
}

function withoutTimestamp (stats) {
  const copy = JSON.parse(JSON.stringify(stats));
  delete copy.computedAt;
  return copy;
}

// Controls Date.now for the cache's freshness check.
function fakeClock (t) {
  const realNow = Date.now;
  let now = realNow();
  Date.now = function () { return now; };
  t.teardown(function () { Date.now = realNow; });
  return { advance: function (ms) { now += ms; } };
}

// A dynamo whose scan() calls all wait until open() is called.
function gatedDynamo (items) {
  let open;
  const gate = new Promise(function (resolve) { open = resolve; });
  const inner = makeFakeStatsDynamo(items);
  let calls = 0;
  return {
    isReady: function () { return true; },
    scan: function (limit, lastKey, opts) {
      calls += 1;
      return gate.then(function () { return inner.scan(limit, lastKey, opts); });
    },
    open: function () { open(); },
    calls: function () { return calls; }
  };
}

function failingDynamo () {
  let calls = 0;
  return {
    isReady: function () { return true; },
    scan: function () { calls += 1; return Promise.reject(new Error('scan failed')); },
    calls: function () { return calls; }
  };
}

function quietConsoleError (t) {
  const real = console.error;
  const logged = [];
  console.error = function () { logged.push(Array.prototype.join.call(arguments, ' ')); };
  t.teardown(function () { console.error = real; });
  return logged;
}

// Let queued promise callbacks run.
async function settle () {
  for (let i = 0; i < 50; i++) await new Promise(function (resolve) { setImmediate(resolve); });
}

// --- the scan ------------------------------------------------------------

test('dashboard-stats scan: parallel segments, paged to the end, trimmed to the stats attributes', async function (t) {
  dashboardStats.invalidate();
  const calls = [];
  const items = richItems();
  const stats = await dashboardStats.getStats(makeFakeStatsDynamo(items, calls), CONFIG);

  const segments = new Set(calls.map(function (c) { return c.segment; }));
  t.equal(segments.size, dashboardStats.SCAN_SEGMENTS, 'every segment scanned');
  t.ok(dashboardStats.SCAN_SEGMENTS > 1, 'more than one segment');
  t.ok(calls.every(function (c) { return c.totalSegments === dashboardStats.SCAN_SEGMENTS; }), 'each call names the segment count');
  t.ok(calls.length > dashboardStats.SCAN_SEGMENTS, 'segments were followed past their first page');
  t.ok(calls.every(function (c) { return c.attributes === dashboardStats.SCAN_ATTRIBUTES; }), 'every page asks for the stats attributes only');
  ['systemPrompt', 'prompt', 'rawResponse', 'pendingMessages'].forEach(function (name) {
    t.equal(dashboardStats.SCAN_ATTRIBUTES.indexOf(name), -1, name + ' is not fetched');
  });
  t.equal(stats.totals.biographies, items.filter(function (i) { return i.entityType === 'BIOGRAPHY'; }).length,
    'each item counted once across segments');
  dashboardStats.invalidate();
  t.end();
});

test('dashboard-stats scan: trimmed items give exactly the same stats as whole items', async function (t) {
  const items = richItems();

  dashboardStats.invalidate();
  const trimmed = await dashboardStats.getStats(makeFakeStatsDynamo(items), CONFIG);

  dashboardStats.invalidate();
  const inner = makeFakeStatsDynamo(items);
  const whole = await dashboardStats.getStats({
    isReady: function () { return true; },
    scan: function (limit, lastKey, opts) {
      return inner.scan(limit, lastKey, Object.assign({}, opts, { attributes: null }));
    }
  }, CONFIG);
  dashboardStats.invalidate();

  t.deepEqual(withoutTimestamp(trimmed), withoutTimestamp(whole), 'same stats');
  // The fixture has to reach the figures, or the comparison proves little.
  t.ok(whole.totals.liveSuppressed > 0, 'fixture reaches living-person suppression');
  t.ok(whole.flags.lifetimeReports > 0 && whole.flags.pendingReports > 0, 'fixture reaches public reports');
  t.ok(whole.flags.hiddenWithPendingReports > 0, 'fixture reaches reports on hidden records');
  t.ok(whole.unresolvedIndex.length > 0, 'fixture reaches the unresolved-reports index');
  t.end();
});

// --- the cache -----------------------------------------------------------

test('dashboard-stats cache: first call waits for the scan, then calls within the fresh window reuse it', async function (t) {
  dashboardStats.invalidate();
  const clock = fakeClock(t);
  const calls = [];
  const dynamo = makeFakeStatsDynamo([bio('cp1')], calls);

  const first = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(first.totals.biographies, 1, 'first call returns the scan result');
  const scansSoFar = calls.length;

  clock.advance(dashboardStats.FRESH_MS - 1);
  const second = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(second, first, 'same result inside the fresh window');
  t.equal(calls.length, scansSoFar, 'no new scan inside the fresh window');
  dashboardStats.invalidate();
  t.end();
});

test('dashboard-stats cache: stale result is returned at once while one background refresh runs', async function (t) {
  dashboardStats.invalidate();
  const clock = fakeClock(t);
  const first = await dashboardStats.getStats(makeFakeStatsDynamo([bio('cp1')]), CONFIG);

  clock.advance(dashboardStats.FRESH_MS + 1);
  const slow = gatedDynamo([bio('cp1'), bio('cp2')]);
  const second = await dashboardStats.getStats(slow, CONFIG);
  t.equal(second, first, 'stale result returned without waiting for the scan');
  t.equal(slow.calls(), dashboardStats.SCAN_SEGMENTS, 'one refresh started (one first page per segment)');

  const third = await dashboardStats.getStats(slow, CONFIG);
  t.equal(third, first, 'still the stale result while the refresh runs');
  t.equal(slow.calls(), dashboardStats.SCAN_SEGMENTS, 'no second refresh while one is running');

  slow.open();
  await settle();
  const fourth = await dashboardStats.getStats(slow, CONFIG);
  t.equal(fourth.totals.biographies, 2, 'refreshed result served once the scan finishes');
  dashboardStats.invalidate();
  t.end();
});

test('dashboard-stats cache: a failed background refresh keeps the previous result and retries later', async function (t) {
  dashboardStats.invalidate();
  const clock = fakeClock(t);
  const logged = quietConsoleError(t);
  const first = await dashboardStats.getStats(makeFakeStatsDynamo([bio('cp1')]), CONFIG);

  clock.advance(dashboardStats.FRESH_MS + 1);
  const broken = failingDynamo();
  const second = await dashboardStats.getStats(broken, CONFIG);
  t.equal(second, first, 'previous result served');
  await settle();
  t.ok(logged.some(function (l) { return l.indexOf('scan failed') !== -1; }), 'failure logged, not thrown');

  const callsAfterFirstTry = broken.calls();
  const third = await dashboardStats.getStats(broken, CONFIG);
  t.equal(third, first, 'still the previous result');
  await settle();
  t.ok(broken.calls() > callsAfterFirstTry, 'next request tries the refresh again');
  dashboardStats.invalidate();
  t.end();
});

test('dashboard-stats cache: with nothing cached, a failed scan reaches the caller', async function (t) {
  dashboardStats.invalidate();
  quietConsoleError(t);
  try {
    await dashboardStats.getStats(failingDynamo(), CONFIG);
    t.fail('expected the scan error');
  } catch (err) {
    t.equal(err.message, 'scan failed', 'error passed to the waiting caller');
  }
  dashboardStats.invalidate();
  t.end();
});

test('dashboard-stats cache: concurrent first calls share one scan', async function (t) {
  dashboardStats.invalidate();
  const slow = gatedDynamo([bio('cp1')]);
  const a = dashboardStats.getStats(slow, CONFIG);
  const b = dashboardStats.getStats(slow, CONFIG);
  slow.open();
  const [ra, rb] = await Promise.all([a, b]);
  t.equal(ra, rb, 'same result object');
  t.equal(slow.calls(), dashboardStats.SCAN_SEGMENTS, 'one scan (one page per segment)');
  dashboardStats.invalidate();
  t.end();
});

test('dashboard-stats cache: a scan started before invalidate() does not fill the cache', async function (t) {
  dashboardStats.invalidate();
  const old = gatedDynamo([bio('cp1'), bio('cp2'), bio('cp3')]);
  const pending = dashboardStats.getStats(old, CONFIG);
  dashboardStats.invalidate();
  old.open();
  await pending;

  const fresh = await dashboardStats.getStats(makeFakeStatsDynamo([bio('cp9')]), CONFIG);
  t.equal(fresh.totals.biographies, 1, 'result comes from the scan after invalidate()');
  dashboardStats.invalidate();
  t.end();
});
