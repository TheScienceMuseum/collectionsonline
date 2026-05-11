'use strict';

// Focused tests for dashboard-stats: AI reviews contribute to spend
// totals alongside biography generations, with a per-kind breakdown
// available for the dashboard. Reviews use the premium model (Opus)
// at significantly higher per-call cost than biography Sonnet calls,
// so excluding them from the dashboard's "spend" totals would
// materially under-report the project's AI bill.

const test = require('tape');
const dashboardStats = require('../lib/ai/dashboard-stats');

// Minimal fake DynamoDB. `scan()` returns one page containing all items
// the test set up. `isReady()` is true so compute() runs (the empty-stats
// shortcut is skipped). Mirrors the real shape returned by the dynamo
// wrapper without pulling in AWS SDK.
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
    generatedAt: new Date().toISOString(),
    biographyHtml: '<p>x</p>'
  }, overrides);
}

function reviewItem (overrides) {
  return Object.assign({
    entityType: 'REVIEW',
    PK: 'cp1',
    SK: 'REVIEW#2026-05-11T10:00:00.000Z',
    reviewModel: 'claude-opus-4-7',
    inputTokens: 3500,
    outputTokens: 800,
    createdAt: new Date().toISOString()
  }, overrides);
}

test('dashboard-stats: REVIEW items contribute to combined lifetime cost', async function (t) {
  dashboardStats.invalidate();
  const stats = await dashboardStats.getStats(makeFakeDynamo([
    biographyItem(),
    reviewItem()
  ]), CONFIG);

  t.ok(stats.costs.biographiesLifetime > 0, 'biographies contribute to lifetime');
  t.ok(stats.costs.reviewsLifetime > 0, 'reviews contribute to lifetime');
  t.equal(
    Number((stats.costs.lifetime).toFixed(6)),
    Number((stats.costs.biographiesLifetime + stats.costs.reviewsLifetime).toFixed(6)),
    'combined lifetime = biographies + reviews'
  );
  t.ok(stats.costs.reviewsLifetime > stats.costs.biographiesLifetime,
    'a single Opus review costs more than a single Sonnet biography (sanity check on pricing weights)');
  t.end();
});

test('dashboard-stats: byKind array exposes biography and review breakdown', async function (t) {
  dashboardStats.invalidate();
  const stats = await dashboardStats.getStats(makeFakeDynamo([
    biographyItem({ PK: 'cp1' }),
    biographyItem({ PK: 'cp2' }),
    reviewItem({ PK: 'cp1', SK: 'REVIEW#a' })
  ]), CONFIG);

  t.equal(stats.costs.byKind.length, 2, 'two kinds emitted');
  const bio = stats.costs.byKind.find(function (k) { return k.kind === 'biography'; });
  const rev = stats.costs.byKind.find(function (k) { return k.kind === 'review'; });
  t.ok(bio && rev, 'both kinds present');
  t.equal(bio.count, 2, 'biography count = 2');
  t.equal(rev.count, 1, 'review count = 1');
  t.equal(bio.label, 'Biographies');
  t.equal(rev.label, 'AI reviews');
  t.ok(typeof bio.lifetimeFormatted === 'string' && bio.lifetimeFormatted.indexOf('£') === 0,
    'biography lifetime is GBP-formatted');
  t.ok(typeof rev.lifetimeFormatted === 'string' && rev.lifetimeFormatted.indexOf('£') === 0,
    'review lifetime is GBP-formatted');
  t.end();
});

test('dashboard-stats: reviewsByModel populated with the review model', async function (t) {
  dashboardStats.invalidate();
  const stats = await dashboardStats.getStats(makeFakeDynamo([
    biographyItem(),
    reviewItem({ SK: 'REVIEW#a' }),
    reviewItem({ SK: 'REVIEW#b' })
  ]), CONFIG);

  t.equal(stats.costs.reviewsByModel.length, 1, 'one review model used');
  const opusRow = stats.costs.reviewsByModel[0];
  t.equal(opusRow.id, 'claude-opus-4-7');
  t.equal(opusRow.count, 2, 'two review calls aggregated to one row');
  t.ok(opusRow.cost > 0);

  // Biography byModel must remain biography-only — keeps the existing
  // dashboard bar chart (which uses totals.biographies as denominator)
  // well-defined.
  t.equal(stats.costs.byModel.length, 1, 'one biography model used');
  t.equal(stats.costs.byModel[0].id, 'claude-sonnet-4-6');
  t.equal(stats.costs.byModel[0].count, 1, 'biography byModel does not include reviews');
  t.end();
});

test('dashboard-stats: unknown review model tracked separately, not silently dropped', async function (t) {
  dashboardStats.invalidate();
  const stats = await dashboardStats.getStats(makeFakeDynamo([
    biographyItem(),
    reviewItem({ reviewModel: 'claude-opus-3-retired', SK: 'REVIEW#a' })
  ]), CONFIG);

  t.equal(stats.costs.reviewUnknownModelCount, 1, 'unknown-model review counted');
  t.equal(stats.costs.reviewsByModel.length, 0, 'unknown-model review not in byModel');
  t.equal(stats.costs.reviewsLifetime, 0, 'unknown-model review excluded from cost total');
  // Biography unknown-model bucket is unaffected — separate tracker.
  t.equal(stats.costs.unknownModelCount, 0, 'biography unknown bucket untouched');
  t.end();
});

test('dashboard-stats: review without tokens is skipped without error', async function (t) {
  dashboardStats.invalidate();
  // Older review schemas might lack token counts. Should not crash or
  // miscount — silent skip is the right call.
  const stats = await dashboardStats.getStats(makeFakeDynamo([
    biographyItem(),
    reviewItem({ inputTokens: undefined, outputTokens: undefined, SK: 'REVIEW#a' })
  ]), CONFIG);

  t.equal(stats.costs.reviewsCount, 0, 'review without tokens contributes 0 count');
  t.equal(stats.costs.reviewsLifetime, 0, 'review without tokens contributes 0 cost');
  t.equal(stats.costs.reviewUnknownModelCount, 0, 'not classified as unknown model — different failure mode');
  t.end();
});

test('dashboard-stats: empty dataset still emits byKind shape (template-safe)', async function (t) {
  dashboardStats.invalidate();
  // Dynamo not ready → emptyStats() path. The dashboard template
  // reads stats.costs.byKind[*] and stats.costs.reviewsByModel, so
  // emptyStats must emit them as empty arrays / zeroed objects.
  const notReady = { isReady: function () { return false; }, scan: function () { return Promise.resolve({ items: [], lastKey: null }); } };
  const stats = await dashboardStats.getStats(notReady, CONFIG);
  t.ok(Array.isArray(stats.costs.byKind), 'byKind is an array');
  t.equal(stats.costs.byKind.length, 2, 'two zeroed kind rows');
  t.ok(Array.isArray(stats.costs.reviewsByModel), 'reviewsByModel is an array');
  t.equal(stats.costs.reviewsLifetimeFormatted, '£0');
  t.end();
});
