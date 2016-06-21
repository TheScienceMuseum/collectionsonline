const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const exampleObjResponse = require('./fixtures/example-get-response-object.json');
const exampleDocResponse = require('./fixtures/example-get-response-document.json');

test('Building the JSON Response for an object', function (t) {
  t.plan(15);
  const JSONAPIResponse = buildJSONResponse(exampleObjResponse, config);
  const terms = JSONAPIResponse.included.filter(el => el.type === 'term');

  t.ok(JSONAPIResponse.data, 'Response contains data field');
  t.equal(JSONAPIResponse.data.type, 'objects', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'smgc-objects-8245103', 'Data field contains correct id');

  t.ok(JSONAPIResponse.relationships, 'Response contains relationships field');

  t.ok(JSONAPIResponse.relationships.parent, 'Relationships field contains parent');
  t.equal(JSONAPIResponse.relationships.parent.data[0].id, 'smgc-objects-5191', 'Parent field has correct id');

  t.ok(JSONAPIResponse.relationships.terms, 'Relationships field contains terms');
  t.equal(JSONAPIResponse.relationships.terms.data.length, 3, 'Terms field contains correct number of items');

  t.ok(JSONAPIResponse.relationships.maker, 'Relationships field contains maker');
  t.ok(JSONAPIResponse.relationships.places, 'Relationships field contains places');

  t.ok(JSONAPIResponse.links, 'Response contains links field');
  t.equal(JSONAPIResponse.links.self, config.rootUrl + '/objects/smgc-objects-8245103', 'Response contains links field');

  t.ok(JSONAPIResponse.included, 'Response contains included field');
  t.equal(JSONAPIResponse.included.length, 6, 'Included field contains correct number of resources');

  t.equal(terms.length, 3, 'Included field contains correct number of terms');
  t.end();
});

test('Building the JSON Response for a document', function (t) {
  t.plan(6);
  const JSONAPIResponse = buildJSONResponse(exampleDocResponse, config);

  t.ok(JSONAPIResponse.data, 'Response contains data field');
  t.equal(JSONAPIResponse.data.type, 'documents', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'smga-documents-110069457', 'Data field contains correct id');

  t.ok(JSONAPIResponse.data.attributes.organisations, 'Response should have organisations in attributes');

  t.notOk(JSONAPIResponse.relationships, 'Response should not contain relationships field');

  t.notOk(JSONAPIResponse.included, 'Response should not contain included field');
  t.end();
});
