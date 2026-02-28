const cache = require('../bin/cache');
const wbk = require('../lib/wikibase');

// Deduplicates concurrent fetches for the same Wikidata ID.
// Without this, concurrent requests for the same uncached ID each fire
// 50+ sub-calls to the Wikidata API independently.
const wikiInFlight = new Map();
const {
  getImageUrl,
  getLogo,
  extractClaimValue,
  nestedData,
  formatDate,
  extractNestedQCodeData,
  extraContext,
  formatViaf
} = require('../lib/wikidataQueries');
const { setCache, fetchCache } = require('../lib/cached-wikidata');
const properties = require('../fixtures/wikibasePropertiesConfig');

// Simple logger function
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(`[${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
};

function hasPropertyAction (property, action) {
  return action.some((item) => item[property] === true);
}

const wikidataConn = async (req, h) => {
  const { wikidata } = req.params;

  try {
    if (!wikidata) {
      log('No wikidata ID supplied');
      return h.response('No wikidata supplied').code(404);
    }

    const languages = ['en'];
    const props = ['info', 'claims', 'labels'];
    const format = 'json';

    try {
      log(`Initiating Wikidata connection for ID: ${wikidata}`);
      const entities = await wbk.getEntities(wikidata, languages, props, format);
      log(`Successfully connected to Wikidata for ID: ${wikidata}`);
      return entities;
    } catch (error) {
      log(`Error fetching entities for ID: ${wikidata}`, error);
      console.error('Error fetching entities:', error);
      return null;
    }
  } catch (error) {
    log('General error in wikidataConn function', error);
    console.error('There was an error:', error);
    return null;
  }
};

async function configResponse (qCode, entities, elastic, config) {
  const obj = {};
  log(`Starting to parse response for QCode: ${qCode}`);

  // Add Wikidata URLs
  obj.wikidataUrl = {
    label: 'Wikidata',
    value: `https://www.wikidata.org/wiki/${qCode}`
  };

  await Promise.all(
    Object.entries(properties).map(async ([key, value]) => {
      const { property, action } = value;
      const label = key;
      if (entities[qCode]?.claims?.[property]) {
        const valueObj =
          entities[qCode].claims[property][0]?.mainsnak.datavalue?.value;
        let finalValue;

        if (typeof valueObj === 'string') {
          if (/^Q\d+$/.test(valueObj)) {
            log(`Processing nested QCode reference: ${valueObj}`);
            finalValue = await extractNestedQCodeData(
              valueObj,
              elastic,
              config,
              false
            );
          } else {
            finalValue = [{ value: valueObj }];
          }
        } else if (typeof valueObj === 'object' && valueObj !== null) {
          finalValue = await extractClaimValue(valueObj);
        }

        if (finalValue) {
          obj[property] = {
            ...(finalValue ? { label } : ''),
            value: finalValue
          };
        }

        const furtherContext = hasPropertyAction('context', action);
        const list = hasPropertyAction('list', action);

        if (hasPropertyAction('nest', action)) {
          const hide = hasPropertyAction('hide', action);
          const nested = await nestedData(entities, qCode, property);
          const relatedRequired = hasPropertyAction('displayLinked', action);
          const value = await extractNestedQCodeData(
            nested,
            elastic,
            config,
            hide,
            relatedRequired,
            list
          );
          obj[property] = {
            ...(value ? { label } : ''),
            value
          };
        } else {
          const hide = hasPropertyAction('hide', action);
          const relatedRequired = hasPropertyAction('displayLinked', action);
          const value = await extractNestedQCodeData(
            valueObj,
            elastic,
            config,
            hide,
            relatedRequired,
            list
          );
          if (value) {
            obj[property] = {
              ...(value ? { label } : ''),
              value
            };
          }
        }

        if (property === 'P18') {
          const imgUrl = await getImageUrl(entities, qCode, property);
          obj[property] = imgUrl;
          log('Processed image URL for property P18');
        } else if (property === 'P154') {
          const logoUrl = await getLogo(entities, qCode, property);
          obj[property] = logoUrl;
          log('Processed logo URL for property P154');
        } else if (property === 'P569' || property === 'P570') {
          const date = formatDate(entities, qCode, property);
          obj[property] = { label, value: [{ value: date, hide: true }] };
          log(`Processed date for property ${property}`);
        } else if (property === 'P571') {
          const date = formatDate(entities, qCode, property);
          obj[property] = { label, value: [{ value: date }] };
          log('Processed date for property P571');
        } else if (property === 'P214') {
          const viafString = await formatViaf(entities, qCode, property);
          obj[property] = { label, value: [{ value: { viaf: viafString } }] };
          log('Processed VIAF for property P214');
        } else if (furtherContext) {
          const qualifiersArr = entities[qCode].claims[property];
          const context = await extraContext(
            qualifiersArr,
            elastic,
            config,
            list
          );

          if (context.length > 0) {
            obj[property] = { label, value: context };
            log(`Added context for property ${property}`);
          }
        }
      }
    })
  );

  log(`Successfully parsed response for QCode: ${qCode}`);
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

        // log(`Checking cache for Wikidata ID: ${wikidata}`);
        const cachedWikidataJson = await fetchCache(cache, wikidata, clear);

        if (cachedWikidataJson !== null && cachedWikidataJson !== undefined) {
          const { item } = cachedWikidataJson;
          // log(`Retrieved from cache for Wikidata ID: ${wikidata}`);
          return h
            .response(JSON.stringify(item))
            .type('application/json')
            .code(200);
        }

        log(`No cache found, fetching from Wikidata for ID: ${wikidata}`);

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
              .then((res) => res.json())
              .catch((err) => {
                log(`Error parsing Wikidata response for ID: ${wikidata}`, err);
                console.error(err);
                return null;
              });

            if (!fetchResult) return null;
            const { entities } = fetchResult;

            log(`Processing Wikidata response for ID: ${wikidata}`);
            const result = await configResponse(wikidata, entities, elastic, config);

            log(`Storing in cache for Wikidata ID: ${wikidata}`);
            await setCache(cache, wikidata, result, clear);

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
        log('Error processing request', error);
        console.error('Error processing request:', error);
        return h.response('Internal Server Error').code(500);
      }
    }
  }
});
