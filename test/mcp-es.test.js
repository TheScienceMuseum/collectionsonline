'use strict';

const test = require('tape');
const es = require('../lib/mcp/es');
const { ToolError } = require('../lib/mcp/errors');

const file = require('path').relative(process.cwd(), __filename) + ' > ';

const ok = (body = {}) => ({ body: Object.assign({ timed_out: false, _shards: { failed: 0 }, hits: { total: { value: 1, relation: 'eq' }, hits: [] } }, body) });

test(file + 'results are exact only when complete', async (t) => {
  t.equal((await es.search({ search: async () => ok() }, {})).exact, true);
  t.equal((await es.search({ search: async () => ok({ timed_out: true }) }, {})).exact, false, 'timed out');
  t.equal((await es.search({ search: async () => ok({ _shards: { failed: 1 } }) }, {})).exact, false, 'shard failure');
  t.equal((await es.search({ search: async () => ok({ hits: { total: { value: 10000, relation: 'gte' } } }) }, {})).exact, false, 'lower-bound total');
  t.end();
});

test(file + 'every search carries the MCP timeout', async (t) => {
  let seen;
  await es.search({ search: async (params, opts) => { seen = { params, opts }; return ok(); } }, { size: 0 });
  t.equal(seen.params.body.timeout, es.TIMEOUT);
  t.equal(seen.opts.requestTimeout, es.REQUEST_TIMEOUT);
  t.end();
});

test(file + 'ES errors become safe tool errors; a missing record is null', async (t) => {
  const origError = console.error;
  console.error = () => {};
  try {
    await es.search({ search: async () => { throw Object.assign(new Error('boom'), { name: 'ConnectionError' }); } }, {});
    t.fail('should throw');
  } catch (error) {
    t.ok(error instanceof ToolError);
    t.notOk(error.message.includes('boom'), 'internal detail not exposed');
  }
  try {
    await es.search({ search: async () => { throw Object.assign(new Error('Request timed out'), { name: 'TimeoutError' }); } }, {});
  } catch (error) {
    t.ok(/took too long/.test(error.message));
  }
  t.equal(await es.get({ get: async () => { throw Object.assign(new Error('nf'), { meta: { statusCode: 404 } }); } }, 'co1'), null);
  console.error = origError;
  t.end();
});

test(file + 'heavy queries beyond the concurrency cap get a busy error', async (t) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const slow = { search: async () => { await gate; return ok(); } };
  const running = [1, 2, 3].map(() => es.search(slow, {}, { heavy: true }));
  t.equal(es._state().active, 3);
  const start = Date.now();
  try {
    await es.search(slow, {}, { heavy: true });
    t.fail('fourth heavy query should be refused');
  } catch (error) {
    t.ok(/busy/.test(error.message), 'busy message');
    t.ok(Date.now() - start >= 1900, 'waited for a slot first');
  }
  release();
  await Promise.all(running);
  t.equal(es._state().active, 0, 'slots released');
  t.end();
});
