'use strict';

// Tests for the curator-decisions store — CRUD over the CURATOR_DECISIONS
// singleton item per subject. Dynamo stubbed at require-cache level so we
// don't need a live DB.

const test = require('tape');

// --- Stub dynamo BEFORE requiring anything transitive --------------

const fakeItems = new Map();
const key = function (pk, sk) { return pk + '|' + sk; };
const fakeDynamo = {
  isReady: function () { return true; },
  get: function (pk, sk) { return Promise.resolve(fakeItems.get(key(pk, sk))); },
  put: function (item) { fakeItems.set(key(item.PK, item.SK), item); return Promise.resolve(); },
  delete: function (pk, sk) { fakeItems.delete(key(pk, sk)); return Promise.resolve(); }
};
const dynamoPath = require.resolve('../lib/ai/dynamo');
require.cache[dynamoPath] = {
  id: dynamoPath, filename: dynamoPath, loaded: true, exports: fakeDynamo
};

const store = require('../lib/ai/curator-decisions-store');

function reset () { fakeItems.clear(); }

// --- Approvals -------------------------------------------------------

test('addApproval: creates item if missing, appends approval entry', async function (t) {
  reset();
  const out = await store.addApproval('cp1', {
    claimSignature: 'sig1', claimText: 'Some claim.', note: 'looks good', approvedBy: 'jamie'
  });
  t.equal(out.SK, 'CURATOR_DECISIONS');
  t.equal(out.PK, 'cp1');
  t.equal(out.approvals.length, 1);
  t.equal(out.approvals[0].claimSignature, 'sig1');
  t.equal(out.approvals[0].claimText, 'Some claim.');
  t.equal(out.approvals[0].note, 'looks good');
  t.equal(out.approvals[0].approvedBy, 'jamie');
  t.ok(out.approvals[0].approvedAt, 'timestamp set');
  t.end();
});

test('addApproval: repeated signature replaces previous (dedup)', async function (t) {
  reset();
  await store.addApproval('cp1', { claimSignature: 'sig1', note: 'first' });
  const out = await store.addApproval('cp1', { claimSignature: 'sig1', note: 'revised' });
  t.equal(out.approvals.length, 1, 'still only one entry');
  t.equal(out.approvals[0].note, 'revised');
  t.end();
});

test('addApproval: missing claimSignature throws', async function (t) {
  reset();
  try {
    await store.addApproval('cp1', {});
    t.fail('should have thrown');
  } catch (err) {
    t.ok(err.message.indexOf('claimSignature') !== -1);
  }
  t.end();
});

// --- Rejections ------------------------------------------------------

test('addRejection: creates + appends rejection entry', async function (t) {
  reset();
  const out = await store.addRejection('cp1', {
    claimSignature: 'sig2', claimText: 'Wrong claim.', rationale: 'sources disagree', rejectedBy: 'jamie'
  });
  t.equal(out.rejections.length, 1);
  t.equal(out.rejections[0].rationale, 'sources disagree');
  t.equal(out.rejections[0].rejectedBy, 'jamie');
  t.end();
});

// --- Clarifications --------------------------------------------------

test('addClarification: creates + appends clarification entry', async function (t) {
  reset();
  const out = await store.addClarification('cp1', {
    claimSignature: 'sig3', clarification: 'use ForMemRS not Fellow', addedBy: 'jamie'
  });
  t.equal(out.clarifications.length, 1);
  t.equal(out.clarifications[0].clarification, 'use ForMemRS not Fellow');
  t.end();
});

test('addClarification: missing clarification text throws', async function (t) {
  reset();
  try {
    await store.addClarification('cp1', { claimSignature: 'sig' });
    t.fail('should have thrown');
  } catch (err) {
    t.ok(err.message.indexOf('clarification text') !== -1);
  }
  t.end();
});

// --- Multiple entries + independence --------------------------------

test('one subject can hold approvals + rejections + clarifications', async function (t) {
  reset();
  await store.addApproval('cp1', { claimSignature: 'sig1' });
  await store.addRejection('cp1', { claimSignature: 'sig2', rationale: 'wrong' });
  await store.addClarification('cp1', { claimSignature: 'sig3', clarification: 'note' });
  const item = await store.get('cp1');
  t.equal(item.approvals.length, 1);
  t.equal(item.rejections.length, 1);
  t.equal(item.clarifications.length, 1);
  t.end();
});

test('subjects are independent', async function (t) {
  reset();
  await store.addApproval('cp1', { claimSignature: 'sig1' });
  await store.addApproval('cp2', { claimSignature: 'sig2' });
  const item1 = await store.get('cp1');
  const item2 = await store.get('cp2');
  t.equal(item1.approvals[0].claimSignature, 'sig1');
  t.equal(item2.approvals[0].claimSignature, 'sig2');
  t.end();
});

// --- removeEntry -----------------------------------------------------

test('removeEntry: removes single entry by signature', async function (t) {
  reset();
  await store.addApproval('cp1', { claimSignature: 'sig1' });
  await store.addApproval('cp1', { claimSignature: 'sig2' });
  const out = await store.removeEntry('cp1', 'approval', 'sig1');
  t.equal(out.approvals.length, 1);
  t.equal(out.approvals[0].claimSignature, 'sig2');
  t.end();
});

test('removeEntry: unknown kind throws', async function (t) {
  reset();
  await store.addApproval('cp1', { claimSignature: 'sig1' });
  try {
    await store.removeEntry('cp1', 'wut', 'sig1');
    t.fail('should have thrown');
  } catch (err) {
    t.ok(err.message.indexOf('unknown entry kind') !== -1);
  }
  t.end();
});

test('removeEntry: no matching entry → no-op, no crash', async function (t) {
  reset();
  await store.addApproval('cp1', { claimSignature: 'sig1' });
  const out = await store.removeEntry('cp1', 'approval', 'does-not-exist');
  t.equal(out.approvals.length, 1, 'unchanged');
  t.end();
});

test('removeEntry: subject has no decisions yet → returns null', async function (t) {
  reset();
  const out = await store.removeEntry('cp1', 'approval', 'sig1');
  t.equal(out, null);
  t.end();
});

// --- deleteAll -------------------------------------------------------

test('deleteAll: purges the item', async function (t) {
  reset();
  await store.addApproval('cp1', { claimSignature: 'sig1' });
  await store.deleteAll('cp1');
  t.equal(await store.get('cp1'), undefined);
  t.end();
});
