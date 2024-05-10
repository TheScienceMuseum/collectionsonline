const cache = require('../bin/cache.js');
const fetch = require('fetch-ponyfill')().fetch;
module.exports = async (endpoint, id) => {
  try {
    await cache.start();
    const url = endpoint?.url;

    const cached = await cache.get({
      segment: 'feed',
      url
    });

    if (cached) {
      await cache.stop();
      return cached.item;
    }
    // fallback
    const data = await fetchArticles(endpoint, id);

    cacheFeed(cache, endpoint, data);

    return data;
  } catch (err) {
    await cache.stop();

    if (err && err.code === 'ECONNREFUSED') {
      console.error('Cache server not running, fetching articles directly');
      const data = await fetchArticles(endpoint, id);
      return data;
    } else if (err && err.message.includes('network error')) {
      console.error('Network error occurred');
      const data = await fetchArticles(endpoint, id);
      return data;
    } else {
      console.error(err, 'An error occurred, unable to cache endpoint');
    }
    throw err;
  }
};

async function fetchArticles (endpoint, id) {
  try {
    const response = await fetch(endpoint.url, {
      timeout: 10000,
      headers: { 'User-Agent': 'SMG Collection Site 1.0' }
    });
    const data = await response.json();
    return {
      museum: endpoint.label,
      data: data.filter((e) => e.collection_objects.indexOf(id) > -1)
    };
  } catch (err) {
    await cache.stop();
    console.error(err, 'There was an error');
    throw err;
  }
}

async function cacheFeed (cache, endpoint, data) {
  try {
    await cache.set({ segment: 'feed', url: endpoint.url }, data, 60000);

    await cache.stop();
    console.log('Feed successfully cached');
  } catch (err) {
    await cache.stop();
    console.error(err, "couldn't cache item");
  }
}
