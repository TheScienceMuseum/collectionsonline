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
    verificationCandidates: countCandidates(sentences),
    selfReview: normaliseSelfReview(parsed.selfReview)
  };
}

// --- JSON extraction -----------------------------------------------

// Strip markdown fences (```json ... ```), leading/trailing prose,
// then attempt JSON.parse. Returns the parsed object or null on any
// failure — caller decides how to handle.
function tryJsonParse (text) {
  const stripped = String(text)
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  // Direct parse first — happy path.
  try {
    return JSON.parse(stripped);
  } catch (err) {
    // Fall through — try to extract the first {…} block.
  }

  // Slice from the first '{' to the last '}' to survive prose wrapping.
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = stripped.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (err) {
    return null;
  }
}

// --- Sentence normalisation ----------------------------------------

function normaliseSentences (rawArr) {
  const out = [];
  for (const raw of rawArr) {
    if (raw == null || typeof raw !== 'object') continue;
    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
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
    // Pass the untrimmed raw.text to normaliseParts — the writer
    // emits parts that concatenate to what it produced, not what we
    // decided to trim. If the concat matches the raw, we know the
    // parts were coherent; trimming the sentence afterwards doesn't
    // invalidate that.
    const parts = normaliseParts(raw.parts, typeof raw.text === 'string' ? raw.text : text, sources);
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
// Validation rules per the spec:
//   1. parts[].text concatenated MUST exactly equal sentence.text.
//      Whitespace-preserving — reconstruct then compare. This catches
//      writer bugs where a space was dropped between spans.
//   2. Every parts[].source MUST appear in sentence.sources.
//   3. Every source in sentence.sources MUST have at least one part
//      referencing it. The chip stack is a promise; parts must
//      keep it. A sources=[wikidata,llm:inferred] sentence with both
//      parts tagged wikidata is dropped — the mix wasn't real.
//   4. parts.length >= 2 (single-part parts are redundant; the chip
//      stack already conveys single-source).
//   5. Every parts[].source and parts[].text must be a non-empty string.
//
// On ANY failure the parser returns null (silent drop) — the sentence
// still renders as chip-stack-only. Failing silently is intentional:
// the admin UI degrades to today's UX rather than surfacing writer
// mistakes to the curator.
function normaliseParts (rawParts, sentenceText, sentenceSources) {
  if (!Array.isArray(rawParts) || rawParts.length < 2) return null;
  const declared = new Set(sentenceSources || []);
  const used = new Set();
  const clean = [];
  for (const p of rawParts) {
    if (p == null || typeof p !== 'object') return null;
    const t = typeof p.text === 'string' ? p.text : '';
    const s = typeof p.source === 'string' ? p.source : '';
    if (!t || !s) return null;
    if (!declared.has(s)) return null;
    used.add(s);
    clean.push({ text: t, source: s });
  }
  const rebuilt = clean.map(function (p) { return p.text; }).join('');
  if (rebuilt !== sentenceText) return null;
  // Rule 3: every declared source must appear in at least one part.
  // Otherwise the chip stack advertises sources the parts don't
  // demonstrate — drop and fall back to chip-stack-only render.
  for (const src of declared) {
    if (!used.has(src)) return null;
  }
  return clean;
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

// Normalise the writer's `selfReview` object. Tolerant — missing
// sub-fields default to empty strings / arrays. Returns null if the
// writer emitted nothing usable (all fields absent or wrong types).
// Downstream consumers (biography-store, admin UI) use presence of
// individual sub-fields to decide what to show.
//
// `selfReview.checks` is a free-form object of `{ [checkName]: string }`
// — we keep whatever keys the writer emitted rather than enforce a
// fixed shape, so new checks the prompt gains land automatically.
// Invalid values (non-strings) are dropped silently.
const SKIPPED_REASON_VALUES = ['no_source_available', 'source_ambiguous', 'llm_prior_only', 'source_partial'];

function normaliseSelfReview (raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};

  if (typeof raw.planningNotes === 'string' && raw.planningNotes.trim()) {
    out.planningNotes = raw.planningNotes.trim();
  }

  if (raw.checks && typeof raw.checks === 'object' && !Array.isArray(raw.checks)) {
    const cleanChecks = {};
    Object.keys(raw.checks).forEach(function (key) {
      const v = raw.checks[key];
      if (typeof v === 'string' && v.trim()) cleanChecks[key] = v.trim();
    });
    if (Object.keys(cleanChecks).length) out.checks = cleanChecks;
  }

  if (Array.isArray(raw.skipped) && raw.skipped.length) {
    const cleanSkipped = raw.skipped
      .filter(function (s) { return s && typeof s === 'object' && !Array.isArray(s); })
      .map(function (s) {
        const desiredText = typeof s.desiredText === 'string' ? s.desiredText.trim() : '';
        const reason = SKIPPED_REASON_VALUES.indexOf(s.reason) !== -1 ? s.reason : 'no_source_available';
        return desiredText ? { desiredText, reason } : null;
      })
      .filter(Boolean);
    if (cleanSkipped.length) out.skipped = cleanSkipped;
  }

  return Object.keys(out).length ? out : null;
}

module.exports = parseSourceTaggedResponse;
module.exports.ParseError = ParseError;
module.exports.VALID_SOURCES = VALID_SOURCES;
module.exports.SOURCE_STRENGTH_ORDER = SOURCE_STRENGTH_ORDER;
module.exports.SOURCE_RANK = SOURCE_RANK;
module.exports.getSources = getSources;
module.exports.normaliseSources = normaliseSources;
module.exports.normaliseSelfReview = normaliseSelfReview;
module.exports.SKIPPED_REASON_VALUES = SKIPPED_REASON_VALUES;
