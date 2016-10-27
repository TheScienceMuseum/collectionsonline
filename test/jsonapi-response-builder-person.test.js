const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
var JSONAPIResponse;

test(file + 'Response is built succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-person.json'), config);
  }, 'Building response does not throw an error');
  t.end();
});

test(file + 'JSON Response for an object should be structured correctly', (t) => {
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

test(file + 'Data field should contain correct attributes', (t) => {
  t.plan(3);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-person.json'), config);
  }, 'Building response does not throw an error');
  t.equal(JSONAPIResponse.data.type, 'people', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'cp36993', 'Data field contains correct id');
  t.end();
});

test(file + 'Relationships field should contain correct attributes', (t) => {
  t.plan(3);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-person.json'), config);
  }, 'Building response does not throw an error');
  t.ok(JSONAPIResponse.data.relationships.people, 'Relationships field contains people');
  t.equal(JSONAPIResponse.data.relationships.people.data.length, 5, 'Relationships field contains correct number of people');
  t.end();
});

test(file + 'People with multiple relationships should be processed correctly', (t) => {
  t.plan(2);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-with-places.json'), config);
  }, 'Building response does not throw an error');
  t.equal(JSONAPIResponse.data.relationships.places.data.length, 2, 'should have two place relationships');
  t.end();
});
