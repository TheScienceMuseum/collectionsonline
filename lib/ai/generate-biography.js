'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const prompts = require('./prompts/biography');
const validateReferences = require('./validate-references');
const classifySubject = require('./classify-subject');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// Confidence is the LLM's self-reported score on the biography it just
// produced — an integer 0 (useless) to 10 (rich, well-grounded). Anything
// at or below this threshold is treated as "the model itself told us this
// shouldn't be published", which maps to status=insufficient_data.
//
// Note: LLM self-reported confidence is a weak signal — we track it mostly
// to observe calibration over time. The sufficiency check (signal score,
// pre-flight) is the stronger gate.
const CONFIDENCE_INSUFFICIENT_AT_OR_BELOW = 2;

// Normalise the model's self-reported confidence to an integer 0–10.
// Non-numeric or out-of-range input defaults to 5 (mid-range, honest
// "I don't know").
function normaliseConfidence (raw) {
  const n = parseFloat(raw);
  if (isNaN(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function generateBiography (personData, relatedItems, wikidataCache, apiKey, model, promptVersion, customPrompt) {
  if (!apiKey) {
    console.error('AI Biography: No Anthropic API key configured');
    return Promise.resolve(null);
  }

  // Pick prompt version — default to active, or caller-specified for A/B testing.
  const promptModule = promptVersion
    ? (prompts.getVersion(promptVersion) || prompts)
    : prompts;
  if (promptVersion && !prompts.getVersion(promptVersion)) {
    console.warn('AI Biography: Requested prompt version', promptVersion, 'not found — falling back to active', prompts.version);
  }

  const allItems = relatedItems || [];
  const subject = classifySubject(personData, wikidataCache);

  // Either use a registered version's prompt, OR an ad-hoc staff-supplied
  // prompt (workshop / A/B exploration). Custom prompts are opaque strings —
  // we don't parse them or interpolate tokens. Staff who want dynamic
  // per-record data should start from the registered template (served to the
  // editor pre-populated) and edit in place.
  const effectiveSystemPrompt = (customPrompt && customPrompt.systemPrompt) || promptModule.systemPrompt;
  const userPrompt = (customPrompt && customPrompt.userPromptTemplate)
    ? customPrompt.userPromptTemplate
    : promptModule.buildUserPrompt(personData, allItems, wikidataCache, subject);
  const effectivePromptVersion = customPrompt
    ? ('custom:' + (customPrompt.label || 'adhoc'))
    : promptModule.version;

  const useModel = model || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  return client.messages.create({
    model: useModel,
    // 2500 (bumped from 1500) — gives the model enough headroom for the
    // longer subjects (rich wikidata, many related items, 3 examples in
    // the system prompt). Truncation mid-JSON produces invalid output we
    // can't recover from; the few extra tokens we occasionally pay for
    // are cheap compared to a biography stuck as transient-fail.
    max_tokens: 2500,
    temperature: 0.3,
    system: effectiveSystemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  }).then(function (response) {
    const text = response.content && response.content[0] && response.content[0].text;
    if (!text) {
      console.error('AI Biography: Empty response from Claude API');
      return null;
    }

    const parsed = extractJsonObject(text);
    if (!parsed) return null;

    // Build combined list of all valid linkable items (objects, documents, and related people)
    const allValidItems = allItems.slice();
    if (personData.relatedPeople) {
      personData.relatedPeople.forEach(function (p) {
        allValidItems.push({ id: p.id, title: p.name, link: p.link, type: 'people' });
      });
    }

    const validatedBiography = validateReferences(parsed.biography, allValidItems);
    const validatedContext = validateReferences(parsed.context || '', allValidItems);

    const validIds = {};
    allValidItems.forEach(function (item) { validIds[item.id] = true; });
    const references = (parsed.referencedItems || parsed.referencedObjects || [])
      .filter(function (ref) { return validIds[ref.id]; });

    const usage = response.usage || {};

    return {
      biographyHtml: validatedBiography,
      contextHtml: validatedContext,
      references,
      confidence: normaliseConfidence(parsed.confidence),
      sources: wikidataCache ? ['collection', 'wikidata'] : ['collection'],
      model: useModel,
      promptVersion: effectivePromptVersion,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      prompt: userPrompt,
      systemPrompt: effectiveSystemPrompt,
      generatedAt: new Date().toISOString()
    };
  }).catch(function (err) {
    const status = err.status || 500;
    console.error('AI Biography: Generation failed:', status, err.message);
    const wrapped = new Error('API call failed: ' + err.message);
    wrapped.statusCode = status;
    // Only treat 5xx and network/timeout errors as transient (retry next page load).
    // 4xx responses (404 missing model, 401 bad key, 400 malformed request) are
    // configuration errors — retrying will always fail. Surface them as hard errors
    // so they're visible in logs rather than masquerading as load.
    const isTransient = status >= 500 || err.name === 'AbortError' || !err.status;
    wrapped.isApiError = isTransient;
    wrapped.isConfigError = !isTransient;
    throw wrapped;
  });
}

// Forgiving JSON object extractor for Claude responses.
//
// Claude _usually_ returns a clean JSON object when instructed to, but a few
// failure modes surface in practice:
//   1. Markdown fences — ```json\n{...}\n``` (common)
//   2. Leading prose    — "Here's the biography:\n{...}"
//   3. Trailing prose   — "{...}\n\nLet me know if you need more."
//   4. Both              — "Based on the data...\n```json\n{...}\n```\nNote..."
//
// Strategy: try a direct parse first (cheap, the happy path), then strip
// common markdown fences and retry, then as a last resort extract the first
// balanced {...} block via depth-tracking (respects strings so that braces
// inside quoted values don't throw off the count). Returns the parsed object
// or null; logs the failure with position info on genuine parse errors.
//
// This does NOT recover truncated JSON — if the response hit max_tokens
// mid-string, no extractor can produce valid output. The fix for truncation
// is max_tokens headroom (above).
function extractJsonObject (text) {
  if (!text || typeof text !== 'string') {
    console.error('AI Biography: no text to parse');
    return null;
  }

  // Attempt 1: direct parse — handles the clean happy path where Claude
  // returns JSON and nothing else.
  try { return ensureBiography(JSON.parse(text.trim())); } catch (_) { /* fall through */ }

  // Attempt 2: strip markdown fences around a JSON block and retry.
  const stripped = text
    .replace(/^[\s\S]*?```(?:json|javascript|js)?\s*\n?/i, '')
    .replace(/\n?```[\s\S]*$/, '')
    .trim();
  if (stripped && stripped !== text.trim()) {
    try { return ensureBiography(JSON.parse(stripped)); } catch (_) { /* fall through */ }
  }

  // Attempt 3: find the first balanced {...} block via depth tracking.
  // Tracks string boundaries so that "{" / "}" inside quoted values don't
  // mess up the count. Useful when Claude wraps the JSON in prose we
  // don't anticipate ("Based on... {...}. Note: ...").
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (inString) {
        if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end !== -1) {
      const candidate = text.slice(firstBrace, end + 1);
      try {
        const parsed = ensureBiography(JSON.parse(candidate));
        if (parsed) {
          console.warn('AI Biography: recovered JSON via balanced-braces extraction (model wrapped output with prose)');
          return parsed;
        }
      } catch (_) { /* fall through to error log */ }
    }
  }

  // All three strategies failed — most likely truncation (response hit
  // max_tokens mid-string) or a genuinely un-parseable reply. Log with
  // enough context to diagnose.
  try { JSON.parse(text.trim()); } catch (err) {
    console.error('AI Biography: Failed to parse response JSON:', err.message,
      '· text length:', text.length,
      '· first 120 chars:', text.slice(0, 120).replace(/\s+/g, ' '));
  }
  return null;
}

// Treats a parsed value as null if the required `biography` field is
// missing. Keeps the "we got something but not what we wanted" case
// centrally handled.
function ensureBiography (parsed) {
  if (parsed && typeof parsed === 'object' && parsed.biography) return parsed;
  console.error('AI Biography: Response missing biography field');
  return null;
}

module.exports = generateBiography;
module.exports.CONFIDENCE_INSUFFICIENT_AT_OR_BELOW = CONFIDENCE_INSUFFICIENT_AT_OR_BELOW;
