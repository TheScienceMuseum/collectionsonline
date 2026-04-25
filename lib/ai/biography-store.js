'use strict';

const dynamo = require('./dynamo');
const flagStore = require('./flag-store');

// Sort-key schema:
//   SK = BIOGRAPHY                   — canonical / public record (one per PK)
//   SK = HISTORY#<ISO timestamp>     — snapshot of every save, enables A/B compare
//   SK = STAFF_NOTE#<ISO timestamp>  — free-text staff note (append-only log)
//   SK = STAFF_FLAG#<staff>          — staff flag (upsert, one per staff member).
//                                      Value is a reason: inaccurate / wrong_tone /
//                                      wrong_subject. Sets status=flagged on first set.
//   SK = REVIEW#<ISO timestamp>      — structured AI-review findings, produced
//                                      on demand via a premium model. Anchored
//                                      to the biography version it reviewed;
//                                      marked stale if the biography changes.
//   SK = FLAGS                       — aggregate public flag counters (single
//                                      item per record with per-reason counts)
//
// "staff" is used instead of "curator" everywhere in the admin data model —
// at a museum "curator" is already a loaded role title, and the admin tool
// is used by a broader set of staff than just collection curators.
const SK_CANONICAL = 'BIOGRAPHY';
const SK_HISTORY_PREFIX = 'HISTORY#';
const SK_NOTE_PREFIX = 'STAFF_NOTE#';
const SK_STAFF_FLAG_PREFIX = 'STAFF_FLAG#';
const SK_REVIEW_PREFIX = 'REVIEW#';

// Fetch the canonical biography record for a given PK. Returns the item
// as-stored regardless of status; callers inspect `status` themselves to
// decide what to do. This is the sensible default — public routes need to
// distinguish live/flagged (serve) from hidden/insufficient_data (suppress),
// and admin needs to see everything regardless.
function fetchBiography (id) {
  return dynamo.get(id, SK_CANONICAL);
}

function saveBiography (id, data, opts) {
  opts = opts || {};
  const generatedAt = data.generatedAt || new Date().toISOString();
  const ops = [];

  // Canonical write is the one that affects the public-facing biography.
  // Pass opts.snapshotOnly to SKIP this write — used for A/B experimentation
  // (e.g. custom prompts from the compare page) where we want the output
  // available for review as a snapshot but do NOT want it on the live site
  // until a staff member explicitly promotes it via "Set as current".
  //
  // The canonical item carries `entityType='BIOGRAPHY'` and `status` so it
  // projects into the CreatedAtIndex and StatusIndex GSIs. It is the ONLY
  // item kind that projects into either GSI.
  if (!opts.snapshotOnly) {
    const canonical = Object.assign({}, data, {
      PK: id,
      SK: SK_CANONICAL,
      entityType: 'BIOGRAPHY',
      generatedAt
    });
    ops.push(dynamo.put(canonical));
  }

  // Timestamped history snapshot — written whenever there's content to show.
  // Cheap storage, invaluable for iterating prompts and comparing models.
  // Skipped when there's no biographyHtml (e.g. pure insufficient_data markers)
  // so the history view stays readable.
  //
  // Snapshots are base-table only — they do NOT carry `entityType` or `status`
  // so they are absent from both GSIs. They're only ever queried directly by
  // PK + SK-prefix via listHistory().
  if (data.biographyHtml) {
    const snapshot = Object.assign({}, data, {
      PK: id,
      SK: SK_HISTORY_PREFIX + generatedAt,
      generatedAt
    });
    delete snapshot.entityType;
    delete snapshot.status;
    ops.push(dynamo.put(snapshot));
  }

  // When fresh content is written to the canonical record, any existing
  // pending public flags are now against the PREVIOUS biography. Don't
  // clear them — staff haven't actually reviewed them. Instead mark them
  // "from previous biography" so the admin UI can warn the next reviewer
  // that the content they're looking at may or may not address the flags.
  // Staff clears pending explicitly via Mark as reviewed when ready.
  if (!opts.snapshotOnly && data.biographyHtml) {
    ops.push(flagStore.markPendingStale(id, generatedAt).catch(function (err) {
      console.warn('Flag-mark-stale failed for', id, '-', err && err.message);
    }));
  }

  return Promise.all(ops);
}

function updateStatus (id, status) {
  return dynamo.update(id, SK_CANONICAL, { status });
}

async function deleteBiography (id) {
  // Cascade delete — wipes canonical + all related items under this PK.
  // Staff use "hide" (status=hidden) for "take off public view but keep
  // the history"; delete means "truly remove this record and all its
  // derivatives". Covers:
  //   - canonical (SK=BIOGRAPHY)
  //   - every history snapshot (SK=HISTORY#*)
  //   - every staff note (SK=STAFF_NOTE#*)
  //   - every staff flag (SK=STAFF_FLAG#*)
  //   - every AI review (SK=REVIEW#*)
  //   - public-flag counters (SK=FLAGS)
  const [history, notes, flags, reviews] = await Promise.all([
    dynamo.queryByPkPrefix(id, SK_HISTORY_PREFIX),
    dynamo.queryByPkPrefix(id, SK_NOTE_PREFIX),
    dynamo.queryByPkPrefix(id, SK_STAFF_FLAG_PREFIX),
    dynamo.queryByPkPrefix(id, SK_REVIEW_PREFIX)
  ]);

  const ops = [dynamo.delete(id, SK_CANONICAL)];
  (history.items || []).forEach(function (item) { ops.push(dynamo.delete(id, item.SK)); });
  (notes.items || []).forEach(function (item) { ops.push(dynamo.delete(id, item.SK)); });
  (flags.items || []).forEach(function (item) { ops.push(dynamo.delete(id, item.SK)); });
  (reviews.items || []).forEach(function (item) { ops.push(dynamo.delete(id, item.SK)); });
  ops.push(flagStore.deleteFlags(id));

  return Promise.all(ops);
}

function listBiographies (status, limit, lastKey) {
  if (status && status !== 'all') {
    return dynamo.queryByStatus(status, limit, lastKey);
  }
  // "All" view: use the CreatedAtIndex GSI — returns every biography across
  // all statuses in reverse chronological order, with native cursor pagination.
  return dynamo.queryByCreatedAt(limit, lastKey);
}

// Case-insensitive substring search over personName. DynamoDB has no native
// ILIKE / full-text, and we don't want to build a full search index for a
// <25k record table — so we page through the CreatedAtIndex GSI and filter
// client-side. Bounded work: at most `maxBatches × batchSize` records are
// scanned before we stop, which keeps the worst case tolerable (a search
// that matches nothing still only reads ~2500 records). If the catalogue
// ever grows past ~25k, reach for OpenSearch or store `personNameLower` as
// an indexed attribute; until then this is plenty.
async function searchByName (q, limit) {
  const needle = (q || '').toLowerCase().trim();
  if (!needle) return { items: [], lastKey: null };
  const wanted = limit || 25;
  const batchSize = 500;
  const maxBatches = 5;
  const matched = [];
  let lastKey = null;
  for (let i = 0; i < maxBatches && matched.length < wanted; i++) {
    const page = await dynamo.queryByCreatedAt(batchSize, lastKey);
    (page.items || []).forEach(function (item) {
      if ((item.personName || '').toLowerCase().indexOf(needle) !== -1) {
        matched.push(item);
      }
    });
    lastKey = page.lastKey;
    if (!lastKey) break;
  }
  // No pagination on name-search results — if 25 hits isn't enough, refine.
  // Matches the "direct ID" search UX: search narrows to a single answer.
  return { items: matched.slice(0, wanted), lastKey: null };
}

// --- History snapshots (for compare view) ---

function listHistory (id) {
  return dynamo.queryByPkPrefix(id, SK_HISTORY_PREFIX).then(function (result) {
    // Reverse chronological — DynamoDB returns ascending by default; we want
    // newest first so the compare view puts the latest snapshot on the left.
    return (result.items || []).slice().reverse();
  });
}

function deleteSnapshot (id, snapshotSk) {
  if (!snapshotSk || snapshotSk.indexOf(SK_HISTORY_PREFIX) !== 0) {
    return Promise.reject(new Error('Invalid snapshot SK: ' + snapshotSk));
  }
  return dynamo.delete(id, snapshotSk);
}

// --- Staff notes (free-text, append-only per record) ---

function addStaffNote (id, note) {
  const now = new Date().toISOString();
  const item = {
    PK: id,
    SK: SK_NOTE_PREFIX + now,
    entityType: 'STAFF_NOTE',
    createdAt: now,
    staff: note.staff || 'unknown',
    text: note.text || '',
    // Scope the note to the specific biography version it was written against.
    // These fields are captured at note-creation time and never updated — they
    // anchor the note to a particular generation so future regenerations can
    // surface it as potentially stale context rather than current feedback.
    biographyPromptVersion: note.biographyPromptVersion || null,
    biographyGeneratedAt: note.biographyGeneratedAt || null,
    biographyModel: note.biographyModel || null
  };
  return dynamo.put(item).then(function () { return item; });
}

function listStaffNotes (id) {
  return dynamo.queryByPkPrefix(id, SK_NOTE_PREFIX).then(function (result) {
    return (result.items || []).slice().reverse(); // newest first
  });
}

function deleteStaffNote (id, sk) {
  return dynamo.delete(id, sk);
}

// --- Staff flags (upsert, one per staff member per record) ---

function setStaffFlag (id, staff, reason, context) {
  // context = { biographyPromptVersion, biographyGeneratedAt, biographyModel }
  // captured at the moment the flag is set. If the biography is later
  // regenerated, we can mark the flag as 'stale' — same approach as notes.
  const now = new Date().toISOString();
  const item = {
    PK: id,
    SK: SK_STAFF_FLAG_PREFIX + staff,
    entityType: 'STAFF_FLAG',
    staff,
    reason, // 'inaccurate' | 'wrong_tone' | 'wrong_subject'
    updatedAt: now,
    biographyPromptVersion: (context && context.biographyPromptVersion) || null,
    biographyGeneratedAt: (context && context.biographyGeneratedAt) || null,
    biographyModel: (context && context.biographyModel) || null
  };
  return dynamo.put(item).then(function () { return item; });
}

function clearStaffFlag (id, staff) {
  return dynamo.delete(id, SK_STAFF_FLAG_PREFIX + staff);
}

function listStaffFlags (id) {
  return dynamo.queryByPkPrefix(id, SK_STAFF_FLAG_PREFIX).then(function (result) {
    return result.items || [];
  });
}

// --- AI reviews (triage findings from a premium model) ---

function addReview (id, review) {
  const now = new Date().toISOString();
  const item = Object.assign({
    PK: id,
    SK: SK_REVIEW_PREFIX + now,
    entityType: 'REVIEW',
    createdAt: now
  }, review);
  return dynamo.put(item).then(function () { return item; });
}

function listReviews (id) {
  return dynamo.queryByPkPrefix(id, SK_REVIEW_PREFIX).then(function (result) {
    return (result.items || []).slice().reverse(); // newest first
  });
}

function deleteReview (id, sk) {
  if (!sk || sk.indexOf(SK_REVIEW_PREFIX) !== 0) {
    return Promise.reject(new Error('Invalid review SK: ' + sk));
  }
  return dynamo.delete(id, sk);
}

// --- Promote a history snapshot to canonical (no regeneration) ---

async function promoteSnapshot (id, snapshotSk) {
  // Fetch the snapshot, rewrite as canonical. No Claude call — pure data copy.
  const snapshot = await dynamo.get(id, snapshotSk);
  if (!snapshot) {
    throw new Error('Snapshot not found: ' + snapshotSk);
  }
  // Snapshot items don't carry `status` (stripped at save time because
  // they don't project into StatusIndex). On promote we need to reinstate
  // one or the canonical record ends up status-less — which in turn breaks
  // the list-view badge and filter tabs. Preserve the current canonical's
  // status so the visibility intent is kept (e.g. promoting between hidden
  // preview snapshots stays hidden). Fall back to 'live' if no canonical
  // exists yet — promotion is an explicit "make this current" action.
  const existing = await dynamo.get(id, SK_CANONICAL);
  // saveBiography writes both canonical + a fresh history snapshot. The
  // fresh snapshot is harmless duplication — the same content tagged with
  // the promote timestamp, useful for audit ("we switched back to v3 here").
  // Strip the snapshot's own SK/entityType/keys so saveBiography sets them.
  const payload = Object.assign({}, snapshot);
  delete payload.PK;
  delete payload.SK;
  delete payload.entityType;
  delete payload.updatedAt;
  payload.status = (existing && existing.status) || 'live';
  // Preserve generatedAt so the restored biography keeps its original
  // generation timestamp (more useful than "when it was last promoted").
  return saveBiography(id, payload);
}

module.exports = {
  fetchBiography,
  saveBiography,
  updateStatus,
  deleteBiography,
  listBiographies,
  searchByName,
  listHistory,
  addStaffNote,
  listStaffNotes,
  deleteStaffNote,
  setStaffFlag,
  clearStaffFlag,
  listStaffFlags,
  addReview,
  listReviews,
  deleteReview,
  promoteSnapshot,
  deleteSnapshot
};
