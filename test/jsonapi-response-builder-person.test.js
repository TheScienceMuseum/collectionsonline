const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
var JSONAPIResponse;

test('Response is built succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-person.json'), config);
  }, 'Building response does not throw an error');
  t.end();
});

test('JSON Response for an object should be structured correctly', (t) => {
  t.plan(6);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-person.json'), config);
  }, 'Building response does not throw an error');
  t.ok(JSONAPIResponse.data, 'Response should contain data field');
  t.ok(JSONAPIResponse.data.attributes, 'Data field should contain attributes field');
  t.ok(JSONAPIResponse.data.relationships, 'Data field should contain relationships field');
  t.ok(JSONAPIResponse.data.links, 'Data field should contain links field');
  t.ok(JSONAPIResponse.included, 'Response should contain included field');
  t.end();
});

test('Data field should contain correct attributes', (t) => {
  t.plan(3);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-person.json'), config);
  }, 'Building response does not throw an error');
  t.equal(JSONAPIResponse.data.type, 'people', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'smgc-people-43512', 'Data field contains correct id');
  t.end();
});

test('Relationships field should contain correct attributes', (t) => {
  t.plan(3);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-person.json'), config);
  }, 'Building response does not throw an error');
  t.ok(JSONAPIResponse.data.relationships.agents, 'Relationships field contains agents');
  t.equal(JSONAPIResponse.data.relationships.agents.data.length, 4, 'Relationships field contains correct number of agents');
  t.end();
});

test('People with multiple relationships should be processed correctly', (t) => {
  t.plan(2);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-with-places.json'), config);
  }, 'Building response does not throw an error');
  t.equal(JSONAPIResponse.data.relationships.places.data.length, 2, 'should have two place relationships');
  t.end();
});
