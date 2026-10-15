'use strict';

const test = require('tape');
const sinon = require('sinon');
const createServer = require('../server');
const baseConfig = require('../config');

const file = require('path').relative(process.cwd(), __filename) + ' > ';
const TOKEN = 't'.repeat(40);
const PROTOCOL = '2025-06-18';

const mcpConfig = (extra = {}) => Object.assign({}, baseConfig, {
  auth: false,
  mcpEnabled: true,
  mcpAccess: 'token',
  mcpClients: { tests: { token: TOKEN, tier: 'internal' } },
  mcpGa4MeasurementId: '',
  mcpGa4ApiSecret: ''
}, extra);

const countResponse = (total) => ({
  body: { timed_out: false, _shards: { failed: 0 }, hits: { total: { value: total, relation: 'eq' }, hits: [] } }
});

const withServer = (config, elastic) => new Promise((resolve, reject) => {
  createServer(elastic, config, (err, ctx) => (err ? reject(err) : resolve(ctx)));
});

const rpc = (server, body, headers = {}) => server.inject({
  method: 'POST',
  url: '/mcp',
  payload: body,
  headers: Object.assign({
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': PROTOCOL
  }, headers)
});

// Responses to 2025-era clients arrive as a single server-sent event.
const parse = (res) => {
  const data = res.payload.split('\n').find((line) => line.startsWith('data: '));
  return JSON.parse(data ? data.slice(6) : res.payload);
};

const auth = { authorization: 'Bearer ' + TOKEN };

test(file + 'returns 404 while disabled', async (t) => {
  const ctx = await withServer(mcpConfig({ mcpEnabled: false }), { search: sinon.stub() });
  const res = await rpc(ctx.server, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, auth);
  t.equal(res.statusCode, 404);
  await ctx.server.stop();
  t.end();
});

test(file + 'token mode rejects missing and wrong tokens with JSON, never a login redirect', async (t) => {
  const adminToken = 'a'.repeat(40);
  const ctx = await withServer(mcpConfig({ adminToken }), { search: sinon.stub() });
  let res = await rpc(ctx.server, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  t.equal(res.statusCode, 401);
  t.equal(res.headers['www-authenticate'], 'Bearer realm="smg-collection"');
  t.equal(JSON.parse(res.payload).error.code, -32001);

  res = await rpc(ctx.server, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { authorization: 'Bearer wrong', accept: 'text/html' });
  t.equal(res.statusCode, 401, 'HTML-accepting client still gets 401, not a redirect');
  t.ok(res.headers['content-type'].startsWith('application/json'));

  res = await rpc(ctx.server, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { authorization: 'Bearer ' + adminToken });
  t.equal(res.statusCode, 401, 'admin token is not accepted');
  await ctx.server.stop();
  t.end();
});

test(file + 'initialize, list the six read-only tools, then call one', async (t) => {
  const elastic = { search: sinon.stub().resolves(countResponse(7266)), get: sinon.stub() };
  const ctx = await withServer(mcpConfig(), elastic);

  let res = await rpc(ctx.server, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'tests', version: '1' } }
  }, auth);
  t.equal(res.statusCode, 200);
  const init = parse(res).result;
  t.equal(init.serverInfo.name, 'smg-collection');
  t.ok(init.instructions.includes('breakdown_records'), 'server instructions sent');
  t.equal(res.headers['x-robots-tag'], 'noindex');

  res = await rpc(ctx.server, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, auth);
  const tools = parse(res).result.tools;
  t.deepEqual(tools.map((tool) => tool.name).sort(), [
    'breakdown_records', 'count_records', 'get_collection_overview', 'get_hierarchy', 'get_record', 'search_collection'
  ]);
  t.ok(tools.every((tool) => tool.annotations && tool.annotations.readOnlyHint === true), 'all tools read-only');

  res = await rpc(ctx.server, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'count_records', arguments: { type: 'objects', museum: 'nrm' } }
  }, auth);
  const call = parse(res).result;
  t.notOk(call.isError);
  t.equal(call.structuredContent.total, 7266);
  t.equal(call.structuredContent.filters_applied.museum, 'National Railway Museum');
  const sent = elastic.search.firstCall.args[0];
  t.equal(sent.body.size, 0);
  t.equal(sent.body.track_total_hits, true);
  t.ok(JSON.stringify(sent.body.query).includes('"@datatype.base":"object"'));
  await ctx.server.stop();
  t.end();
});

test(file + 'invalid arguments and ES failures come back as tool errors', async (t) => {
  const origError = console.error;
  console.error = () => {};
  const elastic = { search: sinon.stub().rejects(Object.assign(new Error('cluster on fire'), { name: 'ConnectionError' })) };
  const ctx = await withServer(mcpConfig(), elastic);

  let res = await rpc(ctx.server, {
    jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'count_records', arguments: { type: 'objects' } }
  }, auth);
  let call = parse(res).result;
  t.equal(call.isError, true);
  t.notOk(call.content[0].text.includes('cluster on fire'), 'ES detail not exposed');

  res = await rpc(ctx.server, {
    jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'count_records', arguments: { type: 'things' } }
  }, auth);
  call = parse(res).result;
  t.equal(call.isError, true, 'schema validation error');
  console.error = origError;
  await ctx.server.stop();
  t.end();
});

test(file + 'GET and DELETE are 405; oversized bodies are a JSON 413', async (t) => {
  const ctx = await withServer(mcpConfig(), { search: sinon.stub() });
  let res = await ctx.server.inject({ method: 'GET', url: '/mcp', headers: { accept: 'text/html' } });
  t.equal(res.statusCode, 405);
  t.equal(res.headers.allow, 'POST');
  res = await ctx.server.inject({ method: 'DELETE', url: '/mcp' });
  t.equal(res.statusCode, 405);
  res = await rpc(ctx.server, 'x'.repeat(70 * 1024), Object.assign({ accept: 'text/html' }, auth));
  t.equal(res.statusCode, 413);
  t.ok(res.headers['content-type'].startsWith('application/json'), 'no HTML error page');
  await ctx.server.stop();
  t.end();
});

test(file + 'open mode: no token needed, but a wrong token is still rejected', async (t) => {
  const elastic = { search: sinon.stub().resolves(countResponse(3)) };
  const ctx = await withServer(mcpConfig({ mcpAccess: 'open' }), elastic);
  let res = await rpc(ctx.server, {
    jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'count_records', arguments: { type: 'people' } }
  });
  t.equal(res.statusCode, 200);
  t.equal(parse(res).result.structuredContent.total, 3);

  res = await rpc(ctx.server, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { authorization: 'Bearer wrong' });
  t.equal(res.statusCode, 401);
  await ctx.server.stop();
  t.end();
});

test(file + 'works when the site-wide JWT auth is switched on', async (t) => {
  const jwtSecret = baseConfig.JWT_SECRET;
  baseConfig.JWT_SECRET = 'encodethejwt';
  const elastic = { search: sinon.stub().resolves(countResponse(1)) };
  const ctx = await withServer(mcpConfig({ auth: true, JWT_SECRET: 'encodethejwt' }), elastic);
  const res = await rpc(ctx.server, {
    jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'count_records', arguments: { type: 'objects' } }
  }, auth);
  t.equal(res.statusCode, 200, '/mcp is not behind the JWT cookie');
  t.equal(parse(res).result.structuredContent.total, 1);
  baseConfig.JWT_SECRET = jwtSecret;
  await ctx.server.stop();
  t.end();
});

// Captures console.error and console.warn while fn runs.
const captureLogs = async (fn) => {
  const logged = { error: [], warn: [] };
  const errorStub = sinon.stub(console, 'error').callsFake((...args) => { logged.error.push(args.join(' ')); });
  const warnStub = sinon.stub(console, 'warn').callsFake((...args) => { logged.warn.push(args.join(' ')); });
  try {
    return { result: await fn(), logged };
  } finally {
    errorStub.restore();
    warnStub.restore();
  }
};

test(file + 'malformed requests the SDK rejects are logged as one short line, never the token', async (t) => {
  const ctx = await withServer(mcpConfig(), { search: sinon.stub() });
  const { result: res, logged } = await captureLogs(() => rpc(ctx.server, { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    Object.assign({ 'mcp-protocol-version': '2099-01-01' }, auth)));
  t.equal(res.statusCode, 400, 'unknown protocol revision rejected by the SDK');
  t.equal(logged.warn.length, 1, 'exactly one line');
  t.equal(logged.error.length, 0, 'nothing logged as an error, so no stack trace');
  const entry = JSON.parse(logged.warn[0]);
  t.equal(entry.evt, 'mcp_rejected');
  t.equal(entry.status, 400);
  t.equal(entry.rpc, 'tools/list');
  t.equal(entry.protocol, '2099-01-01');
  t.equal(entry.client, 'tests');
  t.ok(entry.ref, 'has a reference id');
  t.notOk(logged.warn.concat(logged.error).join('\n').includes(TOKEN), 'token never logged');
  await ctx.server.stop();
  t.end();
});

test(file + 'junk tokens are rejected without logging anything', async (t) => {
  const ctx = await withServer(mcpConfig(), { search: sinon.stub() });
  const { result: res, logged } = await captureLogs(() => rpc(ctx.server, { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { authorization: 'Bearer junk-token-junk-token-junk-token-junk' }));
  t.equal(res.statusCode, 401);
  t.equal(logged.warn.length + logged.error.length, 0, 'nothing logged');
  await ctx.server.stop();
  t.end();
});

test(file + 'server errors are logged with a stack trace and a reference the caller sees', async (t) => {
  const ctx = await withServer(mcpConfig(), { search: sinon.stub() });
  // A header value the web Request can't hold makes the bridge itself throw.
  const { result: res, logged } = await captureLogs(() => rpc(ctx.server, { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    Object.assign({ 'x-test': 'bad\u0100value' }, auth)));
  t.equal(res.statusCode, 500);
  const body = JSON.parse(res.payload);
  const match = /ref ([0-9a-f-]{36})/.exec(body.error.message);
  t.ok(match, 'response carries a reference id');
  const line = logged.error.find((l) => l.includes('"evt":"mcp_error"'));
  t.ok(line, 'mcp_error logged');
  const entry = JSON.parse(line);
  t.equal(entry.label, 'bridge');
  t.equal(entry.ref, match[1], 'log and response share the reference');
  t.ok(logged.error.some((l) => l.includes('    at ')), 'stack trace logged');
  t.notOk(logged.error.join('\n').includes(TOKEN), 'token never logged');
  await ctx.server.stop();
  t.end();
});
