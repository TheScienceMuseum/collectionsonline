const cachedDocument = require('../lib/cached-document');
const stub = require('sinon').stub;
const test = require('tape');
const cache = require('../bin/cache.js');
const elastic = require('./helpers/mock-database')();
const archiveTree = require('../lib/archive-tree');

// Note: cache.start() is called in bin/server.mjs at startup, NOT here.
// Tests control cache behaviour entirely via sinon stubs — no Redis required.

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

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  t.ok(data, 'data returned from elasticsearch on cache miss');
  cacheIsReady.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
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

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  t.ok(data, 'data returned from elasticsearch when cache is unavailable');
  cacheIsReady.restore();
  elasticGet.restore();
});
