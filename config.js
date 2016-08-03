module.exports = require('rc')('co', {
  port: 8000,
  elasticsearch: {
    host: process.env.ELASTIC_HOST || ''
  },
  auth: process.env.auth !== undefined ? process.env.auth : true,
  user: process.env.co_auth_user,
  password: process.env.co_auth_pass,
  JWT_SECRET: process.env.JWT_SECRET
});
