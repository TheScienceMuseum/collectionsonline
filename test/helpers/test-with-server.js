const tape = require('tape');
const createServer = require('../../server');
const config = require('../../config');

module.exports = (description, cb) => {
  createServer(config, (err, server) => {
    if (err) {
      throw err;
    }

    server.start(() => {
      if (err) {
        throw err;
      }

      tape(description, (t) => {
        cb(t, server);
        server.stop();
      });
    });
  });
};
