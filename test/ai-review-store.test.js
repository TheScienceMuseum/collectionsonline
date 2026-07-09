'use strict';

// Tests for the review store — CRUD over REVIEW# items per subject.
// Dynamo stubbed at require-cache level.

const test = require('tape');

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

const store = require('../lib/ai/review-store');

function reset () { fakeItems.clear(); }

// --- saveReview ------------------------------------------------------

test('saveReview: creates a REVIEW# item with normalised findings', async function (t) {
  reset();
  const out = await store.saveReview('cp1', {
    reviewerModel: 'claude-sonnet-4-6',
    spend: 0.001,
    inputTokens: 100,
    outputTokens: 50,
    findings: [
      { claimSignature: 'sig1', claimText: 'A.', kind: 'error', confidence: 'high', concern: 'wrong attribution' },
      { claimSignature: 'sig2', claimText: 'B.', kind: 'info', confidence: 'medium', concern: 'FYI' }
    ]
  });
  t.equal(out.entityType, 'REVIEW');
  t.ok(out.SK.indexOf('REVIEW#') === 0);
  t.equal(out.findings.length, 2);
  t.equal(out.findings[0].kind, 'error');
  t.equal(out.findings[0].confidence, 'high');
  t.equal(out.findings[0].resolution, 'pending', 'defaults to pending');
  t.equal(out.findings[1].kind, 'info');
  t.equal(out.reviewerModel, 'claude-sonnet-4-6');
  t.equal(out.spend, 0.001);
  t.end();
});

test('saveReview: unknown kind → error, unknown confidence → low', async function (t) {
  reset();
  const out = await store.saveReview('cp1', {
    findings: [{ claimSignature: 'sig1', kind: 'bogus', confidence: 'bogus' }]
  });
  t.equal(out.findings[0].kind, 'error', 'unknown kind defaults to error');
  t.equal(out.findings[0].confidence, 'low', 'unknown confidence defaults to low');
  t.end();
});

test('saveReview: stamps writerPromptVersion + writerModel from opts', async function (t) {
  reset();
  const out = await store.saveReview('cp1', {
    reviewerModel: 'claude-sonnet-4-6',
    writerPromptVersion: '2026-07-v8-collection-flow',
    writerModel: 'claude-sonnet-4-6',
    findings: [{ claimSignature: 'sig1', claimText: 'A.', kind: 'error', confidence: 'high', concern: 'x' }]
  });
  t.equal(out.writerPromptVersion, '2026-07-v8-collection-flow', 'writerPromptVersion persisted');
  t.equal(out.writerModel, 'claude-sonnet-4-6', 'writerModel persisted');
  t.end();
});

test('saveReview: writerPromptVersion + writerModel default to null when omitted', async function (t) {
  reset();
  const out = await store.saveReview('cp1', {
    findings: [{ claimSignature: 'sig1', kind: 'error', confidence: 'high' }]
  });
  t.equal(out.writerPromptVersion, null);
  t.equal(out.writerModel, null);
  t.end();
});

test('saveReview: missing findings array throws', async function (t) {
  reset();
  try {
    await store.saveReview('cp1', {});
    t.fail('should have thrown');
  } catch (err) {
    t.ok(err.message.indexOf('findings array') !== -1);
  }
  t.end();
});

// --- listReviews + getReview ----------------------------------------

test('listReviews: returns all REVIEW# items for a subject', async function (t) {
  reset();
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [{ claimSignature: 'sig1' }]
  });
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T11:00:00Z',
    findings: [{ claimSignature: 'sig2' }]
  });
  await store.saveReview('cp2', {
    reviewedAt: '2026-07-02T12:00:00Z',
    findings: [{ claimSignature: 'sig3' }]
  });
  const rvs = await store.listReviews('cp1');
  t.equal(rvs.length, 2, 'both cp1 reviews returned');
  const rvs2 = await store.listReviews('cp2');
  t.equal(rvs2.length, 1, 'cp2 review isolated');
  t.end();
});

test('getReview: fetches a specific review by SK', async function (t) {
  reset();
  const created = await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [{ claimSignature: 'sig1' }]
  });
  const fetched = await store.getReview('cp1', created.SK);
  t.equal(fetched.SK, created.SK);
  t.end();
});

test('getReview: invalid SK throws', async function (t) {
  reset();
  try {
    await store.getReview('cp1', 'NOT_A_REVIEW_SK');
    t.fail('should have thrown');
  } catch (err) {
    t.ok(err.message.indexOf('invalid review SK') !== -1);
  }
  t.end();
});

// --- openFindings ---------------------------------------------------

test('openFindings: flattens pending findings across all reviews', async function (t) {
  reset();
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [
      { claimSignature: 'sig1', kind: 'error', confidence: 'high' },
      { claimSignature: 'sig2', kind: 'info', confidence: 'low' }
    ]
  });
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T11:00:00Z',
    findings: [
      { claimSignature: 'sig3', kind: 'error', confidence: 'medium' }
    ]
  });
  const open = await store.openFindings('cp1');
  t.equal(open.length, 3, 'all pending findings');
  t.ok(open[0].reviewSK.indexOf('REVIEW#') === 0, 'reviewSK attached');
  t.end();
});

test('openFindings: resolved findings excluded', async function (t) {
  reset();
  const rv = await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [
      { claimSignature: 'sig1', kind: 'error', confidence: 'high' },
      { claimSignature: 'sig2', kind: 'error', confidence: 'medium' }
    ]
  });
  await store.updateFindingResolution('cp1', rv.SK, 'sig1', { resolution: 'dismissed', resolvedBy: 'jamie' });
  const open = await store.openFindings('cp1');
  t.equal(open.length, 1);
  t.equal(open[0].claimSignature, 'sig2');
  t.end();
});

test('openFindings: dedup same claimSignature across reviews — highest severity wins', async function (t) {
  reset();
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [
      { claimSignature: 'sig1', kind: 'error', confidence: 'medium', concern: 'first take' }
    ]
  });
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T11:00:00Z',
    findings: [
      { claimSignature: 'sig1', kind: 'error', confidence: 'high', concern: 'second take, harsher' }
    ]
  });
  const open = await store.openFindings('cp1');
  t.equal(open.length, 1, 'one card per signature');
  t.equal(open[0].confidence, 'high', 'harsher one wins');
  t.equal(open[0].concern, 'second take, harsher');
  t.end();
});

test('openFindings: dedup — same severity, most recent wins', async function (t) {
  reset();
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [
      { claimSignature: 'sig1', kind: 'error', confidence: 'high', concern: 'older' }
    ]
  });
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T11:00:00Z',
    findings: [
      { claimSignature: 'sig1', kind: 'error', confidence: 'high', concern: 'newer' }
    ]
  });
  const open = await store.openFindings('cp1');
  t.equal(open.length, 1);
  t.equal(open[0].concern, 'newer');
  t.end();
});

test('openFindings: dedup — findings on OTHER signatures still all surface', async function (t) {
  reset();
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [
      { claimSignature: 'sig1', kind: 'error', confidence: 'high' },
      { claimSignature: 'sig2', kind: 'info', confidence: 'low' }
    ]
  });
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T11:00:00Z',
    findings: [
      { claimSignature: 'sig1', kind: 'error', confidence: 'medium' },
      { claimSignature: 'sig3', kind: 'error', confidence: 'medium' }
    ]
  });
  const open = await store.openFindings('cp1');
  const sigs = open.map(function (f) { return f.claimSignature; }).sort();
  t.deepEqual(sigs, ['sig1', 'sig2', 'sig3'], 'one card per unique signature');
  t.end();
});

// --- updateFindingResolution ---------------------------------------

test('updateFindingResolution: marks finding resolved with timestamp + user', async function (t) {
  reset();
  const rv = await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [{ claimSignature: 'sig1', kind: 'error', confidence: 'high' }]
  });
  const out = await store.updateFindingResolution('cp1', rv.SK, 'sig1', {
    resolution: 'accepted', resolvedBy: 'jamie'
  });
  const f = out.findings[0];
  t.equal(f.resolution, 'accepted');
  t.equal(f.resolvedBy, 'jamie');
  t.ok(f.resolvedAt);
  t.end();
});

test('updateFindingResolution: invalid resolution throws', async function (t) {
  reset();
  const rv = await store.saveReview('cp1', {
    findings: [{ claimSignature: 'sig1' }]
  });
  try {
    await store.updateFindingResolution('cp1', rv.SK, 'sig1', { resolution: 'wut' });
    t.fail('should have thrown');
  } catch (err) {
    t.ok(err.message.indexOf('resolution must be') !== -1);
  }
  t.end();
});

test('updateFindingResolution: unknown signature throws', async function (t) {
  reset();
  const rv = await store.saveReview('cp1', {
    findings: [{ claimSignature: 'sig1' }]
  });
  try {
    await store.updateFindingResolution('cp1', rv.SK, 'sig-nope', { resolution: 'dismissed' });
    t.fail('should have thrown');
  } catch (err) {
    t.ok(err.message.indexOf('no finding matched') !== -1);
  }
  t.end();
});

// --- deleteAll ------------------------------------------------------

test('deleteAll: purges all REVIEW# items for a subject', async function (t) {
  reset();
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T10:00:00Z',
    findings: [{ claimSignature: 'sig1' }]
  });
  await store.saveReview('cp1', {
    reviewedAt: '2026-07-02T11:00:00Z',
    findings: [{ claimSignature: 'sig2' }]
  });
  await store.deleteAll('cp1');
  const rvs = await store.listReviews('cp1');
  t.equal(rvs.length, 0);
  t.end();
});
