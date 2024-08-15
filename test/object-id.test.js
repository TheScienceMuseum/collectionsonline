'use strict';

const config = require('../config');

const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Request for object id page 1970-54', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/oid/1970-54'
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 200, 'Status code was as expected');
  t.equal(res.payload, '{"found":true,"error":null,"path":"/objects/co33448/sample-of-deep-sea-section-of-first-transatlantic-cable-1857-1858"}', 'The path found is /objects/co33448/sample-of-deep-sea-section-of-first-transatlantic-cable-1857-1858-cable');
  t.end();
});

testWithServer(file + 'Request for object id page 1970-54 with redirect true', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/oid/1970-54?redirect=true'
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 301, 'Status code was as expected');
  t.equal(res.headers.location, config.rootUrl + '/objects/co33448/sample-of-deep-sea-section-of-first-transatlantic-cable-1857-1858', 'redirect to /objects/co33448/sample-of-deep-sea-section-of-first-transatlantic-cable-1857-1858-cable');
  t.end();
});

testWithServer(file + 'Request for object id with wrong id', {}, async (t, ctx) => {
  const htmlRequest = {
    method: 'GET',
    url: '/oid/15433554wrong?redirect=true'
  };

  const res = await ctx.server.inject(htmlRequest);
  t.equal(res.statusCode, 404, 'Status code was as expected');
  t.equal(res.payload, '{"found":false,"error":"Not Found","path":""}', 'get a 404 json response');
  t.end();
});

testWithServer('Trigger server error', { mock: { method: 'get', response: { error: true } } }, async (t, ctx) => {
  t.plan(1);

  const htmlRequest = {
    method: 'GET',
    url: '/oid/1234'
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.statusCode, 503, 'server is unavailable');
  t.end();
});
