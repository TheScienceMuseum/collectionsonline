const cachedDocument = require('../lib/cached-document');
const stub = require('sinon').stub;
const test = require('tape');
const cache = require('../bin/cache.js');
const elastic = require('./helpers/mock-database')();
const archiveTree = require('../lib/archive-tree');

test('Cache Error when starting', async function (t) {
  t.plan(2);
  const cacheStart = stub(cache, 'start').rejects({ code: 'ECONNREFUSED' });

  let data;
  let error;

  try {
    data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  } catch (err) {
    error = err;
  }

  t.ok(error, 'Error returned from cache start');
  t.notOk(data, 'no data');
  cacheStart.restore();
});

test('Get fonds data', async function (t) {
  t.plan(1);
  const cacheStart = stub(cache, 'start').resolves();

  const cacheGet = stub(cache, 'get').resolves();

  const elasticGet = stub(elastic, 'get').resolves({ body: { _source: { level: { value: 'fonds' }, summary_title: 'doc', identifier: [{ value: 'BAB' }] } } });

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  t.ok(data, 'data from elasticsearch');
  cacheStart.restore();
  cacheGet.restore();
  elasticGet.restore();
});

test('Get child document data', async function (t) {
  t.plan(1);
  const cacheStart = stub(cache, 'start').resolves();

  const cacheGet = stub(cache, 'get').resolves();

  const cacheSet = stub(cache, 'set').resolves();

  const elasticGet = stub(elastic, 'get').resolves({ body: { _source: { level: { value: 'document' }, fonds: [{ admin: { uid: 'smga-documents-110000003' }, summary_title: 'doc' }], summary_title: 'doc', identifier: [{ value: 'BAB' }] } } });

  const archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return {};
  });

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');

  t.ok(data, 'data from elasticsearch');
  cacheStart.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
  archiveTreeSort.restore();
});

test('Get single document data', async function (t) {
  t.plan(1);
  const cacheStart = stub(cache, 'start').resolves();

  const cacheGet = stub(cache, 'get').resolves();

  const cacheSet = stub(cache, 'set').resolves();

  const elasticGet = stub(elastic, 'get').resolves({ body: { _source: { level: { value: 'document' }, summary_title: 'doc', identifier: [{ value: 'BAB' }] } } });

  const archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return {};
  });

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  t.ok(data, 'data from elasticsearch');
  cacheStart.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
  archiveTreeSort.restore();
});

test('Get single document data', async function (t) {
  t.plan(2);
  const cacheStart = stub(cache, 'start').resolves();

  const cacheGet = stub(cache, 'get').resolves();

  const cacheSet = stub(cache, 'set').resolves();

  const elasticGet = stub(elastic, 'get').resolves({ body: { _source: { level: { value: 'document' }, fonds: [{ admin: { uid: 'smga-documents-110000003' }, summary_title: 'doc' }], summary_title: 'doc', identifier: [{ value: 'BAB' }] } } });

  const elasticSearch = stub(elastic, 'search').rejects(new Error());

  const archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return {};
  });

  let data;
  let error;

  try {
    data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');
  } catch (err) {
    error = err;
  }

  t.ok(error, 'Error from elasticsearch');
  t.notOk(data, 'no data');
  cacheStart.restore();
  cacheGet.restore();
  cacheSet.restore();
  elasticGet.restore();
  elasticSearch.restore();
  archiveTreeSort.restore();
});

test('Get single document data', async function (t) {
  t.plan(1);
  const cacheStart = stub(cache, 'start').resolves();

  const cacheGet = stub(cache, 'get').resolves({ item: '123' });

  const data = await cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003');

  t.equal(data, '123', 'cached item is returned correctly');
  cacheStart.restore();
  cacheGet.restore();
});
