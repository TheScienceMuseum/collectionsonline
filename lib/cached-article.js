const cache = require('../bin/cache.js');
module.exports = async (endpoint) => {
  try {
    // to handle different envs where might not be a redis server, i.e. Travis

    if (!cache) {
      console.debug('There is no cache.');
      return null;
    }

    await cache.start();

    // to handle different envs where might not be a redis server, i.e. Travis
    if (!cache.isReady()) {
      console.debug('Cache is not connected.');
      return null;
    }

    const url = endpoint?.url;
    const cached = await cache.get({
      segment: 'feed',
      id: url
    });
    if (cached) {
      await cache.stop();
      return cached.item;
    }

    await cache.stop();
    return null;
  } catch (err) {
    await cache.stop();
    console.debug(err, 'An error occurred while accessing the cache');
    throw err;
  }
};
