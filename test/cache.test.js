const cachedDocument = require('../lib/cached-document');
const { stub, useFakeTimers } = require('sinon');
const test = require('tape');
const cache = require('../bin/cache.js');
const elastic = require('./helpers/mock-database')();
const archiveTree = require('../lib/archive-tree');

// Note: cache.start() is called in bin/server.mjs at startup, NOT here.
// Tests control cache behaviour entirely via sinon stubs — no Redis required.

// Shape of an ES scroll response page, as consumed by lib/get-full-archive.js
const scrollPage = (hits, total) => ({
  body: {
    _scroll_id: 'scroll-1',
    hits: { total: { value: total }, hits }
  }
});

test('Get fonds data: cache miss falls back to Elasticsearch', async function (t) {
  t.plan(1);
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves(null);
  const cacheSet = stub(cache, 'set').resolves();

  const elasticGet = stub(elastic, 'get').resolves({
    body: {
      _source: {
        level: { value: 'fonds' },
        summary: { title: 'doc' },
        identifier: [{ value: 'BAB' }]
      }
    }
  });
  const elasticSearch = stub(elastic, 'search').resolves(scrollPage([], 0));
  const elasticClearScroll = stub(elastic, 'clearScroll').resolves({});

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  t.ok(data, 'data returned from elasticsearch on cache miss');
  cacheIsReady.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
  elasticSearch.restore();
  elasticClearScroll.restore();
});

test('Get cached document: cache hit returns stored item', async function (t) {
  t.plan(1);
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves({ item: 'cached-tree', stored: Date.now(), ttl: 100000000 });

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  t.equal(data, 'cached-tree', 'cached item is returned correctly');
  cacheIsReady.restore();
  cacheGet.restore();
});

test('Get child document data: falls back to Elasticsearch', async function (t) {
  t.plan(1);
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves(null);
  const cacheSet = stub(cache, 'set').resolves();

  const elasticGet = stub(elastic, 'get').resolves({
    body: {
      _source: {
        level: { value: 'document' },
        fonds: [{ '@admin': { uid: 'smga-documents-110000003' }, summary: { title: 'doc' } }],
        summary: { title: 'doc' },
        identifier: [{ value: 'BAB' }]
      }
    }
  });

  const elasticSearch = stub(elastic, 'search').resolves(scrollPage([], 0));
  const elasticClearScroll = stub(elastic, 'clearScroll').resolves({});

  const archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return {};
  });

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');

  t.ok(data !== undefined, 'data returned from elasticsearch');
  cacheIsReady.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
  elasticSearch.restore();
  elasticClearScroll.restore();
  archiveTreeSort.restore();
});

test('Get single document with no fonds: returns minimal record', async function (t) {
  t.plan(1);
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves(null);
  const cacheSet = stub(cache, 'set').resolves();

  const elasticGet = stub(elastic, 'get').resolves({
    body: {
      _source: {
        level: { value: 'document' },
        summary: { title: 'doc' },
        identifier: [{ value: 'BAB' }]
      }
    }
  });

  const archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return {};
  });

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  t.ok(data !== undefined, 'data returned from elasticsearch');
  cacheIsReady.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
  archiveTreeSort.restore();
});

// Search errors are now caught gracefully in getFullArchive (commit 8b0455ba)
// and return a partial/incomplete tree instead of throwing, so the previous
// assertions (error thrown, no data) no longer apply. We now verify that a
// result is returned despite the search failure.
test('Elasticsearch search error returns incomplete tree instead of throwing', async function (t) {
  t.plan(2);
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves(null);
  const cacheSet = stub(cache, 'set').resolves();

  const elasticGet = stub(elastic, 'get').resolves({
    body: {
      _source: {
        level: { value: 'document' },
        fonds: [{ '@admin': { uid: 'smga-documents-110000003' }, summary: { title: 'doc' } }],
        summary: { title: 'doc' },
        identifier: [{ value: 'BAB' }]
      }
    }
  });

  const elasticSearch = stub(elastic, 'search').rejects(new Error('ES error'));

  const archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return data;
  });

  let data;
  let error;

  try {
    data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  } catch (err) {
    error = err;
  }

  t.notOk(error, 'No error thrown — search failure handled gracefully');
  t.ok(data, 'Partial data returned despite search error');
  cacheIsReady.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
  elasticSearch.restore();
  archiveTreeSort.restore();
  // Clear the failure back-off so later tests on this fondsId do a real fetch.
  cachedDocument._reset();
});

test('Cache unavailable: falls back to Elasticsearch without error', async function (t) {
  t.plan(1);
  // isReady() returns false (default NULL_CACHE / unstarted behaviour)
  const cacheIsReady = stub(cache, 'isReady').returns(false);

  const elasticGet = stub(elastic, 'get').resolves({
    body: {
      _source: {
        level: { value: 'fonds' },
        summary: { title: 'doc' },
        identifier: [{ value: 'BAB' }]
      }
    }
  });
  const elasticSearch = stub(elastic, 'search').resolves(scrollPage([], 0));
  const elasticClearScroll = stub(elastic, 'clearScroll').resolves({});

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  t.ok(data, 'data returned from elasticsearch when cache is unavailable');
  cacheIsReady.restore();
  elasticGet.restore();
  elasticSearch.restore();
  elasticClearScroll.restore();
});

test('Truncated archive fetch is returned but never cached', async function (t) {
  t.plan(3);
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves(null);
  const cacheSet = stub(cache, 'set').resolves();

  const elasticGet = stub(elastic, 'get').resolves({
    body: {
      _source: {
        level: { value: 'document' },
        fonds: [{ '@admin': { uid: 'smga-documents-110000003' }, summary: { title: 'doc' } }],
        summary: { title: 'doc' },
        identifier: [{ value: 'BAB' }]
      }
    }
  });

  // First page returns 2 of 5 hits, then the scroll dries up — get-full-archive
  // throws, cached-document marks the tree incomplete.
  const elasticSearch = stub(elastic, 'search').resolves(scrollPage([
    { _source: { '@admin': { uid: 'doc-1' } } },
    { _source: { '@admin': { uid: 'doc-2' } } }
  ], 5));
  const elasticScroll = stub(elastic, 'scroll').resolves(scrollPage([], 5));
  const elasticClearScroll = stub(elastic, 'clearScroll').resolves({});

  const archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return data;
  });

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');

  t.ok(data, 'partial data still returned to the user');
  t.ok(data.incomplete, 'tree is flagged incomplete for the route');
  t.notOk(cacheSet.called, 'incomplete tree is not cached');

  // The failure starts a back-off for this fonds; clear it so later tests
  // using the same fondsId still exercise a full fetch.
  cachedDocument._reset();

  cacheIsReady.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
  elasticSearch.restore();
  elasticScroll.restore();
  elasticClearScroll.restore();
  archiveTreeSort.restore();
});

test('Stale cache entry (record processed after caching) is dropped and regenerated', async function (t) {
  t.plan(3);
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves({ item: 'old-tree', stored: 1000, ttl: 100000000 });
  const cacheDrop = stub(cache, 'drop').resolves();
  const cacheSet = stub(cache, 'set').resolves();

  const elasticSearch = stub(elastic, 'search').resolves(scrollPage([], 0));
  const elasticClearScroll = stub(elastic, 'clearScroll').resolves({});

  const sourceBody = {
    _source: {
      '@admin': { processed: 2000 },
      level: { value: 'fonds' },
      summary: { title: 'doc' },
      identifier: [{ value: 'BAB' }]
    }
  };

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003', sourceBody);

  t.ok(cacheDrop.calledOnce, 'stale entry dropped from cache');
  t.notEqual(data, 'old-tree', 'stale cached tree is not returned');
  t.ok(cacheSet.calledOnce, 'regenerated tree is re-cached');

  cacheIsReady.restore();
  cacheGet.restore();
  cacheDrop.restore();
  cacheSet.restore();
  elasticSearch.restore();
  elasticClearScroll.restore();
});

test('Fresh cache entry (record processed before caching) is served without hitting Elasticsearch', async function (t) {
  t.plan(2);
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves({ item: 'cached-tree', stored: 2000, ttl: 100000000 });
  const elasticSearch = stub(elastic, 'search').rejects(new Error('should not be called'));

  const sourceBody = {
    _source: {
      '@admin': { processed: 1000 },
      level: { value: 'fonds' },
      summary: { title: 'doc' },
      identifier: [{ value: 'BAB' }]
    }
  };

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003', sourceBody);

  t.equal(data, 'cached-tree', 'cached tree returned');
  t.notOk(elasticSearch.called, 'elasticsearch not queried on a fresh cache hit');

  cacheIsReady.restore();
  cacheGet.restore();
  elasticSearch.restore();
});

test('Concurrent cache misses for one fonds share a single archive rebuild', async function (t) {
  t.plan(4);
  cachedDocument._reset();
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves(null);
  const cacheSet = stub(cache, 'set').resolves();

  let releaseSearch;
  const searchGate = new Promise((resolve) => { releaseSearch = resolve; });
  const elasticSearch = stub(elastic, 'search').callsFake(async () => {
    await searchGate;
    return scrollPage([
      { _source: { '@admin': { uid: 'doc-1' }, parent: [{ '@admin': { uid: 'smga-documents-110000003' } }], summary: { title: 'one' } } }
    ], 1);
  });
  const elasticClearScroll = stub(elastic, 'clearScroll').resolves({});

  const fondsBody = {
    _source: {
      level: { value: 'fonds' },
      summary: { title: 'fonds' },
      identifier: [{ value: 'BAB' }]
    }
  };
  const childBody = {
    _source: {
      level: { value: 'document' },
      fonds: [{ '@admin': { uid: 'smga-documents-110000003' }, summary: { title: 'fonds' } }],
      summary: { title: 'child' }
    }
  };

  const pending = [
    cachedDocument(elastic, 'smga-documents-110000003', 'smga-documents-110000003', fondsBody),
    cachedDocument(elastic, 'doc-1', 'smga-documents-110000003', childBody),
    cachedDocument(elastic, 'doc-2', 'smga-documents-110000003', childBody)
  ];
  // Let all three reach the in-flight check before the scroll completes.
  await new Promise((resolve) => setImmediate(resolve));
  releaseSearch();
  const [a, b, c] = await Promise.all(pending);

  t.equal(elasticSearch.callCount, 1, 'archive scrolled once for three concurrent requests');
  t.ok(a === b && b === c, 'every request gets the same tree');
  t.equal(cacheSet.callCount, 1, 'tree cached once');

  // Once the rebuild settles a new miss starts a fresh one.
  await cachedDocument(elastic, 'doc-1', 'smga-documents-110000003', childBody);
  t.equal(elasticSearch.callCount, 2, 'a later miss rebuilds again');

  cacheIsReady.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticSearch.restore();
  elasticClearScroll.restore();
  cachedDocument._reset();
});

test('After a failed archive fetch the fonds is not re-scrolled until the back-off passes', async function (t) {
  t.plan(6);
  cachedDocument._reset();
  const clock = useFakeTimers({ now: 1700000000000, toFake: ['Date'] });
  const cacheIsReady = stub(cache, 'isReady').returns(true);
  const cacheGet = stub(cache, 'get').resolves(null);
  const cacheSet = stub(cache, 'set').resolves();
  const elasticSearch = stub(elastic, 'search').rejects(new Error('Request timed out'));
  const elasticClearScroll = stub(elastic, 'clearScroll').resolves({});

  const childBody = {
    _source: {
      level: { value: 'document' },
      fonds: [{ '@admin': { uid: 'smga-documents-110000003' }, summary: { title: 'fonds' } }],
      summary: { title: 'child' }
    }
  };

  const first = await cachedDocument(elastic, 'doc-1', 'smga-documents-110000003', childBody);
  t.ok(first.incomplete, 'failed fetch returns the minimal tree');
  t.equal(elasticSearch.callCount, 1, 'first request tried Elasticsearch');

  clock.tick(30 * 1000);
  const second = await cachedDocument(elastic, 'doc-2', 'smga-documents-110000003', childBody);
  t.ok(second.incomplete, 'request during the back-off still gets the minimal tree');
  t.equal(elasticSearch.callCount, 1, 'and does not re-scroll the archive');

  clock.tick(31 * 1000);
  elasticSearch.resolves(scrollPage([], 0));
  const third = await cachedDocument(elastic, 'doc-3', 'smga-documents-110000003', childBody);
  t.equal(elasticSearch.callCount, 2, 'after the back-off the archive is fetched again');
  t.notOk(third.incomplete, 'and a successful fetch clears the incomplete flag');

  clock.restore();
  cacheIsReady.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticSearch.restore();
  elasticClearScroll.restore();
  cachedDocument._reset();
});
