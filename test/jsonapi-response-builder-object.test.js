const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-object.json'), config);

test('JSON Response for an object should be structured correctly', function (t) {
  t.plan(4);
  t.ok(JSONAPIResponse.data, 'Response should contain data field');
  t.ok(JSONAPIResponse.data.relationships, 'Data field should contain relationships field');
  t.ok(JSONAPIResponse.data.links, 'Data field should contain links field');
  t.ok(JSONAPIResponse.included, 'Response should contain included field');
  t.end();
});

test('Data field should contain correct attributes', function (t) {
  t.plan(2);
  t.equal(JSONAPIResponse.data.type, 'objects', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'smgc-objects-8245103', 'Data field contains correct id');
  t.end();
});

test('Relationships field should contain correct attributes', function (t) {
  t.plan(6);
  t.ok(JSONAPIResponse.data.relationships.parent, 'Relationships field contains parent');
  t.equal(JSONAPIResponse.data.relationships.parent.data[0].id, 'smgc-objects-5191', 'Parent field has correct id');
  t.ok(JSONAPIResponse.data.relationships.terms, 'Relationships field contains terms');
  t.equal(JSONAPIResponse.data.relationships.terms.data.length, 3, 'Terms field contains correct number of items');
  t.ok(JSONAPIResponse.data.relationships.maker, 'Relationships field contains maker');
  t.ok(JSONAPIResponse.data.relationships.places, 'Relationships field contains places');
  t.end();
});

test('Links field should contain correct link', function (t) {
  t.plan(1);
  t.equal(JSONAPIResponse.data.links.self, config.rootUrl + '/objects/smgc-objects-8245103', 'Response contains links field');
  t.end();
});

test('Included field should contain correct attributes', function (t) {
  t.plan(2);
  const terms = JSONAPIResponse.included.filter(el => el.type === 'term');
  t.equal(JSONAPIResponse.included.length, 6, 'Included field contains correct number of resources');
  t.equal(terms.length, 3, 'Included field contains correct number of terms');
  t.end();
});
