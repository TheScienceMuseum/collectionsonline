'use strict';

// Truncate a description string to (at most) maxChars characters, ending at
// a sentence boundary where possible — never mid-sentence.
//
// Why sentence-boundary matters for biography prompts:
//
// We feed related-item descriptions into the prompt as context. Mid-sentence
// truncation produces dangerous adjacency artefacts that the LLM bridges
// with fluent-but-wrong completions. A real example from cp37054 (Einstein):
//
//   Original: "Mounted photograph (passe partout) showing the instruments
//   used at Sobral, Brazil... The expedition organised by Sir Arthur
//   Eddington of the Royal Greenwich Observatory used photographs..."
//
//   Truncated at 200 chars (old behaviour): "...The expedition organised
//   by Sir Arthur Eddington of the Royal…"
//
//   The model saw "Sobral, Brazil" + "Eddington" close together with the
//   disambiguating clause severed, then bridged the gap by writing
//   "Eddington's observations at Sobral" — a textbook hallucination.
//
// Sentence-boundary truncation prevents the truncation from creating a new
// (wrong) implied claim. It can't prevent every hallucination — when the
// catalogue itself doesn't disambiguate, only retrieval can — but it does
// remove one large class.
//
// Algorithm:
//   1. If text is shorter than the cap, return as-is.
//   2. Slice to cap, then walk backwards for the LAST sentence terminator
//      (`.`, `!`, `?`) that's followed by whitespace / end and isn't part
//      of a known abbreviation, decimal number, or ellipsis.
//   3. If found AND the result is at least 30% of the cap, return up to
//      that boundary. (30% balances "preserve sentence integrity" against
//      "don't throw most of the slice away" — in practice, descriptions
//      with no sentence boundary in the first 30% of `cap` are rare and
//      typically nominal phrases for which an ellipsis cut is fine.)
//   4. Otherwise fall back to a word-boundary cut with a trailing ellipsis,
//      to make the truncation visible.
//
// Abbreviations: a heuristic blocklist covers the common cases (Dr, Mr,
// U.S., etc., Ph.D, …). Catalogue prose is well-formed English; we don't
// need to be perfect on every edge case, just robust on the common ones.

// Period-terminated tokens that LOOK like sentence ends but typically aren't.
// Anchored to end of prefix; word boundary on the left so "doctor" doesn't
// match "Dr". Two flavours:
//
//   ALWAYS_NON_TERMINAL: titles preceding names ("Dr. Smith"), adjectival
//     abbreviations ("U.S. Army", "p.m. shift"), and corporate suffixes
//     adjacent to names ("Smith Inc. announced"). These nearly always sit
//     mid-phrase. Treated as non-terminal regardless of what follows.
//
//   MAYBE_TERMINAL: abbreviations that genuinely CAN end a sentence —
//     "...lenses, etc. The factory" is two sentences, but "...lenses, etc.,
//     were on display" is one. Distinguish by what follows: uppercase /
//     end-of-input → terminal, anything else → not.
const ALWAYS_NON_TERMINAL_ABBR_RE = /\b(?:Dr|Mr|Mrs|Ms|St|Sr|Jr|Prof|Rev|Hon|Lt|Capt|Sgt|Col|Gen|Adm|U\.S|U\.K|U\.S\.A|p\.m|a\.m|No|Vol|Inc|Corp|Co|Ltd|Ph\.D|M\.D|B\.A|M\.A)\.$/;
const MAYBE_TERMINAL_ABBR_RE = /\b(?:etc|vs|cf|i\.e|e\.g)\.$/;

// What proportion of the cap must remain before we'd accept a
// sentence-boundary cut. Below this we fall back to word-boundary+ellipsis,
// because a 5%-of-cap sentence-only result throws away most of the slice
// for marginal benefit.
const MIN_ACCEPTABLE_FRACTION = 0.3;

function isSentenceEnd (text, idx) {
  const ch = text[idx];
  if (ch !== '.' && ch !== '!' && ch !== '?') return false;

  // Must be followed by whitespace or be at end of input.
  const next = text[idx + 1];
  if (next !== undefined && !/\s/.test(next)) return false;

  // Reject if part of an ellipsis ("...", "…", "?!", etc.). Look at the two
  // adjacent positions: if either neighbour is also a terminator, treat the
  // whole run as a single emphasis cluster, not a sentence end.
  const prev = text[idx - 1];
  const prev2 = text[idx - 2];
  if (prev === '.' || prev === '!' || prev === '?') return false;
  if (next === '.' || next === '!' || next === '?') return false;
  if (prev2 === '.' && prev !== undefined && prev !== ' ') return false;

  const prefix = text.slice(0, idx + 1);

  // Always-non-terminal abbreviations (titles, adjectival forms): never end
  // a sentence in normal prose, regardless of what follows.
  if (ALWAYS_NON_TERMINAL_ABBR_RE.test(prefix)) return false;

  // Maybe-terminal abbreviations: terminal only when followed by an
  // uppercase letter or the end of the input — i.e. a likely
  // sentence-start. "etc., were" stays mid-sentence; "etc. The" terminates.
  if (MAYBE_TERMINAL_ABBR_RE.test(prefix)) {
    let j = idx + 1;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (j >= text.length) return true;
    return /[A-Z]/.test(text[j]);
  }

  return true;
}

function findLastSentenceEnd (text) {
  for (let i = text.length - 1; i >= 0; i--) {
    if (isSentenceEnd(text, i)) return i + 1;
  }
  return -1;
}

function truncateDescription (text, maxChars) {
  if (!text || typeof text !== 'string') return '';
  if (typeof maxChars !== 'number' || maxChars <= 0) return text.trim();

  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const slice = trimmed.slice(0, maxChars);
  const sentenceEnd = findLastSentenceEnd(slice);

  const minAcceptable = Math.floor(maxChars * MIN_ACCEPTABLE_FRACTION);
  if (sentenceEnd >= minAcceptable) {
    return slice.slice(0, sentenceEnd);
  }

  // Fallback: word-boundary cut with visible ellipsis. The ellipsis is the
  // signal to the LLM (and to a human reader of the prompt) that this
  // string was cut without ceremony — distinct from clean sentence cuts.
  return slice.replace(/\s+\S*$/, '') + '…';
}

module.exports = truncateDescription;
module.exports.isSentenceEnd = isSentenceEnd;
module.exports.findLastSentenceEnd = findLastSentenceEnd;
