const cache = require('../bin/cache.js');
const fetch = require('fetch-ponyfill')().fetch;
// Function to fetch and cache data from an endpoint
exports.fetchAndCacheEndpoint = async function (endpoint) {
  try {
    const response = await fetch(endpoint.url, {
      timeout: 200000,
      headers: { 'User-Agent': 'SMG Collection Site 1.0' }
    });
    const data = await response.json();
    await cacheEndpoints(cache, endpoint, data);
    console.log(`Successfully cached ${endpoint.label}`);
    return data;
  } catch (err) {
    console.error(`Failed to cache ${endpoint.label}:`, err);
  }
};

// Function to cache data in the cache

async function cacheEndpoints (cache, endpoint, data) {
  try {
    if (!cache) {
      console.debug('There is no cache.');
      return;
    }

    await cache.start();

    if (!cache.isReady()) {
      console.debug('Cache is not connected.');
      return;
    }
    const url = endpoint.url;
    const cached = await cache.get({ segment: 'feed', id: url });

    if (cached) {
      console.log('cleared cache');
      await cache.drop({ segment: 'feed', id: url });
    }
    await cache.set({ segment: 'feed', id: url }, data, 86400000);
    console.log('Feed successfully cached');
  } catch (err) {
    console.debug("Couldn't cache item:", err);
  } finally {
    await cache.stop();
  }
}
