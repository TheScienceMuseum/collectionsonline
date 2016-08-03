const tape = require('tape');
const createServer = require('../../server');
const config = require('../../config');
// const createMockElastic = require('./mock-elastic');
const createMockDatabase = require('./mock-database');

// Wrap tape's test function with a function that creates a new server and mocks dependencies
module.exports = (description, cb) => {
  const elastic = createMockDatabase();
  config.auth = false;
  createServer(elastic, config, (err, ctx) => {
    if (err) {
      throw err;
    }

    tape(description, (t) => {
      cb(t, ctx);
    });
  });
};
