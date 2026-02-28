import { Client } from '@elastic/elasticsearch';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const config = require('../config');
const createServer = require('../server');
const cache = require('./cache');
const warmFeeds = require('../lib/feeds');

const elastic = new Client(config.elasticsearch);

// Allow PORT env variable to specify port
config.port = process.env.PORT || config.port;

createServer(elastic, config, async (err, ctx) => {
  if (err) {
    throw err;
  }

  try {
    await ctx.server.start();
    console.log(ctx.server.info.uri);
  } catch (err) {
    console.log(err);
    throw err;
  }

  // Start the shared cache client once at startup.
  // All cache lib modules (cached-article, cached-feed, cached-wikidata,
  // cached-document) rely on this single connection — they must NOT call
  // cache.start() / cache.stop() themselves.
  try {
    await cache.start();
    console.log('Cache started, connected:', cache.isReady());
  } catch (err) {
    console.warn('Cache unavailable at startup, running without cache:', err.message);
  }

  // Pre-warm the feed cache in the background so that article requests are
  // served from Redis rather than triggering live fetches per-request.
  // Runs sequentially (one endpoint at a time) to avoid triggering Cloudflare
  // rate-limiting from a burst of concurrent outbound requests.
  warmFeeds().catch((err) => {
    console.warn('Feed warm-up failed:', err.message);
  });
});
