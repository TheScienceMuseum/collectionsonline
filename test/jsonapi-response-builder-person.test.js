const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const JSONAPIResponse = buildJSONResponse(require('./fixtures/example-get-response-person.json'), config);

test('JSON Response for an object should be structured correctly', function (t) {
  t.plan(5);
  t.ok(JSONAPIResponse.data, 'Response should contain data field');
  t.ok(JSONAPIResponse.data.attributes, 'Data field should contain attributes field');
  t.ok(JSONAPIResponse.data.relationships, 'Data field should contain relationships field');
  t.ok(JSONAPIResponse.data.links, 'Data field should contain links field');
  t.ok(JSONAPIResponse.included, 'Response should contain included field');
  t.end();
});

test('Data field should contain correct attributes', function (t) {
  t.plan(2);
  t.equal(JSONAPIResponse.data.type, 'people', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'smgc-people-43512', 'Data field contains correct id');
  t.end();
});

test('Relationships field should contain correct attributes', function (t) {
  t.plan(2);
  t.ok(JSONAPIResponse.data.relationships.agents, 'Relationships field contains agents');
  t.equal(JSONAPIResponse.data.relationships.agents.data.length, 4, 'Relationships field contains correct number of agents');
  t.end();
});
