var Hapi = require('hapi');
var routes = require('./routes.js');
const config = require('./config');

var server = new Hapi.Server();

server.connection({
  port: config.port
});

server.route(routes);

server.register([require('inert'), require('hapi-negotiator')], function (err) {
  if (err) {
    console.error('Failed to load plugin:', err);
  }
});

server.start(function (err) {
  if (err) {
    throw new Error(err);
  }
  console.log(server.info.uri);
});
