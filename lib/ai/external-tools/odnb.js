'use strict';

// Oxford Dictionary of National Biography (ODNB) verification tool.
// Given a claim + subject context:
//   1. Resolves the ODNB entry ID from Wikidata property P1415
//      (passed via opts.wikidataContext). No P1415 → no article.
//   2. Fetches the entry text via the configured ODNB API endpoint.
//   3. Uses a small Anthropic call to decide whether the entry
//      supports the claim.
//
// Tier: A (per plan authority tiers — ODNB is peer-reviewed British
// biographical scholarship, the strongest source in the current tool
// registry).
//
// Gated on the same config used by lib/ai/fetch-odnb-summary.js:
//   - aiBiographyOdnbEnabled: true
//   - aiBiographyOdnbApiUrl:  non-empty
//   - aiBiographyOdnbApiToken: non-empty
// If any is missing, returns { matched: false } silently. This lets
// the verifier be registered ahead of institutional credentials
// landing — Wikipedia + wikidataDeep + gracesGuide continue to
// verify claims; ODNB adds evidence when it can.
//
// Return shape matches the tool interface documented in
// lib/ai/verify-external.js. Never throws; returns
// { matched: false, error? } on any failure.

const Anthropic = require('@anthropic-ai/sdk');

const NAME = 'oxfordDNB';
const TIER = 'A';
const DEFAULT_LLM_MODEL = 'claude-sonnet-4-20250514';
const REQUEST_TIMEOUT_MS = 8000;
const EXTRACT_MAX_CHARS = 8000; // ODNB entries are long — give the LLM more context than Wikipedia
const EVIDENCE_FALLBACK_CHARS = 800;

async function query (claim, subject, opts) {
  opts = opts || {};
  const fetchImpl = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return { matched: false, error: 'no fetch available' };

  const config = opts.config || {};
  if (config.aiBiographyOdnbEnabled !== true) return { matched: false, error: 'ODNB adapter disabled' };
  const apiUrl = config.aiBiographyOdnbApiUrl || '';
  const apiToken = config.aiBiographyOdnbApiToken || '';
  if (!apiUrl || !apiToken) return { matched: false, error: 'ODNB credentials not configured' };

  const odnbId = odnbIdFromWikidata(opts.wikidataContext);
  if (!odnbId) return { matched: false, error: 'no P1415 identifier in wikidataContext' };

  if (!claim || !String(claim).trim()) return { matched: false, error: 'empty claim' };

  let entry;
  try {
    entry = await fetchOdnb(apiUrl, apiToken, odnbId, fetchImpl);
  } catch (err) {
    return { matched: false, error: 'entry fetch failed: ' + (err && err.message) };
  }
  if (!entry || !entry.extract) return { matched: false, error: 'no ODNB entry found' };

  const apiKey = opts.apiKey;
  if (!apiKey && !opts.llmClient) {
    return {
      matched: true,
      extracts: [{
        text: entry.extract.slice(0, EVIDENCE_FALLBACK_CHARS),
        url: entry.url || null,
        supportsClaim: null
      }],
      verdict: 'unclear',
      reasoning: 'no LLM configured — extract returned for manual review',
      cost: 0
    };
  }

  let check;
  try {
    check = await checkClaimAgainstEntry(claim, entry, opts);
  } catch (err) {
    return {
      matched: true,
      extracts: [{
        text: entry.extract.slice(0, EVIDENCE_FALLBACK_CHARS),
        url: entry.url || null,
        supportsClaim: null
      }],
      verdict: 'unclear',
      reasoning: 'llm check failed: ' + (err && err.message),
      cost: 0
    };
  }

  return {
    matched: true,
    extracts: [{
      text: check.evidenceExtract || entry.extract.slice(0, EVIDENCE_FALLBACK_CHARS),
      url: entry.url || null,
      supportsClaim: check.supportsClaim
    }],
    verdict: check.verdict,
    reasoning: check.reasoning,
    cost: check.cost
  };
}

// --- Wikidata → ODNB ID --------------------------------------------

function odnbIdFromWikidata (wikidataContext) {
  if (!wikidataContext) return null;
  const entry = wikidataContext.P1415;
  if (!entry) return null;
  if (typeof entry === 'string') return entry.trim() || null;
  if (Array.isArray(entry.claims) && entry.claims.length) {
    const first = entry.claims[0];
    if (first && typeof first.value === 'string' && first.value.trim()) return first.value.trim();
  }
  if (typeof entry.value === 'string' && entry.value.trim()) return entry.value.trim();
  return null;
}

// --- ODNB API fetch ------------------------------------------------

async function fetchOdnb (apiUrl, apiToken, odnbId, fetchImpl) {
  const url = apiUrl + (apiUrl.indexOf('?') !== -1 ? '&' : '?') + 'id=' + encodeURIComponent(odnbId);
  const opts = {
    headers: {
      Authorization: 'Bearer ' + apiToken,
      Accept: 'application/json'
    }
  };
  let timer = null;
  if (typeof AbortController === 'function') {
    const controller = new AbortController();
    opts.signal = controller.signal;
    timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  }
  try {
    const res = await fetchImpl(url, opts);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// --- LLM check ------------------------------------------------------

async function checkClaimAgainstEntry (claim, entry, opts) {
  const model = opts.model || DEFAULT_LLM_MODEL;
  const client = opts.llmClient || new Anthropic({ apiKey: opts.apiKey });
  const system = [
    'You are verifying whether a specific claim is supported by an Oxford Dictionary of National Biography (ODNB) entry. ODNB entries are peer-reviewed scholarly biographies — treat them as an authoritative source.',
    '',
    'Return strictly valid JSON. No markdown fences, no prose wrapping.',
    '',
    'Schema:',
    '{',
    '  "verdict": "supported" | "unsupported" | "unclear",',
    '  "supportsClaim": true | false | null,',
    '  "reasoning": "one-line explanation of your verdict",',
    '  "evidenceExtract": "up to ~250 chars from the entry that support your verdict, quoted verbatim from the entry text; empty string when the entry does not discuss the claim"',
    '}',
    '',
    'Rules:',
    '- Never fabricate. If the entry does not discuss the claim, verdict is "unclear" and supportsClaim is null.',
    '- If the entry contradicts the claim, verdict is "unsupported" and supportsClaim is false.',
    '- If the entry corroborates the claim, verdict is "supported" and supportsClaim is true.',
    '- evidenceExtract must be verbatim from the entry — do not paraphrase.',
    '- Be strict about "supported" — only pick that verdict if the entry explicitly states the claim or a logically equivalent form.'
  ].join('\n');
  const user = 'CLAIM:\n' + String(claim).slice(0, 500) +
    '\n\nODNB ENTRY (up to first ' + EXTRACT_MAX_CHARS + ' chars):\n' +
    String(entry.extract).slice(0, EXTRACT_MAX_CHARS) +
    '\n\nReturn strictly valid JSON.';

  const response = await client.messages.create({
    model,
    max_tokens: 500,
    system,
    messages: [{ role: 'user', content: user }]
  });
  const raw = ((response && response.content) || [])
    .map(function (b) { return (b && b.text) || ''; })
    .join('');

  let parsed;
  try {
    const stripped = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    parsed = JSON.parse(stripped);
  } catch (err) {
    parsed = { verdict: 'unclear', supportsClaim: null, reasoning: 'parse failed', evidenceExtract: '' };
  }

  const verdict = ['supported', 'unsupported', 'unclear'].indexOf(parsed.verdict) !== -1 ? parsed.verdict : 'unclear';
  const supportsClaim = parsed.supportsClaim === true ? true : (parsed.supportsClaim === false ? false : null);
  const inputTokens = (response.usage && response.usage.input_tokens) || 0;
  const outputTokens = (response.usage && response.usage.output_tokens) || 0;
  const gbpPerUsd = opts.gbpPerUsd || 0.8;
  const cost = (inputTokens * 3 / 1e6 + outputTokens * 15 / 1e6) * gbpPerUsd;

  return {
    supportsClaim,
    verdict,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    evidenceExtract: typeof parsed.evidenceExtract === 'string' ? parsed.evidenceExtract : '',
    cost
  };
}

module.exports = {
  name: NAME,
  tier: TIER,
  query
};
module.exports.odnbIdFromWikidata = odnbIdFromWikidata;
