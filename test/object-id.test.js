'use strict';

var testWithServer = require('./helpers/test-with-server');
var dir = __dirname.split('/')[__dirname.split('/').length - 1];
var file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Request for object id page 1970-54', {}, (t, ctx) => {
  var htmlRequest = {
    method: 'GET',
    url: '/oid/1970-54'
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 200, 'Status code was as expected');
    t.equal(res.payload, '{"found":true,"error":null,"path":"/objects/co33448"}', 'The path found is /objects/co33448');
    t.end();
  });
});

testWithServer(file + 'Request for object id page 1970-54 with redirect true', {}, (t, ctx) => {
  var htmlRequest = {
    method: 'GET',
    url: '/oid/1970-54?redirect=true'
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 302, 'Status code was as expected');
    t.equal(res.headers.location, '/objects/co33448', 'redirect to /objects/co33448');
    t.end();
  });
});

testWithServer(file + 'Request for object id with wrong id', {}, (t, ctx) => {
  var htmlRequest = {
    method: 'GET',
    url: '/oid/15433554wrong?redirect=true'
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.equal(res.statusCode, 404, 'Status code was as expected');
    t.equal(res.payload, '{"found":false,"error":"Not Found","path":""}', 'get a 404 json response');
    t.end();
  });
});

testWithServer('Trigger server error', {mock: {method: 'get', response: {error: true}}}, (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/oid/1234'
  };

  ctx.server.inject(htmlRequest, (res) => {
    t.ok(res.statusCode, 503, 'server is unavailable');
    t.end();
  });
});
