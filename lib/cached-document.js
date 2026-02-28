const getAllFromArchive = require('../lib/get-full-archive');
const archiveTree = require('../lib/archive-tree');
const cache = require('../bin/cache');
const getPrimaryValue = require('./get-primary-value');

// Constants for cache configuration
const CACHE_SEGMENT = 'documents';
const CACHE_TTL = 100000000; // Cache time-to-live in milliseconds

module.exports = async (elastic, id, fondsId) => {
  // Try to get from cache
  const cached = await getFromCache(fondsId);
  if (cached) {
    return cached.item;
  }

  // Fall back to direct Elasticsearch query
  return await getDataDirectly(elastic, id, fondsId);

  async function getFromCache (fondsId) {
    if (!cache || !cache.isReady()) return null;

    try {
      return await cache.get({ segment: CACHE_SEGMENT, id: fondsId });
    } catch (err) {
      console.warn('Cache get operation failed', { error: err.message, fondsId });
      return null;
    }
  }

  async function getDataDirectly (elastic, id, fondsId) {
    const data = await getFullArchive(elastic, id);
    const tree = archiveTree.sortChildren(data);

    try {
      await cacheDocument(fondsId, tree);
    } catch (err) {
      console.warn('Failed to cache document', { error: err.message, fondsId });
    }

    return tree;
  }
};

async function getFullArchive (elastic, id) {
  try {
    let fond;
    const data = [];
    const result = await elastic.get({ index: 'ciim', id });

    if (result.body._source.level && result.body._source.level.value === 'fonds') {
      fond = {
        id,
        summary_title: result.body._source.summary.title,
        identifier: getPrimaryValue(result.body._source.identifier)
      };
    } else if (result.body._source.fonds) {
      fond = {
        id: result.body._source.fonds[0]['@admin'].uid,
        summary_title: result.body._source.fonds[0].summary.title
      };
    } else {
      return [{ id, summary_title: result.body._source.summary.title }];
    }

    data.push(fond);

    const res = await getAllFromArchive(elastic, fond.id);
    return data.concat(res.map(el => ({
      id: el._source['@admin'].uid,
      parent: el._source.parent,
      identifier: getPrimaryValue(el._source.identifier),
      summary_title: el._source.summary.title
    })));
  } catch (err) {
    console.error('Failed to get full archive', {
      error: err.message,
      documentId: id
    });
    throw err;
  }
}

async function cacheDocument (id, data) {
  if (!cache || !cache.isReady()) return;

  try {
    await cache.set({ segment: CACHE_SEGMENT, id }, data, CACHE_TTL);
  } catch (err) {
    console.error('Failed to cache document', { error: err.message, documentId: id });
    throw err;
  }
}
