const config = require('../config');
const createServer = require('../server');

createServer(config, (err, server) => {
  if (err) {
    throw err;
  }

  server.start((err) => {
    if (err) {
      throw err;
    }
    console.log(server.info.uri);
  });
});
