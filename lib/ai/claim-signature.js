'use strict';

// Claim signatures — stable identity for sentences across biography
// regenerations, used to match curator decisions and reviewer findings
// onto newly-generated sentences that mean the same thing but may
// differ slightly in surface form.
//
// A signature is `sha256(sortedTokens).slice(0, 16)` — 64 bits — computed
// on the tokenised, stopword-filtered, sorted form of the claim text.
// Word-order-insensitive by construction: "Einstein worked at the Swiss
// Patent Office" and "worked at the Swiss Patent Office, Einstein"
// produce the same signature.
//
// When exact-signature match fails on a regen (e.g. the writer produced
// substantively similar but not identical text), `similarity()` returns
// a token-containment ratio 0..1 so callers can fall back to fuzzy
// matching. The typical guard is `ratio >= 0.5 && intersection >= 3` —
// tuned in v1 against real reword cases; stays at the same threshold
// here unless prototype testing shows different needs.
//
// See the guardrail-exploration tag (guardrail-exploration-2026-07) for
// the original v1 module (`lib/ai/claim-hash.js`) — most of the
// tokeniser / normalisation logic here is lifted from that module,
// simplified for the v2 use case.

const crypto = require('crypto');

// English stopword list — anything shorter than 3 chars is already
// excluded by tokenize(), this catches the noise that survives.
// Not linguistically exhaustive; the goal is signal-heavy tokens.
const STOPWORDS = new Set([
  'the', 'and', 'but', 'for', 'nor', 'yet', 'has', 'have', 'had', 'was',
  'were', 'been', 'being', 'this', 'that', 'these', 'those', 'with',
  'from', 'into', 'onto', 'upon', 'over', 'under', 'about', 'above',
  'below', 'between', 'among', 'through', 'during', 'before', 'after',
  'since', 'until', 'while', 'when', 'where', 'why', 'how', 'what',
  'which', 'whose', 'whom', 'they', 'them', 'their', 'theirs',
  'there', 'here', 'his', 'her', 'him', 'its', 'own', 'other', 'such',
  'not', 'only', 'more', 'less', 'most', 'least', 'some', 'any', 'all',
  'both', 'each', 'few', 'many', 'much', 'several'
]);

// Normalise a claim string to a canonical form for tokenisation. Handles
// case, punctuation, quote-style variants, and whitespace.
function normalise (text) {
  if (text == null) return '';
  return String(text)
    .toLowerCase()
    // Curly quotes → straight (writer + reviewer may disagree on style)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    // Drop all punctuation and other non-word chars except whitespace
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    // Collapse any run of whitespace to a single space
    .replace(/\s+/g, ' ')
    .trim();
}

// Break a claim into a Set of significant tokens. Filters stopwords +
// short tokens (< 3 chars). Returns a Set so callers can do
// intersection/union operations directly for similarity work.
function tokenize (text) {
  const norm = normalise(text);
  if (!norm) return new Set();
  const out = new Set();
  for (const word of norm.split(/\s+/)) {
    if (word.length < 3) continue;
    if (STOPWORDS.has(word)) continue;
    out.add(word);
  }
  return out;
}

// Compute the stable signature for a claim. Sorts the tokens so
// re-orderings produce the same signature. Returns 16 lowercase hex chars.
function signature (text) {
  const tokens = Array.from(tokenize(text)).sort();
  const joined = tokens.join(' ');
  return crypto.createHash('sha256').update(joined).digest('hex').slice(0, 16);
}

// Containment-style similarity between two claims. Returns 0..1 —
// |intersection| / |smaller set|. Higher than plain Jaccard when one
// claim is a subset of the other, which is what curators need when
// they're matching a shorter finding against a longer sentence.
//
// Callers typically pair this with a minimum-intersection guard
// (e.g. >= 3 tokens) so that a two-word claim like "Sobral Brazil"
// doesn't accidentally match on those two tokens alone.
function similarity (textA, textB) {
  const a = tokenize(textA);
  const b = tokenize(textB);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

// Convenience — return { ratio, intersection } so callers can gate on
// both dimensions in a single call.
function similarityDetail (textA, textB) {
  const a = tokenize(textA);
  const b = tokenize(textB);
  if (!a.size || !b.size) return { ratio: 0, intersection: 0 };
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return { ratio: inter / Math.min(a.size, b.size), intersection: inter };
}

module.exports = {
  normalise,
  tokenize,
  signature,
  similarity,
  similarityDetail
};
