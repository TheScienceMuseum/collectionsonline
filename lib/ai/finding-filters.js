'use strict';

// Small pure helpers for filtering review findings against a
// biography's current sentence set. Extracted into its own module so
// the admin detail handler stays a route file (not a store of pure
// business logic) and the filtering behaviour can be unit-tested
// directly.
//
// Design principle: filters are DISPLAY-TIME only. Findings never get
// deleted from their REVIEW# item — they sit as `pending` and
// automatically re-surface in the panel if a future regeneration
// produces a sentence with a matching claimSignature. That means a
// reviewer's concern comes back if the writer regurgitates the same
// claim, without any per-record garbage-collection step.
//
// Edge case (documented on the caller): exact signature match only.
// A curator decision or a review finding will NOT re-apply if the
// writer paraphrases the same underlying fact with sufficiently
// different tokens that the signature changes. Task 25's fuzzy-
// similarity dedup helps writer-side by avoiding near-duplicates,
// but does not extend to curator decision / finding matching at
// render time.

// Return only the findings whose claimSignature appears in the given
// current-sentence set. Findings without a signature (defensive) are
// dropped. Sentences without a signature are ignored. Preserves input
// ordering — pair with sortOpenFindings if severity-first display is
// wanted (already done in the admin detail handler before this
// filter is applied).
function filterToCurrentSentences (findings, sentences) {
  const set = signatureSet(sentences);
  return (findings || []).filter(function (f) {
    return f && f.claimSignature && set.has(f.claimSignature);
  });
}

// Complement: how many pending findings the filter dropped. Fed to
// the template as a "N stale filtered" hint so a curator knows the
// panel is trimmed rather than empty because nothing's wrong.
function countStale (findings, sentences) {
  const set = signatureSet(sentences);
  let n = 0;
  (findings || []).forEach(function (f) {
    if (!f || !f.claimSignature) { n += 1; return; }
    if (!set.has(f.claimSignature)) n += 1;
  });
  return n;
}

function signatureSet (sentences) {
  const s = new Set();
  (sentences || []).forEach(function (x) {
    if (x && x.claimSignature) s.add(x.claimSignature);
  });
  return s;
}

module.exports = {
  filterToCurrentSentences,
  countStale
};
