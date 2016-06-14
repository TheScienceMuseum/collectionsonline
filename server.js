var Hapi = require('hapi');
var routes = require('./routes.js');

var server = new Hapi.Server();

server.connection({
  port: process.env.PORT || '8000'
});

server.route(routes);

server.register(require('inert'), function (err) {
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
