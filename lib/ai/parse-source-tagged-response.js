'use strict';

// Parser for the source-tagged writer's JSON response. Takes the raw
// text emitted by the Anthropic call, produces a validated + normalised
// object ready to persist on the BIOGRAPHY item.
//
// Robustness principles:
//   - Strip common contamination (markdown fences, leading/trailing
//     prose) before JSON.parse.
//   - Recover partial output where possible — drop malformed sentences,
//     don't refuse the whole response.
//   - Unknown source tags default to 'llm:general_knowledge' (SAFEST
//     — hidden by default; curator can promote later).
//   - Compute per-sentence claimSignature via lib/ai/claim-signature.
//   - Emit verificationCandidates counts so the dashboard aggregator
//     can drive future batch external-verification cost projection
//     without further parsing.

const { signature } = require('./claim-signature');

// Ordered strongest → weakest. Used both for validation (allow-list)
// and for canonical sort order on the `sources` array a sentence
// exposes to downstream consumers.
const SOURCE_STRENGTH_ORDER = [
  'museum',
  'oxfordDNB',
  'wikidata',
  'gracesGuide',
  'wikipedia',
  'llm:inferred',
  'llm:contextualising',
  'llm:general_knowledge'
];

const VALID_SOURCES = new Set(SOURCE_STRENGTH_ORDER);
const SOURCE_RANK = {};
SOURCE_STRENGTH_ORDER.forEach(function (s, i) { SOURCE_RANK[s] = i; });

// Callers that want to publish safely by default get the DEFENSIVE tag
// when the writer emits a source we don't recognise. Never widen this.
const UNKNOWN_SOURCE_FALLBACK = 'llm:general_knowledge';

// Normalise the writer's source shape into a canonical, ordered
// `sources: string[]`. Accepts BOTH the legacy `source: string` and
// the new multi-source `sources: string[]`. Filters out unknown tags
// (they're silently dropped rather than surfacing as garbage); if
// nothing survives, returns [UNKNOWN_SOURCE_FALLBACK] so downstream
// still has a valid one-element array to work with.
//
// The returned array is deduped and sorted strongest → weakest, so
// consumers can trust `sources[0]` as the primary/strongest tag and
// `sources[sources.length - 1]` as the weakest (which drives the
// publishing-filter policy).
function normaliseSources (raw) {
  let candidates = [];
  if (Array.isArray(raw.sources)) {
    candidates = raw.sources;
  } else if (typeof raw.source === 'string') {
    candidates = [raw.source];
  }
  const seen = new Set();
  const valid = [];
  candidates.forEach(function (s) {
    if (typeof s !== 'string') return;
    const trimmed = s.trim();
    if (!VALID_SOURCES.has(trimmed) || seen.has(trimmed)) return;
    seen.add(trimmed);
    valid.push(trimmed);
  });
  if (valid.length === 0) return [UNKNOWN_SOURCE_FALLBACK];
  valid.sort(function (a, b) { return SOURCE_RANK[a] - SOURCE_RANK[b]; });
  return valid;
}

// Small read-side helper for downstream consumers. Handles both:
//   - persisted legacy records that only have `sentence.source`
//   - fresh records that have `sentence.sources`
// Always returns an array; never mutates the sentence.
function getSources (sentence) {
  if (sentence && Array.isArray(sentence.sources) && sentence.sources.length) {
    return sentence.sources;
  }
  if (sentence && typeof sentence.source === 'string' && sentence.source) {
    return [sentence.source];
  }
  return [UNKNOWN_SOURCE_FALLBACK];
}

class ParseError extends Error {}

// Public entry point. Returns a normalised payload; throws ParseError
// when the response can't be usefully recovered.
function parseSourceTaggedResponse (rawText) {
  if (rawText == null || String(rawText).trim() === '') {
    throw new ParseError('empty response text');
  }
  const parsed = tryJsonParse(rawText);
  if (parsed == null || typeof parsed !== 'object') {
    throw new ParseError('response was not a JSON object');
  }
  const rawSentences = Array.isArray(parsed.sentences) ? parsed.sentences : [];
  if (rawSentences.length === 0) {
    throw new ParseError('no sentences in response');
  }

  const sentences = normaliseSentences(rawSentences);
  if (sentences.length === 0) {
    // Every sentence was malformed. Refuse rather than persist a
    // biography with zero content.
    throw new ParseError('all sentences were malformed');
  }

  return {
    sentences,
    paragraphBreaks: normaliseParagraphBreaks(parsed.paragraphBreaks, sentences.length),
    confidence: normaliseConfidence(parsed.confidence),
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    verificationCandidates: countCandidates(sentences)
  };
}

// --- JSON extraction -----------------------------------------------

// Strip markdown fences (```json ... ```), leading/trailing prose,
// then attempt JSON.parse. Returns the parsed object or null on any
// failure — caller decides how to handle.
//
// Contamination patterns seen in the wild:
//   1. Leading/trailing ```json / ``` fence at exact edges (common)
//   2. Fenced JSON with prose AFTER the closing fence (Maxwell + Marie
//      Stopes 2026-08). The old regex only stripped fences at exact
//      end-of-string, so trailing prose defeated both the direct parse
//      and the last-'}' fallback (any '}' in the trailing prose
//      widened the slice past the JSON's true end).
//   3. Multiple `{...}` objects (rare — occurs when the model helpfully
//      returns an example alongside the real payload).
//
// Strategy — attempt in order, return the first that parses:
//   1. Direct parse of whitespace-trimmed input
//   2. Direct parse after aggressive fence stripping (all ``` fences,
//      anywhere in the text — not just at edges)
//   3. Extract the first balanced {…} block from the post-fence text
//      by walking brace depth; string-literals with braces don't
//      confuse the counter.
//   4. Legacy fallback: first-'{' to last-'}' slice (kept for cases
//      the balance walker misses due to malformed JSON internals).
function tryJsonParse (text) {
  const raw = String(text).trim();

  try { return JSON.parse(raw); } catch (_) { /* fall through */ }

  // Strip ALL markdown fences, not just edge-anchored ones. This
  // handles the "```json {...} ``` trailing prose" case where the
  // old edge-anchored strip left the trailing prose in place.
  const defenced = raw
    .replace(/```(?:json|javascript|js)?\s*\n?/gi, '')
    .replace(/```/g, '')
    .trim();

  try { return JSON.parse(defenced); } catch (_) { /* fall through */ }

  const balanced = extractFirstBalancedObject(defenced);
  if (balanced !== null) {
    try { return JSON.parse(balanced); } catch (_) { /* fall through */ }
  }

  // Legacy fallback: first '{' to last '}'. Kept because the balance
  // walker requires syntactically valid brace-matching; malformed JSON
  // where the model dropped a `}` inside a string will fail the walker
  // but sometimes parse via the greedy slice.
  const start = defenced.indexOf('{');
  const end = defenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(defenced.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

// Walk the string tracking brace depth, aware of double-quoted string
// literals (so a `{` or `}` inside a string doesn't affect depth).
// Returns the first balanced {...} substring, or null if none found.
// Handles escaped quotes inside strings (`\"`). Does NOT try to parse
// — just extracts what looks like a self-contained JSON object.
function extractFirstBalancedObject (s) {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s.charAt(i);
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === '\\') { escape = true; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

// --- Sentence normalisation ----------------------------------------

function normaliseSentences (rawArr) {
  const out = [];
  for (const raw of rawArr) {
    if (raw == null || typeof raw !== 'object') continue;
    // Em-dash scrub — house style bans em-dashes in output prose
    // (see prompts/biographies/anti-patterns.md § Punctuation).
    // Applied BEFORE trim + signature so the persisted text matches
    // the signature and the parts concat check still holds. Citations
    // (excerpt / value) are NOT scrubbed — those are verbatim
    // substrings of source inputs which may legitimately contain
    // em-dashes and MUST round-trip character-for-character.
    const rawText = typeof raw.text === 'string' ? stripEmDashes(raw.text) : '';
    const text = rawText.trim();
    if (!text) continue;
    const sources = normaliseSources(raw);
    const sourceDetail = typeof raw.sourceDetail === 'string' && raw.sourceDetail.trim()
      ? raw.sourceDetail.trim()
      : null;
    // Citations: passthrough only. Structural cleanup here (drop non-
    // objects, keep the field/value/excerpt shape as-is). Verbatim
    // validation against the actual inputs happens in
    // lib/ai/validate-citations.js — the parser doesn't have access to
    // the inputs and shouldn't try to fake it.
    const citations = Array.isArray(raw.citations)
      ? raw.citations.filter(function (c) { return c && typeof c === 'object'; })
      : [];
    // Pass the scrubbed rawText to normaliseParts so the parts concat
    // check compares like-with-like (each part's text also gets the
    // same em-dash scrub inside normaliseParts).
    const parts = normaliseParts(raw.parts, rawText, sources);
    const uncoveredSources = computeUncoveredSources(parts, sources);
    out.push({
      text,
      // Backwards-compat: `source` mirrors the strongest tag so legacy
      // readers that haven't been migrated to getSources() still see a
      // sensible primary source. Canonical shape for new code is
      // `sources`, the full ordered array.
      source: sources[0],
      sources,
      // Per-clause source mapping (spec: internal-docs/
      // per-clause-source-highlighting-spec.md). Null when the writer
      // didn't emit parts, when parts fail validation (concat mismatch,
      // unknown source referenced, redundant single-part), or on any
      // legacy record. Admin UI uses this for hover-to-highlight; the
      // chip stack fallback works with parts=null.
      parts,
      // Declared sources not referenced by any part. Non-empty when
      // the writer promised a mix that parts don't actually show —
      // the admin UI badges those pills with a warning marker.
      uncoveredSources,
      sourceDetail,
      citations,
      claimSignature: signature(text)
    });
  }
  return out;
}

// Validate + normalise the writer's `parts` array. Returns:
//   - array of { text, source } on success (>= 2 entries)
//   - null when absent, redundant (< 2 entries), or invalid
//
// Validation rules:
//   1. parts[].text concatenated MUST exactly equal sentence.text.
//   2. Every parts[].source MUST appear in sentence.sources.
//   3. parts.length >= 2 (single-part is redundant).
//   4. Every parts[].source and parts[].text must be a non-empty string.
//
// NOTE — the coverage rule ("every declared source must have a part")
// was REMOVED July 2026 after it silent-dropped the writer's real
// per-clause labels when they got one span right but forgot to
// label another. Now partial parts render as-is and the render
// layer computes `uncoveredSources` — the declared sources with no
// matching part. Admin UI marks those pills with a warning so the
// curator sees the writer's inconsistency instead of losing the
// span data entirely.
function normaliseParts (rawParts, sentenceText, sentenceSources) {
  if (!Array.isArray(rawParts) || rawParts.length < 2) return null;
  const declared = new Set(sentenceSources || []);
  const clean = [];
  for (const p of rawParts) {
    if (p == null || typeof p !== 'object') return null;
    // Same em-dash scrub as the sentence text — see normaliseSentences.
    // Scrubbing here keeps the parts concat matching the (already
    // scrubbed) sentenceText, so the invariant survives the rule.
    const t = typeof p.text === 'string' ? stripEmDashes(p.text) : '';
    const s = typeof p.source === 'string' ? p.source : '';
    if (!t || !s) return null;
    if (!declared.has(s)) return null;
    clean.push({ text: t, source: s });
  }
  const rebuilt = clean.map(function (p) { return p.text; }).join('');
  if (rebuilt !== sentenceText) return null;
  return clean;
}

// House-style em-dash scrub. Replaces every em-dash (U+2014) with a
// comma, collapsing surrounding whitespace so the comma sits tight
// against the preceding word ("year 1879, the same year..." not
// "year 1879 , the same year..."). Anti-patterns.md bans em-dashes
// in output prose; this is the safety net for cases where the writer
// still emits one. En-dashes (U+2013) are left alone — those are
// legitimate for date ranges + page numbers.
function stripEmDashes (s) {
  if (typeof s !== 'string') return s;
  return s.replace(/\s*—\s*/g, ', ');
}

// Which declared sources are NOT referenced by any part in a valid
// parts array. Returns [] when parts is null or empty.
function computeUncoveredSources (parts, sentenceSources) {
  if (!Array.isArray(parts) || parts.length === 0) return [];
  const used = new Set(parts.map(function (p) { return p.source; }));
  return (sentenceSources || []).filter(function (s) { return !used.has(s); });
}

// --- Paragraph breaks ----------------------------------------------

// Accept only integer indices within the sentences range. Dedupe + sort.
// If the writer emitted no breaks, return an empty array — the renderer
// treats "no breaks" as a single-paragraph biography.
function normaliseParagraphBreaks (rawBreaks, sentenceCount) {
  if (!Array.isArray(rawBreaks)) return [];
  const clean = new Set();
  for (const b of rawBreaks) {
    const n = Number(b);
    if (!Number.isInteger(n)) continue;
    if (n < 0 || n >= sentenceCount) continue;
    clean.add(n);
  }
  return Array.from(clean).sort(function (a, b) { return a - b; });
}

// --- Confidence -----------------------------------------------------

// Accept integer 0-10; anything else → null so callers know it's
// unknown rather than forcing a fake value.
function normaliseConfidence (raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 10) return null;
  return Math.round(n);
}

// --- Verification candidate counts ---------------------------------

// Simple per-source-tag counts. The dashboard aggregator combines
// these across records for batch external-verification cost projection.
// Emit as a flat object so the DynamoDB write path doesn't need special
// handling.
function countCandidates (sentences) {
  let generalKnowledgeCount = 0;
  let contextualisingCount = 0;
  let inferredCount = 0;
  for (const s of sentences) {
    // Count a sentence in a bucket if ANY of its sources is that llm:*
    // tag. A mixed sentence like ['wikidata', 'llm:inferred'] counts
    // toward inferredCount because it contains inferred content that
    // curators may want to verify.
    const srcs = getSources(s);
    if (srcs.indexOf('llm:general_knowledge') !== -1) generalKnowledgeCount += 1;
    if (srcs.indexOf('llm:contextualising') !== -1) contextualisingCount += 1;
    if (srcs.indexOf('llm:inferred') !== -1) inferredCount += 1;
  }
  return { generalKnowledgeCount, contextualisingCount, inferredCount };
}

module.exports = parseSourceTaggedResponse;
module.exports.ParseError = ParseError;
module.exports.VALID_SOURCES = VALID_SOURCES;
module.exports.SOURCE_STRENGTH_ORDER = SOURCE_STRENGTH_ORDER;
module.exports.SOURCE_RANK = SOURCE_RANK;
module.exports.getSources = getSources;
module.exports.normaliseSources = normaliseSources;
module.exports.computeUncoveredSources = computeUncoveredSources;
