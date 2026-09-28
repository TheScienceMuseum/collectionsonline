'use strict';

// CRUD for the CURATOR_DECISIONS singleton per subject. Stores three
// arrays of curator actions keyed by claimSignature — approvals,
// rejections, clarifications — that the render layer consults to
// override the source-tag filter and that the writer prompt consults
// to constrain regeneration.
//
// Under PK/SK conventions matching lib/ai/biography-store.js:
//   PK: <subject id>          (e.g. cp37054)
//   SK: 'CURATOR_DECISIONS'   (singleton per PK; no run history)
//   entityType: 'CURATOR_DECISIONS'
//
// Same claimSignature can appear across all three arrays — approvals
// and rejections are mutually exclusive per the render layer's
// dominance rule (rejection wins), but they can coexist in storage
// without corruption. Read-modify-write pattern: pull the current
// item, mutate the array, put it back. Fine at MVP scale.

const dynamo = require('./dynamo');

const SK_DECISIONS = 'CURATOR_DECISIONS';
const ENTITY_TYPE = 'CURATOR_DECISIONS';

async function get (id) {
  return dynamo.get(id, SK_DECISIONS);
}

async function ensureItem (id) {
  const existing = await get(id);
  if (existing) return existing;
  const empty = {
    PK: id,
    SK: SK_DECISIONS,
    entityType: ENTITY_TYPE,
    approvals: [],
    rejections: [],
    clarifications: [],
    createdAt: new Date().toISOString()
  };
  await dynamo.put(empty);
  return empty;
}

// Attach approval, rejection, or clarification to a claim signature.
// Same signature can only appear ONCE per array — repeat calls replace
// the previous entry (typically what curators intend when they revise).
// Task 60: `opts.precedingState` — { visible, decidedBy, concern } —
// captures the sentence's state at the moment the curator acted.
// Persisted verbatim on the entry so an audit query can answer "was
// there a pending finding when the curator rejected this?" without
// replaying render state. Optional — legacy entries and callers that
// don't supply it get `null`, distinguishable from a real state.

async function addApproval (id, opts) {
  if (!opts || !opts.claimSignature) throw new Error('addApproval requires claimSignature');
  const item = await ensureItem(id);
  item.approvals = (item.approvals || []).filter(function (a) { return a.claimSignature !== opts.claimSignature; });
  item.approvals.push({
    claimSignature: opts.claimSignature,
    claimText: opts.claimText || null,
    note: opts.note || null,
    approvedAt: new Date().toISOString(),
    approvedBy: opts.approvedBy || null,
    precedingState: opts.precedingState || null
  });
  await dynamo.put(item);
  return item;
}

async function addRejection (id, opts) {
  if (!opts || !opts.claimSignature) throw new Error('addRejection requires claimSignature');
  const item = await ensureItem(id);
  item.rejections = (item.rejections || []).filter(function (r) { return r.claimSignature !== opts.claimSignature; });
  item.rejections.push({
    claimSignature: opts.claimSignature,
    claimText: opts.claimText || null,
    rationale: opts.rationale || null,
    rejectedAt: new Date().toISOString(),
    rejectedBy: opts.rejectedBy || null,
    precedingState: opts.precedingState || null
  });
  await dynamo.put(item);
  return item;
}

async function addClarification (id, opts) {
  if (!opts || !opts.claimSignature) throw new Error('addClarification requires claimSignature');
  if (!opts.clarification) throw new Error('addClarification requires clarification text');
  const item = await ensureItem(id);
  item.clarifications = (item.clarifications || []).filter(function (c) { return c.claimSignature !== opts.claimSignature; });
  item.clarifications.push({
    claimSignature: opts.claimSignature,
    claimText: opts.claimText || null,
    clarification: opts.clarification,
    addedAt: new Date().toISOString(),
    addedBy: opts.addedBy || null,
    precedingState: opts.precedingState || null
  });
  await dynamo.put(item);
  return item;
}

// Remove a single entry by kind + claimSignature. No-op if the entry
// isn't there. Useful when a curator undoes an action.
async function removeEntry (id, kind, claimSignature) {
  const item = await get(id);
  if (!item) return null;
  let key = null;
  if (kind === 'approval') key = 'approvals';
  else if (kind === 'rejection') key = 'rejections';
  else if (kind === 'clarification') key = 'clarifications';
  if (!key) throw new Error('unknown entry kind: ' + kind);
  const before = (item[key] || []).length;
  item[key] = (item[key] || []).filter(function (e) { return e.claimSignature !== claimSignature; });
  if (item[key].length === before) return item; // no change
  await dynamo.put(item);
  return item;
}

// Cascade delete — called from biography-store.deleteBiography() to
// remove all curator work when a subject is purged.
async function deleteAll (id) {
  return dynamo.delete(id, SK_DECISIONS);
}

module.exports = {
  get,
  addApproval,
  addRejection,
  addClarification,
  removeEntry,
  deleteAll,
  SK_DECISIONS
};
