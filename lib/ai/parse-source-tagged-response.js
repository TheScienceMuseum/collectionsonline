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

const VALID_SOURCES = new Set([
  'museum',
  'wikidata',
  'wikipedia',
  'llm:inferred',
  'llm:contextualising',
  'llm:general_knowledge'
]);

// Callers that want to publish safely by default get the DEFENSIVE tag
// when the writer emits a source we don't recognise. Never widen this.
const UNKNOWN_SOURCE_FALLBACK = 'llm:general_knowledge';

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
    const source = VALID_SOURCES.has(raw.source) ? raw.source : UNKNOWN_SOURCE_FALLBACK;
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
    out.push({
      text,
      source,
      sourceDetail,
      citations,
      claimSignature: signature(text)
    });
  }
  return out;
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
    if (s.source === 'llm:general_knowledge') generalKnowledgeCount += 1;
    else if (s.source === 'llm:contextualising') contextualisingCount += 1;
    else if (s.source === 'llm:inferred') inferredCount += 1;
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
module.exports.normaliseSelfReview = normaliseSelfReview;
module.exports.SKIPPED_REASON_VALUES = SKIPPED_REASON_VALUES;
