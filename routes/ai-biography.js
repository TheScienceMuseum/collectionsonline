'use strict';

const TypeMapping = require('../lib/type-mapping');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');
const extractPersonData = require('../lib/ai/extract-person-data');
const generateSourceTaggedBiography = require('../lib/ai/generate-source-tagged-biography');
const reviewBiographyTagged = require('../lib/ai/review-biography-tagged');
const curatorDecisionsStore = require('../lib/ai/curator-decisions-store');
const reviewStore = require('../lib/ai/review-store');
const renderBiography = require('../lib/ai/render-biography');
const biographyStore = require('../lib/ai/biography-store');
const dynamo = require('../lib/ai/dynamo');
const normaliseWikidata = require('../lib/helpers/normalise-wikidata');
const fetchWikidataLive = require('../lib/ai/fetch-wikidata-live');
const fetchWikipediaSummary = require('../lib/ai/fetch-wikipedia-summary');
const fetchOdnbSummary = require('../lib/ai/fetch-odnb-summary');
const fetchGracesGuideSummary = require('../lib/ai/fetch-graces-guide-summary');
const detectContradictions = require('../lib/ai/detect-contradictions');
const assessSufficiency = require('../lib/ai/assess-sufficiency');
const classifySubject = require('../lib/ai/classify-subject');
const subjectStatus = require('../lib/ai/subject-status');
const flagStore = require('../lib/ai/flag-store');
const truncateDescriptionAtSentence = require('../lib/ai/truncate-description');

const inFlight = new Map();

const CACHE_CONTROL = process.env.NODE_ENV === 'production'
  ? 'public, max-age=3600, stale-while-revalidate=86400'
  : 'no-cache, no-store';

// Per related-item description size in the prompt. Bumped from 200 to 500
// alongside switching to sentence-boundary truncation
// (see lib/ai/truncate-description.js). The previous 200-char cap routinely
// cut descriptions mid-sentence, producing dangerous adjacency artefacts in
// the prompt — cp37054 (Einstein) hit this when the Eddington description
// was severed at "of the Royal…", leaving "Sobral, Brazil" and "Eddington"
// adjacent with no disambiguating clause, and Sonnet bridged the gap by
// inventing "Eddington's observations at Sobral". 500 lets most catalogue
// descriptions complete in one or two sentences; sentence-boundary
// truncation guarantees we never cut a clause that the model could finish
// incorrectly.
const DESCRIPTION_MAX_CHARS = 500;

function truncateDescription (text) {
  return truncateDescriptionAtSentence(text, DESCRIPTION_MAX_CHARS);
}

// v2 writer emits references on each sentence via `sourceDetail`
// (`relatedItem:coXXXXX`) and `citations[]`. The shared
// `deriveReferencesFromSentences` in lib/ai/regenerate-biography.js
// walks BOTH surfaces + extracts persons too, so the returned
// `references[]` list on the BIOGRAPHY item is comprehensive. Imported
// rather than duplicated so a fix to the derivation lands in one
// place. Same shape v1 emitted — `{ id, title, link, type, role? }`
// — plus the new `type: 'person'` variant for relatedPerson entries.
const deriveReferencesFromSentences = require('../lib/ai/regenerate-biography').deriveReferencesFromSentences;
const filterSelfReview = require('../lib/ai/filter-self-review');

// Top-level `sources` list — v1 emitted ['collection'] or
// ['collection', 'wikidata']; v2 derives the same list from the
// source tags actually used across sentences. Same shape, same
// downstream consumers.
function deriveSourcesFromSentences (sentences) {
  const set = new Set();
  (sentences || []).forEach(function (s) {
    if (!s || typeof s.source !== 'string') return;
    if (s.source === 'museum') set.add('collection');
    else if (s.source === 'wikidata') set.add('wikidata');
    else if (s.source.indexOf('llm:validated:') === 0) {
      set.add(s.source.slice('llm:validated:'.length));
    }
  });
  return Array.from(set);
}

function flattenRelated (sortedRelated, personId) {
  const items = [];
  const objects = sortedRelated.relatedObjects || [];
  const documents = sortedRelated.relatedDocuments || [];

  objects.forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      description: truncateDescription(item.attributes && item.attributes.description),
      link: item.links ? item.links.self : '/objects/' + item.id,
      type: 'object',
      role: item.role || ''
    });
  });

  documents.forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      description: truncateDescription(item.attributes && item.attributes.description),
      link: item.links ? item.links.self : '/documents/' + item.id,
      type: 'document',
      role: item.role || ''
    });
  });

  return items;
}

module.exports = function (elastic, config) {
  return [publicBiographyRoute(elastic, config), publicFlagRoute(config)];
};

function publicBiographyRoute (elastic, config) {
  return {
    method: 'GET',
    path: '/ai/biography/{id}',
    config: {
      auth: false,
      handler: async function (request, h) {
        if (!config.aiBiographyEnabled) {
          return h.response({ error: 'AI biography feature is not enabled' }).code(404);
        }

        const id = request.params.id;

        if (!/^[a-z]{2}\d+$/i.test(id)) {
          return h.response({ error: 'Invalid ID format' }).code(400);
        }

        // Check DynamoDB for existing biography. We look up the canonical
        // record regardless of status, then decide what to return:
        //   - living person AND feature-flag off → 204 (policy suppression)
        //   - hidden / insufficient_data         → 204 (don't show publicly)
        //   - live / flagged                     → serve the cached content
        //                                          (flagged is just a triage
        //                                          marker; still public)
        //   - no record at all                   → fall through to regenerate
        //
        // Living-person policy is enforced HERE, at render time — not at
        // generation time. Biographies are generated for everyone; the
        // public flag toggles whether they surface. Lets us enable living
        // people globally by flipping config.aiBiographyIncludeLiving to
        // true, with no batch job or status migration required.
        if (dynamo.isReady()) {
          try {
            const existing = await biographyStore.fetchBiography(id);
            if (existing) {
              if (subjectStatus.isSuppressedOnPublicSite(existing.subjectStatus, config)) {
                return h.response({}).code(204);
              }
              if (existing.status === 'hidden' || existing.status === 'insufficient_data') {
                return h.response({}).code(204);
              }
              if (existing.biographyHtml) {
                // `references` is deliberately NOT surfaced on the public
                // JSON payload — the public /people/{id} page already
                // exposes the agent's related objects via ES elsewhere on
                // the page, and every catalogue item cited by the AI
                // prose is reachable through inline anchors in the HTML.
                // Kept internal-only on the biography item so the admin
                // Claims list can render per-sentence "→ Title" chips
                // without an ES lookup at render time.
                return h.response({
                  biography: existing.biographyHtml,
                  context: existing.contextHtml,
                  personName: existing.personName,
                  sources: existing.sources,
                  generatedAt: existing.generatedAt,
                  model: existing.model,
                  status: existing.status,
                  suppressExisting: existing.existingDescriptionChars < config.aiBiographySuppressExistingChars,
                  flagEnabled: !!config.aiBiographyPublicFlagEnabled
                }).type('application/json').header('Cache-Control', CACHE_CONTROL);
              }
              // v2 records store `sentences[]` on the item and intentionally
              // do NOT persist a rendered `biographyHtml` — the render layer
              // composes HTML at read time so subsequent curator actions
              // (approve / reject / clarify) or filter-level tweaks apply
              // on the next page load without a regen. Prior to this branch
              // the route only handled the legacy pre-rendered field and
              // fell through to a fresh Claude regen (~40s wall-clock)
              // every time a v2 record was loaded publicly. Render inline
              // from the stored sentences instead — the same shape the
              // admin detail already builds.
              if (Array.isArray(existing.sentences) && existing.sentences.length > 0) {
                const curatorDecisions = await curatorDecisionsStore.get(id).catch(function () { return null; });
                const openFindings = await reviewStore.openFindings(id).catch(function () { return []; });
                // `opts.references` is intentionally omitted here — the
                // renderer uses it only to build per-sentence chip data
                // consumed by the admin Claims list. The public path
                // returns just biographyHtml + contextHtml (both of
                // which are complete on their own, inline anchors and
                // all). Passing an empty references list produces
                // empty chip arrays that are then dropped on the floor.
                const rendered = renderBiography({
                  sentences: existing.sentences,
                  paragraphBreaks: existing.paragraphBreaks || []
                }, {
                  decisions: curatorDecisions,
                  openFindings,
                  publishingLevel: config.aiBiographyPublishingLevel
                });
                // References field deliberately not on the public payload
                // — see comment on the legacy branch above for rationale.
                return h.response({
                  biography: rendered.biographyHtml,
                  context: rendered.contextHtml,
                  personName: existing.personName,
                  sources: existing.sources,
                  generatedAt: existing.generatedAt,
                  model: existing.model,
                  status: existing.status,
                  suppressExisting: existing.existingDescriptionChars < config.aiBiographySuppressExistingChars,
                  flagEnabled: !!config.aiBiographyPublicFlagEnabled
                }).type('application/json').header('Cache-Control', CACHE_CONTROL);
              }
            }
          } catch (err) {
            // Log full error — AWS SDK errors don't always populate .message,
            // and a silent empty log makes misconfigured DynamoDB hard to diagnose
            console.warn('AI Biography: DynamoDB fetch failed for', id,
              '- name:', err && err.name,
              '- code:', err && (err.$metadata && err.$metadata.httpStatusCode),
              '- message:', err && err.message,
              '- stack:', err && err.stack);
          }
        } else {
          return h.response({ error: 'Storage unavailable' }).code(503);
        }

        // Public on-demand generation is gated by aiBiographyOnDemandEnabled.
        // In production this is off — the public page has already looked up
        // the cached record above, and if nothing came back we deliberately
        // do NOT fire a Claude call for a walk-in visitor. Cost is capped by
        // the pre-launch batch + admin-triggered regenerations. Dev / staging
        // flips this on to keep the previous "first hit generates" workflow
        // for prototyping.
        if (!config.aiBiographyOnDemandEnabled) {
          return h.response({}).code(204);
        }

        // In-flight deduplication
        if (inFlight.has(id)) {
          try {
            const infResult = await inFlight.get(id);
            if (!infResult) return h.response({}).code(204);
            return h.response(infResult).type('application/json').header('Cache-Control', CACHE_CONTROL);
          } catch (err) {
            return h.response({ error: 'Generation failed' }).code(503);
          }
        }

        const promise = generate(elastic, config, id);
        inFlight.set(id, promise);

        try {
          const result = await promise;
          if (!result) return h.response({}).code(204);
          return h.response(result).type('application/json').header('Cache-Control', CACHE_CONTROL);
        } catch (err) {
          console.error('AI Biography route error for', id,
            '- name:', err && err.name,
            '- message:', err && err.message,
            '- stack:', err && err.stack);
          return h.response({ error: 'Internal server error' }).code(500);
        }
      }
    }
  };
}

// Public "Report a problem" submission endpoint.
//
// Design decisions (see plan section 14):
//   - Feature-flagged via config.aiBiographyPublicFlagEnabled (kill switch).
//     404 when disabled.
//   - Structured reason only — no free-text field. Honeypot input catches
//     dumb bots. WAF rate limit handles the real abuse surface.
//   - Aggregate counters only (see lib/ai/flag-store.js). No individual
//     flag records, no IPs in DynamoDB.
//   - First flag on a `live` record auto-promotes status to `flagged`.
//     Matches the staff-flag behaviour for a unified triage queue.
//   - Cookie is set on successful submission so the button hides in-browser
//     for 24h. UX hint only — server doesn't rely on it.
function publicFlagRoute (config) {
  return {
    method: 'POST',
    path: '/ai/biography/{id}/flag',
    config: {
      auth: false,
      payload: {
        output: 'data',
        parse: true,
        allow: ['application/json', 'application/x-www-form-urlencoded']
      },
      handler: async function (request, h) {
        if (!config.aiBiographyEnabled || !config.aiBiographyPublicFlagEnabled) {
          return h.response({ error: 'Not found' }).code(404);
        }

        const id = request.params.id;
        if (!/^[a-z]{2}\d+$/i.test(id)) {
          return h.response({ error: 'Invalid ID format' }).code(400);
        }

        const payload = request.payload || {};

        // Honeypot: hidden field named `website` that only bots fill in.
        // Silently accept (so bot thinks it worked) but do nothing.
        if (payload.website) {
          return h.response({ ok: true }).code(200);
        }

        const reason = (payload.reason || '').toString();
        if (!flagStore.isValidReason(reason)) {
          return h.response({ error: 'Invalid reason' }).code(400);
        }

        if (!flagStore.isReady()) {
          return h.response({ error: 'Storage unavailable' }).code(503);
        }

        try {
          // Fetch the current canonical record so we know the generatedAt
          // to tag these flags against, and can auto-promote status=live.
          const record = await biographyStore.fetchBiography(id);
          if (!record) {
            // No biography to flag. Reject gracefully — the button shouldn't
            // have been rendered in this case.
            return h.response({ error: 'No biography for this record' }).code(404);
          }

          await flagStore.submitFlag(id, reason, record.generatedAt);

          // Auto-promote status on first actionable flag. Only from 'live';
          // stronger states (hidden, insufficient_data) stay intact.
          if (record.status === 'live') {
            await biographyStore.updateStatus(id, 'flagged');
          }

          // Set a short-lived cookie so the client hides the flag button
          // for this record for 24h. Pure UX — server-side rate-limiting
          // is WAF's job.
          const response = h.response({ ok: true });
          const isProduction = config.NODE_ENV === 'production';
          response.state('aiFlagged_' + id, '1', {
            ttl: 24 * 60 * 60 * 1000,
            isHttpOnly: false,
            isSameSite: 'Lax',
            isSecure: isProduction,
            encoding: 'none',
            path: '/'
          });
          return response;
        } catch (err) {
          console.error('Public flag submit error for', id, '-', err.message);
          return h.response({ error: 'Submission failed' }).code(500);
        }
      }
    }
  };
}

async function generate (elastic, config, id) {
  try {
    const esResult = await elastic.get({ index: config.elasticIndex || 'ciim', id: TypeMapping.toInternal(id) });
    const source = esResult.body._source;

    if (!source['@datatype'] || source['@datatype'].base !== 'agent') {
      return null;
    }

    const personData = extractPersonData(source);

    // Check existing description length threshold. The catalogue already
    // has a good-enough biography, so we skip AI generation entirely to
    // avoid polluting well-researched records with AI-written content.
    // Logged so "why did no biography appear for X?" has an answer in
    // the server logs without needing to reason through the check chain.
    if (personData.descriptionChars >= config.aiBiographyMaxExistingChars) {
      console.log('AI Biography: skipping', id,
        '— existing catalogue description is', personData.descriptionChars,
        'chars (threshold', config.aiBiographyMaxExistingChars + '). No AI needed.');
      return null;
    }

    // Fetch related items
    let sortedRelated = { relatedObjects: [], relatedDocuments: [] };
    try {
      const relatedItems = await getRelatedItems(elastic, id);
      sortedRelated = sortRelated(relatedItems, id);
    } catch (err) {
      console.debug('AI Biography: Could not fetch related items:', err.message);
    }

    const allItems = flattenRelated(sortedRelated, id);
    console.log('AI Biography: Related items for', id, '- objects:', (sortedRelated.relatedObjects || []).length, 'documents:', (sortedRelated.relatedDocuments || []).length, 'flattened:', allItems.length);

    // Fetch Wikidata properties directly from the API (single lightweight call)
    let wikidataContext = null;
    const qCode = normaliseWikidata.getQCode(personData.wikidata);
    if (qCode) {
      try {
        wikidataContext = await fetchWikidataLive(qCode);
        if (!wikidataContext) {
          console.warn('AI Biography: Wikidata fetch for', qCode, '(', id, ') returned no usable properties');
        } else {
          console.log('AI Biography: Wikidata fetch OK for', qCode, '(', id, ') - keys:', Object.keys(wikidataContext).join(', '));
        }
      } catch (err) {
        console.warn('AI Biography: Wikidata fetch failed for', qCode, '(', id, ') -', err.message);
      }
    } else if (personData.wikidata) {
      console.warn('AI Biography: Could not extract Q-code from wikidata value for', id, ':', JSON.stringify(personData.wikidata));
    } else {
      console.log('AI Biography: No wikidata field present on', id);
    }

    // Wikipedia summary — see regenerate-biography.js for rationale.
    // Default OFF as of 2026-07-17; adaptive-fetch gate when enabled.
    let wikipediaSummary = null;
    const wikipediaGate = fetchWikipediaSummary.shouldFetchWikipedia(config, personData, wikidataContext);
    if (wikipediaGate.fire) {
      try {
        wikipediaSummary = await fetchWikipediaSummary({
          qCode,
          subjectName: personData.name
        });
      } catch (err) {
        console.warn('AI Biography: Wikipedia fetch failed for', id, '-', err && err.message);
      }
    } else {
      console.debug('AI Biography:', id, 'Wikipedia skipped (' + wikipediaGate.reason + ')');
    }

    // ODNB — see regenerate-biography.js for rationale. Adapter is
    // self-gating on config + Wikidata P1415, so this always returns
    // null when we don't have credentials or the subject has no ODNB
    // entry.
    let odnbSummary = null;
    try {
      odnbSummary = await fetchOdnbSummary({
        config,
        wikidataContext
      });
    } catch (err) {
      console.warn('AI Biography: ODNB fetch failed for', id, '-', err && err.message);
    }

    // Grace's Guide — UK industrial history wiki. Public, gated on
    // Wikidata P3074.
    let gracesGuideSummary = null;
    if (config.aiBiographyGracesGuideEnabled !== false) {
      try {
        gracesGuideSummary = await fetchGracesGuideSummary({
          config,
          wikidataContext
        });
      } catch (err) {
        console.warn('AI Biography: Grace\'s Guide fetch failed for', id, '-', err && err.message);
      }
    }

    // Cross-source contradiction detection (structured facts only —
    // museum ↔ Wikidata). See lib/ai/regenerate-biography.js for the
    // shared explanation. Kill-switch:
    // aiBiographyContradictionDetectionEnabled=false.
    let contradictions = [];
    if (config.aiBiographyContradictionDetectionEnabled !== false) {
      try {
        contradictions = detectContradictions({
          personData,
          wikidataContext,
          wikipediaSummary,
          odnbSummary,
          gracesGuideSummary
        });
      } catch (err) {
        console.warn('AI Biography: contradiction detection failed for', id, '-', err && err.message);
        contradictions = [];
      }
    }

    // Classify the subject and inspect their living/deceased status. Both
    // travel with the canonical record — `subjectStatus` is what the public
    // route's living-person suppression reads when deciding whether to
    // serve the content.
    const subject = classifySubject(personData, wikidataContext);
    const subjStatus = subjectStatus.inspect(personData, wikidataContext, subject.noun);

    // Pre-flight data-sufficiency check — skip Claude entirely for records
    // with too little source data to produce a meaningful biography.
    const assessment = assessSufficiency.assess(
      personData, allItems, wikidataContext, config.aiBiographyMinSignals
    );
    if (!assessment.sufficient) {
      console.log('AI Biography: insufficient data for', id,
        '—', assessment.signalCount, '/', assessment.totalSignals,
        'signals, minimum score', assessment.minScore, 'required.');
      if (dynamo.isReady()) {
        await biographyStore.saveBiography(id, {
          status: 'insufficient_data',
          skipReason: assessSufficiency.skipReason(assessment),
          personName: personData.name,
          pageUrl: '/people/' + id,
          existingDescriptionChars: personData.descriptionChars,
          signalScore: assessment.score,
          signalMaxScore: assessment.maxScore,
          signalCount: assessment.signalCount,
          signalsPresent: assessment.present,
          signalsMissing: assessment.missing,
          subjectStatus: subjStatus
        });
      }
      return null;
    }

    // v2 source-tagged writer. Curator decisions (rejections + clarifications)
    // are fetched best-effort and injected into the writer prompt as
    // subject-specific constraints — for a fresh subject that's typically null,
    // for a subject the curator has already worked on it feeds prior decisions
    // back into the next generation. Diagnostics is an out-param object;
    // populated on failure and persisted to the record so a curator viewing
    // the failed record sees what actually ran instead of grepping logs.
    const curatorDecisions = await curatorDecisionsStore.get(id).catch(function () { return null; });
    const diagnostics = {};
    let result;
    try {
      result = await generateSourceTaggedBiography(personData, allItems, wikidataContext, {
        apiKey: config.anthropicApiKey,
        model: config.aiBiographyModel,
        curatorDecisions,
        diagnostics,
        wikipediaSummary,
        odnbSummary,
        gracesGuideSummary,
        contradictions,
        // See regenerate-biography.js — flags gate the writer's
        // selfReview output section AND the persisted shape below.
        enableSelfChecks: config.aiBiographyWriterSelfChecksEnabled !== false,
        enableAbstention: config.aiBiographyStructuredAbstentionEnabled !== false
      });
    } catch (err) {
      // v2 writer catches its own API errors internally and returns null with
      // a populated diagnostics object; anything that surfaces via `catch`
      // is unexpected. Log + swallow so a page hit doesn't 500.
      console.error('AI Biography: Unexpected error from v2 writer for', id, '-', err.message);
      return null;
    }

    if (!result) {
      // A null return from the v2 writer means either the API call failed
      // (network / API error surfaced via diagnostics.failureMode =
      // 'api_call_failed' — we WERE NOT billed there; the SDK caught the
      // error before sending), OR the API call succeeded but the response
      // content was unusable (empty body, unparseable JSON, wrong shape —
      // we WERE billed). Both are persisted here so the admin detail
      // page can distinguish them via the failure diagnostics block
      // shipped in Task 55, and either way subsequent page loads don't
      // re-issue the call.
      //
      // Staff can retry manually from the admin detail page via Regenerate
      // — they're paying attention, one retry is fine, and the manual click
      // gives them the feedback loop if the failure persists.
      //
      // Diagnostics fields (failureMode / rawResponse / model /
      // promptVersion / systemPrompt / prompt / parsedKeys / parseError)
      // are persisted so the admin detail view can show what actually
      // ran and what Claude produced. rawResponse is truncated to 4000
      // chars to avoid ballooning DynamoDB item size when a model
      // occasionally goes long. First 4KB is more than enough to
      // diagnose (schema mismatch, refusal, truncation all show in the
      // first paragraph or two).
      console.warn('AI Biography: Claude returned unusable content for', id,
        '— persisting as insufficient_data to prevent auto-retry burning tokens.',
        '· failureMode:', diagnostics.failureMode || 'unknown',
        '· promptVersion:', diagnostics.promptVersion || 'unknown');
      if (dynamo.isReady()) {
        await biographyStore.saveBiography(id, {
          status: 'insufficient_data',
          skipReason: 'Generation failed: Claude returned unusable content (see admin diagnostics for details)',
          personName: personData.name,
          pageUrl: '/people/' + id,
          existingDescriptionChars: personData.descriptionChars,
          signalScore: assessment.score,
          signalMaxScore: assessment.maxScore,
          signalCount: assessment.signalCount,
          signalsPresent: assessment.present,
          signalsMissing: assessment.missing,
          subjectStatus: subjStatus,
          // Failure diagnostics — mirrors success-path metadata (model,
          // promptVersion, systemPrompt, prompt) so the admin UI's
          // existing collapsibles work on failed records too.
          failureMode: diagnostics.failureMode || null,
          model: diagnostics.model || null,
          promptVersion: diagnostics.promptVersion || null,
          systemPrompt: diagnostics.systemPrompt || null,
          prompt: diagnostics.prompt || null,
          rawResponse: diagnostics.rawResponse ? String(diagnostics.rawResponse).slice(0, 4000) : null,
          parsedKeys: diagnostics.parsedKeys || null,
          parseError: diagnostics.parseError || null
        });
      }
      return null;
    }

    // v2 writer's confidence gate. Same 0–10 self-reported score; anything
    // at-or-below the threshold maps to insufficient_data. Threshold pinned
    // locally rather than imported from the v1 module — same semantics,
    // avoids a stale cross-module reference once the v1 writer is deleted.
    const V2_CONFIDENCE_INSUFFICIENT_AT_OR_BELOW = 2;
    if (result.confidence <= V2_CONFIDENCE_INSUFFICIENT_AT_OR_BELOW) {
      if (dynamo.isReady()) {
        await biographyStore.saveBiography(id, {
          status: 'insufficient_data',
          skipReason: 'Low confidence — not enough data for meaningful biography',
          personName: personData.name,
          pageUrl: '/people/' + id,
          existingDescriptionChars: personData.descriptionChars,
          sentences: result.sentences,
          paragraphBreaks: result.paragraphBreaks,
          writerConfidence: result.confidence,
          writerNotes: result.notes,
          verificationCandidates: result.verificationCandidates,
          model: result.model,
          promptVersion: result.promptVersion,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          signalScore: assessment.score,
          signalMaxScore: assessment.maxScore,
          signalCount: assessment.signalCount,
          signalsPresent: assessment.present,
          signalsMissing: assessment.missing,
          subjectStatus: subjStatus
        });
      }
      return null;
    }

    // Per-generation reviewer — runs after every successful writer call.
    // Feature-flagged on config.aiBiographyPerGenerationReviewEnabled
    // (distinct from aiBiographyReviewEnabled, which gates the Opus
    // manual escalation button — different reviewer, different model,
    // different cost profile). Defaults to true; curator can flip it off
    // if the reviewer's findings become noisy in production. Uses the
    // writer's model as fallback — the per-generation reviewer wants
    // Sonnet-tier cost, NOT Opus. Failure to review is non-fatal —
    // biography still saves and serves.
    let reviewResult = null;
    if (config.aiBiographyPerGenerationReviewEnabled !== false) {
      try {
        reviewResult = await reviewBiographyTagged(result, {
          apiKey: config.anthropicApiKey,
          model: config.aiBiographyModel,
          personData,
          gbpPerUsd: config.aiBiographyGbpPerUsd
        });
      } catch (err) {
        console.warn('AI Biography: per-generation review failed for', id, '-', err && err.message);
      }
    }

    // Derive `references` — { id, title, link } for every related item
    // any sentence cites via `sourceDetail: 'relatedItem:*'`. Stored on
    // the canonical BIOGRAPHY item so the render layer can build "→
    // view object" chips + the admin per-sentence Claims list can show
    // links, without a second Dynamo/ES round-trip.
    const references = deriveReferencesFromSentences(result.sentences, allItems, personData);

    // Save canonical v2 record. `biographyHtml` is intentionally NOT stored
    // — HTML is derived at render time from sentences + curator decisions
    // + open findings, so a subsequent curator action (approve / reject /
    // clarify) or filter-level tweak takes effect on the next page load
    // without a regen. `systemPrompt` / `prompt` / `rawResponse` DO land
    // on the record so the admin detail's collapsibles + the failure-
    // diagnostics audit trail have the actual prompts + raw Claude reply
    // available (regression from v1 flagged in Task 56 review).
    if (dynamo.isReady()) {
      await biographyStore.saveBiography(id, {
        status: 'live',
        personName: personData.name,
        pageUrl: '/people/' + id,
        existingDescriptionChars: personData.descriptionChars,
        sentences: result.sentences,
        paragraphBreaks: result.paragraphBreaks,
        writerConfidence: result.confidence,
        writerNotes: result.notes,
        verificationCandidates: result.verificationCandidates,
        // Writer self-review filtered against the same flags that
        // shaped the prompt — see filterSelfReview() below.
        selfReview: filterSelfReview(result.selfReview, config),
        // Cross-source contradictions surfaced pre-write. Empty array
        // when no disagreements or detection was disabled.
        contradictions,
        references,
        model: result.model,
        promptVersion: result.promptVersion,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        systemPrompt: result.systemPrompt || null,
        prompt: result.prompt || null,
        rawResponse: result.rawResponse || null,
        signalScore: assessment.score,
        signalMaxScore: assessment.maxScore,
        signalCount: assessment.signalCount,
        signalsPresent: assessment.present,
        signalsMissing: assessment.missing,
        subjectStatus: subjStatus
      });

      // Persist the review as a REVIEW# item alongside the canonical, so
      // it appears immediately on the admin detail page's open-findings
      // panel + reviews section without an extra round trip.
      if (reviewResult && Array.isArray(reviewResult.findings)) {
        try {
          await reviewStore.saveReview(id, {
            reviewedAt: new Date().toISOString(),
            reviewerModel: reviewResult.model,
            writerPromptVersion: result.promptVersion || null,
            writerModel: result.model || null,
            spend: reviewResult.spend,
            inputTokens: reviewResult.inputTokens,
            outputTokens: reviewResult.outputTokens,
            findings: reviewResult.findings
          });
        } catch (err) {
          console.warn('AI Biography: review-store save failed for', id, '-', err && err.message);
        }
      }
    }

    // Render-time suppression — applied to the freshly-generated result too,
    // not just the cached-retrieve path. If we skip this, the first visit
    // after a record is generated serves the biography once, and subsequent
    // visits hit the cached-record branch (which DOES suppress) and hide
    // it. Keeping the check in both paths gives consistent public behaviour
    // from the first load onwards.
    if (subjectStatus.isSuppressedOnPublicSite(subjStatus, config)) {
      return null;
    }

    // Render the sentence-tagged biography to public HTML. The findings we
    // just saved feed straight into the render layer — error:high findings
    // hide their sentence by default (defensive-by-default). Curator
    // decisions are the ones we just fetched at the top of this block.
    // References plumbed through so the render layer can append clickable
    // "In the collection" chips per cited object — restores v1's inline
    // object hyperlinking behaviour.
    const openFindings = (reviewResult && reviewResult.findings) || [];
    const rendered = renderBiography({
      sentences: result.sentences,
      paragraphBreaks: result.paragraphBreaks
    }, {
      decisions: curatorDecisions,
      openFindings,
      publishingLevel: config.aiBiographyPublishingLevel,
      references
    });

    return {
      // v2 splits main prose vs collection-object prose at render time
      // (Task 56). biographyHtml = "who / what / when" narrative;
      // contextHtml = "In the collection: bronze bust... solar eclipse
      // instruments...". Downstream templates render both blocks with
      // their own headings. `biography` kept as a synonym for
      // biographyHtml so any consumer that hasn't migrated stays happy.
      //
      // `references` deliberately NOT surfaced on the public payload —
      // the public /people/{id} page already lists related objects via
      // ES elsewhere, and every catalogue item cited in the AI prose
      // is reachable through inline anchors. The field lives on the DB
      // item so the admin Claims list can render per-sentence chips
      // without an ES lookup, but public API consumers don't need it.
      biography: rendered.biographyHtml,
      biographyHtml: rendered.biographyHtml,
      context: rendered.contextHtml,
      contextHtml: rendered.contextHtml,
      personName: personData.name,
      sources: deriveSourcesFromSentences(result.sentences),
      generatedAt: new Date().toISOString(),
      model: result.model,
      status: 'live',
      suppressExisting: personData.descriptionChars < config.aiBiographySuppressExistingChars,
      flagEnabled: !!config.aiBiographyPublicFlagEnabled
    };
  } finally {
    inFlight.delete(id);
  }
}
