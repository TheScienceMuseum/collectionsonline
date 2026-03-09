'use strict';

/**
 * Regression tests for the /wiki/{qCode} route.
 *
 * These tests verify the shape and content of the processed Wikidata response
 * for Steve Jobs (Q19837) and Apple Inc. (Q312), using controlled fixtures so
 * they run offline without hitting the live Wikidata API.
 *
 * Fixtures live in test/fixtures/wikidata/.
 * They use fetch-mock to intercept calls to wikidata.org, and sinon to stub
 * the Elasticsearch client (used to find matching collection records).
 *
 * Run with: npm run test:unit:tape
 */

const sinon = require('sinon');

// fetch-mock v10 requires global Request/Response/Headers to be present.
// Node.js v16 doesn't have them built-in, so polyfill from node-fetch.
// Must be set before requiring fetch-mock so it picks them up at load time.
const nodeFetch = require('node-fetch');
if (!global.Request) global.Request = nodeFetch.Request;
if (!global.Response) global.Response = nodeFetch.Response;
if (!global.Headers) global.Headers = nodeFetch.Headers;

const fetchMock = require('fetch-mock');
const testWithServer = require('./helpers/test-with-server');
const cache = require('../bin/cache');
const config = require('../config');

const steveJobsFixture = require('./fixtures/wikidata/steve-jobs-Q19837.json');
const appleFixture = require('./fixtures/wikidata/apple-Q312.json');
const batchLabelsFixture = require('./fixtures/wikidata/batch-labels.json');
const duplicateEmployerFixture = require('./fixtures/wikidata/duplicate-employer-Q99001.json');

// Point global.fetch at a persistent fetch-mock sandbox so the wiki route
// never makes real HTTP calls. Matchers are registered in specificity order
// (first match wins); the final catch-all returns the batch labels fixture for
// any other wikidata.org call (e.g. the getManyEntities batch fetch).
const sandboxFetch = fetchMock.sandbox();
global.fetch = sandboxFetch;

// Q19837 primary entity fetch (single ID, full props)
sandboxFetch.get(/ids=Q19837/, steveJobsFixture);
// Q99001 duplicate-employer fixture (two P108 claims for the same employer)
sandboxFetch.get(/ids=Q99001/, duplicateEmployerFixture);
// Q312 primary entity fetch — 'ids=Q312&' identifies a single-ID request.
// Batch calls use pipe-separated IDs encoded as %7C, e.g. 'ids=Q312%7CQ24740'.
sandboxFetch.get((url) => url.includes('ids=Q312&'), appleFixture);
// Catch-all: batch label fetches (getManyEntities) and any other wikidata.org call
sandboxFetch.get(/wikidata\.org/, batchLabelsFixture);

// Test config: include a rootUrl so related links can be assembled correctly
const testConfig = Object.assign({}, config, {
  rootUrl: 'https://collection.sciencemuseumgroup.org.uk',
  auth: false
});

// Stub cache to simulate a miss, forcing full Wikidata processing each test.
// Returns a restore function to call after the test.
function stubCacheMiss () {
  const isReady = sinon.stub(cache, 'isReady').returns(true);
  const get = sinon.stub(cache, 'get').resolves(null);
  const set = sinon.stub(cache, 'set').resolves();
  return () => { isReady.restore(); get.restore(); set.restore(); };
}

// ─── Steve Jobs (Q19837) ───────────────────────────────────────────────────

testWithServer('wiki Q19837: returns 200 with JSON body', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q19837' });
  t.equal(res.statusCode, 200, 'status 200');
  t.doesNotThrow(() => JSON.parse(res.payload), 'payload is valid JSON');
  t.end();
});

testWithServer('wiki Q19837: image (P18) is a Wikimedia Commons URL', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q19837' });
  const body = JSON.parse(res.payload);

  t.ok(body.P18, 'P18 (Image) is present');
  t.ok(
    typeof body.P18 === 'string' && body.P18.includes('wikimedia.org'),
    `P18 is a wikimedia.org URL: ${body.P18}`
  );
  t.end();
});

testWithServer('wiki Q19837: employer (P108) includes "Apple Inc." and date range', { config: testConfig }, async (t, ctx) => {
  t.plan(3);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q19837' });
  const body = JSON.parse(res.payload);

  t.ok(body.P108 && Array.isArray(body.P108.value), 'P108 (Employer) is present with value array');
  const val = body.P108.value[0] && body.P108.value[0].value;
  t.ok(val && val.includes('Apple Inc.'), `value includes "Apple Inc.": "${val}"`);
  t.ok(val && val.includes('1997') && val.includes('2011'), `value includes date range 1997-2011: "${val}"`);
  t.end();
});

testWithServer('wiki Q19837: employer (P108) has related link when collection record found', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  // Return cp20600 when ES is queried for Apple's wikidata URL (Q312)
  sinon.stub(ctx.elastic, 'search').callsFake(async (opts) => {
    const queryStr = JSON.stringify(opts.body);
    return {
      body: {
        hits: {
          hits: queryStr.includes('Q312') ? [{ _id: 'cp20600', _source: { wikidata: 'https://www.wikidata.org/wiki/Q312' } }] : []
        }
      }
    };
  });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q19837' });
  const body = JSON.parse(res.payload);

  t.ok(body.P108 && body.P108.value[0], 'P108 has a value entry');
  t.ok(
    body.P108.value[0].related && body.P108.value[0].related.includes('/people/cp20600'),
    `employer entry links to /people/cp20600: "${body.P108.value[0].related}"`
  );
  t.end();
});

testWithServer('wiki Q19837: notable work (P800) is present with a label', { config: testConfig }, async (t, ctx) => {
  t.plan(3);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q19837' });
  const body = JSON.parse(res.payload);

  t.ok(body.P800, 'P800 (Notable Work) is present');
  t.ok(Array.isArray(body.P800.value), 'P800 value is an array');
  t.ok(body.P800.value[0] && body.P800.value[0].value, `P800 value[0] has a label: "${body.P800.value[0] && body.P800.value[0].value}"`);
  t.end();
});

// ─── Apple Inc. (Q312 / collection record cp20600) ────────────────────────

testWithServer('wiki Q312: returns 200 with JSON body', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  t.equal(res.statusCode, 200, 'status 200');
  t.doesNotThrow(() => JSON.parse(res.payload), 'payload is valid JSON');
  t.end();
});

testWithServer('wiki Q312: logo (P154) is a Wikimedia Commons URL', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  const body = JSON.parse(res.payload);

  t.ok(body.P154, 'P154 (Logo) is present');
  t.ok(
    typeof body.P154 === 'string' && body.P154.includes('wikimedia.org'),
    `P154 is a wikimedia.org URL: ${body.P154}`
  );
  t.end();
});

testWithServer('wiki Q312: inception (P571) includes 1976', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  const body = JSON.parse(res.payload);

  t.ok(body.P571 && Array.isArray(body.P571.value), 'P571 (Inception) is present');
  const val = body.P571.value[0] && body.P571.value[0].value;
  t.ok(val && String(val).includes('1976'), `inception value includes 1976: "${val}"`);
  t.end();
});

testWithServer('wiki Q312: owner of (P1830) includes "iTunes"', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  const body = JSON.parse(res.payload);

  t.ok(body.P1830 && Array.isArray(body.P1830.value), 'P1830 (Owner Of) is present');
  const val = body.P1830.value[0] && body.P1830.value[0].value;
  t.ok(val && val.includes('iTunes'), `owner of value includes "iTunes": "${val}"`);
  t.end();
});

testWithServer('wiki Q312: chief executive officers (P169) includes "Tim Cook"', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  const body = JSON.parse(res.payload);

  t.ok(body.P169 && Array.isArray(body.P169.value), 'P169 (CEO) is present');
  const val = body.P169.value[0] && body.P169.value[0].value;
  t.ok(val && val.includes('Tim Cook'), `CEO value includes "Tim Cook": "${val}"`);
  t.end();
});

testWithServer('wiki Q312: CEO (P169) has related link when collection record found', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  // Return a fake collection record when ES is queried for Tim Cook's wikidata URL (Q5136071)
  sinon.stub(ctx.elastic, 'search').callsFake(async (opts) => {
    const queryStr = JSON.stringify(opts.body);
    return {
      body: {
        hits: {
          hits: queryStr.includes('Q5136071') ? [{ _id: 'cp99999', _source: { wikidata: 'https://www.wikidata.org/wiki/Q5136071' } }] : []
        }
      }
    };
  });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  const body = JSON.parse(res.payload);

  t.ok(body.P169 && body.P169.value[0], 'P169 (CEO) has a value entry');
  t.ok(
    body.P169.value[0].related && body.P169.value[0].related.includes('/people/cp99999'),
    `CEO entry links to /people/cp99999: "${body.P169.value[0].related}"`
  );
  t.end();
});

// ─── Also in our collection: names should not include date ranges ──────────

testWithServer('wiki Q312: alsoInCollection uses clean label without date ranges', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  // Return a fake collection record for Tim Cook (Q5136071) — appears under P169 (CEO)
  sinon.stub(ctx.elastic, 'search').callsFake(async (opts) => {
    const queryStr = JSON.stringify(opts.body);
    return {
      body: {
        hits: {
          hits: queryStr.includes('Q5136071') ? [{ _id: 'cp99999', _source: { wikidata: 'https://www.wikidata.org/wiki/Q5136071' } }] : []
        }
      }
    };
  });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  const body = JSON.parse(res.payload);

  t.ok(body.alsoInCollection && body.alsoInCollection.length > 0, 'alsoInCollection is present');
  const entry = body.alsoInCollection.find(e => e.url.includes('cp99999'));
  t.ok(
    entry && !/\(\d{4}/.test(entry.name),
    `alsoInCollection name should not contain date ranges: "${entry && entry.name}"`
  );
  t.end();
});

// ─── Cross-link: Apple Inc. → Founded By → Steve Jobs (cp50119) ───────────

testWithServer('wiki Q312: founded by (P112) includes "Steve Jobs"', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  const body = JSON.parse(res.payload);

  t.ok(body.P112 && Array.isArray(body.P112.value), 'P112 (Founded By) is present');
  const val = body.P112.value[0] && body.P112.value[0].value;
  t.ok(val && val.includes('Steve Jobs'), `founded by value includes "Steve Jobs": "${val}"`);
  t.end();
});

testWithServer('wiki Q312: founded by (P112) has related link when collection record found', { config: testConfig }, async (t, ctx) => {
  t.plan(2);
  const restore = stubCacheMiss();
  t.teardown(restore);
  // Return cp50119 when ES is queried for Steve Jobs' wikidata URL (Q19837)
  sinon.stub(ctx.elastic, 'search').callsFake(async (opts) => {
    const queryStr = JSON.stringify(opts.body);
    return {
      body: {
        hits: {
          hits: queryStr.includes('Q19837') ? [{ _id: 'cp50119', _source: { wikidata: 'https://www.wikidata.org/wiki/Q19837' } }] : []
        }
      }
    };
  });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q312' });
  const body = JSON.parse(res.payload);

  t.ok(body.P112 && body.P112.value[0], 'P112 (Founded By) has a value entry');
  t.ok(
    body.P112.value[0].related && body.P112.value[0].related.includes('/people/cp50119'),
    `founded by entry links to /people/cp50119: "${body.P112.value[0].related}"`
  );
  t.end();
});

// ─── Colleagues (Q19837 / People who worked alongside) ───────────────────────

// The Steve Jobs fixture has P108: Q312 (Apple). These tests verify that
// colleagues are surfaced when SPARQL returns colleague Q-codes that are
// also found in the ES collection.

testWithServer('wiki Q19837: colleagues present when SPARQL + ES return matches', { config: testConfig }, async (t, ctx) => {
  t.plan(4);
  const restore = stubCacheMiss();
  t.teardown(restore);

  // Per-test fetch sandbox: intercept SPARQL and fall back to the shared fixtures
  const testFetch = fetchMock.sandbox();
  testFetch.get(/ids=Q19837/, steveJobsFixture);
  // SPARQL query for P108=Q312 colleagues → returns one Q-code
  testFetch.get((url) => url.includes('query.wikidata.org'), {
    results: {
      bindings: [
        { item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1234567' } }
      ]
    }
  });
  testFetch.get(/wikidata\.org/, batchLabelsFixture);

  const prevFetch = global.fetch;
  global.fetch = testFetch;
  t.teardown(() => { global.fetch = prevFetch; });

  // ES returns a collection record for the colleague Q-code
  sinon.stub(ctx.elastic, 'search').callsFake(async (opts) => {
    const queryStr = JSON.stringify(opts.body);
    if (queryStr.includes('Q1234567')) {
      return {
        body: {
          hits: {
            hits: [{
              _id: 'cp11111',
              _source: {
                wikidata: 'https://www.wikidata.org/wiki/Q1234567',
                name: [{ value: 'Ada Lovelace', primary: true }]
              }
            }]
          }
        }
      };
    }
    return { body: { hits: { hits: [] } } };
  });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q19837' });
  const body = JSON.parse(res.payload);

  t.ok(Array.isArray(body.colleagues), 'colleagues array is present');
  t.ok(body.colleagues.length > 0, 'colleagues array is non-empty');
  const group = body.colleagues[0];
  t.ok(group && group.employer, 'colleague group has employer label');
  t.ok(
    group && group.colleagues && group.colleagues[0]?.name === 'Ada Lovelace',
    `first colleague is "Ada Lovelace": "${group && group.colleagues && group.colleagues[0]?.name}"`
  );
  t.end();
});

testWithServer('wiki Q19837: colleagues absent when no collection records match', { config: testConfig }, async (t, ctx) => {
  t.plan(1);
  const restore = stubCacheMiss();
  t.teardown(restore);
  // Default catch-all returns batchLabelsFixture (no results.bindings → empty colleagues)
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q19837' });
  const body = JSON.parse(res.payload);

  t.notOk(body.colleagues, 'colleagues is absent when no collection records match');
  t.end();
});

// ─── Duplicate context-property deduplication ─────────────────────────────────
//
// Regression for the case where Wikidata holds two claims for the same employer
// (one with date qualifiers, one without). Both resolve to the same label, so
// only the richer entry (the one with dates) should appear in the output.

testWithServer('wiki Q99001: duplicate P108 claims for same employer collapse to one entry', { config: testConfig }, async (t, ctx) => {
  t.plan(3);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q99001' });
  const body = JSON.parse(res.payload);

  t.ok(body.P108 && Array.isArray(body.P108.value), 'P108 is present');
  t.equal(body.P108.value.length, 1, 'deduplicated to exactly one entry');
  const val = body.P108.value[0] && body.P108.value[0].value;
  t.ok(val && val.includes('1997') && val.includes('2011'), `surviving entry includes date range: "${val}"`);
  t.end();
});

// ─── Input validation ─────────────────────────────────────────────────────────

testWithServer('wiki: invalid entity ID returns 400', { config: testConfig }, async (t, ctx) => {
  t.plan(3);

  const invalidIds = ['Hans_Christian_Ørsted', 'cabaça', 'not-a-qcode'];
  for (const id of invalidIds) {
    const res = await ctx.server.inject({ method: 'GET', url: `/wiki/${encodeURIComponent(id)}` });
    t.equal(res.statusCode, 400, `${id} returns 400`);
  }
  t.end();
});

// ─── HTML error page handling ─────────────────────────────────────────────────

testWithServer('wiki: HTML response from Wikidata returns 503', { config: testConfig }, async (t, ctx) => {
  t.plan(1);
  const restore = stubCacheMiss();
  t.teardown(restore);
  sinon.stub(ctx.elastic, 'search').resolves({ body: { hits: { hits: [] } } });

  const htmlFetch = fetchMock.sandbox();
  htmlFetch.get(/wikidata\.org/, {
    status: 200,
    body: '<!DOCTYPE html><html><body>Bot protection</body></html>',
    headers: { 'content-type': 'text/html' }
  });
  const prevFetch = global.fetch;
  global.fetch = htmlFetch;
  t.teardown(() => { global.fetch = prevFetch; });

  const res = await ctx.server.inject({ method: 'GET', url: '/wiki/Q19837' });
  t.equal(res.statusCode, 503, 'HTML Wikidata response yields 503');
  t.end();
});
