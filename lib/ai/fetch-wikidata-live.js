'use strict';

/**
 * Fetch basic Wikidata entity properties directly from the API.
 * Lightweight alternative to the full /wiki route — just gets key facts
 * for the AI prompt (description, occupation, industry, etc).
 *
 * Returns an object keyed by human-readable property name, or null if nothing
 * useful was returned. Caller is responsible for filtering/formatting.
 */

const CLAIM_PROPS = {
  // Person properties
  P106: 'occupation',
  P27: 'country of citizenship',
  P69: 'educated at',
  P108: 'employer',
  P101: 'field of work',
  P800: 'notable work',
  P166: 'awards received',
  P463: 'member of',
  P1412: 'languages spoken',
  P569: 'date of birth',
  P570: 'date of death',
  // Organisation properties
  P112: 'founded by',
  P571: 'inception',
  P576: 'dissolved',
  P169: 'chief executive officer',
  P488: 'chairperson',
  P452: 'industry',
  P159: 'headquarters location',
  P17: 'country',
  P127: 'owned by',
  P749: 'parent organization',
  P355: 'subsidiary',
  P1056: 'product or material produced',
  P1830: 'owner of'
};

const TIMEOUT_MS = 8000;

async function fetchWikidataLive (qCode) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
    '&ids=' + qCode + '&languages=en&props=labels|descriptions|claims|sitelinks&format=json';

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data.entities && data.entities[qCode];
    if (!entity) return null;

    const result = {};
    const desc = entity.descriptions && entity.descriptions.en;
    if (desc) result.description = { value: desc.value };

    Object.keys(CLAIM_PROPS).forEach(function (prop) {
      const claims = entity.claims && entity.claims[prop];
      if (!claims || !claims.length) return;

      const values = claims.slice(0, 5).map(function (claim) {
        const snak = claim.mainsnak;
        if (!snak || !snak.datavalue) return null;
        if (snak.datavalue.type === 'wikibase-entityid') {
          return snak.datavalue.value.id;
        }
        if (snak.datavalue.type === 'string') {
          return snak.datavalue.value;
        }
        if (snak.datavalue.type === 'time' && snak.datavalue.value && snak.datavalue.value.time) {
          return snak.datavalue.value.time;
        }
        return null;
      }).filter(Boolean);

      if (values.length) {
        result[CLAIM_PROPS[prop]] = { value: values.join(', ') };
      }
    });

    // Resolve Q-code values to labels in a single batch
    const qCodes = [];
    Object.keys(result).forEach(function (key) {
      if (!result[key] || !result[key].value) return;
      const matches = result[key].value.match(/Q\d+/g);
      if (matches) qCodes.push.apply(qCodes, matches);
    });

    if (qCodes.length > 0) {
      try {
        const labelUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
          '&ids=' + qCodes.slice(0, 50).join('|') + '&languages=en&props=labels&format=json';
        const labelRes = await fetch(labelUrl, { signal: controller.signal });
        if (labelRes.ok) {
          const labelData = await labelRes.json();
          const labels = {};
          Object.keys(labelData.entities || {}).forEach(function (id) {
            const label = labelData.entities[id].labels && labelData.entities[id].labels.en;
            if (label) labels[id] = label.value;
          });
          Object.keys(result).forEach(function (key) {
            if (!result[key] || !result[key].value) return;
            result[key].value = result[key].value.replace(/Q\d+/g, function (q) {
              return labels[q] || q;
            });
          });
        }
      } catch (err) {
        // Label resolution failed — Q-codes will remain, which is fine
      }
    }

    const enwiki = entity.sitelinks && entity.sitelinks.enwiki;
    if (enwiki) {
      result.wikipediaUrl = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(enwiki.title.replace(/ /g, '_'));
    }

    return Object.keys(result).length > 0 ? result : null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = fetchWikidataLive;
module.exports.CLAIM_PROPS = CLAIM_PROPS;
