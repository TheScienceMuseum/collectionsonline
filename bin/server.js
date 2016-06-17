const Client = require('elasticsearch').Client;
const config = require('../config');
const createServer = require('../server');

const elastic = new Client(config.elasticsearch);

createServer({ elastic, config }, (err, { server }) => {
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
