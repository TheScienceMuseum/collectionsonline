const cache = require('../bin/cache');
const wbk = require('../lib/wikibase');

// Deduplicates concurrent fetches for the same Wikidata ID.
// Without this, concurrent requests for the same uncached ID each fire
// 50+ sub-calls to the Wikidata API independently.
const wikiInFlight = new Map();
const {
  nestedData,
  formatDate,
  extractNestedQCodeData,
  extraContext,
  batchFetchEntities,
  collectNestedQCodes,
  fetchImageMetadata
} = require('../lib/wikidataQueries');
const { setCache, fetchCache } = require('../lib/cached-wikidata');
const properties = require('../fixtures/wikibasePropertiesConfig');

function hasPropertyAction (property, action) {
  return action.some((item) => item[property] === true);
}

// Removes duplicate entries from a property's value array.
// Wikidata entities can hold many claims for the same award/membership (e.g. the BBC
// has 50+ separate P166 claims all resolving to "Peabody Awards"). We show each
// distinct label once. Items are keyed by their value field; object values (e.g. VIAF)
// are serialised with JSON.stringify so they deduplicate correctly too.
function dedupeValueArray (items) {
  if (!Array.isArray(items)) return items;
  const seen = new Set();
  return items.filter(item => {
    const key = typeof item.value === 'object'
      ? JSON.stringify(item.value)
      : item.value;
    if (key === undefined || key === null) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Property-type handler functions ─────────────────────────────────────────
// Each handler encapsulates the logic for one category of Wikidata property,
// eliminating the previous "set then immediately override" pattern in the loop.

function handleImageOrLogo (entities, qCode, property) {
  const value =
    entities[qCode].claims[property]?.[0]?.mainsnak?.datavalue?.value ?? null;
  if (!value) return null;
  const imgPath = value.replace(/ /g, '_');
  return `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${imgPath}`;
}

function handleDate (entities, qCode, label, property) {
  const hide = property === 'P569' || property === 'P570';
  const date = formatDate(entities, qCode, property);
  return { label, value: [{ value: date, ...(hide ? { hide: true } : {}) }] };
}

async function handleContextProperty (qualifiersArr, elastic, config, label, list, prefetchedEntities) {
  const context = await extraContext(qualifiersArr, elastic, config, list, prefetchedEntities);
  if (context.length > 0) {
    return { label, value: context };
  }
  return null;
}

async function handleNestedProperty (entities, qCode, property, label, elastic, config, flags, prefetchedEntities) {
  const { hide, relatedRequired, list } = flags;
  const nested = nestedData(entities, qCode, property);
  const value = await extractNestedQCodeData(nested, elastic, config, hide, relatedRequired, list, prefetchedEntities);
  return { ...(value ? { label } : {}), value };
}

// ─── Response builder ─────────────────────────────────────────────────────────

const wikidataConn = async (req) => {
  const { wikidata } = req.params;
  if (!wikidata) return null;
  try {
    return await wbk.getEntities(wikidata, ['en'], ['info', 'claims', 'labels', 'sitelinks'], 'json');
  } catch (error) {
    console.error('Error fetching entities:', error);
    return null;
  }
};

async function configResponse (qCode, entities, elastic, config) {
  const obj = {};

  // Pre-collect all nested Q-codes referenced in this entity's claims and qualifiers,
  // then batch-fetch them all in a single HTTP request. This replaces the previous
  // pattern of one network call per nested Q-code (up to 50+ for complex entities).
  const nestedQCodes = collectNestedQCodes(entities, qCode, properties);
  const prefetchedEntities = await batchFetchEntities(nestedQCodes);

  // Add Wikidata URL
  obj.wikidataUrl = {
    label: 'Wikidata',
    value: `https://www.wikidata.org/wiki/${qCode}`
  };

  await Promise.all(
    Object.entries(properties).map(async ([key, propConfig]) => {
      const { property, action } = propConfig;
      const label = key;

      if (!entities[qCode]?.claims?.[property]) return;

      if (property === 'P18' || property === 'P154') {
        obj[property] = handleImageOrLogo(entities, qCode, property);
      } else if (property === 'P569' || property === 'P570' || property === 'P571') {
        obj[property] = handleDate(entities, qCode, label, property);
      } else if (hasPropertyAction('context', action)) {
        const qualifiersArr = entities[qCode].claims[property];
        const list = hasPropertyAction('list', action);
        const result = await handleContextProperty(qualifiersArr, elastic, config, label, list, prefetchedEntities);
        if (result) obj[property] = result;
      } else if (hasPropertyAction('nest', action)) {
        const flags = {
          hide: hasPropertyAction('hide', action),
          relatedRequired: hasPropertyAction('displayLinked', action),
          list: hasPropertyAction('list', action)
        };
        obj[property] = await handleNestedProperty(entities, qCode, property, label, elastic, config, flags, prefetchedEntities);
      } else {
        // Generic scalar / Q-code property (no nest, no context)
        const valueObj = entities[qCode].claims[property][0]?.mainsnak.datavalue?.value;
        const hide = hasPropertyAction('hide', action);
        const relatedRequired = hasPropertyAction('displayLinked', action);
        const list = hasPropertyAction('list', action);
        const value = await extractNestedQCodeData(valueObj, elastic, config, hide, relatedRequired, list, prefetchedEntities);
        if (value && value.length > 0) {
          obj[property] = { label, value };
        }
      }
    })
  );

  // Fetch Wikimedia Commons metadata for whichever image will be displayed (P18 > P154).
  // Runs after the property loop so both P18 and P154 are already resolved.
  const imageFilename =
    entities[qCode]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value ||
    entities[qCode]?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
  if (imageFilename) {
    obj.imageMetadata = await fetchImageMetadata(imageFilename);
  }

  // Deduplicate every property's value array so repeated Wikidata claims for the same
  // label (e.g. 50× "Peabody Awards") collapse to a single entry.
  for (const key of Object.keys(obj)) {
    if (obj[key] && Array.isArray(obj[key].value)) {
      obj[key].value = dedupeValueArray(obj[key].value);
    }
  }

  // Wikipedia sitelink — store English Wikipedia URL if present.
  // Title uses underscores per Wikipedia URL convention.
  const enwiki = entities[qCode]?.sitelinks?.enwiki;
  if (enwiki && enwiki.title) {
    obj.wikipediaUrl = 'https://en.wikipedia.org/wiki/' + enwiki.title.replace(/ /g, '_');
  }

  return obj;
}

module.exports = (elastic, config) => ({
  method: 'get',
  path: '/wiki/{wikidata}',

  config: {
    handler: async (req, h) => {
      try {
        const { wikidata } = req.params;
        const { clear } = req.query;

        const cachedWikidataJson = await fetchCache(cache, wikidata, clear);

        if (cachedWikidataJson !== null && cachedWikidataJson !== undefined) {
          const { item } = cachedWikidataJson;
          return h
            .response(JSON.stringify(item))
            .type('application/json')
            .code(200);
        }

        // If a fetch for this ID is already in progress, await it rather
        // than firing a duplicate set of 50+ Wikidata sub-calls.
        const existing = wikiInFlight.get(wikidata);
        if (existing) {
          const result = await existing;
          if (!result) return h.response('Wikidata unavailable').code(503);
          return h.response(JSON.stringify(result)).type('application/json').code(200);
        }

        const dataPromise = (async () => {
          try {
            const data = await wikidataConn(req);
            const fetchResult = await fetch(data, { signal: AbortSignal.timeout(10000) })
              .then((res) => {
                if (!res.ok) {
                  console.error(`Wikidata API returned ${res.status} ${res.statusText} for ${wikidata}`);
                  return null;
                }
                return res.json();
              })
              .catch((err) => {
                console.error('Error parsing Wikidata response:', err);
                return null;
              });

            if (!fetchResult) return null;
            const { entities } = fetchResult;

            const result = await configResponse(wikidata, entities, elastic, config);

            const ttl = config.wikidataCacheTtl || 2629746000;
            await setCache(cache, wikidata, result, clear, ttl);

            return result;
          } finally {
            wikiInFlight.delete(wikidata);
          }
        })();

        wikiInFlight.set(wikidata, dataPromise);
        const result = await dataPromise;
        if (!result) return h.response('Wikidata unavailable').code(503);
        return h
          .response(JSON.stringify(result))
          .type('application/json')
          .code(200);
      } catch (error) {
        console.error('Error processing request:', error);
        return h.response('Internal Server Error').code(500);
      }
    }
  }
});
