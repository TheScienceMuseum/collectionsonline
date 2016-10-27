const testWithServer = require('./helpers/test-with-server');
const cache = require('../bin/cache.js');
const stub = require('sinon').stub;
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Request for Archive HTML Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aabadRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer(file + 'Request for Archive JSON Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aabadRequest',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer(file + 'Request for Object HTML Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/cobadRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer(file + 'Request for Object JSON Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/objects/cobadRequest',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer(file + 'Request for Person HTML Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cpbadRequest',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer(file + 'Request for Person JSON Page but receive bad request from es', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cpbadRequest',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    t.end();
  });
});

testWithServer(file + 'Request for Person with related items', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/people/cp36993',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    var response = JSON.parse(res.payload);
    t.equal(res.statusCode, 200, 'Status code was as expected, 200');
    t.notOk(response.data.relationships.objects, 'Response has no related items');
    t.end();
  });
});

testWithServer(file + 'Search for JSON', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
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

testWithServer(file + 'Search for HTML', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
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

testWithServer(file + 'Request for Archive JSON with children', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  var cacheGet = stub(cache, 'get', function (options, cb) {
    return cb(new Error());
  });

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110000003',
    headers: {'Accept': 'application/vnd.api+json'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    cacheGet.restore();
    t.end();
  });
});

testWithServer(file + 'Request for Archive JSON with children', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  var cacheGet = stub(cache, 'get', function (options, cb) {
    return cb(new Error());
  });

  const htmlRequest = {
    method: 'GET',
    url: '/documents/aa110000003',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 503, 'Status code was as expected, 503');
    cacheGet.restore();
    t.end();
  });
});

testWithServer(file + 'Request for Person JSON with related items', {mock: {method: 'search', response: {error: true}}}, (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/people/ap8',
    headers: {'Accept': 'text/html'}
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Should still work');
    t.equal(res.payload.indexOf('See more'), -1, 'Should have no related items');
    t.end();
  });
});
