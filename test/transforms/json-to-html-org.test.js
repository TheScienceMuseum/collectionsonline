const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/example-get-response-organisation.json'), config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
const HTMLData = buildHTMLData(JSONAPIResponse);

test('Data fields should have correct values', function (t) {
  t.plan(6);
  t.equal(HTMLData.title, 'Royal Astronomical Society', 'title should be correct');
  t.equal(HTMLData.type, 'people', 'type should be correct');
  t.deepEqual(HTMLData.fact, [], 'facts should be empty');
  t.equal(HTMLData.related.people.length, 1, 'Data should contain one related person');
  t.notOk(HTMLData.description, 'Data should contain no description');
  t.equal(HTMLData.details[0].key, 'Website', 'details should contain a website');
  t.end();
});
