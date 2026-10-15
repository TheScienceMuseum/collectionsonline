'use strict';

const test = require('tape');
const { authenticate } = require('../lib/mcp/auth');

const file = require('path').relative(process.cwd(), __filename) + ' > ';
const COPILOT = 'c'.repeat(40);
const PUBLIC_PARTNER = 'p'.repeat(40);

const config = (extra = {}) => Object.assign({
  mcpAccess: 'token',
  mcpClients: {
    copilot: { token: COPILOT, tier: 'internal' },
    partner: { token: PUBLIC_PARTNER, tier: 'public' },
    shorthand: 's'.repeat(40),
    tooShort: { token: 'short' }
  },
  adminToken: 'a'.repeat(40),
  cacheClearToken: 'z'.repeat(40)
}, extra);

const request = (headers = {}, query = {}) => ({ headers, query });

test(file + 'token mode: a valid bearer or X-API-Key token resolves client and tier', (t) => {
  t.deepEqual(authenticate(request({ authorization: 'Bearer ' + COPILOT }), config()), { ok: true, client: 'copilot', tier: 'internal' });
  t.deepEqual(authenticate(request({ 'x-api-key': PUBLIC_PARTNER }), config()), { ok: true, client: 'partner', tier: 'public' });
  t.deepEqual(authenticate(request({ authorization: 'bearer ' + 's'.repeat(40) }), config()), { ok: true, client: 'shorthand', tier: 'internal' }, 'string shorthand = internal');
  t.end();
});

test(file + 'token mode: missing, wrong, too-short and admin tokens are rejected', (t) => {
  t.equal(authenticate(request(), config()).ok, false);
  t.equal(authenticate(request({ authorization: 'Bearer nope' }), config()).ok, false);
  t.equal(authenticate(request({ authorization: 'Bearer short' }), config()).ok, false, 'tokens under 32 chars are ignored');
  t.equal(authenticate(request({ authorization: 'Bearer ' + 'a'.repeat(40) }), config()).ok, false, 'admin token is not an MCP token');
  t.equal(authenticate(request({ authorization: 'Bearer ' + 'z'.repeat(40) }), config()).ok, false, 'cache-clear token is not an MCP token');
  t.end();
});

test(file + 'open mode: anonymous is public, tokens still upgrade, bad tokens still fail', (t) => {
  const open = config({ mcpAccess: 'open' });
  t.deepEqual(authenticate(request(), open), { ok: true, client: 'anonymous', tier: 'public' });
  t.deepEqual(authenticate(request({ authorization: 'Bearer ' + COPILOT }), open), { ok: true, client: 'copilot', tier: 'internal' });
  t.equal(authenticate(request({ authorization: 'Bearer wrong' }), open).ok, false);
  t.end();
});

test(file + '?key= is only accepted when mcpAllowQueryKey is on', (t) => {
  t.equal(authenticate(request({}, { key: COPILOT }), config()).ok, false);
  t.deepEqual(authenticate(request({}, { key: COPILOT }), config({ mcpAllowQueryKey: 'true' })), { ok: true, client: 'copilot', tier: 'internal' });
  t.end();
});
