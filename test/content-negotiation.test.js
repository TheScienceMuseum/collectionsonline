const testWithServer = require('./helpers/test-with-server');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

testWithServer(file + 'Request for HTML Content', {}, async (t, ctx) => {
  t.plan(2);

  const htmlRequest = {
    method: 'GET',
    url: '/',
    headers: { 'Accept': 'text/html' }
  };

  const res = await ctx.server.inject(htmlRequest);
  t.ok(res.payload.toLowerCase().indexOf('<!doctype html>') > -1, 'HTML request should respond with HTML');
  t.ok(res.headers['content-type'].indexOf('text/html') > -1, 'Response header should be text/html');
  t.end();
});

testWithServer(file + 'Request for JSONAPI Content', {}, async (t, ctx) => {
  // http://jsonapi.org/format/#content-negotiation-servers
  //
  // Servers MUST send all JSON API data in response documents with the header
  // `Content-Type: application/vnd.api+json` without any media type parameters.
  t.plan(1);

  const jsonRequest = {
    method: 'GET',
    url: '/search?q=test',
    headers: { 'Accept': 'application/vnd.api+json' }
  };

  const res = await ctx.server.inject(jsonRequest);
  t.ok(res.headers['content-type'].indexOf('application/vnd.api+json') > -1, 'JSONAPI response header should be application/vnd.api+json');
  t.end();
});

testWithServer(file + 'Request with multiple instances of JSONAPI media type, one without parameters', {}, async (t, ctx) => {
  t.plan(1);

  const acceptableJSONRequest = {
    method: 'GET',
    url: '/search?q=test',
    headers: { 'Accept': 'application/vnd.api+json; charset=utf-8, application/vnd.api+json' }
  };

  const res = await ctx.server.inject(acceptableJSONRequest);
  t.equal(res.statusCode, 200, 'At least one JSONAPI without parameters should work');
  t.end();
});

testWithServer(file + 'Not acceptable request when to accept header', {}, async (t, ctx) => {
  t.plan(1);

  const acceptableJSONRequest = {
    method: 'GET',
    url: '/'
  };

  const res = await ctx.server.inject(acceptableJSONRequest);
  t.equal(res.statusCode, 406, 'Not acceptable request when no accept header is defined');
  t.end();
});

testWithServer(file + 'Not acceptable if json and html header are defined at the same time', {}, async (t, ctx) => {
  t.plan(1);

  const acceptableJSONRequest = {
    method: 'GET',
    url: '/',
    headers: { 'Accept': 'text/html, application/json' }
  };

  const res = await ctx.server.inject(acceptableJSONRequest);
  t.equal(res.statusCode, 406, 'Not acceptable request when a json and html header are defined at the same time');
  t.end();
});

testWithServer(file + 'Return html if user agent is twitter bot', {}, async (t, ctx) => {
  t.plan(1);

  const acceptableJSONRequest = {
    method: 'GET',
    url: '/',
    headers: { 'user-agent': 'Twitterbot' }
  };

  const res = await ctx.server.inject(acceptableJSONRequest);
  t.equal(res.statusCode, 200, 'return some html for twitter');
  t.end();
});

testWithServer(file + 'Not acceptable if no accept header and no user-agent twitter', {}, async (t, ctx) => {
  t.plan(1);

  const acceptableJSONRequest = {
    method: 'GET',
    url: '/',
    headers: { 'user-agent': 'bot' }
  };

  const res = await ctx.server.inject(acceptableJSONRequest);
  t.equal(res.statusCode, 406, 'not acceptage if user-agent is not twitter');
  t.end();
});
