'use strict';

const cache = require('../bin/cache');
const wbk = require('../lib/wikibase');
const { processPropertyValues } = require('../lib/wikiPropertySort');
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
// distinct label once.
// For context properties (e.g. employers, positions) items carry a clean `label` field
// alongside a `value` that includes date ranges. We key by `label` when present so that
// two claims for the same entity — one with dates, one without — collapse to one entry,
// keeping whichever has the richer (longer) value.
function dedupeValueArray (items) {
  if (!Array.isArray(items)) return items;
  const seen = new Map(); // key → index in result
  const result = [];
  for (const item of items) {
    const key = item.label
      ? String(item.label)
      : (item.value !== null && typeof item.value === 'object')
          ? JSON.stringify(item.value)
          : String(item.value ?? '');
    if (seen.has(key)) {
      // Prefer the entry with more context (e.g. one that includes a date range)
      const existingIdx = seen.get(key);
      if (String(item.value ?? '').length > String(result[existingIdx].value ?? '').length) {
        result[existingIdx] = item;
      }
    } else {
      seen.set(key, result.length);
      result.push(item);
    }
  }
  return result;
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

// ─── Colleagues lookup ────────────────────────────────────────────────────────
// For each employer Q-code (from P108 claims), runs a SPARQL query to find other
// humans who share the same employer, then cross-references with the ES collection
// to find those with collection records. Returns an array grouped by employer:
//   [{ employer: 'Science Museum Group', colleagues: [{ name, url }] }]
//
// Runs concurrently with the property loop so SPARQL latency is hidden.

// Extract a display-ready name from a raw ES _source document.
// Mirrors the system-aware logic in getValues.getTitle() so that Mimsy records
// (which store name.value in "Last, First" catalogue order) use summary.title
// (always natural display order), and AdLib person records are reconstructed
// from name.first + name.last.
// Mirrors getValues.getSystemName() — raw ES source values to canonical names
const SYSTEM_NAMES = { 'Mimsy XG': 'Mimsy', 'Adlib Archives': 'AdLib' };

function colleagueDisplayName (src) {
  const system = SYSTEM_NAMES[src && src['@admin'] && src['@admin'].source];
  const nameArr = src && src.name;

  if (system === 'Mimsy') {
    return (src.summary && src.summary.title) || (nameArr && nameArr[0] && nameArr[0].value);
  }

  if (system === 'AdLib') {
    const nameEntry = nameArr && nameArr[0];
    if (nameEntry && nameEntry.first) {
      const first = Array.isArray(nameEntry.first) ? nameEntry.first[0] : nameEntry.first;
      const last = nameEntry.last;
      return last ? (first + ' ' + last) : first;
    }
    return (src.summary && src.summary.title) || (nameEntry && nameEntry.value);
  }

  // Unknown/missing system — fall back to preferred-name logic
  return (nameArr && (nameArr.find(function (n) { return n.primary; }) || nameArr[0]) && (nameArr.find(function (n) { return n.primary; }) || nameArr[0]).value) || null;
}

async function fetchColleagues (employers, currentQCode, elastic, config, subjectBirthYear, subjectDeathYear) {
  if (!employers || employers.length === 0) return [];

  // Step 1: SPARQL query per employer, in parallel
  const sparqlResults = await Promise.allSettled(
    employers.map(async ({ qCode: employerQCode, label }) => {
      // Build optional lifetime-overlap filters.
      // A colleague overlaps with the subject iff:
      //   colleague born <= subject died  (colleague existed before subject died)
      //   colleague died >= subject born  (colleague was alive when subject was born)
      // We use OPTIONAL so that colleagues with no dates in Wikidata are still included.
      const dateFilters = [];
      if (subjectDeathYear) {
        dateFilters.push(
          '  OPTIONAL { ?item wdt:P569 ?born . }',
          `  FILTER(!bound(?born) || ?born <= "${subjectDeathYear}-12-31T00:00:00Z"^^xsd:dateTime)`
        );
      }
      if (subjectBirthYear) {
        dateFilters.push(
          '  OPTIONAL { ?item wdt:P570 ?died . }',
          `  FILTER(!bound(?died) || ?died >= "${subjectBirthYear}-01-01T00:00:00Z"^^xsd:dateTime)`
        );
      }
      const sparql = [
        'SELECT DISTINCT ?item WHERE {',
        `  ?item wdt:P108 wd:${employerQCode} ;`,
        '        wdt:P31 wd:Q5 .',
        ...dateFilters,
        '} LIMIT 500'
      ].join('\n');
      const url = wbk.sparqlQuery(sparql);
      const res = await fetchWithRetry(url, { signal: AbortSignal.timeout(10000) });
      if (!res) return { employerQCode, label, qCodes: [] };
      let json;
      try { json = await res.json(); } catch (e) { return { employerQCode, label, qCodes: [] }; }
      const qCodes = (json.results?.bindings || [])
        .map(b => b.item?.value?.match(/\/(Q\d+)$/)?.[1])
        .filter(Boolean)
        .filter(q => q !== currentQCode);
      return { employerQCode, label, qCodes };
    })
  );

  const employerData = sparqlResults
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(e => e.qCodes.length > 0);

  const allQCodes = [...new Set(employerData.flatMap(e => e.qCodes))];
  if (!allQCodes.length) return [];

  // Step 2: Single ES query — find which Q-codes are in the collection, fetch names
  const inCollection = new Map();
  try {
    const result = await elastic.search({
      index: 'ciim',
      body: {
        size: Math.min(allQCodes.length, 200),
        _source: ['wikidata', 'name', 'summary', '@admin'],
        query: {
          terms: {
            'wikidata.keyword': allQCodes.map(q => `https://www.wikidata.org/wiki/${q}`)
          }
        }
      }
    });
    for (const hit of (result.body.hits.hits || [])) {
      const m = (hit._source?.wikidata || '').match(/\/(Q\d+)$/);
      if (m) inCollection.set(m[1], hit);
    }
  } catch (err) {
    console.error('[wiki] ES error fetching colleague records:', err.message);
    return [];
  }

  if (!inCollection.size) return [];

  // Step 3: Group by employer, max 6 colleagues per employer
  return employerData
    .map(({ label, qCodes }) => {
      const colleagues = qCodes
        .filter(q => inCollection.has(q))
        .slice(0, 6)
        .map(q => {
          const hit = inCollection.get(q);
          const name = colleagueDisplayName(hit._source) || hit._id;
          return { name, url: `${config.rootUrl}/people/${hit._id}` };
        });
      return colleagues.length > 0 ? { employer: label, colleagues } : null;
    })
    .filter(Boolean);
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

  // Start colleagues lookup concurrently with the property loop.
  // Extracts employer Q-codes from P108 claims; SPARQL queries run in parallel
  // so their latency is hidden behind the property processing time.
  const p108Claims = entities[qCode]?.claims?.P108 || [];
  const employerQCodes = [...new Set(
    p108Claims
      .map(c => c?.mainsnak?.datavalue?.value?.id)
      .filter(id => id && /^Q\d+/.test(id))
  )];
  const employers = employerQCodes.map(q => ({
    qCode: q,
    label: prefetchedEntities?.[q]?.labels?.en?.value || q
  }));
  // Extract the subject's birth/death years to filter out temporally impossible colleagues.
  const subjectBirthStr = entities[qCode]?.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time;
  const subjectDeathStr = entities[qCode]?.claims?.P570?.[0]?.mainsnak?.datavalue?.value?.time;
  const subjectBirthYear = subjectBirthStr ? (subjectBirthStr.match(/^\+?(\d{4})/) || [])[1] : null;
  const subjectDeathYear = subjectDeathStr ? (subjectDeathStr.match(/^\+?(\d{4})/) || [])[1] : null;
  const colleaguesPromise = employers.length > 0
    ? fetchColleagues(employers, qCode, elastic, config, subjectBirthYear, subjectDeathYear)
    : Promise.resolve([]);

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

  // Await image metadata and colleagues (both started before the property loop).
  const [imageMetadata, colleagues] = await Promise.all([imageMetaPromise, colleaguesPromise]);
  obj.imageMetadata = imageMetadata;
  if (colleagues.length > 0) obj.colleagues = colleagues;

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

  // Sort and merge each property's value array (date-sort, range-merge, alpha).
  for (const key of Object.keys(obj)) {
    if (obj[key] && Array.isArray(obj[key].value)) {
      obj[key].value = processPropertyValues(obj[key].value);
    }
  }

  // "Also in our collection" — collect property values that have a related collection link.
  const alsoInCollection = [];
  for (const prop of Object.values(obj)) {
    if (!prop || !Array.isArray(prop.value)) continue;
    for (const v of prop.value) {
      if (v.related && v.value) {
        alsoInCollection.push({ name: String(v.label || v.value).trim(), url: v.related });
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

        if (!/^Q\d+$/i.test(wikidata)) {
          return h.response('Invalid Wikidata ID').code(400);
        }

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
                const ct = res.headers.get('content-type') || '';
                if (!ct.includes('application/json') && !ct.includes('text/javascript')) {
                  console.error(`[wiki] Wikidata returned non-JSON response (${ct}) for ${wikidata}`);
                  return null;
                }
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
