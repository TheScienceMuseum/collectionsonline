'use strict';

const TypeMapping = require('../lib/type-mapping');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');
const extractPersonData = require('../lib/ai/extract-person-data');
const generateBiography = require('../lib/ai/generate-biography');
const biographyStore = require('../lib/ai/biography-store');
const dynamo = require('../lib/ai/dynamo');
const normaliseWikidata = require('../lib/helpers/normalise-wikidata');

const inFlight = new Map();

const CACHE_CONTROL = process.env.NODE_ENV === 'production'
  ? 'public, max-age=3600, stale-while-revalidate=86400'
  : 'no-cache, no-store';

function flattenRelated (sortedRelated, personId) {
  const items = [];
  const objects = sortedRelated.relatedObjects || [];
  const documents = sortedRelated.relatedDocuments || [];

  objects.forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      link: item.links ? item.links.self : '/objects/' + item.id,
      type: 'object',
      role: item.role || ''
    });
  });

  documents.forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      link: item.links ? item.links.self : '/documents/' + item.id,
      type: 'document',
      role: item.role || ''
    });
  });

  return items;
}

module.exports = function (elastic, config) {
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

        // Check DynamoDB for existing biography
        if (dynamo.isReady()) {
          try {
            const cached = await biographyStore.fetchBiography(id);
            if (cached) {
              return h.response({
                biography: cached.biographyHtml,
                context: cached.contextHtml,
                personName: cached.personName,
                references: cached.references,
                sources: cached.sources,
                sourcesSummary: cached.sourcesSummary,
                generatedAt: cached.generatedAt,
                model: cached.model,
                status: cached.status,
                suppressExisting: cached.existingDescriptionChars < config.aiBiographySuppressExistingChars
              }).type('application/json').header('Cache-Control', CACHE_CONTROL);
            }

            // Check if we already recorded insufficient_data
            const existing = await biographyStore.fetchBiographyAny(id);
            if (existing && existing.status === 'insufficient_data') {
              return h.response({}).code(204);
            }
          } catch (err) {
            console.warn('AI Biography: DynamoDB fetch failed:', err.message);
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
          console.error('AI Biography route error:', err.message);
          return h.response({ error: 'Internal server error' }).code(500);
        }
      }
    }
  };
};

async function generate (elastic, config, id) {
  try {
    const esResult = await elastic.get({ index: config.elasticIndex || 'ciim', id: TypeMapping.toInternal(id) });
    const source = esResult.body._source;

    if (!source['@datatype'] || source['@datatype'].base !== 'agent') {
      return null;
    }

    const personData = extractPersonData(source);

    // Check existing description length threshold
    if (personData.descriptionChars >= config.aiBiographyMaxExistingChars) {
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
      } catch (err) {
        console.debug('AI Biography: Wikidata fetch failed for', qCode, '-', err.message);
      }
    }

    // Generate biography
    let result;
    try {
      result = await generateBiography(personData, allItems, wikidataContext, config.anthropicApiKey);
    } catch (err) {
      if (err.isApiError) {
        // Transient API error (overload, timeout, network) — don't persist, allow retry next page load
        console.warn('AI Biography: Transient API error for', id, '-', err.message);
        return null;
      }
      throw err;
    }

    if (!result) {
      // Record insufficient data (only for genuine data issues, not API failures)
      if (dynamo.isReady()) {
        await biographyStore.saveBiography(id, {
          status: 'insufficient_data',
          skipReason: 'Generation returned null — insufficient input data',
          personName: personData.name,
          pageUrl: '/people/' + id,
          existingDescriptionChars: personData.descriptionChars
        });
      }
      return null;
    }

    // Check confidence
    if (result.confidence === 'low') {
      if (dynamo.isReady()) {
        await biographyStore.saveBiography(id, {
          status: 'insufficient_data',
          skipReason: 'Low confidence — not enough data for meaningful biography',
          personName: personData.name,
          pageUrl: '/people/' + id,
          existingDescriptionChars: personData.descriptionChars,
          biographyHtml: result.biographyHtml,
          contextHtml: result.contextHtml,
          sourcesSummary: result.sourcesSummary,
          model: result.model,
          promptVersion: result.promptVersion,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          prompt: result.prompt,
          systemPrompt: result.systemPrompt,
          references: result.references,
          sources: result.sources
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
        sourcesSummary: result.sourcesSummary,
        model: result.model,
        promptVersion: result.promptVersion,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        prompt: result.prompt,
        systemPrompt: result.systemPrompt,
        references: result.references,
        sources: result.sources
      });
    }

    return {
      biography: result.biographyHtml,
      context: result.contextHtml,
      personName: personData.name,
      references: result.references,
      sources: result.sources,
      sourcesSummary: result.sourcesSummary,
      generatedAt: result.generatedAt,
      model: result.model,
      status: 'live',
      suppressExisting: personData.descriptionChars < config.aiBiographySuppressExistingChars
    };
  } finally {
    inFlight.delete(id);
  }
}

/**
 * Fetch basic Wikidata entity properties directly from the API.
 * Lightweight alternative to the full /wiki route — just gets key facts
 * for the AI prompt (description, notable work, field of work, etc).
 */
async function fetchWikidataLive (qCode) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
    '&ids=' + qCode + '&languages=en&props=labels|descriptions|claims|sitelinks&format=json';

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data.entities && data.entities[qCode];
    if (!entity) return null;

    const result = {};
    const desc = entity.descriptions && entity.descriptions.en;
    if (desc) result.description = { value: desc.value };

    // Extract key claims as simple label/value pairs
    const claimProps = {
      P106: 'occupation',
      P27: 'country of citizenship',
      P69: 'educated at',
      P108: 'employer',
      P101: 'field of work',
      P800: 'notable work',
      P166: 'awards received',
      P463: 'member of',
      P1412: 'languages spoken'
    };

    Object.keys(claimProps).forEach(function (prop) {
      const claims = entity.claims && entity.claims[prop];
      if (!claims || !claims.length) return;

      const values = claims.slice(0, 5).map(function (claim) {
        const snak = claim.mainsnak;
        if (!snak || !snak.datavalue) return null;
        if (snak.datavalue.type === 'wikibase-entityid') {
          return snak.datavalue.value.id;
        }
        if (snak.datavalue.type === 'string') {
          return snak.datavalue.value;
        }
        return null;
      }).filter(Boolean);

      if (values.length) {
        result[claimProps[prop]] = { value: values.join(', ') };
      }
    });

    // Resolve Q-code values to labels in a single batch
    const qCodes = [];
    Object.keys(result).forEach(function (key) {
      if (!result[key] || !result[key].value) return;
      const matches = result[key].value.match(/Q\d+/g);
      if (matches) qCodes.push.apply(qCodes, matches);
    });

    if (qCodes.length > 0) {
      try {
        const labelUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
          '&ids=' + qCodes.slice(0, 50).join('|') + '&languages=en&props=labels&format=json';
        const labelRes = await fetch(labelUrl, { signal: controller.signal });
        if (labelRes.ok) {
          const labelData = await labelRes.json();
          const labels = {};
          Object.keys(labelData.entities || {}).forEach(function (id) {
            const label = labelData.entities[id].labels && labelData.entities[id].labels.en;
            if (label) labels[id] = label.value;
          });

          // Replace Q-codes with labels
          Object.keys(result).forEach(function (key) {
            if (!result[key] || !result[key].value) return;
            result[key].value = result[key].value.replace(/Q\d+/g, function (q) {
              return labels[q] || q;
            });
          });
        }
      } catch (err) {
        // Label resolution failed — Q-codes will remain, which is fine
      }
    }

    // Wikipedia URL
    const enwiki = entity.sitelinks && entity.sitelinks.enwiki;
    if (enwiki) {
      result.wikipediaUrl = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(enwiki.title.replace(/ /g, '_'));
    }

    return Object.keys(result).length > 0 ? result : null;
  } finally {
    clearTimeout(timeout);
  }
}
