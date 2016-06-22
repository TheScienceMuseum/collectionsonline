const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const JSONAPIResponse = buildJSONResponse(require('./fixtures/example-get-response-document.json'), config);

test('JSON Response for an object should be structured correctly', function (t) {
  t.plan(4);
  t.ok(JSONAPIResponse.data, 'Response should contain data field');
  t.notOk(JSONAPIResponse.data.relationships, 'Data field should not contain relationships field');
  t.ok(JSONAPIResponse.data.links, 'Data field should contain links field');
  t.notOk(JSONAPIResponse.included, 'Response should not contain included field');
  t.end();
});

test('Data field should contain correct attributes', function (t) {
  t.plan(2);
  t.equal(JSONAPIResponse.data.type, 'documents', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'smga-documents-110069457', 'Data field contains correct id');
  t.end();
});
