const cachedDocument = require('../lib/cached-document');
const stub = require('sinon').stub;
const test = require('tape');
const cache = require('../bin/cache.js');
const elastic = require('./helpers/mock-database')();
const archiveTree = require('../lib/archive-tree');

test('Cache Error when starting', function (t) {
  t.plan(2);
  var cacheStart = stub(cache, 'start').rejects({code: 'ECONNREFUSED'});

  cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003', function (err, data) {
    t.ok(err, 'Error returned from cache start');
    t.notOk(data, 'no data');
    cacheStart.restore();
  });
});

test('Get fonds data', function (t) {
  t.plan(2);
  var cacheStart = stub(cache, 'start').resolves();

  var cacheGet = stub(cache, 'get').resolves();

  var elasticGet = stub(elastic, 'get').callsFake(function (options, cb) {
    return cb(null, {_source: {level: {value: 'fonds'}, summary_title: 'doc', identifier: [{value: 'BAB'}]}});
  });

  cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003', function (err, data) {
    t.notOk(err, 'no error');
    t.ok(data, 'data from elasticsearch');
    cacheStart.restore();
    cacheGet.restore();
    elasticGet.restore();
  });
});

test('Get child document data', function (t) {
  t.plan(2);
  var cacheStart = stub(cache, 'start').resolves();

  var cacheGet = stub(cache, 'get').resolves();

  var cacheSet = stub(cache, 'set').resolves();

  var elasticGet = stub(elastic, 'get').callsFake(function (options, cb) {
    return cb(null, {_source: {level: {value: 'document'}, fonds: [{admin: {uid: 'smga-documents-110000003'}, summary_title: 'doc'}], summary_title: 'doc', identifier: [{value: 'BAB'}]}});
  });

  var archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return {};
  });

  cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003', function (err, data) {
    t.notOk(err, 'no error');
    t.ok(data, 'data from elasticsearch');
    cacheStart.restore();
    cacheGet.restore();
    cacheSet.restore();
    elasticGet.restore();
    archiveTreeSort.restore();
  });
});

test('Get single document data', function (t) {
  t.plan(2);
  var cacheStart = stub(cache, 'start').resolves();

  var cacheGet = stub(cache, 'get').resolves();

  var cacheSet = stub(cache, 'set').resolves();

  var elasticGet = stub(elastic, 'get').callsFake(function (options, cb) {
    return cb(null, {_source: {level: {value: 'document'}, summary_title: 'doc', identifier: [{value: 'BAB'}]}});
  });

  var archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return {};
  });

  cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003', function (err, data) {
    t.notOk(err, 'no error');
    t.ok(data, 'data from elasticsearch');
    cacheStart.restore();
    cacheGet.restore();
    cacheSet.restore();
    elasticGet.restore();
    archiveTreeSort.restore();
  });
});

test('Get single document data', function (t) {
  t.plan(2);
  var cacheStart = stub(cache, 'start').resolves();

  var cacheGet = stub(cache, 'get').resolves();

  var cacheSet = stub(cache, 'set').resolves();

  var elasticGet = stub(elastic, 'get').callsFake(function (options, cb) {
    return cb(null, {_source: {level: {value: 'document'}, fonds: [{admin: {uid: 'smga-documents-110000003'}, summary_title: 'doc'}], summary_title: 'doc', identifier: [{value: 'BAB'}]}});
  });

  var elasticSearch = stub(elastic, 'search').callsFake(function (options, cb) {
    return cb(new Error());
  });

  var archiveTreeSort = stub(archiveTree, 'sortChildren').callsFake(function (data) {
    return {};
  });

  cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003', function (err, data) {
    t.ok(err, 'Error from elasticsearch');
    t.notOk(data, 'no data');
    cacheStart.restore();
    cacheGet.restore();
    cacheSet.restore();
    elasticGet.restore();
    elasticSearch.restore();
    archiveTreeSort.restore();
  });
});

test('Get single document data', function (t) {
  t.plan(2);
  var cacheStart = stub(cache, 'start').resolves();

  var cacheGet = stub(cache, 'get').resolves({item: '123'});

  cachedDocument(elastic, 'smga-documents-110000013', 'smga-documents-110000003', function (err, data) {
    t.notOk(err, 'no error');
    t.equal(data, '123', 'cached item is returned correctly');
    cacheStart.restore();
    cacheGet.restore();
  });
});
