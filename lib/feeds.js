const { fetchAndCacheEndpoint } = require('./cached-feed.js');
const endpoints = require('../fixtures/article-endpoints');

// Pre-warm the feed cache for all endpoints at startup.
// Runs sequentially to avoid triggering Cloudflare rate-limiting.
module.exports = async () => {
  for (const endpoint of endpoints) {
    await fetchAndCacheEndpoint(endpoint);
  }
};
