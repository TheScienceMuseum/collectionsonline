const cache = require('../bin/cache');

const wbk = require('../lib/wikibase');
const {
  getImageUrl,
  getLogo,
  extractClaimValue,
  nestedData,
  formatDate,
  extractNestedQCodeData
} = require('../lib/wikidataQueries');
const { setCache, fetchCache } = require('../lib/cached-wikidata');
const qCodes = require('../fixtures/wikibaseQCodes');

// handles action flags on fields, can pass in relevant action

function hasPropertyAction (property, action) {
  return action.some((item) => item[property] === true);
}

const wikidataConn = async (req, h) => {
  const { wikidata } = req.params;

  try {
    if (!wikidata) {
      h.response('No wikidata supplied').code(404);
      return null;
    }

    let entities;
    const languages = ['en'];
    const props = ['info', 'claims', 'labels'];
    const format = 'json';
    try {
      entities = await wbk.getEntities(wikidata, languages, props, format);
      return entities;
    } catch (error) {
      console.error('Error fetching entities:', error);
      return h.response('Error fetching entities').code(500);
    }
  } catch (error) {
    console.error('There was an error:', error);
    return h.response('Internal Server Error').code(500);
  }
};

async function configResponse (qCode, entities, elastic, config) {
  const obj = {};
  // iterates over qCodes config
  await Promise.all(
    Object.entries(qCodes).map(async ([key, value]) => {
      const { qCode: q, action } = value;

      const label = key;

      if (entities[qCode]?.claims?.[q]) {
        // default value on which the relevant properties are extracted from conditionally
        const valueObj =
          entities[qCode].claims[q][0]?.mainsnak.datavalue?.value;
        const value = await extractClaimValue(valueObj);

        // handles nested data (arrays of values)
        if (hasPropertyAction('nest', action)) {
          // does it have a hide prop - to be hidden from the UI, but included in json
          const hide = hasPropertyAction('hide', action);
          const nested = await nestedData(entities, qCode, q);

          const value = await extractNestedQCodeData(
            nested,
            elastic,
            config,
            hide
          );
          obj[q] = {
            ...(value ? { label } : ''),
            value
          };
        } else {
          // single values
          const hide = hasPropertyAction('hide', action);

          const transformedVal = await extractNestedQCodeData(
            value,
            elastic,
            config,
            hide
          );
          if (transformedVal) {
            obj[q] = {
              ...(transformedVal ? { label } : ''),
              value: transformedVal
            };
          }
        }

        // QCodes that need special configuration
        if (q === 'P18') {
          const imgUrl = await getImageUrl(entities, qCode, q);
          obj[q] = imgUrl;
        } else if (q === 'P154') {
          const logoUrl = await getLogo(entities, qCode, q);
          obj[q] = logoUrl;
        } else if (q === 'P569' || q === 'P570') {
          const date = formatDate(entities, qCode, q);
          obj[q] = { label, value: [{ value: date, hide: true }] };
        } else if (q === 'P571') {
          const date = formatDate(entities, qCode, q);
          obj[q] = { label, value: [{ value: date }] };
        }
      }
    })
  );
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

        if (cachedWikidataJson !== null) {
          const { item } = cachedWikidataJson;
          return h
            .response(JSON.stringify(item))
            .type('application/json')
            .code(200);
        }

        const data = await wikidataConn(req);
        const { entities } = await fetch(data).then((res) => res.json());
        const result = await configResponse(
          wikidata,
          entities,
          elastic,
          config
        );

        await setCache(cache, wikidata, result);

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
