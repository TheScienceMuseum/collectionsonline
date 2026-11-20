const Path = require('path');
const fs = require('fs');
const cacheHeaders = require('./route-helpers/cache-control');

const PUBLIC = Path.resolve(__dirname, '..', 'public');

// A fingerprinted bundle name, as written by scripts/fingerprint.js.
const HASHED_BUNDLE = /^(bundle|barcode)-[a-f0-9]{8}(\.js|\.css)$/;

// How long a stale bundle name serves the current bundle. Short, so the old
// URL never stays pinned to one build for long.
const FALLBACK_TTL_MS = 5 * 60 * 1000;

module.exports = (config) => ({
  method: 'GET',
  path: '/{path*}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: function (req, h) {
      const requested = req.params.path || '';
      const match = HASHED_BUNDLE.exec(requested);

      // Each build deletes the previous hashed bundles (scripts/fingerprint.js),
      // but pages cached before a deploy (24h at CloudFront and in browsers)
      // still ask for the old hash. Serve the current build rather than a 404,
      // which would leave the page without its CSS and JS.
      if (match && !fs.existsSync(Path.join(PUBLIC, requested))) {
        return h.file(Path.join(PUBLIC, match[1] + match[2])).ttl(FALLBACK_TTL_MS);
      }

      return h.file(Path.resolve(PUBLIC, requested));
    }
  }
});
