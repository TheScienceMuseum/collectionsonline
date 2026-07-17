'use strict';

// Reasoning-mode writer wrapper — single-call replacement for the
// two-stage writer + reviewer pipeline.
//
// Design (agreed 2026-07-17 after two rounds of A/Bs):
//   - Single Claude call, extended thinking on (budget_tokens shape;
//     works on Haiku 4.5 + Sonnet 4.5 with the current SDK 0.88).
//   - Model config-controlled, defaulting to claude-haiku-4-5. The
//     model A/B on the 10-subject holdout showed Haiku matches Sonnet
//     4.5 on trap avoidance at ~2.5× lower cost.
//   - Streams every call — Sonnet-with-thinking on hard subjects can
//     take >10 min, which the SDK's non-streaming path times out. Even
//     Haiku streams for consistency; usage numbers are identical either
//     way.
//   - Reuses the existing v8 prompt module with
//     enableSelfChecks / enableAbstention flags OFF — reasoning
//     replaces the separate selfReview block. The writer's editorial
//     reasoning surfaces in the `notes` field instead.
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
const DEFAULT_MAX_TOKENS = 16000;
const DEFAULT_PROMPT_MODULE_PATH = '../../prompts/biographies/2026-07-v8-collection-flow';

// Same opts contract as generateSourceTaggedBiography, with these
// additions / differences:
//   model         — defaults to Haiku 4.5 rather than Sonnet 4
//   budgetTokens  — token budget for extended thinking (default 4000)
//   maxTokens     — response cap (default 16000; budgetTokens must be
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
  if (budgetTokens >= maxTokens) {
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

  // Compose the system prompt WITHOUT the selfReview schema block —
  // reasoning replaces its function. Anti-patterns + curator
  // constraints stay because they're class-wide + subject-specific
  // guidance the model still needs.
  let basePrompt;
  if (typeof promptModule.buildSystemPrompt === 'function') {
    basePrompt = promptModule.buildSystemPrompt({
      enableSelfChecks: false,
      enableAbstention: false
    });
  } else {
    basePrompt = promptModule.systemPrompt;
  }
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

  const params = {
    model: modelId,
    max_tokens: maxTokens,
    thinking: { type: 'enabled', budget_tokens: budgetTokens },
    system: systemField,
    messages: [{ role: 'user', content: userPrompt }]
  };

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

  let parsed;
  try {
    parsed = parseSourceTaggedResponse(rawText);
  } catch (err) {
    console.warn('generate-reasoning: parse failed:', err && err.message,
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
    // No structured selfReview under reasoning-mode — the writer's
    // reasoning trace surfaces in `notes` and in the `thinking`
    // blocks (visible to admin via response usage but not persisted
    // in the current DB shape). Returning null keeps null-checking
    // consumers happy.
    selfReview: null,
    model: modelId,
    promptVersion: promptModule.version,
    inputTokens: (response.usage && response.usage.input_tokens) || 0,
    outputTokens: (response.usage && response.usage.output_tokens) || 0,
    cacheCreationTokens: (response.usage && response.usage.cache_creation_input_tokens) || 0,
    cacheReadTokens: (response.usage && response.usage.cache_read_input_tokens) || 0,
    // Reasoning-mode specific: how much thinking the model actually
    // did, as a char count. Not persisted today; useful for tuning
    // budget_tokens later.
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
