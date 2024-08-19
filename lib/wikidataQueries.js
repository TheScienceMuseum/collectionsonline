const wbk = require('./wikibase');
const relatedWikidata = require('./getWikidataRelated');
// for extracting and configuring nested data only with text - excluding id and other properties
function extract (datavalue) {
  if (typeof datavalue === 'object' && 'text' in datavalue) {
    if (datavalue.language === 'en') {
      return datavalue.text;
    }
  } else if (typeof datavalue === 'object' && 'text' in datavalue === false) {
    return undefined;
  } else {
    return datavalue;
  }
}

// utility function used in extractNestedQCodeData below
async function configureNestedData (
  qCodeData,
  qCodeReg,
  isMultipleQCodes = undefined
) {
  let claimsValues = [];
  // excludes non qcode values, i.e dates and makes wikibase call
  if (qCodeReg) {
    const additionalDetails = await wbk.getEntities(
      qCodeData,
      'en',
      ['info', 'claims', 'labels'],
      'json'
    );

    if (additionalDetails) {
      const { entities } = await fetch(additionalDetails)
        .then((response) => response.json())
        .catch((error) => console.error('Fetch error:', error));

      const claimValue = entities[qCodeData]?.labels?.en?.value;

      if (claimValue) {
        claimsValues = [...claimsValues, extract(claimValue)];
      }
    }
    return claimsValues.filter(Boolean)[0];
  }
}

function underscoredVal (val) {
  return val.replace(/ /g, '_');
}

// to generate path to either image or logo
function generateString (data, qCode, key) {
  const value =
    data[qCode].claims[key]?.[0]?.mainsnak?.datavalue?.value ?? null;
  const imgPath = value ? underscoredVal(value) : null;
  const imageUrl = imgPath
    ? `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${imgPath}`
    : null;
  return imageUrl;
}
module.exports = {
  configureNestedData,
  getImageUrl: async (data, qCode, key) => {
    const imageUrl = generateString(data, qCode, key);
    return imageUrl;
  },
  getLogo: async (data, qCode, key) => {
    const logoUrl = generateString(data, qCode, key);
    return logoUrl;
  },
  extractClaimValue (datavalue) {
    // configures data to return a specific property conditionally to avoid errors

    if (
      typeof datavalue === 'object' &&
      (datavalue.hasOwnProperty.call('id') ||
        datavalue.hasOwnProperty.call('time') ||
        datavalue.hasOwnProperty.call('text'))
    ) {
      return datavalue.id || datavalue.text || datavalue.time;
    } else {
      return datavalue;
    }
  },
  formatDate (data, qCode, key) {
    const date = data[qCode].claims[key][0].mainsnak.datavalue.value.time;
    const formattedDate = date.slice(1, date.length - 1);
    const newDate = new Date(formattedDate);
    const year = newDate.getFullYear();
    const month = newDate.getMonth() + 1;
    const day = newDate.getDate();
    return `${day}/${month}/${year}`;
  },
  nestedData (data, qCode, key) {
    // used with nest flag to return array of nested data if exists
    const nestedData = data[qCode].claims[key].map((k) => k);

    const value = nestedData.map((k) => {
      const { id: value } = k.mainsnak.datavalue.value;
      return { value };
    });
    return value;
  },
  // extracts text values for QCodes passed in
  extractNestedQCodeData: async (qCodeData, elastic, config, hide = false) => {
    let results = [];
    // regex captures QCodes and excludes images and dates that need extra config are configured separately
    const qCodeRegex = /^Q/i;
    const qCodeArr = Array.isArray(qCodeData);
    const singleQCode = !Array.isArray(qCodeData);
    // array of qCodes
    if (qCodeArr) {
      const promises = qCodeData.map(async (code) => {
        let related;
        const isQCodeRegex = qCodeRegex.test(code.value);
        if (isQCodeRegex) {
          // Elasticsearch lookup for related records
          related = await relatedWikidata(elastic, code.value, undefined);
        }
        const nestedResult = await configureNestedData(
          code.value,
          isQCodeRegex,
          qCodeArr
        );
        const link = related
          ? `${config.rootUrl}/people/${related?.[0]?._id}`
          : undefined;

        return {
          ...(link ? { related: link } : {}),
          value: nestedResult,
          ...(hide ? { hide: true } : {})
        };
      });
      const resolvedPromises = await Promise.all(promises);

      results = [...resolvedPromises];
    } else if (singleQCode) {
      const isQCodeRegex = qCodeRegex.test(qCodeData?.id);

      // for extracting links
      const linkRegex = /^http/g;
      if (linkRegex.exec(qCodeData)) {
        const externalLink = qCodeData;
        return [
          {
            value: externalLink,
            ...(hide ? { hide: true } : {})
          }
        ];
      }

      const singleQCodePromise = await configureNestedData(
        qCodeData?.id,
        isQCodeRegex
      );
      const related = await relatedWikidata(elastic, qCodeData?.id, undefined);
      const singleQCode = await singleQCodePromise;
      // defensive check for undefined values
      if (singleQCode === undefined) {
        return;
      }

      const link = related
        ? `${config.rootUrl}/people/${related?.[0]?._id}`
        : undefined;

      const result = {
        ...(link ? { related: link } : {}),
        value: singleQCode,
        ...(hide ? { hide: true } : {})
      };
      results = [...results, result];
    }

    return results.filter((r) => r.value !== undefined);
  }
};
