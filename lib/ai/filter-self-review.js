'use strict';

// Strip parts of the writer's `selfReview` payload that the runtime
// config flags say we shouldn't be persisting. Guarantees the stored
// shape can never contain fields for a feature that's turned off —
// even if the writer emitted them (e.g. flag was toggled between
// prompt build and save, or the prompt module always emits them).
// Returns null when nothing survives filtering (writer emitted no
// self-review AND/OR both flags are off).
//
// Extracted into its own module so tests can exercise it without
// dragging in biography-store / review-store / dynamo — those pull
// in a DB client that other tests mock via require.cache, and loading
// them from a unit test breaks the cache mock for later tests.
function filterSelfReview (selfReview, config) {
  if (!selfReview || typeof selfReview !== 'object') return null;
  const keepChecks = config && config.aiBiographyWriterSelfChecksEnabled !== false;
  const keepAbstention = config && config.aiBiographyStructuredAbstentionEnabled !== false;
  const out = {};
  if (keepChecks && selfReview.planningNotes) out.planningNotes = selfReview.planningNotes;
  if (keepChecks && selfReview.checks) out.checks = selfReview.checks;
  if (keepAbstention && Array.isArray(selfReview.skipped) && selfReview.skipped.length) {
    out.skipped = selfReview.skipped;
  }
  return Object.keys(out).length ? out : null;
}

module.exports = filterSelfReview;
