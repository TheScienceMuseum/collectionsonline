'use strict';

// Tests for the v2-specific additions to biography-store.js:
//   - saveBiography writes a history snapshot when sentences are present
//     (not just when the legacy biographyHtml field is present).
//   - saveBiography passes source-tagged fields through unchanged.
//   - deleteBiography cascades the CURATOR_DECISIONS singleton in addition
//     to the historical prefix scans.
//
// Dynamo + flagStore stubbed at require-cache level, same pattern as
// ai-claim-ledger.test.js in v1.

const test = require('tape');

// --- Stubs -----------------------------------------------------------

const fakeItems = new Map();
const key = function (pk, sk) { return pk + '|' + sk; };
// The listBiographies pagination tests below drive the GSI stubs via a
// scripted queue: each entry is the next {items, lastKey} response to
// return. The scripted mode is only active while `queryScript` is non-
// empty; unscripted calls (from other tests in this file) fall through
// to an empty result so they don't crash.
let queryCalls = [];
let queryScript = [];
const fakeDynamo = {
  isReady: function () { return true; },
  get: function (pk, sk) { return Promise.resolve(fakeItems.get(key(pk, sk))); },
  put: function (item) { fakeItems.set(key(item.PK, item.SK), item); return Promise.resolve(); },
  delete: function (pk, sk) { fakeItems.delete(key(pk, sk)); return Promise.resolve(); },
  queryByPkPrefix: function (pk, prefix) {
    const items = [];
    for (const [k, v] of fakeItems.entries()) {
      const [ipk, isk] = k.split('|');
      if (ipk === pk && isk.indexOf(prefix) === 0) items.push(v);
    }
    return Promise.resolve({ items });
  },
  queryByStatus: function (status, limit, lastKey) {
    queryCalls.push({ kind: 'status', status, limit, lastKey });
    return Promise.resolve(queryScript.shift() || { items: [], lastKey: null });
  },
  queryByCreatedAt: function (limit, lastKey) {
    queryCalls.push({ kind: 'createdAt', limit, lastKey });
    return Promise.resolve(queryScript.shift() || { items: [], lastKey: null });
  }
};
const dynamoPath = require.resolve('../lib/ai/dynamo');
require.cache[dynamoPath] = {
  id: dynamoPath, filename: dynamoPath, loaded: true, exports: fakeDynamo
};

const flagStoreCalls = { markPendingStale: [], deleteFlags: [] };
const flagStorePath = require.resolve('../lib/ai/flag-store');
require.cache[flagStorePath] = {
  id: flagStorePath,
  filename: flagStorePath,
  loaded: true,
  exports: {
    markPendingStale: function (id, generatedAt) {
      flagStoreCalls.markPendingStale.push({ id, generatedAt });
      return Promise.resolve();
    },
    deleteFlags: function (id) {
      flagStoreCalls.deleteFlags.push(id);
      return Promise.resolve();
    },
    getFlags: function () { return Promise.resolve(null); }
  }
};

const store = require('../lib/ai/biography-store');

function reset () {
  fakeItems.clear();
  flagStoreCalls.markPendingStale.length = 0;
  flagStoreCalls.deleteFlags.length = 0;
  queryCalls = [];
  queryScript = [];
}

function mkItems (n, prefix) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ PK: (prefix || 'cp') + i, SK: 'BIOGRAPHY' });
  return out;
}

// --- saveBiography: v2 field passthrough ---------------------------

test('saveBiography: source-tagged fields survive round-trip', async function (t) {
  reset();
  const payload = {
    sentences: [
      { text: 'Fact.', source: 'museum', sourceDetail: 'personData.birthDate', claimSignature: 'sig1' }
    ],
    paragraphBreaks: [0],
    writerConfidence: 8,
    writerNotes: 'Sample notes.',
    verificationCandidates: { generalKnowledgeCount: 0, contextualisingCount: 0, inferredCount: 0 },
    status: 'live',
    personName: 'Test Subject',
    model: 'claude-sonnet-4',
    promptVersion: '2026-07-v7-source-tagged'
  };
  await store.saveBiography('cp1', payload);
  const canonical = await store.fetchBiography('cp1');
  t.ok(canonical, 'canonical stored');
  t.equal(canonical.entityType, 'BIOGRAPHY');
  t.equal(canonical.SK, 'BIOGRAPHY');
  t.equal(canonical.sentences.length, 1);
  t.equal(canonical.sentences[0].claimSignature, 'sig1');
  t.deepEqual(canonical.paragraphBreaks, [0]);
  t.equal(canonical.writerConfidence, 8);
  t.equal(canonical.writerNotes, 'Sample notes.');
  t.deepEqual(canonical.verificationCandidates, { generalKnowledgeCount: 0, contextualisingCount: 0, inferredCount: 0 });
  t.equal(canonical.status, 'live');
  t.equal(canonical.personName, 'Test Subject');
  t.ok(canonical.generatedAt, 'generatedAt stamped');
  t.end();
});

// --- saveBiography: canonical + flag-mark-stale --------------------

test('saveBiography: canonical is always written', async function (t) {
  reset();
  await store.saveBiography('cp1', {
    sentences: [{ text: 'X', source: 'museum', claimSignature: 'sig' }],
    paragraphBreaks: [],
    status: 'live'
  });
  const canonical = await store.fetchBiography('cp1');
  t.ok(canonical, 'canonical BIOGRAPHY item written');
  t.equal(canonical.PK, 'cp1');
  t.equal(canonical.SK, 'BIOGRAPHY');
  const snapshots = Array.from(fakeItems.keys()).filter(function (k) { return k.indexOf('HISTORY#') !== -1; });
  t.equal(snapshots.length, 0, 'no HISTORY# snapshot (feature retired)');
  t.end();
});

test('saveBiography: flag-mark-stale runs when biography has content', async function (t) {
  reset();
  await store.saveBiography('cp1', {
    sentences: [{ text: 'X', source: 'museum', claimSignature: 'sig' }],
    status: 'live'
  });
  t.equal(flagStoreCalls.markPendingStale.length, 1);
  t.equal(flagStoreCalls.markPendingStale[0].id, 'cp1');
  t.end();
});

test('saveBiography: flag-mark-stale skipped when no biography content', async function (t) {
  reset();
  await store.saveBiography('cp1', { status: 'insufficient_data', skipReason: 'no data' });
  t.equal(flagStoreCalls.markPendingStale.length, 0);
  t.end();
});

test('saveBiography: empty sentences array does NOT trigger flag-mark-stale', async function (t) {
  reset();
  await store.saveBiography('cp1', { sentences: [], status: 'insufficient_data' });
  t.equal(flagStoreCalls.markPendingStale.length, 0);
  t.end();
});

// --- deleteBiography: CURATOR_DECISIONS cascade --------------------

test('deleteBiography: removes CURATOR_DECISIONS singleton', async function (t) {
  reset();
  // Prime: canonical + a CURATOR_DECISIONS item
  await store.saveBiography('cp1', {
    sentences: [{ text: 'X', source: 'museum', claimSignature: 'sig' }],
    status: 'live'
  });
  fakeItems.set(key('cp1', 'CURATOR_DECISIONS'), {
    PK: 'cp1',
    SK: 'CURATOR_DECISIONS',
    entityType: 'CURATOR_DECISIONS',
    approvals: [{ claimSignature: 'sig', claimText: 'X' }]
  });
  await store.deleteBiography('cp1');
  t.equal(fakeItems.get(key('cp1', 'CURATOR_DECISIONS')), undefined,
    'CURATOR_DECISIONS purged');
  t.equal(fakeItems.get(key('cp1', 'BIOGRAPHY')), undefined,
    'canonical purged');
  t.equal(flagStoreCalls.deleteFlags[0], 'cp1', 'flag counters purged');
  t.end();
});

test('deleteBiography: no CURATOR_DECISIONS for the subject → still succeeds', async function (t) {
  reset();
  await store.saveBiography('cp1', {
    sentences: [{ text: 'X', source: 'museum', claimSignature: 'sig' }],
    status: 'live'
  });
  await store.deleteBiography('cp1');
  t.equal(fakeItems.get(key('cp1', 'BIOGRAPHY')), undefined);
  // Assertion is that the operation completes without error — no throws
  // even when the curator-decisions item never existed.
  t.pass('no throw on missing CURATOR_DECISIONS');
  t.end();
});

test('deleteBiography: also cascades REVIEW# items', async function (t) {
  reset();
  await store.saveBiography('cp1', {
    sentences: [{ text: 'X', source: 'museum', claimSignature: 'sig' }],
    status: 'live'
  });
  // Add a REVIEW# item
  fakeItems.set(key('cp1', 'REVIEW#2026-07-03T10:00:00Z'), {
    PK: 'cp1', SK: 'REVIEW#2026-07-03T10:00:00Z', entityType: 'REVIEW', findings: []
  });
  await store.deleteBiography('cp1');
  t.equal(fakeItems.get(key('cp1', 'REVIEW#2026-07-03T10:00:00Z')), undefined,
    'REVIEW# item purged');
  const remaining = Array.from(fakeItems.keys()).filter(function (k) { return k.indexOf('cp1|') === 0; });
  t.equal(remaining.length, 0, 'all cp1 items removed');
  t.end();
});

// --- listBiographies: internal pagination fix (2026-08-04) ----------
//
// DynamoDB Query returns at most 1 MB per response and stops early with
// a LastEvaluatedKey when that cap is reached — even if the caller's
// Limit was higher. Before the fix, listBiographies passed the short
// page straight back to the admin list, which treated it as "here's
// the whole page" and silently truncated. The fix loops internally.

test('listBiographies: loops when the first page is short (2026-08-04 regression)', async function (t) {
  reset();
  queryScript = [
    { items: mkItems(13, 'a'), lastKey: { k: 'after-13' } },
    { items: mkItems(12, 'b'), lastKey: null }
  ];
  const result = await store.listBiographies('all', 25, null);
  t.equal(result.items.length, 25, 'all 25 items returned in one call');
  t.equal(result.lastKey, null, 'lastKey null after exhausting the GSI');
  t.equal(queryCalls.length, 2, 'two GSI calls made');
  t.equal(queryCalls[0].limit, 25, 'first call asks for the full wanted amount');
  t.equal(queryCalls[1].limit, 12, 'second call asks only for the remaining 12');
  t.deepEqual(queryCalls[1].lastKey, { k: 'after-13' }, 'second call passes the first page\'s cursor');
  t.end();
});

test('listBiographies: single full page → no extra call', async function (t) {
  reset();
  queryScript = [
    { items: mkItems(25, 'a'), lastKey: { k: 'more-available' } }
  ];
  const result = await store.listBiographies('all', 25, null);
  t.equal(result.items.length, 25, '25 items');
  t.deepEqual(result.lastKey, { k: 'more-available' }, 'cursor preserved for the UI\'s next-page link');
  t.equal(queryCalls.length, 1, 'no unnecessary second call');
  t.end();
});

test('listBiographies: GSI exhausted with fewer items than requested', async function (t) {
  reset();
  queryScript = [
    { items: mkItems(5, 'a'), lastKey: null }
  ];
  const result = await store.listBiographies('all', 25, null);
  t.equal(result.items.length, 5, 'returns only what the GSI had');
  t.equal(result.lastKey, null, 'no next-page cursor');
  t.equal(queryCalls.length, 1, 'one call, no wasted retries after empty lastKey');
  t.end();
});

test('listBiographies: passes through explicit lastKey for continued pagination', async function (t) {
  reset();
  queryScript = [
    { items: mkItems(10, 'x'), lastKey: null }
  ];
  await store.listBiographies('all', 25, { k: 'from-earlier-page' });
  t.deepEqual(queryCalls[0].lastKey, { k: 'from-earlier-page' },
    'caller-supplied lastKey passed to the first GSI call');
  t.end();
});

test('listBiographies: status filter routes to StatusIndex, not CreatedAtIndex', async function (t) {
  reset();
  queryScript = [
    { items: mkItems(3, 'f'), lastKey: null }
  ];
  await store.listBiographies('flagged', 25, null);
  t.equal(queryCalls.length, 1, 'one call');
  t.equal(queryCalls[0].kind, 'status', 'uses queryByStatus');
  t.equal(queryCalls[0].status, 'flagged', 'passes the status filter');
  t.end();
});

test('listBiographies: iteration cap prevents runaway loops on tiny pages', async function (t) {
  reset();
  // Pathological: every page returns 1 item and always has a next cursor.
  // The safety cap should kick in at 10 iterations, not chase forever.
  for (let i = 0; i < 20; i++) {
    queryScript.push({ items: mkItems(1, 'p' + i), lastKey: { k: 'still-more-' + i } });
  }
  const result = await store.listBiographies('all', 100, null);
  t.equal(queryCalls.length, 10, 'stops at LIST_MAX_ITERATIONS');
  t.equal(result.items.length, 10, 'returns whatever it accumulated');
  t.ok(result.lastKey, 'preserves cursor so caller can continue from where we stopped');
  t.end();
});
