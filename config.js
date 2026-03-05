module.exports = require('rc')('co', {
  port: 8000,
  elasticsearch: {
    node: process.env.ELASTIC_HOST || ''
  },
  auth: process.env.auth !== undefined ? (process.env.auth) : false,
  user: process.env.co_auth_user,
  password: process.env.co_auth_pass,
  JWT_SECRET: process.env.JWT_SECRET,
  // Token required by /clearcache/* and /listcache/* admin routes.
  // Generate with: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  cacheClearToken: process.env.CACHE_CLEAR_TOKEN,
  NODE_ENV: process.env.NODE_ENV || 'test'
});
