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

// --- saveBiography: snapshot triggered by sentences ----------------

test('saveBiography: snapshot written when sentences present (v2 canonical)', async function (t) {
  reset();
  await store.saveBiography('cp1', {
    sentences: [{ text: 'X', source: 'museum', claimSignature: 'sig' }],
    paragraphBreaks: [],
    status: 'live'
  });
  const snapshots = Array.from(fakeItems.keys()).filter(function (k) { return k.indexOf('HISTORY#') !== -1; });
  t.equal(snapshots.length, 1, 'history snapshot written');
  t.end();
});

test('saveBiography: snapshot written when only biographyHtml present (legacy v1 shape)', async function (t) {
  reset();
  await store.saveBiography('cp1', { biographyHtml: '<p>Legacy HTML.</p>', status: 'live' });
  const snapshots = Array.from(fakeItems.keys()).filter(function (k) { return k.indexOf('HISTORY#') !== -1; });
  t.equal(snapshots.length, 1);
  t.end();
});

test('saveBiography: no snapshot when neither sentences nor biographyHtml present', async function (t) {
  reset();
  await store.saveBiography('cp1', { status: 'insufficient_data', skipReason: 'no data' });
  const snapshots = Array.from(fakeItems.keys()).filter(function (k) { return k.indexOf('HISTORY#') !== -1; });
  t.equal(snapshots.length, 0);
  t.end();
});

test('saveBiography: empty sentences array does NOT trigger snapshot', async function (t) {
  reset();
  await store.saveBiography('cp1', { sentences: [], status: 'insufficient_data' });
  const snapshots = Array.from(fakeItems.keys()).filter(function (k) { return k.indexOf('HISTORY#') !== -1; });
  t.equal(snapshots.length, 0);
  t.end();
});

// --- saveBiography: flag-mark-stale triggered on content -----------

test('saveBiography: flag-mark-stale runs when sentences trigger snapshot', async function (t) {
  reset();
  await store.saveBiography('cp1', {
    sentences: [{ text: 'X', source: 'museum', claimSignature: 'sig' }],
    status: 'live'
  });
  t.equal(flagStoreCalls.markPendingStale.length, 1);
  t.equal(flagStoreCalls.markPendingStale[0].id, 'cp1');
  t.end();
});

test('saveBiography: snapshotOnly opt skips canonical + flag-mark-stale', async function (t) {
  reset();
  await store.saveBiography('cp1', {
    sentences: [{ text: 'X', source: 'museum', claimSignature: 'sig' }],
    status: 'live'
  }, { snapshotOnly: true });
  const canonical = await store.fetchBiography('cp1');
  t.equal(canonical, undefined, 'no canonical write');
  t.equal(flagStoreCalls.markPendingStale.length, 0, 'no flag-mark-stale');
  const snapshots = Array.from(fakeItems.keys()).filter(function (k) { return k.indexOf('HISTORY#') !== -1; });
  t.equal(snapshots.length, 1, 'snapshot still written');
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

test('deleteBiography: also cascades REVIEW# items and history snapshots', async function (t) {
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
