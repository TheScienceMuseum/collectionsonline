module.exports = require('rc')('co', {
  port: 8000,
  elasticsearch: {
    node: process.env.ELASTIC_HOST || ''
  },
  auth: process.env.auth !== undefined ? (process.env.auth === 'true') : true,
  user: process.env.co_auth_user,
  password: process.env.co_auth_pass,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'test'
});
