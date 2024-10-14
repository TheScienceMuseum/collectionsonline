const cache = require('../bin/cache');

const wbk = require('../lib/wikibase');
const {
  getImageUrl,
  getLogo,
  extractClaimValue,
  nestedData,
  formatDate,
  extractNestedQCodeData,
  extraContext
} = require('../lib/wikidataQueries');
const { setCache, fetchCache } = require('../lib/cached-wikidata');
const properties = require('../fixtures/wikibasePropertiesConfig');

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

  // iterates over properties config
  await Promise.all(
    Object.entries(properties).map(async ([key, value]) => {
      const { property, action } = value;
      const label = key;
      if (entities[qCode]?.claims?.[property]) {
        // default value on which the relevant properties are extracted from conditionally
        const valueObj =
          entities[qCode].claims[property][0]?.mainsnak.datavalue?.value;
        let finalValue;

        // most values brought back are objects, but a few are directly strings
        if (typeof valueObj === 'string') {
          if (/^Q\d+$/.test(valueObj)) {
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

        // For dates and extra information
        const furtherContext = hasPropertyAction('context', action);

        // Handling nested data that needs extra configuration
        if (hasPropertyAction('nest', action)) {
          const hide = hasPropertyAction('hide', action);
          const nested = await nestedData(entities, qCode, property);
          const relatedRequired = hasPropertyAction('displayLinked', action);
          const value = await extractNestedQCodeData(
            nested,
            elastic,
            config,
            hide,
            relatedRequired
          );

          obj[property] = {
            ...(value ? { label } : ''),
            value
          };
        } else {
          // single values
          const hide = hasPropertyAction('hide', action);
          const relatedRequired = hasPropertyAction('displayLinked', action);
          const value = await extractNestedQCodeData(
            valueObj,
            elastic,
            config,
            hide,
            relatedRequired
          );

          if (value) {
            obj[property] = {
              ...(value ? { label } : ''),
              value
            };
          }
        }

        // Properties that need special configuration
        if (property === 'P18') {
          const imgUrl = await getImageUrl(entities, qCode, property);
          obj[property] = imgUrl;
        } else if (property === 'P154') {
          const logoUrl = await getLogo(entities, qCode, property);
          obj[property] = logoUrl;
        } else if (property === 'P569' || property === 'P570') {
          const date = formatDate(entities, qCode, property);
          obj[property] = { label, value: [{ value: date, hide: true }] };
        } else if (property === 'P571') {
          const date = formatDate(entities, qCode, property);
          obj[property] = { label, value: [{ value: date }] };
        } else if (furtherContext) {
          // for position held + qualifiers. N.B can be expanded to do further nesting, i.e value of value
          const qualifiersArr = entities[qCode].claims[property];
          const context = await extraContext(qualifiersArr, elastic, config);

          if (context.length > 0) {
            obj[property] = { label, value: context };
          }
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
        // ! note when clearing cache with postman, the item is set again immediately below unless commented out
        const { clear } = req.query;
        const cachedWikidataJson = await fetchCache(cache, wikidata, clear);

        if (cachedWikidataJson !== null && cachedWikidataJson !== undefined) {
          const { item } = cachedWikidataJson;
          return h
            .response(JSON.stringify(item))
            .type('application/json')
            .code(200);
        }

        const data = await wikidataConn(req);
        const { entities } = await fetch(data)
          .then((res) => res.json())
          .catch((err) => console.error(err));
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
