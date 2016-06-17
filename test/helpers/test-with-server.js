const tape = require('tape');
const createServer = require('../../server');
const config = require('../../config');
const createMockElastic = require('./mock-elastic');

// Wrap tape's test function with a function that creates a new server and mocks dependencies
module.exports = (description, cb) => {
  const elastic = createMockElastic();

  createServer({ config, elastic }, (err, ctx) => {
    if (err) {
      throw err;
    }

    tape(description, (t) => {
      cb(t, ctx);
    });
  });
};
