const Hapi = require('hapi');
const routes = require('./routes');

module.exports = (config, cb) => {
  const server = new Hapi.Server();

  server.connection({
    port: config.port
  });

  server.route(routes);

  server.register([require('inert'), require('hapi-negotiator')], (err) => {
    if (err) {
      return cb(err);
    }
    cb(null, server);
  });
};
