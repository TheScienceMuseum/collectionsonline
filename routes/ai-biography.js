'use strict';

const TypeMapping = require('../lib/type-mapping');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');
const extractPersonData = require('../lib/ai/extract-person-data');
const generateBiography = require('../lib/ai/generate-biography');
const biographyStore = require('../lib/ai/biography-store');
const dynamo = require('../lib/ai/dynamo');
const normaliseWikidata = require('../lib/helpers/normalise-wikidata');
const fetchWikidataLive = require('../lib/ai/fetch-wikidata-live');
const assessSufficiency = require('../lib/ai/assess-sufficiency');
const classifySubject = require('../lib/ai/classify-subject');
const subjectStatus = require('../lib/ai/subject-status');
const flagStore = require('../lib/ai/flag-store');

const inFlight = new Map();

const CACHE_CONTROL = process.env.NODE_ENV === 'production'
  ? 'public, max-age=3600, stale-while-revalidate=86400'
  : 'no-cache, no-store';

// Truncate descriptions for prompt inclusion — 200 chars is enough for the LLM
// to understand the item without ballooning token costs.
const DESCRIPTION_MAX_CHARS = 200;

function truncateDescription (text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= DESCRIPTION_MAX_CHARS) return trimmed;
  return trimmed.slice(0, DESCRIPTION_MAX_CHARS).replace(/\s+\S*$/, '') + '…';
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
                return h.response({
                  biography: existing.biographyHtml,
                  context: existing.contextHtml,
                  personName: existing.personName,
                  references: existing.references,
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

    // Generate biography
    let result;
    try {
      result = await generateBiography(personData, allItems, wikidataContext, config.anthropicApiKey, config.aiBiographyModel);
    } catch (err) {
      if (err.isConfigError) {
        // Configuration error (bad model name, bad API key, malformed request).
        // Surface loudly — retries will never succeed until config is fixed.
        console.error('AI Biography: Configuration error for', id, '- status', err.statusCode, '-', err.message);
        console.error('AI Biography: Check config.aiBiographyModel and config.anthropicApiKey. Generation disabled until resolved.');
        return null;
      }
      if (err.isApiError) {
        // Transient API error (overload, timeout, network) — don't persist, allow retry next page load
        console.warn('AI Biography: Transient API error for', id, '-', err.message);
        return null;
      }
      throw err;
    }

    if (!result) {
      // A null return from generateBiography means the API call SUCCEEDED
      // (so we were billed) but the response content was unusable — empty
      // body, truncation, unparseable JSON, or missing the `biography` field.
      // Persist the record as insufficient_data with a specific skipReason
      // so subsequent page loads of this URL don't each trigger another
      // billed Claude call (a popular record's URL could otherwise burn a
      // meaningful amount of tokens repeating the same failure).
      //
      // Staff can retry manually from the admin detail page via Regenerate
      // — they're paying attention, one retry is fine, and the manual click
      // gives them the feedback loop if the failure persists.
      //
      // Contrast with NETWORK errors (caught + thrown as isApiError inside
      // generateBiography, handled above): those never reached Claude and
      // therefore weren't billed, so auto-retry on next page load is safe
      // and that path does NOT persist.
      console.warn('AI Biography: Claude returned unusable content for', id,
        '— persisting as insufficient_data to prevent auto-retry burning tokens. Check preceding log line for root cause; staff can Regenerate from admin if the failure was transient.');
      if (dynamo.isReady()) {
        await biographyStore.saveBiography(id, {
          status: 'insufficient_data',
          skipReason: 'Generation failed: Claude returned unusable content (see server logs)',
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

    // Check confidence — LLM's self-reported 0-10 score. Values at or below
    // the threshold map to insufficient_data.
    if (result.confidence <= generateBiography.CONFIDENCE_INSUFFICIENT_AT_OR_BELOW) {
      if (dynamo.isReady()) {
        await biographyStore.saveBiography(id, {
          status: 'insufficient_data',
          skipReason: 'Low confidence — not enough data for meaningful biography',
          personName: personData.name,
          pageUrl: '/people/' + id,
          existingDescriptionChars: personData.descriptionChars,
          biographyHtml: result.biographyHtml,
          contextHtml: result.contextHtml,
          model: result.model,
          promptVersion: result.promptVersion,
          confidence: result.confidence,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          prompt: result.prompt,
          systemPrompt: result.systemPrompt,
          references: result.references,
          sources: result.sources,
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

    // Save to DynamoDB
    if (dynamo.isReady()) {
      await biographyStore.saveBiography(id, {
        status: 'live',
        personName: personData.name,
        pageUrl: '/people/' + id,
        existingDescriptionChars: personData.descriptionChars,
        biographyHtml: result.biographyHtml,
        contextHtml: result.contextHtml,
        model: result.model,
        promptVersion: result.promptVersion,
        confidence: result.confidence,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        prompt: result.prompt,
        systemPrompt: result.systemPrompt,
        references: result.references,
        sources: result.sources,
        signalScore: assessment.score,
        signalMaxScore: assessment.maxScore,
        signalCount: assessment.signalCount,
        signalsPresent: assessment.present,
        signalsMissing: assessment.missing,
        subjectStatus: subjStatus
      });
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

    return {
      biography: result.biographyHtml,
      context: result.contextHtml,
      personName: personData.name,
      references: result.references,
      sources: result.sources,
      generatedAt: result.generatedAt,
      model: result.model,
      status: 'live',
      suppressExisting: personData.descriptionChars < config.aiBiographySuppressExistingChars,
      flagEnabled: !!config.aiBiographyPublicFlagEnabled
    };
  } finally {
    inFlight.delete(id);
  }
}
