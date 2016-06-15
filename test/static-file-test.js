var test = require('tape');
var Hapi = require('hapi');
var fs = require('fs');
var server = new Hapi.Server();
var routes = require('../routes.js');
var jsFile = fs.readFileSync('public/bundle.js');
var cssFile = fs.readFileSync('public/bundle.css');

server.connection({
  port: process.env.TESTPORT || '8080'
});

server.route(routes);

server.register(require('inert'), function (err) {
  if (err) {
    console.error('Failed to load plugin:', err);
  }
});

test('Static File Serving', function (t) {
  t.plan(3);

  var jsRequest = {
    method: 'GET',
    url: '/bundle.js'
  };

  var cssRequest = {
    method: 'GET',
    url: '/bundle.css'
  };

  var badRequest = {
    method: 'GET',
    url: '/notfound.js'
  };

  server.inject(jsRequest, function (res) {
    t.equal(res.payload.toString('utf-8'), jsFile.toString(), 'JS File is served correctly');
  });

  server.inject(cssRequest, function (res) {
    t.equal(res.payload.toString('utf-8'), cssFile.toString(), 'CSS file is served correctly');
  });

  server.inject(badRequest, function (res) {
    t.equal(res.statusCode, 404, 'Non-existent file returns 404');
  });
});
