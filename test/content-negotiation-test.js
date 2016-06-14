var test = require('tape');
var Hapi = require('hapi');
var server = new Hapi.Server();
var routes = require('../routes.js');

server.connection({
  port: process.env.TESTPORT || '8080'
});

server.route(routes);

server.register(require('hapi-negotiator'), function (err) {
  if (err) {
    console.error('Failed to load plugin:', err);
  }
});

test('Content Negotiation', function (t) {
  var htmlRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'text/html'}
  };

  var jsonRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  var badJSONRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'application/vnd.api+json; charset=utf-8'}
  };

  var acceptableJSONRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'application/vnd.api+json; charset=utf-8, application/vnd.api+json'}
  };

  server.inject(htmlRequest, function (res) {
    t.equal(res.payload, '<h1>HTML Response</h1>', 'HTML request correct');
    t.ok(res.headers['content-type'].indexOf('text/html') > -1, 'HTML response header is correct');
  });

  server.inject(jsonRequest, function (res) {
    t.equal(res.payload, '"{"response": "JSONAPI"}"', 'JSONAPI request correct');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header is correct');
  });

  server.inject(badJSONRequest, function (res) {
    t.equal(res.statusCode, 406, 'JSONAPI request with parameter is not acceptable');
  });

  server.inject(acceptableJSONRequest, function (res) {
    t.equal(res.statusCode, 200, 'One JSONAPI without parameters should work');
    t.end();
  });
});
