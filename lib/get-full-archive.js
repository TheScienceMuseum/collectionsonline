const TypeMapping = require('./type-mapping.js');
const config = require('../config');

const PAGE_SIZE = 1000;
const SCROLL_TTL = '30s';
const REQUEST_TIMEOUT = 5000;

// Fetch every record belonging to a fonds. Large archives exceed both the old
// single-request cap and ES's 10k result window (SMG Corporate Archive is
// ~11.5k records), so results are paged with the scroll API. Throws if the
// full set can't be retrieved — callers treat that as an incomplete tree and
// skip caching it.
module.exports = async (elastic, id) => {
  const searchOpts = {
    index: config.elasticIndex,
    scroll: SCROLL_TTL,
    body: {
      size: PAGE_SIZE,
      // Without this ES7 caps hits.total.value at 10000, which would silently
      // end the loop early and defeat the completeness check below.
      track_total_hits: true,
      query: {
        constant_score: {
          filter: {
            bool: {
              must: {
                term: { 'fonds.@admin.uid': TypeMapping.toInternal(id) }
              }
            }
          }
        }
      }
    },
    _source: [
      '@admin',
      'parent',
      'identifier',
      'summary'
    ]
  };

  let scrollId;
  try {
    let result = await elastic.search(searchOpts, { requestTimeout: REQUEST_TIMEOUT });
    scrollId = result.body._scroll_id;
    const total = result.body.hits.total.value;
    const hits = result.body.hits.hits.slice();

    while (hits.length < total && result.body.hits.hits.length > 0) {
      result = await elastic.scroll(
        { scroll_id: scrollId, scroll: SCROLL_TTL },
        { requestTimeout: REQUEST_TIMEOUT }
      );
      scrollId = result.body._scroll_id || scrollId;
      hits.push(...result.body.hits.hits);
    }

    if (hits.length < total) {
      throw new Error(`Incomplete archive fetch for ${id}: got ${hits.length} of ${total} records`);
    }

    return hits;
  } finally {
    if (scrollId) {
      try {
        await elastic.clearScroll({ body: { scroll_id: scrollId } });
      } catch (err) {
        console.warn('clearScroll failed', { error: err.message, fondsId: id });
      }
    }
  }
};
