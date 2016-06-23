const Client = require('elasticsearch').Client;
const config = require('../config');
const createServer = require('../server');

const elastic = new Client(config.elasticsearch);

// Allow PORT env variable to specify port for elasticbeanstalk
config.port = process.env.PORT || config.port;

createServer(elastic, config, (err, ctx) => {
  if (err) {
    throw err;
  }

  ctx.server.start((err) => {
    if (err) {
      throw err;
    }
    console.log(ctx.server.info.uri);
  });
});
