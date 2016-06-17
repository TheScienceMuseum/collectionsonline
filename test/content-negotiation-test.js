const testWithServer = require('./helpers/test-with-server');

testWithServer('Request for HTML Content', (t, { server }) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'text/html'}
  };

  server.inject(htmlRequest, (res) => {
    t.ok(res.payload.toLowerCase().indexOf('<!doctype html>') > -1, 'HTML request should respond with HTML');
    t.ok(res.headers['content-type'].indexOf('text/html') > -1, 'Response header should be text/html');
    t.end();
  });
});

testWithServer('Request for JSONAPI Content', (t, { server }) => {
  // http://jsonapi.org/format/#content-negotiation-servers
  //
  // Servers MUST send all JSON API data in response documents with the header
  // `Content-Type: application/vnd.api+json` without any media type parameters.
  t.plan(2);

  const jsonRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  server.inject(jsonRequest, (res) => {
    t.equal(res.payload, '"{"response": "JSONAPI"}"', 'JSONAPI request should respond with JSONAPI data');
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});

testWithServer('Request for JSONAPI Content with parameters', (t, { server }) => {
  // http://jsonapi.org/format/#content-negotiation-servers
  //
  // Servers MUST respond with a 406 Not Acceptable status code if a request’s
  // Accept header contains the JSON API media type and all instances of that
  // media type are modified with media type parameters.
  t.plan(1);

  const badJSONRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'application/vnd.api+json; charset=utf-8'}
  };

  server.inject(badJSONRequest, (res) => {
    t.equal(res.statusCode, 406, 'One JSONAPI request with parameter should return 406');
    t.end();
  });
});

testWithServer('Request with multiple instances of JSONAPI media type, one without parameters', (t, { server }) => {
  t.plan(1);

  const acceptableJSONRequest = {
    method: 'GET',
    url: '/',
    headers: {'Accept': 'application/vnd.api+json; charset=utf-8, application/vnd.api+json'}
  };
  server.inject(acceptableJSONRequest, (res) => {
    t.equal(res.statusCode, 200, 'At least one JSONAPI without parameters should work');
    t.end();
  });
});

testWithServer('Request to /search requesting JSON', (t, { server }) => {
  t.plan(1);

  const acceptableJSONRequest = {
    method: 'GET',
    url: '/search?q=test',
    headers: {'Accept': 'application/vnd.api+json'}
  };
  server.inject(acceptableJSONRequest, (res) => {
    t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
    t.end();
  });
});
