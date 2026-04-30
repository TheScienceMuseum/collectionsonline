module.exports = require('rc')('co', {
  port: 8000,
  elasticIndex: process.env.ELASTIC_INDEX || 'ciim',
  elasticsearch: {
    node: process.env.ELASTIC_HOST || '',
    requestTimeout: 10000
  },
  // Redis / ElastiCache connection (host:port). Set ELASTICACHE_ENDPOINT in
  // production or elasticacheEndpoint in .corc for local dev.
  elasticacheEndpoint: process.env.ELASTICACHE_ENDPOINT || '',
  auth: process.env.auth !== undefined ? (process.env.auth) : false,
  user: process.env.co_auth_user,
  password: process.env.co_auth_pass,
  JWT_SECRET: process.env.JWT_SECRET,
  // Token required by /clearcache/* and /listcache/* admin routes.
  // Generate with: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  cacheClearToken: process.env.CACHE_CLEAR_TOKEN,
  // Visual search (image-to-image catalogue retrieval at /scan).
  // Disabled by default so an absent index doesn't surface a broken page.
  visualSearchEnabled: process.env.VISUAL_SEARCH_ENABLED === 'true',
  // Where to fetch embeddings.bin + manifest.json. Either an https URL
  // (e.g. https://coimages.../models) or a local filesystem path for dev.
  visualSearchModelsBaseUrl: process.env.VISUAL_SEARCH_MODELS_BASE_URL || '',
  // Top-1 score thresholds for the three-tier confidence UX. Calibrate
  // from the 20-photo recall test before launch — these placeholders are
  // CLIP ViT-B/32 ballparks, not validated values.
  visualSearchHighConfidenceThreshold: parseFloat(process.env.VISUAL_SEARCH_HIGH_THRESHOLD) || 0.34,
  visualSearchMediumConfidenceThreshold: parseFloat(process.env.VISUAL_SEARCH_MEDIUM_THRESHOLD) || 0.26,
  // Hard cap on how long startup will wait for the index to download.
  visualSearchLoadTimeoutMs: parseInt(process.env.VISUAL_SEARCH_LOAD_TIMEOUT_MS, 10) || 60000,
  NODE_ENV: process.env.NODE_ENV || 'test'
});
