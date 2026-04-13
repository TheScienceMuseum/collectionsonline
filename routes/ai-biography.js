'use strict';

const TypeMapping = require('../lib/type-mapping');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');
const extractPersonData = require('../lib/ai/extract-person-data');
const generateBiography = require('../lib/ai/generate-biography');
const biographyStore = require('../lib/ai/biography-store');
const dynamo = require('../lib/ai/dynamo');
const cache = require('../bin/cache');
const normaliseWikidata = require('../lib/helpers/normalise-wikidata');

const inFlight = new Map();

const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';

function flattenRelated (sortedRelated, personId) {
  const items = [];
  const objects = sortedRelated.object || [];
  const documents = sortedRelated.archive || [];

  objects.forEach(function (item) {
    items.push({
      id: item.id,
      title: item.title || item.name || '',
      link: item.links ? item.links.self : '/objects/' + item.id,
      type: 'object',
      role: item.role || ''
    });
  });

  documents.forEach(function (item) {
    items.push({
      id: item.id,
      title: item.title || item.name || '',
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
    let sortedRelated = { object: [], archive: [] };
    try {
      const relatedItems = await getRelatedItems(elastic, id);
      sortedRelated = sortRelated(relatedItems, id);
    } catch (err) {
      console.debug('AI Biography: Could not fetch related items:', err.message);
    }

    const allItems = flattenRelated(sortedRelated, id);

    // Try to get cached wikidata
    let wikidataCache = null;
    const qCode = normaliseWikidata.getQCode(personData.wikidata);
    if (qCode) {
      try {
        const fetchWikiCache = require('../lib/cached-wikidata').fetchCache;
        wikidataCache = await fetchWikiCache(cache, qCode);
      } catch (err) {
        // Wikidata cache miss is fine
      }
    }

    // Generate biography
    const result = await generateBiography(personData, allItems, wikidataCache, config.anthropicApiKey);

    if (!result) {
      // Record insufficient data
      if (dynamo.isReady()) {
        await biographyStore.saveBiography(id, {
          status: 'insufficient_data',
          skipReason: 'Generation returned null — insufficient input data or API error',
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
