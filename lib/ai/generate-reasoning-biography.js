'use strict';

// Reasoning-mode writer wrapper — single-call replacement for the
// two-stage writer + reviewer pipeline.
//
// Design (agreed 2026-07-17 after two rounds of A/Bs):
//   - Single Claude call, extended thinking on. 4.5-era models take the
//     budget_tokens shape; Haiku 5.5 and other current models take
//     adaptive thinking + output_config.effort (ADAPTIVE_THINKING_MODEL).
//   - Model config-controlled, defaulting to claude-haiku-4-5. The
//     model A/B on the 10-subject holdout showed Haiku matches Sonnet
//     4.5 on trap avoidance at ~2.5× lower cost.
//   - Streams every call — Sonnet-with-thinking on hard subjects can
//     take >10 min, which the SDK's non-streaming path times out. Even
//     Haiku streams for consistency; usage numbers are identical either
//     way.
//   - Reuses the v8 prompt module. Reasoning replaces the old
//     structured selfReview / skipped[] scaffolding — the writer's
//     editorial reasoning surfaces in the `notes` field instead.
//   - Reuses existing citation validation (verbatim String.indexOf
//     against source fields) — quality gate unchanged from the
//     two-stage pipeline.
//   - Return shape matches generateSourceTaggedBiography's — same 14
//     fields — so downstream persistence in regenerate-biography.js /
//     routes/ai-biography.js is unchanged. selfReview always returns
//     null since we don't request it.
//
// See internal-docs/ai-biographies-pipeline-experiments-2026-07-17.md
// for the A/B results that led to this design.

const Anthropic = require('@anthropic-ai/sdk');
const classifySubject = require('./classify-subject');
const antiPatterns = require('./anti-patterns');
const parseSourceTaggedResponse = require('./parse-source-tagged-response');
const validateCitations = require('./validate-citations');
const generateSourceTaggedBiography = require('./generate-source-tagged-biography');

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_BUDGET_TOKENS = 4000;
// Bumped from 16000 → 24000 on 2026-08-06 after ceiling-hit diagnosis:
// distribution of successful output_tokens across 32 recent regens had
// max=15663 and P90=14683 — only 337 tokens of headroom under the old
// ceiling on the richest subjects. The ~20% empty_response failure rate
// was consistent with the model exhausting max_tokens on thinking + JSON
// output for rich-source subjects. See commit message for details.
// Bumped 24000 → 32000 on 2026-10-08 for Haiku 5.5, whose tokenizer
// counts ~30% more tokens for the same text: a 50-subject run at
// medium effort had p95=20.7K and max=21.4K output tokens.
const DEFAULT_MAX_TOKENS = 32000;
// Adaptive-thinking models only. 'medium' is Haiku 5.5's own default.
// At 'high', 9/20 subjects in the 2026-10-08 A/B ran thinking + JSON
// past the 24K cap and truncated, and the ones that survived used up
// to 23.3K tokens; 'medium' succeeded on 50/50.
const DEFAULT_EFFORT = 'medium';
const VALID_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
// These reject {type: 'enabled', budget_tokens} with a 400.
const ADAPTIVE_THINKING_MODEL = /^claude-(haiku-5|sonnet-5|opus-5|opus-4-[78]|fable-5)/;
const DEFAULT_PROMPT_MODULE_PATH = '../../prompts/biographies/2026-07-v8-collection-flow';

// Same opts contract as generateSourceTaggedBiography, with these
// additions / differences:
//   model         — defaults to Haiku 4.5 rather than Sonnet 4
//   budgetTokens  — token budget for extended thinking (default 4000;
//                   4.5-era models only, ignored on adaptive models)
//   effort        — low | medium | high | xhigh | max (default medium;
//                   adaptive-thinking models only)
//   maxTokens     — response cap (default 32000; budgetTokens must be
//                   strictly less than maxTokens per Anthropic API rules)
//   client        — inject an Anthropic client for tests
//   diagnostics   — same as the source-tagged writer's out-param
//
// opts.useCache / opts.curatorDecisions / opts.wikipediaSummary /
// opts.odnbSummary / opts.gracesGuideSummary / opts.contradictions all
// behave exactly as in the source-tagged writer — the input package is
// identical; only the call shape differs.
async function generateReasoningBiography (personData, relatedItems, wikidataContext, opts) {
  opts = opts || {};
  const apiKey = opts.apiKey;
  const diagnostics = opts.diagnostics;
  if (!apiKey && !opts.client) {
    console.error('generate-reasoning: no Anthropic API key configured');
    populateDiagnostics(diagnostics, { failureMode: 'no_api_key' });
    return null;
  }

  const modelId = opts.model || DEFAULT_MODEL;
  const budgetTokens = Number.isInteger(opts.budgetTokens) ? opts.budgetTokens : DEFAULT_BUDGET_TOKENS;
  const maxTokens = Number.isInteger(opts.maxTokens) ? opts.maxTokens : DEFAULT_MAX_TOKENS;
  const adaptive = ADAPTIVE_THINKING_MODEL.test(modelId);
  const effort = opts.effort || DEFAULT_EFFORT;
  if (adaptive && VALID_EFFORTS.indexOf(effort) === -1) {
    throw new Error(
      'generate-reasoning: effort "' + effort + '" must be one of ' + VALID_EFFORTS.join(', ')
    );
  }
  if (!adaptive && budgetTokens >= maxTokens) {
    // Anthropic requires budget_tokens < max_tokens (minimum 1024).
    // Guard here to surface the misconfiguration clearly rather than
    // as a 400 mid-run.
    throw new Error(
      'generate-reasoning: budgetTokens (' + budgetTokens +
      ') must be strictly less than maxTokens (' + maxTokens + ')'
    );
  }
  const promptModule = opts.promptModule || require(DEFAULT_PROMPT_MODULE_PATH);
  const client = opts.client || new Anthropic({ apiKey });

  const subject = classifySubject(personData, wikidataContext);

  // Anti-patterns + curator constraints get appended on top of the
  // module's system prompt. Reasoning replaces the old structured
  // selfReview/skipped[] scaffolding — the writer's thinking phase
  // does that work now.
  const basePrompt = typeof promptModule.buildSystemPrompt === 'function'
    ? promptModule.buildSystemPrompt()
    : promptModule.systemPrompt;
  const withAntiPatterns = opts.skipAntiPatterns
    ? basePrompt
    : antiPatterns.appendToPrompt(basePrompt);
  const systemPrompt = generateSourceTaggedBiography.appendCuratorConstraints(
    withAntiPatterns,
    opts.curatorDecisions
  );

  const userPrompt = promptModule.buildUserPrompt(
    personData,
    relatedItems || [],
    wikidataContext || {},
    subject,
    {
      wikipediaSummary: opts.wikipediaSummary || null,
      odnbSummary: opts.odnbSummary || null,
      gracesGuideSummary: opts.gracesGuideSummary || null,
      contradictions: Array.isArray(opts.contradictions) ? opts.contradictions : []
    }
  );

  // Opt-in prompt caching — same shape as the source-tagged writer.
  const systemField = opts.useCache
    ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
    : systemPrompt;

  const params = Object.assign({
    model: modelId,
    max_tokens: maxTokens,
    system: systemField,
    messages: [{ role: 'user', content: userPrompt }]
  }, adaptive
    ? { thinking: { type: 'adaptive' }, output_config: { effort } }
    : { thinking: { type: 'enabled', budget_tokens: budgetTokens } });

  // Always stream — Sonnet with extended thinking can exceed the
  // SDK's 10-minute non-streaming timeout on hard subjects. Haiku
  // also streams for consistency; usage numbers are identical.
  let response;
  try {
    const stream = client.messages.stream(params);
    response = await stream.finalMessage();
  } catch (err) {
    console.warn('generate-reasoning: Anthropic call failed:', err && err.message);
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

  // Response can contain interleaved thinking + text blocks. Concat
  // text for JSON parse; keep thinking length as an audit signal we
  // may surface later.
  const contentBlocks = (response && response.content) || [];
  const rawText = contentBlocks
    .filter(function (b) { return b && b.type === 'text'; })
    .map(function (b) { return b.text || ''; })
    .join('');
  const thinkingChars = contentBlocks
    .filter(function (b) { return b && b.type === 'thinking'; })
    .map(function (b) { return (b.thinking || '').length; })
    .reduce(function (a, n) { return a + n; }, 0);
  const stopReason = (response && response.stop_reason) || null;

  // Haiku 5.5+ safety classifiers can decline (HTTP 200, no server-side
  // fallback on Haiku). Any partial text is not a usable biography.
  if (stopReason === 'refusal') {
    const refusalCategory = (response.stop_details && response.stop_details.category) || null;
    console.warn('generate-reasoning: model declined · category:', refusalCategory);
    populateDiagnostics(diagnostics, {
      failureMode: 'refusal',
      stopReason,
      refusalCategory,
      rawResponse: rawText,
      model: modelId,
      promptVersion: promptModule.version,
      systemPrompt,
      prompt: userPrompt
    });
    return null;
  }

  let parsed;
  try {
    parsed = parseSourceTaggedResponse(rawText);
  } catch (err) {
    console.warn('generate-reasoning: parse failed:', err && err.message,
      '· stop_reason:', stopReason,
      '· text length:', rawText.length,
      '· first 120 chars:', rawText.slice(0, 120).replace(/\s+/g, ' '));
    let failureMode = rawText ? 'parse_failed' : 'empty_response';
    if (stopReason === 'max_tokens') failureMode = 'max_tokens';
    populateDiagnostics(diagnostics, {
      failureMode,
      stopReason,
      parseError: err && err.message,
      rawResponse: rawText,
      model: modelId,
      promptVersion: promptModule.version,
      systemPrompt,
      prompt: userPrompt
    });
    return null;
  }

  // Citation validation is unchanged from the source-tagged writer —
  // any excerpt in `citations[]` must be a verbatim substring of the
  // referenced input field. Failures dropped; report surfaced.
  const citationDrops = [];
  const validatedSentences = validateCitations(
    parsed.sentences,
    {
      personData,
      relatedItems: relatedItems || [],
      wikidataContext: wikidataContext || {},
      wikipediaSummary: opts.wikipediaSummary || null,
      odnbSummary: opts.odnbSummary || null,
      gracesGuideSummary: opts.gracesGuideSummary || null
    },
    { diagnostics: citationDrops }
  );
  if (citationDrops.length > 0) {
    console.log('generate-reasoning: dropped', citationDrops.length,
      'unverifiable citation(s) — first reason:', citationDrops[0].reason);
  }

  return {
    sentences: validatedSentences,
    paragraphBreaks: parsed.paragraphBreaks,
    confidence: parsed.confidence,
    notes: parsed.notes,
    verificationCandidates: parsed.verificationCandidates,
    model: modelId,
    promptVersion: promptModule.version,
    inputTokens: (response.usage && response.usage.input_tokens) || 0,
    outputTokens: (response.usage && response.usage.output_tokens) || 0,
    cacheCreationTokens: (response.usage && response.usage.cache_creation_input_tokens) || 0,
    cacheReadTokens: (response.usage && response.usage.cache_read_input_tokens) || 0,
    // Reasoning-mode specific: how much thinking the model actually
    // did, as a char count. Not persisted today; useful for tuning
    // budget_tokens later. Always 0 on adaptive models, which omit
    // thinking text by default.
    thinkingChars,
    systemPrompt,
    prompt: userPrompt,
    rawResponse: rawText,
    citationDrops
  };
}

function populateDiagnostics (diagnostics, fields) {
  if (!diagnostics || typeof diagnostics !== 'object') return;
  Object.keys(fields).forEach(function (k) {
    if (fields[k] !== undefined) diagnostics[k] = fields[k];
  });
}

module.exports = generateReasoningBiography;
module.exports.DEFAULT_MODEL = DEFAULT_MODEL;
module.exports.DEFAULT_BUDGET_TOKENS = DEFAULT_BUDGET_TOKENS;
module.exports.DEFAULT_MAX_TOKENS = DEFAULT_MAX_TOKENS;
module.exports.DEFAULT_EFFORT = DEFAULT_EFFORT;
