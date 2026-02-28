const cache = require('../bin/cache.js');

module.exports = async (endpoint) => {
  try {
    if (!cache || !cache.isReady()) {
      return null;
    }

    const url = endpoint?.url;
    const cached = await cache.get({
      segment: 'feed',
      id: url
    });

    if (cached) {
      return cached.item;
    }

    return null;
  } catch (err) {
    // Swallow cache errors — caller falls back to live fetch
    return null;
  }
};
