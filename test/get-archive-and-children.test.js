const test = require('tape');
const getArchiveAndChildren = require('../lib/get-archive-and-children.js');
const createMockDatabase = require('./helpers/mock-database');
const config = require('../config');
const elastic = createMockDatabase();
const request = {
  params: {
    id: 'smga-documents-110000003'
  },
  query: {}
};

const request2 = {
  params: {
    id: 'smga-documents-110066453'
  },
  query: {}
};

test('Items are retrieved succesfully', (t) => {
  t.plan(4);
  t.doesNotThrow(() => {
    getArchiveAndChildren(elastic, config, request, function (err, data) {
      if (err) t.fail();
      t.ok(data, 'ok');
      t.ok(data.HTMLData, 'ok');
      t.ok(data.JSONData, 'ok');
    });
  }, 'Building response does not throw an error');
});

test('Items are retrieved succesfully', (t) => {
  t.plan(2);
  t.doesNotThrow(() => {
    getArchiveAndChildren(elastic, config, request2, function (err, data) {
      if (err) t.fail();
      t.ok(data, 'ok');
    });
  }, 'Building response does not throw an error');
});
