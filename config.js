module.exports = require('rc')('co', {
  port: 8000,
  elasticsearch: {
    host: process.env.ELASTIC_HOST || ''
  }
});
