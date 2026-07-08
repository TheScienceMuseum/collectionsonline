'use strict';

// Tests for the v2 source-tagged pipeline metrics added to
// dashboard-stats.js (Task 53). Uses the same fake-dynamo pattern as
// test/ai-dashboard-stats-reviews.test.js: a scan() that returns all
// items in one page, no AWS SDK involved.

const test = require('tape');
const dashboardStats = require('../lib/ai/dashboard-stats');

function makeFakeDynamo (items) {
  return {
    isReady: function () { return true; },
    scan: function () {
      return Promise.resolve({ items: items.slice(), lastKey: null });
    }
  };
}

const CONFIG = { aiBiographyGbpPerUsd: 0.8 };

function biographyItem (overrides) {
  return Object.assign({
    entityType: 'BIOGRAPHY',
    PK: 'cp1',
    SK: 'BIOGRAPHY',
    status: 'live',
    model: 'claude-sonnet-4-6',
    inputTokens: 2000,
    outputTokens: 500,
    generatedAt: new Date().toISOString()
  }, overrides);
}

function reviewItem (overrides) {
  return Object.assign({
    entityType: 'REVIEW',
    PK: 'cp1',
    SK: 'REVIEW#2026-07-03T10:00:00Z',
    reviewedAt: new Date().toISOString(),
    reviewerModel: 'claude-sonnet-4-6',
    inputTokens: 1500,
    outputTokens: 400,
    findings: []
  }, overrides);
}

function curatorDecisionsItem (overrides) {
  return Object.assign({
    entityType: 'CURATOR_DECISIONS',
    PK: 'cp1',
    SK: 'CURATOR_DECISIONS',
    approvals: [],
    rejections: [],
    clarifications: []
  }, overrides);
}

test.onFinish = function () {}; // silence tape's default cleanup

// invalidate before each test since dashboard-stats caches globally
function reset () { dashboardStats.invalidate(); }

// --- Records with sentences (v2 shape identification) -----------------

test('v2: records without sentences[] are not counted as v2', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    biographyItem({ PK: 'cp1', biographyHtml: '<p>legacy prose</p>' }),
    biographyItem({ PK: 'cp2', biographyHtml: '<p>another legacy</p>' })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.recordsWithSentences, 0);
  t.equal(stats.v2.sourceTagTotal, 0);
  t.end();
});

test('v2: records with sentences[] increment recordsWithSentences', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    biographyItem({ PK: 'cp1', sentences: [{ text: 'A.', source: 'museum' }] }),
    biographyItem({ PK: 'cp2', sentences: [{ text: 'B.', source: 'wikidata' }] }),
    biographyItem({ PK: 'cp3', biographyHtml: '<p>legacy</p>' })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.recordsWithSentences, 2);
  t.equal(stats.totals.biographies, 3, 'total biographies still counts all');
  t.end();
});

test('v2: empty sentences[] does NOT increment recordsWithSentences', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    biographyItem({ PK: 'cp1', sentences: [] })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.recordsWithSentences, 0);
  t.end();
});

// --- Source tag distribution -----------------------------------------

test('v2: sourceTagDistribution aggregates across all sentences', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    biographyItem({
      PK: 'cp1',
      sentences: [
        { text: 'A.', source: 'museum' },
        { text: 'B.', source: 'museum' },
        { text: 'C.', source: 'wikidata' },
        { text: 'D.', source: 'llm:inferred' }
      ]
    }),
    biographyItem({
      PK: 'cp2',
      sentences: [
        { text: 'E.', source: 'museum' },
        { text: 'F.', source: 'llm:contextualising' },
        { text: 'G.', source: 'llm:general_knowledge' }
      ]
    })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.sourceTagTotal, 7);

  const asMap = Object.create(null);
  stats.v2.sourceTagDistribution.forEach(function (r) { asMap[r.tag] = r.count; });
  t.equal(asMap.museum, 3);
  t.equal(asMap.wikidata, 1);
  t.equal(asMap['llm:inferred'], 1);
  t.equal(asMap['llm:contextualising'], 1);
  t.equal(asMap['llm:general_knowledge'], 1);

  // Sorted most-common first
  t.equal(stats.v2.sourceTagDistribution[0].tag, 'museum');
  t.equal(stats.v2.sourceTagDistribution[0].count, 3);
  t.end();
});

test('v2: llm:validated:<toolname> variants collapse under llm:validated', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    biographyItem({
      sentences: [
        { text: 'A.', source: 'llm:validated:wikipedia' },
        { text: 'B.', source: 'llm:validated:wikidataDeep' },
        { text: 'C.', source: 'llm:validated:odnb' }
      ]
    })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  const asMap = Object.create(null);
  stats.v2.sourceTagDistribution.forEach(function (r) { asMap[r.tag] = r.count; });
  t.equal(asMap['llm:validated'], 3, 'all three variants collapse');
  t.notOk(asMap['llm:validated:wikipedia'], 'per-tool key not surfaced');
  t.end();
});

// --- Verification candidates -----------------------------------------

test('v2: verificationCandidates sums across all records', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    biographyItem({
      PK: 'cp1',
      sentences: [{ text: 'x', source: 'museum' }],
      verificationCandidates: {
        generalKnowledgeCount: 2,
        contextualisingCount: 3,
        inferredCount: 1,
        estimatedExternalValidationCost: 0.05
      }
    }),
    biographyItem({
      PK: 'cp2',
      sentences: [{ text: 'y', source: 'museum' }],
      verificationCandidates: {
        generalKnowledgeCount: 1,
        contextualisingCount: 0,
        inferredCount: 4,
        estimatedExternalValidationCost: 0.02
      }
    }),
    biographyItem({ PK: 'cp3', biographyHtml: '<p>legacy, no candidates</p>' })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.verificationCandidates.generalKnowledge, 3);
  t.equal(stats.v2.verificationCandidates.contextualising, 3);
  t.equal(stats.v2.verificationCandidates.inferred, 5);
  t.equal(stats.v2.verificationCandidates.total, 11);
  t.ok(Math.abs(stats.v2.verificationCandidates.estimatedExternalValidationCost - 0.07) < 1e-9);
  t.equal(typeof stats.v2.verificationCandidates.estimatedExternalValidationCostFormatted, 'string');
  t.end();
});

test('v2: verificationCandidates handles missing block gracefully', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    biographyItem({ sentences: [{ text: 'x', source: 'museum' }] })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.verificationCandidates.total, 0);
  t.equal(stats.v2.verificationCandidates.estimatedExternalValidationCost, 0);
  t.end();
});

// --- Open findings ---------------------------------------------------

test('v2: recordsWithOpenFindings counts distinct PKs with pending findings', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    reviewItem({
      PK: 'cp1',
      SK: 'REVIEW#2026-07-03T10:00:00Z',
      findings: [
        { claimSignature: 'a', kind: 'error', confidence: 'high', resolution: 'pending' }
      ]
    }),
    // Same subject, second review — should not double-count
    reviewItem({
      PK: 'cp1',
      SK: 'REVIEW#2026-07-03T11:00:00Z',
      findings: [
        { claimSignature: 'b', kind: 'error', confidence: 'medium', resolution: 'pending' }
      ]
    }),
    reviewItem({
      PK: 'cp2',
      findings: [
        { claimSignature: 'c', kind: 'info', confidence: 'low', resolution: 'pending' }
      ]
    }),
    // Different subject, no pending findings
    reviewItem({
      PK: 'cp3',
      findings: [
        { claimSignature: 'd', kind: 'error', confidence: 'high', resolution: 'dismissed' }
      ]
    })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.recordsWithOpenFindings, 2, 'cp1 (deduped) + cp2, not cp3');
  t.end();
});

test('v2: reviews with empty findings[] do not count', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    reviewItem({ PK: 'cp1', findings: [] })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.recordsWithOpenFindings, 0);
  t.end();
});

// --- Curator decisions ----------------------------------------------

test('v2: recordsWithCuratorDecisions counts items with any non-empty array', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    curatorDecisionsItem({
      PK: 'cp1',
      approvals: [{ claimSignature: 'a' }]
    }),
    curatorDecisionsItem({
      PK: 'cp2',
      rejections: [{ claimSignature: 'b' }]
    }),
    curatorDecisionsItem({
      PK: 'cp3',
      clarifications: [{ claimSignature: 'c', clarification: 'use X' }]
    }),
    // Empty singleton — should NOT count
    curatorDecisionsItem({ PK: 'cp4' })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  t.equal(stats.v2.recordsWithCuratorDecisions, 3);
  t.end();
});

// --- v2 review cost accounting (regression guard) --------------------

test('v2: reviewer_Model + reviewedAt fields are accepted for cost accounting', async function (t) {
  reset();
  const dynamo = makeFakeDynamo([
    // v2 REVIEW# shape — reviewerModel + reviewedAt (not reviewModel/createdAt)
    reviewItem({
      PK: 'cp1',
      reviewerModel: 'claude-sonnet-4-6',
      reviewedAt: new Date().toISOString(),
      inputTokens: 1500,
      outputTokens: 400,
      findings: []
    })
  ]);
  const stats = await dashboardStats.getStats(dynamo, CONFIG);
  // If the cost accounting missed v2 field names, review count would be 0
  t.equal(stats.costs.byKind[1].count, 1, 'v2 review counted in byKind[review]');
  t.ok(stats.costs.byKind[1].lifetime > 0, 'v2 review contributes non-zero cost');
  t.end();
});

// --- Empty stats (unavailable path) ----------------------------------

test('emptyStats: has v2 block with zeros', function (t) {
  reset();
  const dynamo = { isReady: function () { return false; } };
  return dashboardStats.getStats(dynamo, CONFIG).then(function (stats) {
    t.equal(stats.unavailable, true);
    t.ok(stats.v2, 'v2 block present');
    t.equal(stats.v2.recordsWithSentences, 0);
    t.equal(stats.v2.sourceTagTotal, 0);
    t.deepEqual(stats.v2.sourceTagDistribution, []);
    t.equal(stats.v2.recordsWithOpenFindings, 0);
    t.equal(stats.v2.recordsWithCuratorDecisions, 0);
    t.equal(stats.v2.verificationCandidates.total, 0);
    t.end();
  });
});
