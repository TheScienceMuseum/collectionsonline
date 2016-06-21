const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const exampleGETResponse = require('./fixtures/example-get-response.json');

test('Building the JSON Response', function (t) {
  t.plan(11);
  const JSONAPIResponse = buildJSONResponse(exampleGETResponse, config);

  t.ok(JSONAPIResponse.data, 'Response contains data field');
  t.equal(JSONAPIResponse.data.type, 'object', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'smgc-object-8245103', 'Data field contains correct id');

  t.ok(JSONAPIResponse.relationships, 'Response contains relationships field');

  t.ok(JSONAPIResponse.relationships.parent, 'Relationships field contains parent');
  t.equal(JSONAPIResponse.relationships.parent.data[0].id, 'smgc-object-5191', 'Parent field has correct id');

  t.ok(JSONAPIResponse.relationships.terms, 'Relationships field contains terms');
  t.equal(JSONAPIResponse.relationships.terms.data.length, 3, 'Tersm field contains correct number of items');

  t.ok(JSONAPIResponse.links, 'Response contains links field');
  t.equal(JSONAPIResponse.links.self, config.rootUrl + '/object/smgc-object-8245103', 'Response contains links field');

  t.ok(JSONAPIResponse.included, 'Response contains included field');
  t.end();
});
