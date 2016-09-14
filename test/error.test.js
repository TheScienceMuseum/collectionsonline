const testWithServer = require('./helpers/test-with-server');
// const async = require('async');
// var stub = require('sinon').stub;

testWithServer('Request for Archive HTML Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-badRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer('Request for Archive JSON Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/smga-documents-badRequest',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer('Request for Object HTML Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-badRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer('Request for Object JSON Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/smgc-objects-badRequest',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer('Request for Person HTML Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-badRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer('Request for Person JSON Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-badRequest',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer('Request for Person with related items', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/people/smgc-people-36993',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);
    t.equal(res.statusCode, 200, 'Status code was as expected, 200');
    t.notOk(response.data.relationships.objects, 'Response has no related items');
    t.end();
  });
});

testWithServer('Search for JSON', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?q=charles',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer('Search for HTML', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/search?q=charles',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

// testWithServer('Request for Archive JSON with children', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
//   t.plan(3);
//
//   const htmlRequest = {
//     method: 'GET',
//     url: '/documents/smga-documents-110000003',
//     headers: {'Accept': 'application/vnd.api+json'}
//   };
//
//   ctx.server.inject(htmlRequest, (res) => {
//     var response = JSON.parse(res.payload);
//     t.equal(res.statusCode, 200, 'Status code was as expected, 200');
//     t.deepEqual(response.data.relationships.children.data, [], 'Response has no children');
//     t.deepEqual(response.data.relationships.siblings.data, [], 'Response has no related siblings');
//     t.end();
//   });
// });
