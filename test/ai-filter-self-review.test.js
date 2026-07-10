'use strict';

// Focused unit tests for filter-self-review. Kept in its own file
// module (not inside regenerate-biography.js) so this test doesn't
// drag in the ES / DynamoDB / Anthropic-dependent chain — the
// review-store test relies on mocking dynamo via require.cache and
// that mock breaks if regenerate-biography.js is already loaded.

const test = require('tape');
const filterSelfReview = require('../lib/ai/filter-self-review');

// --- filterSelfReview ------------------------------------------------

test('filterSelfReview: null input → null', function (t) {
  t.equal(filterSelfReview(null, {}), null);
  t.equal(filterSelfReview(undefined, {}), null);
  t.equal(filterSelfReview('not-an-object', {}), null);
  t.end();
});

test('filterSelfReview: both flags on → all fields kept', function (t) {
  const input = {
    planningNotes: 'plan',
    checks: { temporalConsistency: 'ok' },
    skipped: [{ desiredText: 'X', reason: 'no_source_available' }]
  };
  const config = {
    aiBiographyWriterSelfChecksEnabled: true,
    aiBiographyStructuredAbstentionEnabled: true
  };
  const out = filterSelfReview(input, config);
  t.equal(out.planningNotes, 'plan');
  t.deepEqual(out.checks, { temporalConsistency: 'ok' });
  t.equal(out.skipped.length, 1);
  t.end();
});

test('filterSelfReview: default config (no keys set) → all fields kept', function (t) {
  const input = {
    planningNotes: 'plan',
    checks: { temporalConsistency: 'ok' },
    skipped: [{ desiredText: 'X', reason: 'no_source_available' }]
  };
  // Empty config — writer-self-review flags default ON via !== false semantics
  const out = filterSelfReview(input, {});
  t.ok(out.planningNotes);
  t.ok(out.checks);
  t.ok(out.skipped);
  t.end();
});

test('filterSelfReview: selfChecks flag OFF → drops planningNotes + checks, keeps skipped', function (t) {
  const input = {
    planningNotes: 'plan',
    checks: { temporalConsistency: 'ok' },
    skipped: [{ desiredText: 'X', reason: 'llm_prior_only' }]
  };
  const config = {
    aiBiographyWriterSelfChecksEnabled: false,
    aiBiographyStructuredAbstentionEnabled: true
  };
  const out = filterSelfReview(input, config);
  t.equal(out.planningNotes, undefined, 'planningNotes dropped');
  t.equal(out.checks, undefined, 'checks dropped');
  t.equal(out.skipped.length, 1, 'skipped kept');
  t.end();
});

test('filterSelfReview: abstention flag OFF → drops skipped, keeps checks', function (t) {
  const input = {
    planningNotes: 'plan',
    checks: { temporalConsistency: 'ok' },
    skipped: [{ desiredText: 'X', reason: 'no_source_available' }]
  };
  const config = {
    aiBiographyWriterSelfChecksEnabled: true,
    aiBiographyStructuredAbstentionEnabled: false
  };
  const out = filterSelfReview(input, config);
  t.equal(out.planningNotes, 'plan', 'planningNotes kept');
  t.deepEqual(out.checks, { temporalConsistency: 'ok' }, 'checks kept');
  t.equal(out.skipped, undefined, 'skipped dropped');
  t.end();
});

test('filterSelfReview: both flags OFF → null', function (t) {
  const input = {
    planningNotes: 'plan',
    checks: { temporalConsistency: 'ok' },
    skipped: [{ desiredText: 'X', reason: 'no_source_available' }]
  };
  const config = {
    aiBiographyWriterSelfChecksEnabled: false,
    aiBiographyStructuredAbstentionEnabled: false
  };
  t.equal(filterSelfReview(input, config), null);
  t.end();
});

test('filterSelfReview: writer emitted nothing under abstention flag → null', function (t) {
  const input = { planningNotes: 'plan', checks: { x: 'y' } };
  const config = {
    aiBiographyWriterSelfChecksEnabled: false,
    aiBiographyStructuredAbstentionEnabled: true
  };
  t.equal(filterSelfReview(input, config), null, 'nothing keeps → null');
  t.end();
});

test('filterSelfReview: empty skipped array not persisted', function (t) {
  const input = { skipped: [] };
  const config = {
    aiBiographyWriterSelfChecksEnabled: false,
    aiBiographyStructuredAbstentionEnabled: true
  };
  t.equal(filterSelfReview(input, config), null);
  t.end();
});
