'use strict';

// CRUD for REVIEW# items — per-review-run audit trail. Each review
// call (per-generation auto-review or on-demand Opus escalation)
// produces one REVIEW# item containing:
//
//   PK: <subject id>
//   SK: 'REVIEW#<generatedAt>'   (ISO timestamp — stable sort order)
//   entityType: 'REVIEW'
//   findings: [ { claimSignature, claimText, kind, confidence,
//                 concern, resolution, resolvedAt?, resolvedBy? } ]
//   spend, inputTokens, outputTokens, reviewerModel, reviewedAt
//
// Findings within a review are addressed by their claimSignature.
// updateFindingResolution() mutates the parent REVIEW# item since
// findings are stored as an embedded array (Dynamo pattern; no
// separate FINDING# item).

const dynamo = require('./dynamo');

const SK_REVIEW_PREFIX = 'REVIEW#';
const ENTITY_TYPE = 'REVIEW';

// Persist a fresh review run. Each finding is normalised: kind
// defaults to 'error', confidence to 'low', resolution to 'pending'.
async function saveReview (id, opts) {
  if (!opts || !Array.isArray(opts.findings)) {
    throw new Error('saveReview requires findings array');
  }
  const reviewedAt = opts.reviewedAt || new Date().toISOString();
  const sk = SK_REVIEW_PREFIX + reviewedAt;
  const item = {
    PK: id,
    SK: sk,
    entityType: ENTITY_TYPE,
    reviewedAt,
    reviewerModel: opts.reviewerModel || null,
    spend: opts.spend || 0,
    inputTokens: opts.inputTokens || 0,
    outputTokens: opts.outputTokens || 0,
    findings: opts.findings.map(function (f) {
      return {
        claimSignature: f.claimSignature || null,
        claimText: f.claimText || null,
        kind: f.kind === 'info' ? 'info' : 'error',
        confidence: f.confidence === 'high' || f.confidence === 'medium' || f.confidence === 'low'
          ? f.confidence
          : 'low',
        concern: f.concern || '',
        resolution: 'pending',
        resolvedAt: null,
        resolvedBy: null
      };
    })
  };
  await dynamo.put(item);
  return item;
}

async function getReview (id, sk) {
  if (!sk || sk.indexOf(SK_REVIEW_PREFIX) !== 0) {
    throw new Error('invalid review SK: ' + sk);
  }
  return dynamo.get(id, sk);
}

async function listReviews (id) {
  const result = await dynamo.queryByPkPrefix(id, SK_REVIEW_PREFIX);
  return result.items || [];
}

// Return all OPEN findings (resolution === 'pending') across every
// review run for a subject, flattened into one array. Callers get the
// same list the renderer expects.
async function openFindings (id) {
  const reviews = await listReviews(id);
  const out = [];
  for (const rv of reviews) {
    for (const f of rv.findings || []) {
      if (f.resolution === 'pending') {
        out.push(Object.assign({}, f, { reviewSK: rv.SK, reviewedAt: rv.reviewedAt }));
      }
    }
  }
  return out;
}

// Mark a finding resolved. `resolution` is one of accepted / dismissed
// / clarified — the renderer treats anything non-'pending' as
// resolved and drops it from openFindings.
async function updateFindingResolution (id, reviewSK, claimSignature, opts) {
  opts = opts || {};
  const resolution = opts.resolution;
  if (['accepted', 'dismissed', 'clarified'].indexOf(resolution) === -1) {
    throw new Error('resolution must be accepted / dismissed / clarified');
  }
  const item = await getReview(id, reviewSK);
  if (!item) throw new Error('review not found: ' + reviewSK);
  const findings = item.findings || [];
  let changed = false;
  for (const f of findings) {
    if (f.claimSignature === claimSignature) {
      f.resolution = resolution;
      f.resolvedAt = new Date().toISOString();
      f.resolvedBy = opts.resolvedBy || null;
      changed = true;
    }
  }
  if (!changed) throw new Error('no finding matched claimSignature: ' + claimSignature);
  await dynamo.put(item);
  return item;
}

// Cascade delete every REVIEW# item under a subject. Called from
// biography-store.deleteBiography.
async function deleteAll (id) {
  const reviews = await listReviews(id);
  await Promise.all(reviews.map(function (r) {
    return dynamo.delete(id, r.SK);
  }));
}

module.exports = {
  saveReview,
  getReview,
  listReviews,
  openFindings,
  updateFindingResolution,
  deleteAll,
  SK_REVIEW_PREFIX
};
