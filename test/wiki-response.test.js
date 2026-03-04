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
const fetchMock = require('fetch-mock');
const testWithServer = require('./helpers/test-with-server');
const cache = require('../bin/cache');
const config = require('../config');

const steveJobsFixture = require('./fixtures/wikidata/steve-jobs-Q19837.json');
const appleFixture = require('./fixtures/wikidata/apple-Q312.json');
const batchLabelsFixture = require('./fixtures/wikidata/batch-labels.json');

// Point global.fetch at a persistent fetch-mock sandbox so the wiki route
// never makes real HTTP calls. Matchers are registered in specificity order
// (first match wins); the final catch-all returns the batch labels fixture for
// any other wikidata.org call (e.g. the getManyEntities batch fetch).
const sandboxFetch = fetchMock.sandbox();
global.fetch = sandboxFetch;

// Q19837 primary entity fetch (single ID, full props)
sandboxFetch.get(/ids=Q19837/, steveJobsFixture);
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
          hits: queryStr.includes('Q312') ? [{ _id: 'cp20600' }] : []
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
          hits: queryStr.includes('Q5136071') ? [{ _id: 'cp99999' }] : []
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
