const wbk = require('./wikibase');

// for extracting and configuring nested data only with text - excluding id and other properties
function extract (datavalue) {
  if (typeof datavalue === 'object' && datavalue.hasOwnProperty.call('text')) {
    if (datavalue.language === 'en') {
      return datavalue.text;
    }
  } else if (
    typeof datavalue === 'object' &&
    !datavalue.hasOwnProperty.call('text')
  ) {
    return undefined;
  } else {
    return datavalue;
  }
}

const qCodeArrConfig = ['P1559', 'P373', 'P1448', 'P39'];
const singleQCodeConfig = ['P1559', 'P1477', 'P373', 'P1448', 'P39'];

// utility function used in extractNestedQCodeData below
async function configureNestedData (
  qCodeData,
  qCodeReg,
  qCodeConfig,
  isMultipleQCodes = undefined
) {
  const claimsValues = [];

  if (qCodeReg) {
    const additionalDetails = await wbk.getEntities(
      qCodeData,
      'en',
      ['info', 'claims'],
      'json'
    );

    if (additionalDetails) {
      const { entities } = await fetch(additionalDetails)
        .then((response) => response.json())
        .catch((error) => console.error('Fetch error:', error));

      for (const qCodeKey of qCodeConfig) {
        const claimValue =
          entities[qCodeData]?.claims[qCodeKey]?.[0]?.mainsnak?.datavalue
            ?.value;
        if (claimValue && claimValue !== undefined) {
          claimsValues.push(extract(claimValue));
        }
      }
      // to flatten and dedupe nested data
      if (claimsValues.length > 1 && claimsValues !== undefined) {
        const flattenedClaimsValues = [].concat(...claimsValues);
        const uniqueClaimsValues = Array.from(
          new Set(flattenedClaimsValues.map((item) => item))
        );
        return uniqueClaimsValues.filter(Boolean);
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
  getImageUrl: async (data, qCode, key) => {
    const imageUrl = generateString(data, qCode, key);
    return imageUrl;
  },
  getLogo: async (data, qCode, key) => {
    const logoUrl = generateString(data, qCode, key);
    return logoUrl;
  },
  extractClaimValue (datavalue) {
    // configures data to return a specific property to avoid errors
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
  extractNestedQCodeData: async (qCode) => {
    const results = [];

    // regex captures QCodes and excludes images and dates that need extra config are configured separately
    const qCodeRegex = /^Q/i;
    const qCodeArr = Array.isArray(qCode);
    const singleQCode = !Array.isArray(qCode);

    // array of qCodes
    if (qCodeArr) {
      const promises = qCode.map(async (code) => {
        const isQCodeRegex = qCodeRegex.test(code.value);
        return configureNestedData(
          code.value,
          isQCodeRegex,
          qCodeArrConfig,
          qCodeArr
        );
      });
      results.push(await Promise.all(promises));
    } else if (singleQCode) {
      const isQCodeRegex = qCodeRegex.test(qCode);
      const singleQCodePromise = configureNestedData(
        qCode,
        isQCodeRegex,
        singleQCodeConfig
      );
      results.push(await Promise.resolve(singleQCodePromise));
    }
    return results.filter(Boolean);
  }
};
