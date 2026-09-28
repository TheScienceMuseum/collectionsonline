'use strict';

// Wikipedia verification tool. Given a claim + subject context:
//   1. Resolves the subject's Wikipedia article via the MediaWiki
//      search API (best match).
//   2. Fetches the article's plain-text extract.
//   3. Uses a small Anthropic call to decide whether the article
//      supports the claim.
//
// Tier: C (per plan authority tiers — Wikipedia is prose, community-
// edited; useful as pointer to sources, not itself an authority).
//
// Return shape follows the tool interface documented in
// lib/ai/verify-external.js. Never throws; returns
// { matched: false, error } on any failure.

const Anthropic = require('@anthropic-ai/sdk');

const NAME = 'wikipedia';
const TIER = 'C';
const USER_AGENT = 'collectionsonline-guardrail (contact@sciencemuseum.org.uk)';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const DEFAULT_LLM_MODEL = 'claude-sonnet-4-20250514';
const REQUEST_TIMEOUT_MS = 8000;
const EXTRACT_MAX_CHARS = 6000; // chars of Wikipedia article passed to LLM
const EVIDENCE_FALLBACK_CHARS = 800;

async function query (claim, subject, opts) {
  opts = opts || {};
  const fetchImpl = opts.fetch || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return { matched: false, error: 'no fetch available' };

  const subjectName = subject && subject.name;
  if (!subjectName) return { matched: false, error: 'no subject name provided' };
  if (!claim || !String(claim).trim()) return { matched: false, error: 'empty claim' };

  let article;
  try {
    article = await fetchArticle(subjectName, fetchImpl);
  } catch (err) {
    return { matched: false, error: 'article fetch failed: ' + (err && err.message) };
  }
  if (!article) return { matched: false, error: 'no matching Wikipedia article' };

  const apiKey = opts.apiKey;
  if (!apiKey && !opts.llmClient) {
    // Return the article extract so the caller can display it, but no
    // verdict — we can't check without an LLM.
    return {
      matched: true,
      extracts: [{
        text: article.extract.slice(0, EVIDENCE_FALLBACK_CHARS),
        url: article.url,
        supportsClaim: null
      }],
      verdict: 'unclear',
      reasoning: 'no LLM configured — extract returned for manual review',
      cost: 0
    };
  }

  let check;
  try {
    check = await checkClaimAgainstArticle(claim, article, opts);
  } catch (err) {
    return {
      matched: true,
      extracts: [{
        text: article.extract.slice(0, EVIDENCE_FALLBACK_CHARS),
        url: article.url,
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
      text: check.evidenceExtract || article.extract.slice(0, EVIDENCE_FALLBACK_CHARS),
      url: article.url,
      supportsClaim: check.supportsClaim
    }],
    verdict: check.verdict,
    reasoning: check.reasoning,
    cost: check.cost
  };
}

// --- Article resolution --------------------------------------------

async function fetchArticle (subjectName, fetchImpl) {
  const searchParams = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: subjectName,
    srlimit: '1',
    format: 'json',
    origin: '*'
  });
  const searchJson = await httpGetJson(WIKI_API + '?' + searchParams.toString(), fetchImpl);
  const first = searchJson && searchJson.query && searchJson.query.search && searchJson.query.search[0];
  if (!first) return null;
  const title = first.title;

  const extractParams = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    exlimit: '1',
    explaintext: '1',
    titles: title,
    format: 'json',
    origin: '*'
  });
  const extractJson = await httpGetJson(WIKI_API + '?' + extractParams.toString(), fetchImpl);
  const pages = (extractJson && extractJson.query && extractJson.query.pages) || {};
  const pageId = Object.keys(pages)[0];
  const page = pageId ? pages[pageId] : null;
  if (!page || !page.extract) return null;

  return {
    title,
    extract: page.extract,
    url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/\s+/g, '_'))
  };
}

async function httpGetJson (url, fetchImpl) {
  // AbortController-driven timeout — only wired in when the runtime
  // supports it (Node 15+). On older runtimes the fetch call happens
  // without a timeout; better than crashing. Tests under Node 14 rely
  // on this fallback.
  const opts = { headers: { 'User-Agent': USER_AGENT } };
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

async function checkClaimAgainstArticle (claim, article, opts) {
  const model = opts.model || DEFAULT_LLM_MODEL;
  const client = opts.llmClient || new Anthropic({ apiKey: opts.apiKey });
  const system = [
    'You are verifying whether a specific claim is supported by a Wikipedia article.',
    '',
    'Return strictly valid JSON. No markdown fences, no prose wrapping.',
    '',
    'Schema:',
    '{',
    '  "verdict": "supported" | "unsupported" | "unclear",',
    '  "supportsClaim": true | false | null,',
    '  "reasoning": "one-line explanation of your verdict",',
    '  "evidenceExtract": "up to ~250 chars from the article that support your verdict, quoted verbatim from the article text; empty string when the article does not discuss the claim"',
    '}',
    '',
    'Rules:',
    '- Never fabricate. If the article does not discuss the claim, verdict is "unclear" and supportsClaim is null.',
    '- If the article contradicts the claim, verdict is "unsupported" and supportsClaim is false.',
    '- If the article corroborates the claim, verdict is "supported" and supportsClaim is true.',
    '- evidenceExtract must be verbatim from the article you were shown — do not paraphrase.',
    '- Be strict about "supported" — only pick that verdict if the article explicitly states the claim or a logically equivalent form.'
  ].join('\n');
  const user = 'CLAIM:\n' + String(claim).slice(0, 500) +
    '\n\nWIKIPEDIA ARTICLE (up to first ' + EXTRACT_MAX_CHARS + ' chars):\n' +
    String(article.extract).slice(0, EXTRACT_MAX_CHARS) +
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
  // Sonnet: $3/M input, $15/M output.
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
