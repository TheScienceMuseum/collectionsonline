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

async function wikibaseCall (wikibaseEntities) {
  try {
    const { entities } = await fetch(wikibaseEntities)
      .then((response) => response.json())
      .catch((error) => console.error('Fetch error:', error));
    return entities;
  } catch (error) {
    console.error('Error configuring data', error);
  }
}
// utility function used in extractNestedQCodeData below
async function configureNestedData (
  qCodeData,
  isQCodeReg,
  isMultipleQCodes = undefined
) {
  let claimsValues = [];
  // excludes non qcode values, i.e dates and makes wikibase call
  if (isQCodeReg) {
    const additionalDetails = await wbk.getEntities(
      qCodeData,
      'en',
      ['info', 'claims', 'labels'],
      'json'
    );

    if (additionalDetails) {
      const entities = await wikibaseCall(additionalDetails);
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
  wikibaseCall,
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
      ('id' in datavalue || 'time' in datavalue || 'text' in datavalue)
    ) {
      return datavalue.id || datavalue.text || datavalue.time;
    } else {
      return datavalue;
    }
  },
  async positionHeld (qualifiersArr) {
    // for position held + qualifiers. N.B can be expanded to do further nesting, i.e value of value
    const positions = [];

    for (const qualifier of qualifiersArr) {
      const positionData = {};
      let entities;
      let positionHeld;
      const positionTitle = qualifier.mainsnak.datavalue.value.id;
      try {
        const companyDetails = await wbk.getEntities(
          positionTitle,
          'en',
          ['labels'],
          'json'
        );
        entities = await wikibaseCall(companyDetails);

        positionHeld = entities[positionTitle]?.labels?.en?.value;
      } catch (error) {
        console.error(`Error configuring data for ${qualifier}:`, error);
      }
      // Check for P642 (of) qualifier to determine the company/organization
      if (qualifier.qualifiers?.P642) {
        const qualifiersId =
          qualifier?.qualifiers?.P642?.[0]?.datavalue?.value?.id;
        const companyDetails = await wbk.getEntities(
          qualifiersId,
          'en',
          ['labels'],
          'json'
        );

        const companyEntities = await wikibaseCall(companyDetails);
        // find company label
        const company = companyEntities[qualifiersId]?.labels?.en?.value;
        // position + company as string
        positionData.position = `${positionHeld} at ${company}`;
        positions.push({ value: positionData.position });
      }
    }
    return positions;
  },
  formatDate (data, qCode, key) {
    const dateStr = data[qCode].claims[key][0].mainsnak.datavalue.value.time;
    const yearOnly = dateStr.match(/^\+(\d{4})-00-00/);
    if (yearOnly) return yearOnly[1];
    const date = new Date(dateStr.slice(1, -1));
    return isNaN(date.getTime()) ? null : date.toLocaleDateString('en-GB');
  },
  nestedData (data, qCode, key) {
    // used with nest flag to return array of nested data if exists
    // const nestedData = data[qCode].claims[key].map((k) => { value: k.mainsnak.datavalue?.value?.id });
    return data[qCode].claims[key].map((k) => ({
      value: k.mainsnak.datavalue?.value?.id
    }));
  },
  // extracts text values for QCodes passed in
  async extractNestedQCodeData (
    qCodeData,
    elastic,
    config,
    hide = false,
    relatedRequired = false
  ) {
    const results = [];
    const qCodeRegex = /^Q/i;
    const linkRegex = /^http/g;
    const hasDisplayLinkedFlag = relatedRequired;

    const processCode = async (code) => {
      if (!code) {
        return {};
      }
      // for values that aren't objects, or have properties that can't be configured like others
      let stringValue;
      if (typeof code === 'string') {
        stringValue = code;
      } else if (typeof code === 'object' && code !== null) {
        if ('text' in code) {
          stringValue = code.text;
        } else if ('time' in code) {
          return {};
        }
      }
      const isQCodeRegex = qCodeRegex.test(code?.value || code?.id);

      // check if related record with ES search
      const related = isQCodeRegex
        ? await relatedWikidata(elastic, code.value || code.id, undefined)
        : null;

      // nested items
      const nestedResult = await configureNestedData(
        code.value || code.id || code.text,
        isQCodeRegex
      );

      // if no related record and has wikidata config flag, hide from ui
      const hideFromUi = !related && hasDisplayLinkedFlag;
      // to build anchor tags to related records
      const link = related
        ? `${config.rootUrl}/people/${related?.[0]?._id}`
        : undefined;

      //
      return {
        ...(link ? { related: link } : {}),
        ...(hideFromUi
          ? {}
          : { value: nestedResult || stringValue?.text || stringValue }),
        ...(hide ? { hide: true } : {})
      };
    };

    if (linkRegex.test(qCodeData)) {
      return [{ value: qCodeData, ...(hide && { hide: true }) }];
    }
    // handles array parameters vs single values
    const qCodes = Array.isArray(qCodeData) ? qCodeData : [qCodeData];

    for (const code of qCodes) {
      const result = await processCode(code);
      if (result && result.value !== undefined) results.push(result);
    }
    return results.filter(Boolean);
  }
};