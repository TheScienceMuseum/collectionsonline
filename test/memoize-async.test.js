const test = require('tape');
const memoizeAsync = require('../lib/helpers/memoize-async');

function clock (start) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('memoizeAsync: reuses a value until the TTL expires', async (t) => {
  const c = clock(1000);
  let calls = 0;
  const load = memoizeAsync(async () => ++calls, { ttlMs: 100, now: c.now });

  t.equal(await load(), 1, 'first call computes');
  c.advance(99);
  t.equal(await load(), 1, 'within TTL the cached value is returned');
  c.advance(1);
  t.equal(await load(), 2, 'after TTL the value is recomputed');
  t.end();
});

test('memoizeAsync: a key change forces a recompute', async (t) => {
  const c = clock(1000);
  let key = 'period-1';
  let calls = 0;
  const load = memoizeAsync(async () => ++calls, { key: () => key, ttlMs: 100000, now: c.now });

  await load();
  key = 'period-2';
  t.equal(await load(), 2, 'new key recomputes even though the TTL has not passed');
  t.equal(await load(), 2, 'and is then cached under the new key');
  t.end();
});

test('memoizeAsync: concurrent callers share one in-flight call', async (t) => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const load = memoizeAsync(async () => { calls++; await gate; return 'value'; }, { ttlMs: 1000 });

  const pending = [load(), load(), load()];
  release();
  const results = await Promise.all(pending);

  t.equal(calls, 1, 'underlying function ran once');
  t.deepEqual(results, ['value', 'value', 'value'], 'every caller got the result');
  t.end();
});

test('memoizeAsync: empty results are kept only for failureTtlMs', async (t) => {
  const c = clock(1000);
  let calls = 0;
  const load = memoizeAsync(async () => { calls++; return null; }, { ttlMs: 100000, failureTtlMs: 50, now: c.now });

  await load();
  await load();
  t.equal(calls, 1, 'a null result is reused within failureTtlMs');
  c.advance(50);
  await load();
  t.equal(calls, 2, 'and retried once failureTtlMs has passed');
  t.end();
});

test('memoizeAsync: errors reach every waiter and are not cached', async (t) => {
  let calls = 0;
  const load = memoizeAsync(async () => {
    calls++;
    if (calls === 1) throw new Error('boom');
    return 'ok';
  }, { ttlMs: 100000 });

  const results = await Promise.allSettled([load(), load()]);
  t.deepEqual(results.map((r) => r.status), ['rejected', 'rejected'], 'both waiters see the error');
  t.equal(await load(), 'ok', 'next call retries rather than returning a cached failure');
  t.equal(calls, 2, 'one failed call, one retry');
  t.end();
});

test('memoizeAsync: forwards arguments to the wrapped function', async (t) => {
  const load = memoizeAsync(async (a, b) => a + b, { ttlMs: 1000 });
  t.equal(await load(2, 3), 5, 'arguments reach the function');
  t.end();
});
