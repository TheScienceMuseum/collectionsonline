'use strict';

const dynamo = require('./dynamo');
const flagStore = require('./flag-store');

// Sort-key schema:
//   SK = BIOGRAPHY                   — canonical / public record (one per PK).
//                                      Under v2 carries source-tagged sentences[]
//                                      + paragraphBreaks + writerConfidence +
//                                      writerNotes + verificationCandidates
//                                      + selfReview (writer's planningNotes,
//                                      checks, skipped abstentions — admin
//                                      only, gated by the two writer-self-
//                                      review config flags)
//                                      alongside the existing fields; HTML is
//                                      derived at render time by
//                                      lib/ai/render-biography.js.
//   SK = HISTORY#<ISO timestamp>     — snapshot of every save, enables A/B compare
//   SK = STAFF_NOTE#<ISO timestamp>  — free-text staff note (append-only log)
//   SK = STAFF_FLAG#<staff>          — staff flag (upsert, one per staff member).
//                                      Value is a reason: inaccurate / wrong_tone /
//                                      wrong_subject. Sets status=flagged on first set.
//   SK = REVIEW#<ISO timestamp>      — structured AI-review findings. Under v2 owned
//                                      by lib/ai/review-store.js (findings[] with
//                                      kind + confidence + claimSignature).
//   SK = CURATOR_DECISIONS           — singleton per subject. Approvals /
//                                      rejections / clarifications on individual
//                                      claim signatures. Owned by
//                                      lib/ai/curator-decisions-store.js.
//   SK = FLAGS                       — aggregate public flag counters (single
//                                      item per record with per-reason counts)
//
// "staff" is used instead of "curator" everywhere in the admin data model —
// at a museum "curator" is already a loaded role title, and the admin tool
// is used by a broader set of staff than just collection curators.
const SK_CANONICAL = 'BIOGRAPHY';
const SK_NOTE_PREFIX = 'STAFF_NOTE#';
const SK_STAFF_FLAG_PREFIX = 'STAFF_FLAG#';
const SK_REVIEW_PREFIX = 'REVIEW#';
const SK_CURATOR_DECISIONS = 'CURATOR_DECISIONS';

// Fetch the canonical biography record for a given PK. Returns the item
// as-stored regardless of status; callers inspect `status` themselves to
// decide what to do. This is the sensible default — public routes need to
// distinguish live/flagged (serve) from hidden/insufficient_data (suppress),
// and admin needs to see everything regardless.
function fetchBiography (id) {
  return dynamo.get(id, SK_CANONICAL);
}

function saveBiography (id, data) {
  const generatedAt = data.generatedAt || new Date().toISOString();
  const ops = [];

  // Canonical write. The canonical item carries `entityType='BIOGRAPHY'`
  // and `status` so it projects into the CreatedAtIndex and StatusIndex
  // GSIs. It is the ONLY item kind that projects into either GSI.
  //
  // Note: prior versions of this function also wrote a HISTORY# snapshot
  // per save + supported an opts.snapshotOnly flag for A/B compare-page
  // experimentation. Both were retired when snapshots + the compare page
  // were removed — canonical write is now unconditional.
  const canonical = Object.assign({}, data, {
    PK: id,
    SK: SK_CANONICAL,
    entityType: 'BIOGRAPHY',
    generatedAt
  });
  ops.push(dynamo.put(canonical));

  // When fresh content is written to the canonical record, any existing
  // pending public flags are now against the PREVIOUS biography. Don't
  // clear them — staff haven't actually reviewed them. Instead mark them
  // "from previous biography" so the admin UI can warn the next reviewer
  // that the content they're looking at may or may not address the flags.
  // Staff clears pending explicitly via Mark as reviewed when ready.
  const hasContent = !!(data.biographyHtml || (Array.isArray(data.sentences) && data.sentences.length));
  if (hasContent) {
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
  //   - every staff note (SK=STAFF_NOTE#*)
  //   - every staff flag (SK=STAFF_FLAG#*)
  //   - every AI review (SK=REVIEW#*) — v2 auto-review + any legacy
  //     v1 REVIEW# items still in the table
  //   - the curator-decisions singleton (SK=CURATOR_DECISIONS)
  //   - public-flag counters (SK=FLAGS)
  //
  // CURATOR_DECISIONS is a single item per subject rather than a prefix,
  // so it's added directly to the ops list without a queryByPkPrefix.
  // dynamo.delete on a non-existent key is a no-op so this is safe even
  // for subjects that never got any curator actions.
  const [notes, flags, reviews] = await Promise.all([
    dynamo.queryByPkPrefix(id, SK_NOTE_PREFIX),
    dynamo.queryByPkPrefix(id, SK_STAFF_FLAG_PREFIX),
    dynamo.queryByPkPrefix(id, SK_REVIEW_PREFIX)
  ]);

  const ops = [
    dynamo.delete(id, SK_CANONICAL),
    dynamo.delete(id, SK_CURATOR_DECISIONS)
  ];
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

module.exports = {
  fetchBiography,
  saveBiography,
  updateStatus,
  deleteBiography,
  listBiographies,
  searchByName,
  addStaffNote,
  listStaffNotes,
  deleteStaffNote,
  setStaffFlag,
  clearStaffFlag,
  listStaffFlags
};
