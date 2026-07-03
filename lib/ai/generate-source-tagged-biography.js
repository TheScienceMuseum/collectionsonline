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

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_PROMPT_MODULE_PATH = '../../prompts/biographies/2026-07-v7-source-tagged';

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
//   maxTokens    — override; defaults to 3000 (enough for a 12-sentence
//                  tagged JSON output plus notes).
//
// Returns null when the API key is missing / no response was parsed.
// Returns the full payload on success:
//   {
//     sentences, paragraphBreaks, confidence, notes,
//     verificationCandidates,
//     model, promptVersion,
//     inputTokens, outputTokens
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
  const withAntiPatterns = antiPatterns.appendToPrompt(promptModule.systemPrompt);
  const systemPrompt = appendCuratorConstraints(withAntiPatterns, opts.curatorDecisions);

  const userPrompt = promptModule.buildUserPrompt(personData, relatedItems || [], wikidataContext || {}, subject);
  const maxTokens = Number.isInteger(opts.maxTokens) ? opts.maxTokens : 3000;

  let response;
  try {
    response = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system: systemPrompt,
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

  return {
    sentences: parsed.sentences,
    paragraphBreaks: parsed.paragraphBreaks,
    confidence: parsed.confidence,
    notes: parsed.notes,
    verificationCandidates: parsed.verificationCandidates,
    model: modelId,
    promptVersion: promptModule.version,
    inputTokens: (response.usage && response.usage.input_tokens) || 0,
    outputTokens: (response.usage && response.usage.output_tokens) || 0
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
