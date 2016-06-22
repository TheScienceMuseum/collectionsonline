const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const JSONAPIResponse = buildJSONResponse(require('./fixtures/example-get-response-person.json'), config);

test('JSON Response for an object should be structured correctly', function (t) {
  t.plan(5);
  t.ok(JSONAPIResponse.data, 'Response should contain data field');
  t.ok(JSONAPIResponse.data.attributes, 'Data field should contain attributes field');
  t.notOk(JSONAPIResponse.data.relationships, 'Data field should not contain relationships field');
  t.ok(JSONAPIResponse.data.links, 'Data field should contain links field');
  t.notOk(JSONAPIResponse.included, 'Response should not contain included field');
  t.end();
});

test('Data field should contain correct attributes', function (t) {
  t.plan(2);
  t.equal(JSONAPIResponse.data.type, 'people', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'smgc-people-114620', 'Data field contains correct id');
  t.end();
});
