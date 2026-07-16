'use strict';

// Writer wrapper for the v2 source-tagged pipeline.
//
// Takes the input package (personData + relatedItems + wikidataContext)
// plus curator decisions for the subject, calls Anthropic with the
// source-tagged prompt module, parses + normalises the response, and
// returns a structured biography ready to persist on the BIOGRAPHY item.
//
// Departure from v1's generate-biography.js:
//   - Response is source-tagged JSON, parsed via parse-source-tagged-response.
//   - Curator constraints (rejections + clarifications) are injected
//     into the system prompt so the writer avoids re-producing rejected
//     claims and follows curator clarifications.
//   - No HTML output — sentences flow to biography-store, HTML is
//     computed at render time by render-biography (task 43).

const Anthropic = require('@anthropic-ai/sdk');
const classifySubject = require('./classify-subject');
const antiPatterns = require('./anti-patterns');
const parseSourceTaggedResponse = require('./parse-source-tagged-response');
const validateCitations = require('./validate-citations');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_PROMPT_MODULE_PATH = '../../prompts/biographies/2026-07-v8-collection-flow';

// Public entry point.
//
// opts:
//   apiKey       — Anthropic API key. Required; if missing, returns null.
//   model        — override the default writer model.
//   client       — inject a client (for tests).
//   promptModule — override the default prompt module (for tests /
//                  version A-B).
//   curatorDecisions — CURATOR_DECISIONS item shape (approvals,
//                  rejections, clarifications). Rejections + clarifications
//                  are injected into the system prompt as subject-specific
//                  constraints; approvals inform priority but aren't
//                  injected verbatim (kept the prompt lean).
//   maxTokens    — override; defaults to 6000. Bumped from 3000 to 6000
//                  on 2026-07-10 alongside the Wikidata qualifiers/refs
//                  upgrade + selfReview output block: rich subjects
//                  (Einstein 24 wikidata keys with per-claim qualifiers,
//                  plus planning notes + 5 self-checks + skipped[])
//                  routinely hit 3500-5000 output tokens and truncate
//                  against a 3000 ceiling, producing mid-JSON cutoffs
//                  that fail parsing. 6000 is comfortable headroom for
//                  the richest subjects. You only pay for what the
//                  writer actually emits — the ceiling doesn't inflate
//                  cost, only the truncation risk.
//   useCache     — when true, sends the system prompt as an ephemeral
//                  cache block (`cache_control: {type: 'ephemeral'}`).
//                  Batch runs pass true (cache write pays for itself after
//                  ~2-3 subjects sharing the same prompt within the 5-min
//                  TTL); one-off calls leave it false to avoid paying a
//                  25% cache-write premium for a cache no follow-up call
//                  will read.
//
// Returns null when the API key is missing / no response was parsed.
// Returns the full payload on success:
//   {
//     sentences, paragraphBreaks, confidence, notes,
//     verificationCandidates,
//     model, promptVersion,
//     inputTokens, outputTokens,
//     cacheCreationTokens, cacheReadTokens
//   }
//
// opts.diagnostics — optional out-param object the caller supplies to
// capture what went wrong on a null-return. Populated only when Claude
// was called but the response was unusable (parse failure). Fields:
//   failureMode    — 'api_call_failed' | 'parse_failed' | 'no_api_key'
//                    | 'empty_response'
//   rawResponse    — the raw text Claude returned (may be empty)
//   model, promptVersion, systemPrompt, prompt — same as v1 writer
//   parseError?    — for parse_failed, the parser's error message
//   apiError?      — for api_call_failed, the SDK error message
// Callers that don't care can omit `opts.diagnostics` — the field is
// silently ignored when unset, so this is a non-breaking addition.
async function generateSourceTaggedBiography (personData, relatedItems, wikidataContext, opts) {
  opts = opts || {};
  const apiKey = opts.apiKey;
  const diagnostics = opts.diagnostics; // may be undefined; that's fine
  if (!apiKey && !opts.client) {
    console.error('generate-source-tagged: no Anthropic API key configured');
    populateDiagnostics(diagnostics, { failureMode: 'no_api_key' });
    return null;
  }

  const modelId = opts.model || DEFAULT_MODEL;
  const promptModule = opts.promptModule || require(DEFAULT_PROMPT_MODULE_PATH);
  const client = opts.client || new Anthropic({ apiKey });

  const subject = classifySubject(personData, wikidataContext);

  // Compose the effective system prompt:
  //   base prompt → anti-patterns (class-wide) → curator constraints (subject-specific)
  //
  // opts.skipAntiPatterns lets callers who have already appended their own
  // anti-patterns text (e.g. the workshop playground with an editable
  // anti-patterns textarea) opt out of the automatic file-based append —
  // otherwise the class-wide rules would render twice.
  //
  // opts.enableSelfChecks / opts.enableAbstention control whether the
  // prompt's `selfReview` section is included. When either is on, the
  // prompt asks the writer to fill in that portion of the response
  // schema — and the parser stores whatever the writer emitted. When
  // both are off, the prompt is the legacy sentences-only shape.
  // Callers with a promptModule that predates buildSystemPrompt fall
  // through to promptModule.systemPrompt unchanged.
  let basePrompt;
  if (typeof promptModule.buildSystemPrompt === 'function') {
    basePrompt = promptModule.buildSystemPrompt({
      enableSelfChecks: opts.enableSelfChecks !== false,
      enableAbstention: opts.enableAbstention !== false
    });
  } else {
    basePrompt = promptModule.systemPrompt;
  }
  const withAntiPatterns = opts.skipAntiPatterns
    ? basePrompt
    : antiPatterns.appendToPrompt(basePrompt);
  const systemPrompt = appendCuratorConstraints(withAntiPatterns, opts.curatorDecisions);

  const userPrompt = promptModule.buildUserPrompt(personData, relatedItems || [], wikidataContext || {}, subject, {
    wikipediaSummary: opts.wikipediaSummary || null,
    odnbSummary: opts.odnbSummary || null,
    gracesGuideSummary: opts.gracesGuideSummary || null
  });
  const maxTokens = Number.isInteger(opts.maxTokens) ? opts.maxTokens : 6000;

  // Opt-in prompt caching: when useCache is true, we send the system
  // prompt as an ephemeral cache block. Anthropic charges ~1.25x on the
  // cache-write call and ~0.1x on cache-read calls within the 5-minute
  // TTL — so this only makes sense for batch runs. See the opts doc.
  const systemField = opts.useCache
    ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
    : systemPrompt;

  let response;
  try {
    response = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system: systemField,
      messages: [{ role: 'user', content: userPrompt }]
    });
  } catch (err) {
    console.warn('generate-source-tagged: Anthropic call failed:', err && err.message);
    populateDiagnostics(diagnostics, {
      failureMode: 'api_call_failed',
      apiError: err && err.message,
      model: modelId,
      promptVersion: promptModule.version,
      systemPrompt,
      prompt: userPrompt
    });
    return null;
  }

  const rawText = ((response && response.content) || [])
    .map(function (b) { return (b && b.text) || ''; })
    .join('');

  let parsed;
  try {
    parsed = parseSourceTaggedResponse(rawText);
  } catch (err) {
    console.warn('generate-source-tagged: parse failed:', err && err.message,
      '· text length:', rawText.length,
      '· first 120 chars:', rawText.slice(0, 120).replace(/\s+/g, ' '));
    populateDiagnostics(diagnostics, {
      failureMode: rawText ? 'parse_failed' : 'empty_response',
      parseError: err && err.message,
      rawResponse: rawText,
      model: modelId,
      promptVersion: promptModule.version,
      systemPrompt,
      prompt: userPrompt
    });
    return null;
  }

  // Strict-verbatim citation validation. Drops any citation whose excerpt
  // isn't a substring of the referenced input field, or whose structured
  // value doesn't match. Non-destructive; sentences flow through with
  // per-sentence citations[] filtered. The dropped-citations report
  // surfaces on the returned payload so callers can log or persist it.
  const citationDrops = [];
  const validatedSentences = validateCitations(parsed.sentences, {
    personData,
    relatedItems: relatedItems || [],
    wikidataContext: wikidataContext || {},
    wikipediaSummary: opts.wikipediaSummary || null,
    odnbSummary: opts.odnbSummary || null,
    gracesGuideSummary: opts.gracesGuideSummary || null
  }, { diagnostics: citationDrops });
  if (citationDrops.length > 0) {
    console.log('generate-source-tagged: dropped', citationDrops.length,
      'unverifiable citation(s) — first reason:', citationDrops[0].reason);
  }

  return {
    sentences: validatedSentences,
    paragraphBreaks: parsed.paragraphBreaks,
    confidence: parsed.confidence,
    notes: parsed.notes,
    verificationCandidates: parsed.verificationCandidates,
    // Writer's own self-review — null if the writer emitted nothing usable,
    // or an object with any subset of { planningNotes, checks, skipped }.
    // Callers persist this on the BIOGRAPHY item only if the corresponding
    // config flags (aiBiographyWriterSelfChecksEnabled +
    // aiBiographyStructuredAbstentionEnabled) are on.
    selfReview: parsed.selfReview,
    model: modelId,
    promptVersion: promptModule.version,
    inputTokens: (response.usage && response.usage.input_tokens) || 0,
    outputTokens: (response.usage && response.usage.output_tokens) || 0,
    cacheCreationTokens: (response.usage && response.usage.cache_creation_input_tokens) || 0,
    cacheReadTokens: (response.usage && response.usage.cache_read_input_tokens) || 0,
    // Surface the actual prompt sent + raw response received so the
    // caller can persist them on the BIOGRAPHY item. Admin detail
    // template renders the two prompt collapsibles from these fields
    // (regression from v1 flagged in Task 56 UX review), and the raw
    // response feeds the "what did Claude actually return" audit
    // affordance mirroring the failure-path diagnostics from Task 55.
    // rawText is returned uncapped here; the route trims to a cap when
    // saving (~10-20KB per record is fine at collection scale, per
    // curator preference during Task 56).
    systemPrompt,
    prompt: userPrompt,
    rawResponse: rawText,
    // Citation-validation report — one entry per citation the writer
    // emitted that we couldn't verify against the actual input. Persisted
    // by the caller alongside the biography so the admin detail can
    // surface "the writer tried to cite X but we couldn't match it"
    // affordances if the drop rate ever spikes. Empty array when every
    // citation the writer emitted checked out.
    citationDrops
  };
}

// Append a subject-specific constraints block to the system prompt.
// Rejections list what the writer must never emit; clarifications tell
// the writer how to phrase specific topics. Approvals are omitted —
// they don't need constraint text, and including them would bloat the
// prompt (curator has already vetted those claims and they'll flow
// through source tagging on the natural path).
//
// Skipped entirely when decisions has no rejections or clarifications
// (fresh subjects and subjects where the curator has only approved
// claims). Keeps the prompt lean.
function appendCuratorConstraints (basePrompt, decisions) {
  if (!decisions) return basePrompt;
  const rejections = (decisions.rejections || []).filter(function (r) { return r && r.claimText; });
  const clarifications = (decisions.clarifications || []).filter(function (c) { return c && c.clarification; });
  if (rejections.length === 0 && clarifications.length === 0) return basePrompt;

  const lines = ['', '---', '', '## Curator-specific constraints for this subject', ''];
  if (rejections.length) {
    lines.push('Rejected claims — do NOT write any of these, in any wording. If the underlying fact is important, express it differently or omit it entirely.');
    lines.push('');
    rejections.forEach(function (r) {
      lines.push('- "' + r.claimText + '"' + (r.rationale ? ' (rationale: ' + r.rationale + ')' : ''));
    });
    lines.push('');
  }
  if (clarifications.length) {
    lines.push('Clarifications — apply these when your prose touches on the referenced claims:');
    lines.push('');
    clarifications.forEach(function (c) {
      const label = c.claimText ? 'For "' + c.claimText + '": ' : '';
      lines.push('- ' + label + c.clarification);
    });
    lines.push('');
  }

  return basePrompt + '\n' + lines.join('\n');
}

// Populate the caller-owned diagnostics object in place. No-op when
// diagnostics is undefined — keeps the callers-that-don't-care path
// backwards-compatible. Mirrors the helper in lib/ai/generate-biography.js
// so the two writer wrappers behave identically on failure surfacing.
function populateDiagnostics (diagnostics, fields) {
  if (!diagnostics || typeof diagnostics !== 'object') return;
  Object.keys(fields).forEach(function (k) {
    if (fields[k] !== undefined) diagnostics[k] = fields[k];
  });
}

module.exports = generateSourceTaggedBiography;
module.exports.appendCuratorConstraints = appendCuratorConstraints;
module.exports.DEFAULT_MODEL = DEFAULT_MODEL;
