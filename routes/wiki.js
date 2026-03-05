'use strict';

const cache = require('../bin/cache');
const wbk = require('../lib/wikibase');
const wikidataCircuitBreaker = require('../lib/wikidata-circuit-breaker');

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
const { batchRelatedWikidata } = require('../lib/getWikidataRelated');

const WIKIDATA_USER_AGENT = 'CollectionsOnline/1.0 (https://collection.sciencemuseumgroup.org.uk; web.team@sciencemuseum.ac.uk)';
const CACHE_CONTROL_HEADER = 'public, max-age=3600, stale-while-revalidate=86400';

// Fixed set of external identifier properties rendered as a dedicated block at the
// bottom of the Wikidata panel. Order here determines display order.
const EXTERNAL_IDENTIFIER_CONFIG = [
  { property: 'P3029', label: 'National Archive', urlTemplate: 'https://discovery.nationalarchives.gov.uk/details/c/' },
  { property: 'P3074', label: 'Graces Guide', urlTemplate: 'https://www.gracesguide.co.uk/' },
  { property: 'P1415', label: 'Oxford DNB', urlTemplate: 'https://www.oxforddnb.com/view/article/' },
  { property: 'P214', label: 'VIAF', urlTemplate: 'https://viaf.org/viaf/' }
];

// Checks whether a string flag is present in a property's action array.
// action arrays are plain string arrays, e.g. ['nest', 'display', 'list'].
function hasPropertyAction (property, action) {
  return action.includes(property);
}

// Removes duplicate entries from a property's value array.
// Wikidata entities can hold many claims for the same award/membership (e.g. the BBC
// has 50+ separate P166 claims all resolving to "Peabody Awards"). We show each
// distinct label once. Items are keyed by their string value field; object values
// are serialised with JSON.stringify so they deduplicate correctly too.
function dedupeValueArray (items) {
  if (!Array.isArray(items)) return items;
  const seen = new Set();
  return items.filter(item => {
    const key = (item.value !== null && typeof item.value === 'object')
      ? JSON.stringify(item.value)
      : String(item.value ?? '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Retry with exponential back-off on HTTP 429. Any other non-ok status or network
// error returns null immediately so the caller can log and return a 503.
async function fetchWithRetry (url, opts, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        ...opts,
        headers: { 'User-Agent': WIKIDATA_USER_AGENT, ...(opts && opts.headers) }
      });
    } catch (err) {
      console.error('Wikidata fetch error:', err.message);
      return null;
    }
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10);
      const delayMs = (retryAfter || (1 << attempt)) * 1000;
      console.warn(`Wikidata 429 — retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      continue;
    }
    if (!res.ok) {
      console.error(`Wikidata API returned ${res.status} ${res.statusText} for ${url}`);
      return null;
    }
    return res;
  }
  console.error('Wikidata 429 — max retries exceeded');
  return null;
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

async function handleContextProperty (qualifiersArr, elastic, config, label, list, prefetchedEntities, relatedMap) {
  const context = await extraContext(qualifiersArr, elastic, config, list, prefetchedEntities, relatedMap);
  if (context.length > 0) {
    return { label, value: context };
  }
  return null;
}

async function handleNestedProperty (entities, qCode, property, label, elastic, config, flags, prefetchedEntities, relatedMap) {
  const { hide, relatedRequired, list } = flags;
  const nested = nestedData(entities, qCode, property);
  const value = await extractNestedQCodeData(nested, elastic, config, hide, relatedRequired, list, prefetchedEntities, relatedMap);
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
  // then batch-fetch their labels in a single HTTP request and look them up in ES
  // with a single terms query — replaces the previous pattern of N individual calls.
  const nestedQCodes = collectNestedQCodes(entities, qCode, properties);
  const prefetchedEntities = await batchFetchEntities(nestedQCodes);
  const relatedMap = await batchRelatedWikidata(elastic, nestedQCodes);

  // Start image metadata fetch before the property loop — the filename is known
  // as soon as the primary entity arrives (P18 > P154). Awaited after the loop.
  const imageFilename =
    entities[qCode]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value ||
    entities[qCode]?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
  const imageMetaPromise = imageFilename
    ? fetchImageMetadata(imageFilename)
    : Promise.resolve(null);

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
        const result = await handleContextProperty(qualifiersArr, elastic, config, label, list, prefetchedEntities, relatedMap);
        if (result) obj[property] = result;
      } else if (hasPropertyAction('nest', action)) {
        const flags = {
          hide: hasPropertyAction('hide', action),
          relatedRequired: hasPropertyAction('displayLinked', action),
          list: hasPropertyAction('list', action)
        };
        obj[property] = await handleNestedProperty(entities, qCode, property, label, elastic, config, flags, prefetchedEntities, relatedMap);
      } else {
        // Generic scalar / Q-code property (no nest, no context)
        const valueObj = entities[qCode].claims[property][0]?.mainsnak.datavalue?.value;
        const hide = hasPropertyAction('hide', action);
        const relatedRequired = hasPropertyAction('displayLinked', action);
        const list = hasPropertyAction('list', action);
        const value = await extractNestedQCodeData(valueObj, elastic, config, hide, relatedRequired, list, prefetchedEntities, relatedMap);
        if (value && value.length > 0) {
          obj[property] = { label, value };
        }
      }
    })
  );

  // Await image metadata (started before property loop for parallelism).
  obj.imageMetadata = await imageMetaPromise;

  // Deduplicate every property's value array so repeated Wikidata claims for the same
  // label (e.g. 50× "Peabody Awards") collapse to a single entry.
  for (const key of Object.keys(obj)) {
    if (obj[key] && Array.isArray(obj[key].value)) {
      obj[key].value = dedupeValueArray(obj[key].value);
    }
  }

  // Product and Notable Work search links — link each label to a collection search.
  for (const prop of ['P1056', 'P800']) {
    if (obj[prop] && Array.isArray(obj[prop].value)) {
      obj[prop].value = obj[prop].value.map(v =>
        v.value ? { ...v, searchUrl: `/search?q=${encodeURIComponent(v.value)}` } : v
      );
    }
  }

  // "Also in our collection" — collect property values that have a related collection link.
  const alsoInCollection = [];
  for (const prop of Object.values(obj)) {
    if (!prop || !Array.isArray(prop.value)) continue;
    for (const v of prop.value) {
      if (v.related && v.value) {
        alsoInCollection.push({ name: String(v.value).trim(), url: v.related });
      }
    }
  }
  // Dedupe by URL before storing
  const dedupedAlso = [...new Map(alsoInCollection.map(x => [x.url, x])).values()];
  if (dedupedAlso.length) obj.alsoInCollection = dedupedAlso;

  // External identifiers — fixed set rendered as a dedicated block, not regular properties.
  const externalIds = EXTERNAL_IDENTIFIER_CONFIG.reduce((acc, { property, label, urlTemplate }) => {
    const value = entities[qCode]?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
    if (value) acc.push({ label, value, url: urlTemplate + value });
    return acc;
  }, []);
  if (externalIds.length) obj.externalIdentifiers = externalIds;

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

        const cachedWikidataJson = await fetchCache(cache, wikidata);

        if (cachedWikidataJson !== null && cachedWikidataJson !== undefined) {
          const { item } = cachedWikidataJson;
          return h
            .response(JSON.stringify(item))
            .type('application/json')
            .code(200)
            .header('Cache-Control', CACHE_CONTROL_HEADER);
        }

        // If a fetch for this ID is already in progress, await it rather
        // than firing a duplicate set of 50+ Wikidata sub-calls.
        const existing = wikiInFlight.get(wikidata);
        if (existing) {
          const result = await existing;
          if (!result) return h.response('Wikidata unavailable').code(503);
          return h.response(JSON.stringify(result)).type('application/json').code(200)
            .header('Cache-Control', CACHE_CONTROL_HEADER);
        }

        const dataPromise = (async () => {
          try {
            const data = await wikidataConn(req);

            // Wrap primary entity fetch in circuit breaker + retry with back-off.
            // On sustained outages the circuit opens and subsequent requests fail fast
            // rather than queuing 50+ failing Wikidata sub-calls.
            let fetchResult;
            try {
              fetchResult = await wikidataCircuitBreaker.call(async () => {
                const res = await fetchWithRetry(data, { signal: AbortSignal.timeout(10000) });
                if (!res) return null;
                return res.json();
              });
            } catch (err) {
              // Circuit is open — fail fast
              console.warn('[wiki] Circuit breaker open:', err.message);
              return null;
            }

            if (!fetchResult) return null;
            const { entities } = fetchResult;

            const result = await configResponse(wikidata, entities, elastic, config);

            const ttl = config.wikidataCacheTtl || 2629746000;
            await setCache(cache, wikidata, result, undefined, ttl);

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
          .code(200)
          .header('Cache-Control', CACHE_CONTROL_HEADER);
      } catch (error) {
        console.error('Error processing request:', error);
        return h.response('Internal Server Error').code(500);
      }
    }
  }
});
