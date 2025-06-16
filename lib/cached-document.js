const getAllFromArchive = require('../lib/get-full-archive');
const archiveTree = require('../lib/archive-tree');
const cache = require('../bin/cache');
const getPrimaryValue = require('./get-primary-value');

// Constants for cache configuration
const CACHE_SEGMENT = 'documents';
const CACHE_TTL = 100000000; // Cache time-to-live in milliseconds
const REDIS_CONNECTION_ERRORS = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNRESET',
  'Connection is closed'
];

module.exports = async (elastic, id, fondsId) => {
  let cacheActive = true;

  try {
    // Attempt to start cache with timeout
    await startCacheWithTimeout();

    // Try to get from cache
    const cached = await getFromCache(fondsId);
    if (cached) {
      return cached.item;
    }

    // Fall back to direct Elastic search if cache fails
    return await getDataDirectly(elastic, id, fondsId);
  } catch (err) {
    if (isRedisConnectionError(err)) {
      console.warn('Redis connection failed, falling back to direct Elastic search', {
        error: err.message,
        fondsId,
        stack: err.stack // Add stack for debugging
      });
      cacheActive = false;
      // Ensure cache is properly stopped
      try {
        await cache.stop();
      } catch (stopErr) {
        console.error('Failed to stop cache after error', stopErr);
      }
      return await getDataDirectly(elastic, id, fondsId);
    }
  } finally {
    if (cacheActive) {
      try {
        await cache.stop();
      } catch (stopErr) {
        console.error('Failed to stop cache connection', {
          error: stopErr.message
        });
      }
    }
  }

  async function startCacheWithTimeout () {
    try {
      await Promise.race([
        cache.start(),
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        )
      ]);
    } catch (err) {
      console.warn('Cache initialization failed', {
        error: err.message,
        fondsId
      });
      cacheActive = false;
      throw err;
    }
  }

  async function getFromCache (fondsId) {
    if (!cacheActive) return null;

    try {
      return await cache.get({ segment: CACHE_SEGMENT, id: fondsId });
    } catch (err) {
      console.warn('Cache get operation failed', {
        error: err.message,
        fondsId
      });
      cacheActive = false;
      return null;
    }
  }

  async function getDataDirectly (elastic, id, fondsId) {
    const data = await getFullArchive(elastic, id);
    const tree = archiveTree.sortChildren(data);

    if (cacheActive) {
      try {
        await cacheDocument(fondsId, tree);
      } catch (err) {
        console.warn('Failed to cache document', {
          error: err.message,
          fondsId
        });
      }
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
  try {
    await cache.set({ segment: CACHE_SEGMENT, id }, data, CACHE_TTL);
    console.debug('Successfully cached document', { documentId: id });
  } catch (err) {
    console.error('Failed to cache document', {
      error: err.message,
      documentId: id
    });
    throw err;
  } finally {
    try {
      await cache.stop();
    } catch (err) {
      console.error('Failed to stop cache after caching document', {
        error: err.message
      });
    }
  }
}

function isRedisConnectionError (err) {
  return REDIS_CONNECTION_ERRORS.includes(err.code) ||
         err.message.includes('Redis') ||
         err.message.includes('connection');
}
