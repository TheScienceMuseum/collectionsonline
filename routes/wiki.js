const wbk = require('../lib/wikibase');
const {
  getImageUrl,
  getLogo,
  extractClaimValue,
  nestedData,
  formatDate,
  extractNestedQCodeData
} = require('../lib/wikidataQueries');
const qCodes = require('../fixtures/wikibaseQCodes');

// handles nested flags on fields
function hasNestAction (action) {
  return action.some((item) => item.nest === true);
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
    const props = ['info', 'claims'];
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

      if (entities[qCode].claims[q]) {
        // default value on which the relevant properties are extracted from conditionally
        const valueObj =
          entities[qCode].claims[q][0]?.mainsnak.datavalue?.value;
        const value = await extractClaimValue(valueObj);
        // handles nested data (arrays of values)
        if (hasNestAction(action)) {
          const nested = await nestedData(entities, qCode, q);
          const value = await extractNestedQCodeData(nested, elastic, config);

          obj[q] = {
            ...(value ? { label } : ''),
            value
          };
        } else {
          // single values
          const transformedVal = await extractNestedQCodeData(
            value,
            elastic,
            config
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
        } else if (q === 'P569') {
          const date = formatDate(entities, qCode, q);
          obj[q] = { label, value: [{ value: date }], action };
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

        const data = await wikidataConn(req);
        const { entities } = await fetch(data).then((res) => res.json());
        const result = await configResponse(
          wikidata,
          entities,
          elastic,
          config
        );
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
