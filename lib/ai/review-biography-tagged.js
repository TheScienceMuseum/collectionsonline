'use strict';

// Per-generation reviewer wrapper. Called after the source-tagged
// writer produces a biography — catches SUBTLE issues that the writer's
// source-tag discipline can't catch on its own:
//
//   - Same-source conflations (Wikidata says the subject was educated
//     at both A and B; biography says "studied at A and B" but the
//     reality was undergrad at A + doctorate at B — Wikidata itself
//     doesn't distinguish, but a scholar would).
//   - Multi-team attribution (Eddington-Sobral 1919 case; both
//     museum + Wikidata may say "he observed the 1919 eclipse" without
//     distinguishing Sobral/Príncipe teams).
//   - Class-wide anti-pattern violations (era-inappropriate
//     institution names, personal-opinion attributions).
//   - Tone / language issues (unsupported superlatives).
//
// The reviewer does NOT re-check things source tagging handles:
//   - Whether an llm:general_knowledge claim is actually true (Mode A
//     external verification handles that on demand).
//   - Whether the writer used the correct source tag for a claim.
//
// Output shape mirrors v1 exploration's reviewer with kind + confidence:
//   { findings: [{ claimSignature, claimText, kind, confidence, concern }],
//     inputTokens, outputTokens, model, spend }
// The claimSignature is COMPUTED at parse time by matching the
// reviewer's quoted claim text against the biography's sentence
// signatures. If exact match fails, uses fuzzy similarity.

const Anthropic = require('@anthropic-ai/sdk');
const antiPatterns = require('./anti-patterns');
const { signature, similarityDetail } = require('./claim-signature');
const modelsRegistry = require('./models');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// Confidence threshold for accepting a reviewer's claim quotation
// against a biography sentence via fuzzy match. Same threshold as v1
// convergence work (>= 0.4 ratio AND >= 3 tokens intersection).
const FUZZY_MATCH_RATIO = 0.4;
const FUZZY_MATCH_MIN_TOKENS = 3;

const SYSTEM_PROMPT = `You are a senior fact-checker and editor reviewing an AI-generated biography for a museum's collection database. Your audience is curatorial staff who need to know where to investigate; they trust your findings to be substantive, not stylistic.

The biography is source-tagged — the writer has already declared which sentences came from museum inputs, which from Wikidata, which from its own inference or general knowledge. Sentences tagged as museum or Wikidata are considered corroborated at generation time; LLM-tagged content is filtered at render time per the collection's publishing policy. Your job is NOT to re-check the source tags. Your job is to catch SUBTLE issues source tagging can't see.

What you look for:

  - **Same-source conflations.** Wikidata records may list multiple related facts under one property (e.g. all four educational institutions) without distinguishing their relationships. If the biography implies a uniform relationship where one didn't exist (undergrad vs doctorate; visiting vs employed) — flag it.

  - **Multi-team / multi-collaborator attribution.** When a subject was part of a larger effort, a sentence that flatly attributes the effort's specific actions to the subject is suspect. Classic case: Eddington at Sobral (Crommelin's separate team). Look for anything similar.

  - **Class-wide anti-pattern violations.** The class-wide rules (appended below) apply to every biography. Any rule violation is an error-tier finding.

  - **Tone / language issues.** Unsupported superlatives, editorial commentary ("tragically", "brilliantly"), unattributed personal opinions.

  - **Interesting context worth curators knowing** (kind='info'). Not errors — nuances a curator might want to be aware of. Example: "The Nobel Prize was awarded in 1921 but formally received at the 1922 ceremony — the biography's phrasing is standard shorthand, not wrong." Don't emit info entries for stylistic nits.

What you DO NOT look for:

  - Whether an llm:general_knowledge claim is actually true. External verification handles that on demand — not your job here.
  - Whether the writer picked the right source tag. Source-tagging discipline is enforced elsewhere.
  - "Precision notes" — the catalogue said 'near Cromer, Norfolk' but the biography says 'Norfolk'. This is fine; do not flag.
  - Anything you can't finish articulating without hedging ("this isn't wrong per se, but…"). If you can't articulate the specific suspicion crisply, OMIT it — leave findings for things that are actually worth curator attention.

RESPONSE — strict JSON, no prose wrapping, no markdown fences:

{
  "overallVerdict": "likely_correct" | "possible_issues" | "likely_issues",
  "verdictReasoning": "one-sentence summary",
  "factualIssues": [
    {
      "claim": "the EXACT sentence from the biography you're flagging, quoted verbatim so the system can match it back to the source-tagged sentence array",
      "kind": "error" | "info",
      "confidence": "high" | "medium" | "low",
      "concern": "specific reason. For error: what you suspect is wrong. For info: what context a curator would want to know. Do not hedge."
    }
  ]
}

kind semantics:
  - "error": you specifically suspect the claim is wrong.
  - "info": FYI — the claim is not wrong, but there's context a curator would want to know.

confidence semantics:
  - "high": highly confident (e.g. the concern is a clear anti-pattern violation, or you have specific scholarly knowledge that contradicts the claim).
  - "medium": suspect it's wrong; worth a curator's time.
  - "low": specific but weak suspicion. NOT a stylistic preference. NOT "curator may wish to confirm" nit. If your concern includes phrases like "this isn't wrong per se, but…" or "may not warrant action, but…", the finding does NOT belong at any confidence level — omit it entirely.

Err toward "medium" rather than "high" when uncertain. Empty factualIssues[] for a clean biography is the correct outcome.`;

// Public entry point.
async function reviewBiographyTagged (biography, opts) {
  opts = opts || {};
  const apiKey = opts.apiKey;
  if (!apiKey && !opts.client) {
    console.error('review-biography-tagged: no Anthropic API key configured');
    return null;
  }
  const modelId = opts.model || DEFAULT_MODEL;
  const client = opts.client || new Anthropic({ apiKey });

  const biographyText = renderBiographyText(biography);
  if (!biographyText.trim()) {
    // Nothing to review. Return an empty-findings result so the caller
    // can still persist a REVIEW# item with zero findings and count
    // it in the guardrail report.
    return emptyResult(modelId);
  }

  const systemPrompt = antiPatterns.appendToPrompt(SYSTEM_PROMPT);
  const userPrompt = buildUserPrompt(biography, biographyText, opts);
  const maxTokens = Number.isInteger(opts.maxTokens) ? opts.maxTokens : 2000;

  let response;
  try {
    response = await client.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
  } catch (err) {
    console.warn('review-biography-tagged: Anthropic call failed:', err && err.message);
    return null;
  }

  const rawText = ((response && response.content) || [])
    .map(function (b) { return (b && b.text) || ''; })
    .join('');

  let parsed;
  try {
    parsed = tryJsonParse(rawText);
  } catch (err) {
    console.warn('review-biography-tagged: parse failed:', err && err.message);
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    console.warn('review-biography-tagged: response was not a JSON object');
    return null;
  }

  const findings = normaliseFindings(parsed.factualIssues, biography);
  const inputTokens = (response.usage && response.usage.input_tokens) || 0;
  const outputTokens = (response.usage && response.usage.output_tokens) || 0;
  const spend = modelsRegistry.calculateCost
    ? (modelsRegistry.calculateCost(modelId, inputTokens, outputTokens, opts.gbpPerUsd || 0) || { perBio: 0 }).perBio
    : 0;

  return {
    findings,
    overallVerdict: typeof parsed.overallVerdict === 'string' ? parsed.overallVerdict : 'possible_issues',
    verdictReasoning: typeof parsed.verdictReasoning === 'string' ? parsed.verdictReasoning : '',
    model: modelId,
    inputTokens,
    outputTokens,
    spend
  };
}

// --- Helpers --------------------------------------------------------

function emptyResult (modelId) {
  return {
    findings: [],
    overallVerdict: 'likely_correct',
    verdictReasoning: 'No biography content to review.',
    model: modelId,
    inputTokens: 0,
    outputTokens: 0,
    spend: 0
  };
}

// Turn the biography's sentences into numbered prose the reviewer can
// scan and quote back from. Numbering the sentences helps the reviewer
// reference specific claims accurately.
function renderBiographyText (biography) {
  if (!biography) return '';
  const sentences = (biography.sentences || []).map(function (s) { return s && s.text ? String(s.text) : ''; }).filter(Boolean);
  if (!sentences.length) return '';
  return sentences.map(function (s, i) { return '[S' + (i + 1) + '] ' + s; }).join('\n');
}

function buildUserPrompt (biography, biographyText, opts) {
  const parts = [];
  parts.push('Review the following AI-generated biography for subtle factual issues that source tagging cannot catch on its own.');
  parts.push('');
  parts.push('BIOGRAPHY (sentences numbered [S1], [S2], … for reference — quote sentence text verbatim in your factualIssues[].claim field):');
  parts.push('');
  parts.push(biographyText);
  parts.push('');

  if (opts.personData) {
    parts.push('INPUT DATA — museum catalogue');
    if (opts.personData.name) parts.push('  Name: ' + opts.personData.name);
    if (opts.personData.birthDate) parts.push('  Born: ' + opts.personData.birthDate);
    if (opts.personData.deathDate) parts.push('  Died: ' + opts.personData.deathDate);
    if (opts.personData.occupation) parts.push('  Occupation: ' + opts.personData.occupation);
    if (opts.personData.nationality) parts.push('  Nationality: ' + opts.personData.nationality);
    if (opts.personData.briefBiography) parts.push('  Brief biography: ' + opts.personData.briefBiography);
    if (opts.personData.biography) parts.push('  Existing catalogue biography: ' + String(opts.personData.biography).slice(0, 1500));
    parts.push('');
  }

  if (biography.writerNotes) {
    parts.push('WRITER\'S OWN EDITORIAL NOTES (context for your review):');
    parts.push(biography.writerNotes);
    parts.push('');
  }

  parts.push('Return strictly valid JSON matching the response schema in the system prompt.');
  return parts.join('\n');
}

// Same tolerant JSON extraction as parse-source-tagged-response.
function tryJsonParse (text) {
  const stripped = String(text)
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch (err) {}
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

// Normalise + validate findings, compute claimSignature by matching
// against biography sentences.
function normaliseFindings (rawArr, biography) {
  if (!Array.isArray(rawArr)) return [];
  const bioSentences = (biography && biography.sentences) || [];
  const sigByExactText = new Map();
  bioSentences.forEach(function (s) {
    if (s && s.text) sigByExactText.set(s.text.trim(), s.claimSignature);
  });

  return rawArr
    .filter(function (i) { return i && typeof i === 'object'; })
    .map(function (i) {
      const claimText = typeof i.claim === 'string' ? i.claim.trim() : '';
      if (!claimText) return null;
      const kind = i.kind === 'info' ? 'info' : 'error';
      const confidence = i.confidence === 'high' || i.confidence === 'medium' || i.confidence === 'low'
        ? i.confidence
        : 'low';
      const concern = typeof i.concern === 'string' ? i.concern : (typeof i.reasoning === 'string' ? i.reasoning : '');
      let claimSignature = sigByExactText.get(claimText);
      if (!claimSignature) claimSignature = matchByFuzzy(claimText, bioSentences);
      if (!claimSignature) claimSignature = signature(claimText); // fall back — signature of quoted text alone
      return {
        claimSignature,
        claimText,
        kind,
        confidence,
        concern
      };
    })
    .filter(Boolean);
}

// Fuzzy-match a reviewer's quoted claim against biography sentences.
// Returns the signature of the best matching sentence if it clears the
// containment-ratio + intersection thresholds; null otherwise.
function matchByFuzzy (quotedClaim, bioSentences) {
  let best = { sig: null, ratio: 0, intersection: 0 };
  for (const s of bioSentences) {
    if (!s || !s.text) continue;
    const d = similarityDetail(quotedClaim, s.text);
    if (d.ratio > best.ratio) best = { sig: s.claimSignature, ratio: d.ratio, intersection: d.intersection };
  }
  if (best.sig && best.ratio >= FUZZY_MATCH_RATIO && best.intersection >= FUZZY_MATCH_MIN_TOKENS) {
    return best.sig;
  }
  return null;
}

module.exports = reviewBiographyTagged;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
module.exports.DEFAULT_MODEL = DEFAULT_MODEL;
module.exports.normaliseFindings = normaliseFindings;
