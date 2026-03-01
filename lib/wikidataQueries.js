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
  if (dateOne === null || dateOne === undefined) dateOne = '';
  if (dateTwo === null || dateTwo === undefined) dateTwo = '';

  if (!dateOne && !dateTwo) return '';

  return dateOne !== '' || dateTwo !== '' ? `${formatType}` : '';
}

// for building string for extra field context
function contextString (
  company = undefined,
  contextVal = undefined,
  dateOne = undefined,
  dateTwo = undefined
) {
  const contextValPrefix = contextVal || '';
  const companySuffix = company ? `, ${company}` : '';

  let dateRange;
  if (dateOne || dateTwo) {
    dateRange = `${contextDateStringFormatter(dateOne, dateTwo, '(')}${
      dateOne ? `${dateOne}` : ''
    }${dateOne && dateTwo ? '-' : ''}${
      dateTwo ? `${dateTwo}` : ''
    }${contextDateStringFormatter(dateOne, dateTwo, ')')}`;

    // Only add comma before date range if there's a company or position
    return `${contextValPrefix}${companySuffix} ${dateRange}`.trim();
  } else {
    return `${contextValPrefix}${companySuffix}`.trim();
  }
}
function formatDate (data, qCode = undefined, key = undefined) {
  const dateStr =
    data[qCode]?.claims?.[key]?.[0].mainsnak.datavalue.value.time || data;
  const yearOnly = dateStr.match(/^\+(\d{4})-00-00/);
  if (yearOnly) return yearOnly[1];
  const date = new Date(dateStr.slice(1, -1));
  return isNaN(date.getTime()) ? null : date.toLocaleDateString('en-GB');
}

// Deduplicates concurrent fetches for the same Wikidata URL.
// Multiple properties on a page can reference the same QCode, so without
// this each reference fires its own outbound HTTP request simultaneously.
const wbkInFlight = new Map();

async function wikibaseCall (wikibaseEntities, signal = undefined) {
  const existing = wbkInFlight.get(wikibaseEntities);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const fetchOpts = { signal: signal || AbortSignal.timeout(10000) };
      const result = await fetch(wikibaseEntities, fetchOpts)
        .then((response) => response.json())
        .catch((error) => {
          console.error('Fetch error:', error);
          return null;
        });
      if (!result) return {};
      const { entities } = result;
      return entities;
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        console.error('Wikidata API call timed out:', wikibaseEntities);
        return {};
      }
      console.error('Error configuring data', error);
      return {};
    } finally {
      wbkInFlight.delete(wikibaseEntities);
    }
  })();

  wbkInFlight.set(wikibaseEntities, promise);
  return promise;
}

// Batch-fetches labels for multiple Q-codes in a single HTTP request.
// wikibase-sdk supports an array of IDs, producing one URL with all IDs.
// Returns a map of { [qCode]: entityData } for label lookup without further calls.
async function batchFetchEntities (qCodes) {
  if (!qCodes || qCodes.length === 0) return {};
  const unique = [...new Set(qCodes.filter(Boolean))];
  if (unique.length === 0) return {};
  const url = wbk.getEntities(unique, ['en'], ['info', 'claims', 'labels'], 'json');
  const signal = AbortSignal.timeout(15000);
  const entities = await wikibaseCall(url, signal);
  return entities || {};
}

// Scans all claims (and qualifiers) in the primary entity for nested Q-code references.
// Returns a flat deduplicated array used for a single batch pre-fetch before processing.
function collectNestedQCodes (entities, qCode, propertiesConfig) {
  const qCodeSet = new Set();
  const qCodeRegex = /^Q\d+$/i;
  const entity = entities[qCode];
  if (!entity || !entity.claims) return [];

  for (const { property } of Object.values(propertiesConfig)) {
    const claims = entity.claims[property] || [];
    for (const claim of claims) {
      const val = claim?.mainsnak?.datavalue?.value;
      if (val && typeof val === 'object' && val.id && qCodeRegex.test(val.id)) {
        qCodeSet.add(val.id);
      }
      // also collect Q-codes from qualifiers (e.g. P39 position context)
      if (claim.qualifiers) {
        for (const qualArr of Object.values(claim.qualifiers)) {
          for (const q of qualArr) {
            const qval = q?.datavalue?.value;
            if (qval && typeof qval === 'object' && qval.id && qCodeRegex.test(qval.id)) {
              qCodeSet.add(qval.id);
            }
          }
        }
      }
    }
  }
  return [...qCodeSet];
}

// utility function used in extractNestedQCodeData below
async function configureNestedData (
  qCodeData,
  isQCodeReg,
  prefetchedEntities = null
) {
  let claimsValues = [];
  // excludes non qcode values, i.e dates and makes wikibase call
  if (isQCodeReg) {
    let entities;
    // Use pre-fetched map if the entity is already available — avoids a network call
    if (prefetchedEntities && prefetchedEntities[qCodeData]) {
      entities = prefetchedEntities;
    } else {
      const additionalDetails = await wbk.getEntities(
        qCodeData,
        'en',
        ['info', 'claims', 'labels'],
        'json'
      );

      if (additionalDetails) {
        entities = await wikibaseCall(additionalDetails);
      }
    }
    const claimValue = entities?.[qCodeData]?.labels?.en?.value;
    if (claimValue) {
      claimsValues = [...claimsValues, extract(claimValue)];
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
  batchFetchEntities,
  collectNestedQCodes,
  getImageUrl: async (data, qCode, key) => {
    const imageUrl = generateString(data, qCode, key);
    return imageUrl;
  },
  getLogo: async (data, qCode, key) => {
    const logoUrl = generateString(data, qCode, key);
    return logoUrl;
  },
  extractClaimValue,
  async extraContext (qualifiersArr, elastic, config, list = false, prefetchedEntities = null) {
    // for position held + company + extra context from qualifiers array.
    let context = [];
    for (const qualifier of qualifiersArr) {
      const contextData = {};
      let entities;
      let contextValue;
      let company;
      const fieldId = qualifier?.mainsnak?.datavalue?.value?.id;
      const related = await relatedWikidata(elastic, fieldId);
      const link = related
        ? `${config.rootUrl}/people/${related?.[0]?._id}`
        : undefined;

      // pulls out position as top level field
      if (fieldId) {
        try {
          // Use pre-fetched entity if available — avoids a redundant network call
          if (prefetchedEntities && prefetchedEntities[fieldId]) {
            entities = prefetchedEntities;
          } else {
            const companyDetails = await wbk.getEntities(
              fieldId,
              'en',
              ['labels'],
              'json'
            );
            entities = await wikibaseCall(companyDetails);
          }
          contextValue = entities?.[fieldId]?.labels?.en?.value;
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

        let companyEntities;
        if (prefetchedEntities && prefetchedEntities[qualifiersId]) {
          companyEntities = prefetchedEntities;
        } else {
          const companyDetails = await wbk.getEntities(
            qualifiersId,
            'en',
            ['labels'],
            'json'
          );
          companyEntities = await wikibaseCall(companyDetails);
        }

        // find company label
        company = companyEntities?.[qualifiersId]?.labels?.en?.value;

        // position + company + dates as string
        contextData.context = contextString(
          company,
          contextValue,
          dateOne,
          dateTwo
        );
        context = [
          ...context,
          {
            ...(related && { related: link }),
            ...(list && { list: true }),

            value: contextData.context
          }
        ];
      } else {
        // Where there is not company or position held
        contextData.context = contextString(
          company,
          contextValue,
          dateOne,
          dateTwo
        );

        context = [
          ...context,
          {
            ...(related && { related: link }),
            ...(list && { list: true }),
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
    list = false,
    prefetchedEntities = null
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

      // nested items — pass prefetchedEntities to avoid redundant API calls
      const nestedResult = await configureNestedData(
        code.value || code.id || code.text,
        isQCodeRegex,
        prefetchedEntities
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
