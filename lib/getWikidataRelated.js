const config = require('../config');

module.exports = async (elastic, qCode, count) => {
  if (!qCode) {
    return;
  }
  const body = {
    size: count || 1,
    query: {
      bool: {
        must: [
          {
            term: {
              'wikidata.keyword': `https://www.wikidata.org/wiki/${qCode}`
            }
          }
        ]
      }
    }
  };

  const searchOpts = {
    index: config.elasticIndex,
    body
  };

  const result = await elastic.search(searchOpts, { requestTimeout: 5000 });

  if (result.body.hits.hits.length === 0) {
    return;
  }

  return result.body.hits.hits;
};

/**
 * Batch Elasticsearch lookup for multiple Q-codes.
 *
 * Issues a single ES `terms` query instead of one query per Q-code.
 * Returns a Map<qCode, hit[]> — entries with no match are absent from the map.
 *
 * @param {object} elastic – Elasticsearch client
 * @param {string[]} qCodes – array of Q-code strings (e.g. ['Q312', 'Q19837'])
 * @returns {Promise<Map<string, object[]>>}
 */
module.exports.batchRelatedWikidata = async (elastic, qCodes) => {
  const unique = [...new Set((qCodes || []).filter(Boolean))];
  if (!unique.length) return new Map();

  const result = await elastic.search({
    index: config.elasticIndex,
    body: {
      size: Math.min(unique.length, 200),
      _source: ['wikidata'],
      query: {
        bool: {
          must: [
            {
              terms: {
                'wikidata.keyword': unique.map(q => `https://www.wikidata.org/wiki/${q}`)
              }
            }
          ]
        }
      }
    }
  }, { requestTimeout: 5000 });

  const map = new Map();
  for (const hit of (result.body.hits.hits || [])) {
    const wdUrl = (hit._source && hit._source.wikidata) || '';
    const m = wdUrl.match(/\/(Q\d+)$/);
    if (m) {
      map.set(m[1], [hit]);
    }
  }
  return map;
};
