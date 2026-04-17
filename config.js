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
  NODE_ENV: process.env.NODE_ENV || 'test',

  // --- AI Biographies ---
  dynamodb: {
    region: process.env.AWS_REGION || 'eu-west-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || '',
    tableName: process.env.DYNAMODB_TABLE || 'collectionsonline-ai'
  },
  aiBiographyEnabled: process.env.AI_BIOGRAPHY_ENABLED === 'true',
  aiBiographyModel: process.env.AI_BIOGRAPHY_MODEL || 'claude-3-haiku-20240307',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  // Token for /admin/ai routes. Falls back to cacheClearToken if not set.
  adminToken: process.env.ADMIN_TOKEN || '',
  // Skip AI biography generation if existing description exceeds this (chars)
  aiBiographyMaxExistingChars: parseInt(process.env.AI_BIO_MAX_EXISTING_CHARS, 10) || 500,
  // Suppress original description and show only AI biography if under this (chars)
  aiBiographySuppressExistingChars: parseInt(process.env.AI_BIO_SUPPRESS_EXISTING_CHARS, 10) || 50
});
