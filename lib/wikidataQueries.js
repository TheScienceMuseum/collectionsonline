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
function contextDateStringFormatter (
  dateOne = undefined,
  dateTwo = undefined,
  formatType
) {
  return `${
    dateOne !== undefined || dateTwo !== undefined ? `${formatType}` : ''
  }`;
}
// for building string for extra field context
function contextString (
  company = undefined,
  position = undefined,
  dateOne = undefined,
  dateTwo = undefined
) {
  // position + company as string
  const positionPrefix = position
    ? `${position}${contextDateStringFormatter(dateOne, dateTwo, ',')}`
    : '';
  const companySuffix = position && company ? ` ${company}` : '';
  const dateRange = `${contextDateStringFormatter(dateOne, dateTwo, '(')} ${
    dateOne ? `${dateOne}` : ''
  } ${dateOne && dateTwo ? '-' : ''} ${
    dateTwo ? `${dateTwo}` : ''
  }${contextDateStringFormatter(dateOne, dateTwo, ')')}`;
  return `${positionPrefix} ${companySuffix} ${dateRange}`.trim();
}
function formatDate (data, qCode = undefined, key = undefined) {
  const dateStr =
    data[qCode]?.claims?.[key]?.[0].mainsnak.datavalue.value.time || data;
  const yearOnly = dateStr.match(/^\+(\d{4})-00-00/);
  if (yearOnly) return yearOnly[1];
  const date = new Date(dateStr.slice(1, -1));
  return isNaN(date.getTime()) ? null : date.toLocaleDateString('en-GB');
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

async function extractClaimValue (datavalue) {
  // configures data to return a specific property conditionally to avoid errors
  if (
    typeof datavalue === 'object' &&
    ('id' in datavalue || 'time' in datavalue || 'text' in datavalue)
  ) {
    return datavalue.id || datavalue.text || datavalue.time;
  } else {
    return datavalue;
  }
}

function underscoredVal (val) {
  return val.replace(/ /g, '_');
}

// To pull out qualifiers data
async function qualifiersData (qualifiers) {
  if (!qualifiers || typeof qualifiers !== 'object') {
    return [];
  }

  // simplifies json
  const reducedQualifiers = await Object.entries(qualifiers).reduce(
    async (promise, [key, value]) => {
      const acc = await promise;
      const qualifierValue = await extractClaimValue(value[0].datavalue.value);
      acc[key] = qualifierValue;
      return acc;
    },
    {}
  );
  return Object.entries(reducedQualifiers).map(async ([key, value]) => {
    const startsWith = 'Q';
    // targets dates only
    if (typeof value === 'string' && !value.startsWith(startsWith)) {
      return contextFormatDate(formatDate(value));
    }
    return null;
  });
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

function contextFormatDate (date) {
  if (date !== null && typeof date !== 'object') {
    if (date.includes('/')) {
      const d = date.split('/');
      return d[d.length - 1];
    }
  }
  return date;
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
  extractClaimValue,
  async extraContext (qualifiersArr, elastic, config) {
    // for position held + company + extra context from qualifiers array.
    let context = [];
    for (const qualifier of qualifiersArr) {
      const contextData = {};
      let entities;
      let positionHeld;
      let company;
      let companyDetails;
      const fieldId = qualifier?.mainsnak?.datavalue?.value?.id;
      const related = await relatedWikidata(elastic, fieldId);
      const link = related
        ? `${config.rootUrl}/people/${related?.[0]?._id}`
        : undefined;

      // pulls out position as top level field
      if (fieldId) {
        try {
          companyDetails = await wbk.getEntities(
            fieldId,
            'en',
            ['labels'],
            'json'
          );
          entities = await wikibaseCall(companyDetails);
          positionHeld = entities[fieldId]?.labels?.en?.value;
        } catch (error) {
          console.error(`Error configuring data for ${qualifier}:`, error);
        }
      }

      // extracts further context from qualifiers - dates for now, will expand to include further fields as needed
      const [dateOne, dateTwo] = await Promise.all(
        await qualifiersData(qualifier.qualifiers)
      );

      // explicitly handles company name, as needs to make wikibase call
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
        company = companyEntities[qualifiersId]?.labels?.en?.value;

        // position + company + dates as string

        contextData.context = contextString(
          company,
          positionHeld,
          dateOne,
          dateTwo
        );
        context = [
          ...context,
          {
            ...(related && { related: link }),
            value: contextData.context
          }
        ];
      } else {
        // Where there is not company or position held
        contextData.context = contextString(
          company,
          positionHeld,
          dateOne,
          dateTwo
        );

        context = [
          ...context,
          {
            ...(related && { related: link }),
            value: contextData.context
          }
        ];
      }
    }
    return context;
  },
  formatDate,
  nestedData (data, qCode, key) {
    // used with nest flag to return array of nested data if exists
    return data[qCode].claims[key].map((k) => ({
      value: k.mainsnak.datavalue?.value?.id
    }));
  },
  async formatViaf (entities, qCode, property) {
    const viafValue =
      entities[qCode]?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
    return `https://viaf.org/viaf/${viafValue}/`;
  },
  // extracts text values for QCodes passed in
  async extractNestedQCodeData (
    qCodeData,
    elastic,
    config,
    hide = false,
    relatedRequired = false,
    list = false
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

      return {
        ...(link ? { related: link } : {}),
        ...(list ? { list: true } : {}),
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
