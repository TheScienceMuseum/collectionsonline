'use strict';

// AI triage reviewer — sends an existing biography to a premium model
// (Opus by default) and gets back structured findings across three
// concerns: offensiveness, factual issues, identity confidence.
//
// Design principles — the reviewer is a TRIAGE tool, not a rewriter:
//   - Output is "what to investigate", not "here is the fix". Staff keep
//     the authoring decision.
//   - Every factual claim flagged carries an explicit confidence marker
//     so staff can prioritise (high = check this first; low = hunch).
//   - External sources are NAMED, not hyperlinked. We can't verify URLs
//     and don't want staff clicking hallucinated ones.
//   - Internal links (/people/, /objects/, /documents/) are validated at
//     generation time via validate-references.js — the reviewer is told
//     not to flag them.
//
// Stored shape lives under SK=REVIEW#<ISO timestamp> on the biography
// record. See biography-store.js.

const Anthropic = require('@anthropic-ai/sdk');

// Bump this constant whenever the reviewer's prompt OR data-passing logic
// changes meaningfully. The admin detail page compares stored
// `reviewPromptVersion` on each review against this constant to flag
// reviews produced under older reviewer behaviour as "outdated reviewer".
//
// Version log:
//   v1-triage (2026-04, original)  — initial prompt; had a field-name
//     bug (`personData.description` vs `personData.biography`) that
//     starved Opus of the catalogue prose, producing "no dates / addresses
//     to anchor" complaints even when the data was present.
//   v2-triage (2026-04, fix)       — fixed the field-name bug; added
//     explicit "Brief biography:" labelled section so the reviewer can
//     interpret structured-text date prose ("active 1817-1839") distinctly
//     from a freeform main biography. Reviews under v1 are flagged stale
//     in the admin UI and worth re-running.
const PROMPT_VERSION = '2026-04-v2-triage';
const DEFAULT_MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are a senior fact-checker and editor reviewing an AI-generated biography of a subject held in a museum's collection database.

Your audience is curatorial staff who are triaging public reports and need to know where to investigate. You produce FINDINGS, not rewrites — staff make authoring decisions.

Rules:

1. Focus on PROSE claims — dates, relationships, accomplishments, attributions, characterisations, value judgements. Use the provided subject data and Wikidata context as evidence where relevant.

2. Internal links in the biography (URLs beginning /people/, /objects/, /documents/) have been validated against the museum catalogue at generation time. Do NOT flag internal links. Do NOT invent external URLs.

3. Suggested sources — be conservative. These are starting points for a curator who may investigate, NOT citations you have verified. Quality over quantity:

   - Only suggest a source if you believe, with high confidence, that it specifically covers THIS claim — not merely the broader topic. "Charles Babbage's biography might mention his son Henry's schooling" is weaker than "Henry's own memoir is likely to cover his education."
   - Prefer **fewer, better-targeted** suggestions over **many tangential** ones. An empty suggestedChecks array is better than a list of plausibly-related-but-unverified sources.
   - If you have no good source in mind for a particular claim, return an empty suggestedChecks array. The flag itself is still useful — curators can decide where to look.

   Format for suggestions you do include — the admin UI turns these into deep links where possible (Wikipedia article, doi.org by DOI); everything else is plain text:

   - Wikipedia: describe the topic in natural prose — e.g. "Wikipedia's article on Charles Babbage". The UI builds the URL.
   - Journal articles / papers: include the DOI if known — e.g. "Collier's 1970 survey paper (doi:10.1017/S0007087400001539)".
   - Books: NAME the book (author + title) in plain prose. Do NOT include an ISBN. A hallucinated ISBN that passes checksum validation still frequently resolves to the WRONG book on library systems, looking authoritative while wasting staff time. Plain "Elizabeth Brayer's biography of George Eastman" is strictly more useful than "Elizabeth Brayer's biography of George Eastman (ISBN 9781580461894)" when the ISBN may be wrong.
   - Archives / press / other unstructured sources: name them plainly — they'll render as plain text.

   Never supply raw URLs directly. Wikipedia topic names and DOIs are the ONLY structured identifiers we accept. Do NOT include ISBNs.

4. factualIssues is ONLY for claims you have specific reason to suspect are WRONG. This is the most important rule — an entry in factualIssues means "staff, investigate this; I think it's incorrect". It is NOT a general "things to verify anyway" list.

   Every entry must meet at least one of these:

   (a) It contradicts the subject data or Wikidata context provided above.
   (b) You have specific reason from your own knowledge to suspect it's inaccurate, anachronistic, or conflates different subjects (e.g. biography says son attended school X, but X was the FATHER's school).
   (c) It names a specific detail (date, place, attribution) that is not widely established in the standard scholarly sources you know of.

   If a claim appears CORRECT based on what you know — e.g. "1888 is the widely accepted date for the Kodak trademark" — DO NOT list it. Listing a claim you're confirming as correct defeats the purpose of the array and wastes staff time. An empty factualIssues array for a well-researched biography is the correct outcome.

   Do NOT use factualIssues to show thoroughness by listing claims you've verified. Do NOT list every dated claim "just in case". Every entry is a signal that staff should dig.

   Framing of each flagged entry — two rules for how to populate the "claim" and "reasoning" fields:

   (i) Quote the SMALLEST portion of the biography that is actually suspect. If the concern is the phrase "inventor of roll film" within the sentence "George Eastman, inventor of roll film, registered the Kodak trademark in 1888", quote ONLY "inventor of roll film" as the claim — not the whole sentence. Quoting surrounding correct material (e.g. the 1888 date, which is right) obscures what's actually being flagged and makes the finding read as contradicting itself.

   (ii) The "reasoning" field MUST begin with the specific concern — NEVER with a confirmation. Do NOT start with "X is correct, but...", "The date is right, however...", "This is broadly accurate, though...", or any variant that leads with confirming the flagged claim. Staff reading fast will misread a confirmation-led reasoning as "this claim is fine" and dismiss the flag. Start with the suspicion directly:

   - Wrong framing: "The dates are broadly correct, but 'developed' elides that Mannes and Godowsky were the actual inventors."
   - Right framing: "Attributing Kodachrome's development to the company elides that Leopold Mannes and Leopold Godowsky Jr. invented it while working with Kodak."

   If you cannot phrase the reasoning without leading with a confirmation, the claim probably doesn't warrant being in factualIssues — leave it out.

5. Confidence marker semantics:

   - "high"   — you are highly confident this claim is WRONG
   - "medium" — you suspect it's wrong; worth a curator's time
   - "low"    — a hunch; worth a quick check if other signals align

   Err towards "medium" rather than "high" when uncertain. Staff prefer accurate uncertainty signalling over bold assertions. The reasoning field should explain specifically WHY you suspect the claim, not restate the claim or confirm it.

6. If a biography is unremarkable — no offensive content, factual content matches the source data, identity is unambiguous — say so plainly with an empty/null findings structure. It is OK (and often correct) to report "no issues found".

7. Respond in strictly valid JSON. No prose wrapping, no markdown fences.

Response schema:

{
  "overallVerdict": "likely_correct" | "possible_issues" | "likely_issues",
  "verdictReasoning": "one sentence summary of your overall take",
  "offensive": null | {
    "flagged": true,
    "explanation": "what is problematic and why",
    "passages": ["quoted phrase 1", "quoted phrase 2"]
  },
  "factualIssues": [
    {
      "claim": "the exact claim, quoted or paraphrased from the biography",
      "confidence": "high" | "medium" | "low",
      "reasoning": "SPECIFIC reason you suspect this claim is wrong. Not a restatement of the claim; not a confirmation that it's correct. If you can't articulate a specific suspicion, the claim does not belong in this array.",
      "suggestedChecks": ["source name 1", "source name 2"]
    }
  ],
  "identityConfidence": {
    "score": 0,
    "reasoning": "why you believe the biography is / is not about the subject identified by the catalogue record",
    "possibleConfusions": [
      { "name": "Another Person Name", "reason": "why this alternative is plausible" }
    ]
  }
}

If no offensive concerns: set offensive to null (not a flagged:false object). If no factual issues: factualIssues is []. If identity is well-anchored: possibleConfusions is []. identityConfidence.score is 0-10.`;

async function reviewBiography (opts) {
  const {
    biographyHtml,
    contextHtml,
    personData,
    wikidataContext,
    reportCounts,
    apiKey,
    model
  } = opts;

  if (!biographyHtml) {
    throw new Error('reviewBiography: no biographyHtml to review');
  }
  if (!apiKey) {
    throw new Error('reviewBiography: missing Anthropic API key');
  }
  if (!model) {
    throw new Error('reviewBiography: no model specified');
  }

  const userPrompt = buildUserPrompt({
    biographyHtml,
    contextHtml,
    personData,
    wikidataContext,
    reportCounts
  });

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const raw = (response.content && response.content[0] && response.content[0].text) || '';
  const findings = parseAndValidate(raw);

  return {
    findings,
    model,
    promptVersion: PROMPT_VERSION,
    inputTokens: (response.usage && response.usage.input_tokens) || 0,
    outputTokens: (response.usage && response.usage.output_tokens) || 0,
    rawResponse: raw
  };
}

function buildUserPrompt (opts) {
  const { biographyHtml, contextHtml, personData, wikidataContext, reportCounts } = opts;
  const parts = [];

  parts.push('## Biography to review\n');
  parts.push(biographyHtml);
  if (contextHtml) {
    parts.push('\n\n### Collection context block\n');
    parts.push(contextHtml);
  }

  parts.push('\n\n## Subject data (ground truth from the museum catalogue)\n');
  parts.push('Name: ' + (personData.name || '(unknown)'));
  if (personData.birthDate) parts.push('Born: ' + personData.birthDate);
  if (personData.birthPlace) parts.push('Place of birth: ' + personData.birthPlace);
  if (personData.deathDate) parts.push('Died: ' + personData.deathDate);
  if (personData.deathPlace) parts.push('Place of death: ' + personData.deathPlace);
  if (personData.occupation) parts.push('Occupation: ' + personData.occupation);
  if (personData.nationality) parts.push('Nationality: ' + personData.nationality);
  // Existing catalogue text — the same fields passed to the generator at
  // generation time. Surfaced separately because they're semantically
  // distinct: brief biography is a structured-text summary often
  // containing "active YYYY-YYYY" date text where structured birth/death
  // are absent; the main biography is freeform curatorial text.
  if (personData.briefBiography) {
    parts.push('Brief biography (terse summary, may include "active YYYY-YYYY" date text): ' + String(personData.briefBiography).slice(0, 600));
  }
  if (personData.biography) {
    parts.push('Existing catalogue biography: ' + String(personData.biography).slice(0, 1500));
  }

  if (wikidataContext && Object.keys(wikidataContext).length) {
    parts.push('\n\n## Wikidata context (external source, cached from generation time)\n');
    Object.keys(wikidataContext).forEach(function (k) {
      const v = wikidataContext[k];
      const value = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
      if (value != null && value !== '') {
        parts.push(k + ': ' + String(value));
      }
    });
  }

  if (reportCounts && Object.keys(reportCounts).length) {
    parts.push('\n\n## Public report categories so far\n');
    parts.push('Visitors flagging this biography have selected these reasons:');
    Object.keys(reportCounts).forEach(function (reason) {
      parts.push('- ' + reason + ': ' + reportCounts[reason]);
    });
  }

  parts.push('\n\nReview the biography comprehensively against the above context. Respond with valid JSON only — no markdown, no prose around it.');

  return parts.join('\n');
}

// Strict-ish JSON parse with a small amount of forgiveness. Opus mostly
// respects the "no markdown" instruction but occasionally wraps its reply
// in a ```json fence — strip that before parsing.
function parseAndValidate (raw) {
  if (!raw) throw new Error('reviewBiography: empty model response');
  const stripped = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    const hint = stripped.slice(0, 200);
    throw new Error('reviewBiography: model response was not valid JSON: ' + err.message + ' — first 200 chars: ' + hint);
  }

  // Shape validation — soft, fills gaps with sensible defaults so a
  // mildly malformed response still produces a usable record rather
  // than erroring the entire review.
  const findings = {
    overallVerdict: validVerdict(parsed.overallVerdict) || 'possible_issues',
    verdictReasoning: str(parsed.verdictReasoning),
    offensive: normaliseOffensive(parsed.offensive),
    factualIssues: normaliseFactualIssues(parsed.factualIssues),
    identityConfidence: normaliseIdentity(parsed.identityConfidence)
  };

  return findings;
}

function validVerdict (v) {
  return ['likely_correct', 'possible_issues', 'likely_issues'].indexOf(v) !== -1 ? v : null;
}

function str (v) { return typeof v === 'string' ? v : ''; }

function normaliseOffensive (o) {
  if (!o || typeof o !== 'object') return null;
  if (!o.flagged) return null;
  return {
    flagged: true,
    explanation: str(o.explanation),
    passages: Array.isArray(o.passages) ? o.passages.filter(function (p) { return typeof p === 'string'; }) : []
  };
}

function normaliseFactualIssues (arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(function (i) { return i && typeof i === 'object'; })
    .map(function (i) {
      return {
        claim: str(i.claim),
        confidence: ['high', 'medium', 'low'].indexOf(i.confidence) !== -1 ? i.confidence : 'medium',
        reasoning: str(i.reasoning),
        suggestedChecks: Array.isArray(i.suggestedChecks) ? i.suggestedChecks.filter(function (c) { return typeof c === 'string'; }) : []
      };
    });
}

function normaliseIdentity (ic) {
  if (!ic || typeof ic !== 'object') return { score: null, reasoning: '', possibleConfusions: [] };
  const score = typeof ic.score === 'number' && ic.score >= 0 && ic.score <= 10 ? ic.score : null;
  return {
    score,
    reasoning: str(ic.reasoning),
    possibleConfusions: Array.isArray(ic.possibleConfusions)
      ? ic.possibleConfusions
        .filter(function (c) { return c && typeof c === 'object'; })
        .map(function (c) { return { name: str(c.name), reason: str(c.reason) }; })
      : []
  };
}

module.exports = { reviewBiography, PROMPT_VERSION };
