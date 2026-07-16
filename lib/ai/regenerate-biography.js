'use strict';

// Shared regeneration pipeline.
//
// Extracted from routes/admin-ai.js so the same code path serves both the
// admin "Regenerate" button and the bulk-regen CLI (scripts/bulk-regen.js).
//
// The flow mirrors the public route (routes/ai-biography.js) but is
// admin-triggered rather than page-hit — we always regenerate, we always
// persist, we don't apply living-person suppression at generation time
// (that's a render-time concern).
//
// Opts:
//   useCache        — when true, plumbs `useCache: true` through to the
//                     writer + reviewer wrappers. Batch runs turn this on;
//                     one-off admin regens leave it off (see the writer
//                     wrapper for the 25% cold-write premium rationale).
//   bulkGenerateBatch  — optional identifier tagged onto the persisted
//                     BIOGRAPHY item. Batch runs pass a timestamp so the
//                     canonical record has an audit breadcrumb for which
//                     batch produced it.
//
// Returns a summary object regardless of whether Claude was called:
//   {
//     id,
//     status,                // 'live' | 'insufficient_data'
//     skippedByAssessment,   // true when we bailed pre-Claude on data-sufficiency
//     writer: { inputTokens, outputTokens, cacheCreationTokens,
//               cacheReadTokens, model, promptVersion, confidence } | null,
//     reviewer: { inputTokens, outputTokens, cacheCreationTokens,
//                 cacheReadTokens, model, findingsCount, spend } | null,
//     bulkGenerateBatch
//   }
// Throws on transient writer errors — callers decide whether to retry or
// record the failure. Persistent-failure diagnostics land on the
// BIOGRAPHY item and don't throw (mirrors the routes behaviour).

const TypeMapping = require('../type-mapping');
const getRelatedItems = require('../get-related-items');
const sortRelated = require('../sort-related-items');
const extractPersonData = require('./extract-person-data');
const generateSourceTaggedBiography = require('./generate-source-tagged-biography');
const reviewBiographyTagged = require('./review-biography-tagged');
const biographyStore = require('./biography-store');
const curatorDecisionsStore = require('./curator-decisions-store');
const reviewStore = require('./review-store');
const normaliseWikidata = require('../helpers/normalise-wikidata');
const fetchWikidataLive = require('./fetch-wikidata-live');
const fetchWikipediaSummary = require('./fetch-wikipedia-summary');
const fetchOdnbSummary = require('./fetch-odnb-summary');
const assessSufficiency = require('./assess-sufficiency');
const classifySubject = require('./classify-subject');
const subjectStatus = require('./subject-status');

const filterSelfReview = require('./filter-self-review');

const DESCRIPTION_MAX_CHARS = 200;

function truncateDescription (text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= DESCRIPTION_MAX_CHARS) return trimmed;
  return trimmed.slice(0, DESCRIPTION_MAX_CHARS).replace(/\s+\S*$/, '') + '…';
}

function flattenRelated (sortedRelated) {
  const items = [];
  (sortedRelated.relatedObjects || []).forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      description: truncateDescription(item.attributes && item.attributes.description),
      link: item.links ? item.links.self : '/objects/' + item.id,
      type: 'object',
      role: item.role || ''
    });
  });
  (sortedRelated.relatedDocuments || []).forEach(function (item) {
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

// Walk every sentence's `sourceDetail` AND `citations[]` for
// `relatedItem:coXXXX` / `relatedPerson:cpXXXX` references, look each up
// in the flattened related-items list (objects/documents) or
// personData.relatedPeople (people/organisations), dedupe on ID. The
// returned array becomes the `references[]` field on the BIOGRAPHY item —
// so the admin Claims list can render "🏛️ Statue of Hygeia" and
// "👤 Asklepios (father)" without a fresh ES lookup at read time.
//
// IMPORTANT: earlier versions of this function only walked `sourceDetail`
// and only extracted `relatedItem:` — persons never made it in, and any
// item the writer cited via `citations[]` but not via sourceDetail was
// silently dropped. Old records still have that incomplete data on disk;
// a regen refreshes them.
function deriveReferencesFromSentences (sentences, relatedItems, personData) {
  if (!Array.isArray(sentences) || sentences.length === 0) return [];

  const itemsById = Object.create(null);
  (relatedItems || []).forEach(function (item) {
    if (item && item.id) itemsById[item.id.toLowerCase()] = item;
  });
  const peopleById = Object.create(null);
  ((personData && personData.relatedPeople) || []).forEach(function (p) {
    if (p && p.id) peopleById[p.id.toLowerCase()] = p;
  });

  const out = [];
  const seen = new Set();

  // Extract every id-carrying reference token from a text source (either
  // a sourceDetail string or a citation.field). Yields lowercase
  // `relatedItem:coXXXX` / `relatedPerson:cpXXXX` matches to the caller.
  function extractRefs (text, yield_) {
    if (typeof text !== 'string' || !text.trim()) return;
    text.split(/[,;]/).forEach(function (piece) {
      const trimmed = piece.trim().toLowerCase();
      if (trimmed.indexOf('relateditem:') === 0) {
        yield_('object', trimmed.slice('relateditem:'.length));
      } else if (trimmed.indexOf('relatedperson:') === 0) {
        yield_('person', trimmed.slice('relatedperson:'.length));
      }
    });
  }

  sentences.forEach(function (s) {
    if (!s) return;
    const collect = function (kind, refId) {
      if (!refId || seen.has(kind + ':' + refId)) return;
      seen.add(kind + ':' + refId);
      if (kind === 'object') {
        const item = itemsById[refId];
        if (!item) return;
        out.push({
          id: item.id,
          title: item.title || '',
          link: item.link || null,
          type: item.type || 'object'
        });
      } else if (kind === 'person') {
        const person = peopleById[refId];
        if (!person) return;
        out.push({
          id: person.id,
          title: person.name || '',
          link: person.link || null,
          type: 'person',
          role: person.role || null
        });
      }
    };
    extractRefs(s.sourceDetail, collect);
    // Structured citations — extract IDs from the field prefix (that's
    // where the ID lives; c.title / c.name might already carry it but
    // we don't rely on validator enrichment for the derivation because
    // old records won't have it).
    (Array.isArray(s.citations) ? s.citations : []).forEach(function (c) {
      if (!c || typeof c.field !== 'string') return;
      const f = c.field.toLowerCase();
      if (f.indexOf('relateditem:') === 0) collect('object', f.slice('relateditem:'.length));
      else if (f.indexOf('relatedperson:') === 0) collect('person', f.slice('relatedperson:'.length));
    });
  });

  return out;
}

async function regenerateBiography (elastic, config, id, opts) {
  opts = opts || {};
  const useCache = !!opts.useCache;
  const bulkGenerateBatch = opts.bulkGenerateBatch || null;

  const esResult = await elastic.get({
    index: config.elasticIndex || 'ciim',
    id: TypeMapping.toInternal(id)
  });
  const source = esResult.body._source;
  const personData = extractPersonData(source);

  let sortedRelated = { relatedObjects: [], relatedDocuments: [] };
  try {
    const relatedItems = await getRelatedItems(elastic, id);
    sortedRelated = sortRelated(relatedItems, id);
  } catch (err) {
    console.debug('regenerate-biography: could not fetch related items for', id, '-', err.message);
  }

  const allItems = flattenRelated(sortedRelated);

  let wikidataContext = null;
  const qCode = normaliseWikidata.getQCode(personData.wikidata);
  if (qCode) {
    try {
      wikidataContext = await fetchWikidataLive(qCode);
    } catch (err) {
      console.warn('regenerate-biography: Wikidata fetch failed for', qCode, '(', id, ') -', err.message);
    }
  }

  // Wikipedia summary — narrative-prose complement to Wikidata's
  // structured claims. Non-fatal on failure (network / no article /
  // ambiguous name): writer proceeds with museum + Wikidata only.
  // Off-by-default kill switch bypasses the fetch entirely.
  let wikipediaSummary = null;
  if (config.aiBiographyWikipediaEnabled !== false) {
    try {
      wikipediaSummary = await fetchWikipediaSummary({
        qCode,
        subjectName: personData.name
      });
    } catch (err) {
      console.warn('regenerate-biography: Wikipedia fetch failed for', id, '-', err && err.message);
    }
  }

  // ODNB entry — peer-reviewed British biographical prose. Adapter
  // returns null when the flag is off, when credentials aren't in
  // config, or when the subject has no Wikidata P1415 (ODNB ID).
  // Cost / rate-limit-friendly by construction: no P1415 → no fetch.
  let odnbSummary = null;
  try {
    odnbSummary = await fetchOdnbSummary({
      config,
      wikidataContext
    });
  } catch (err) {
    console.warn('regenerate-biography: ODNB fetch failed for', id, '-', err && err.message);
  }

  const subject = classifySubject(personData, wikidataContext);
  const subjStatus = subjectStatus.inspect(personData, wikidataContext, subject.noun);

  // Pre-flight data-sufficiency check. Skip the Claude call entirely for
  // records without enough signal.
  const assessment = assessSufficiency.assess(
    personData, allItems, wikidataContext, config.aiBiographyMinSignals
  );
  if (!assessment.sufficient) {
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
      subjectStatus: subjStatus,
      bulkGenerateBatch
    });
    return {
      id,
      status: 'insufficient_data',
      skippedByAssessment: true,
      writer: null,
      reviewer: null,
      bulkGenerateBatch
    };
  }

  const useModel = config.aiBiographyModel;
  const curatorDecisions = await curatorDecisionsStore.get(id).catch(function () { return null; });

  const diagnostics = {};
  let result;
  try {
    result = await generateSourceTaggedBiography(personData, allItems, wikidataContext, {
      apiKey: config.anthropicApiKey,
      model: useModel,
      curatorDecisions,
      diagnostics,
      useCache,
      // Wikipedia summary flows in as `opts.wikipediaSummary`. null
      // when the flag is off or the fetch failed; prompt just skips
      // the section in that case.
      wikipediaSummary,
      // ODNB summary flows similarly; null when off / no credentials
      // / no ODNB entry for the subject.
      odnbSummary,
      // Feature flags gate the writer's `selfReview` output section.
      // Defaults are ON (both config keys default `!== 'false'`), so
      // absent config still gets the full self-review shape.
      enableSelfChecks: config.aiBiographyWriterSelfChecksEnabled !== false,
      enableAbstention: config.aiBiographyStructuredAbstentionEnabled !== false
    });
  } catch (err) {
    console.error('regenerate-biography: unexpected error from v2 writer for', id, '-', err.message);
    throw new Error('Generation failed: ' + err.message);
  }

  if (!result) {
    // Writer returned null: either the API call failed (SDK caught the
    // error — not billed) OR the response was unusable (billed). Same
    // policy as the routes: do NOT overwrite a healthy live record with
    // insufficient_data on a transient blip. Throw so the caller can
    // record the failure and move on.
    console.warn('regenerate-biography: writer returned null for', id,
      '· failureMode:', diagnostics.failureMode || 'unknown',
      '· promptVersion:', diagnostics.promptVersion || 'unknown');
    throw new Error('Generation returned null (' + (diagnostics.failureMode || 'unknown') + ')');
  }

  const V2_CONFIDENCE_INSUFFICIENT_AT_OR_BELOW = 2;
  const status = result.confidence <= V2_CONFIDENCE_INSUFFICIENT_AT_OR_BELOW
    ? 'insufficient_data'
    : 'live';

  let reviewResult = null;
  if (config.aiBiographyPerGenerationReviewEnabled !== false) {
    try {
      reviewResult = await reviewBiographyTagged(result, {
        apiKey: config.anthropicApiKey,
        model: config.aiBiographyModel,
        personData,
        gbpPerUsd: config.aiBiographyGbpPerUsd,
        useCache
      });
    } catch (err) {
      console.warn('regenerate-biography: per-generation review failed for', id, '-', err && err.message);
    }
  }

  const references = deriveReferencesFromSentences(result.sentences, allItems, personData);

  await biographyStore.saveBiography(id, {
    status,
    personName: personData.name,
    pageUrl: '/people/' + id,
    existingDescriptionChars: personData.descriptionChars,
    sentences: result.sentences,
    paragraphBreaks: result.paragraphBreaks,
    writerConfidence: result.confidence,
    writerNotes: result.notes,
    verificationCandidates: result.verificationCandidates,
    // Writer self-review — filtered against the same flags that gate
    // the prompt sections. Guarantees the stored shape never gets
    // ahead of what the writer was actually asked to emit.
    selfReview: filterSelfReview(result.selfReview, config),
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
    subjectStatus: subjStatus,
    bulkGenerateBatch,
    skipReason: status === 'insufficient_data'
      ? 'Low confidence (writer self-reported ' + result.confidence + '/10) on regeneration'
      : undefined
  });

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
      console.warn('regenerate-biography: review-store save failed for', id, '-', err && err.message);
    }
  }

  return {
    id,
    status,
    skippedByAssessment: false,
    writer: {
      inputTokens: result.inputTokens || 0,
      outputTokens: result.outputTokens || 0,
      cacheCreationTokens: result.cacheCreationTokens || 0,
      cacheReadTokens: result.cacheReadTokens || 0,
      model: result.model,
      promptVersion: result.promptVersion,
      confidence: result.confidence
    },
    reviewer: reviewResult
      ? {
          inputTokens: reviewResult.inputTokens || 0,
          outputTokens: reviewResult.outputTokens || 0,
          cacheCreationTokens: reviewResult.cacheCreationTokens || 0,
          cacheReadTokens: reviewResult.cacheReadTokens || 0,
          model: reviewResult.model,
          findingsCount: (reviewResult.findings || []).length,
          spend: reviewResult.spend
        }
      : null,
    bulkGenerateBatch
  };
}

module.exports = regenerateBiography;
module.exports.deriveReferencesFromSentences = deriveReferencesFromSentences;
module.exports.flattenRelated = flattenRelated;
