const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-object.json'), config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
var HTMLData;

test('HTMLData should be transformed succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.end();
});

test('Data fields should have correct values', function (t) {
  t.plan(6);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.equal(HTMLData.title, 'Packet of Technetium (MDP) for bone scintigraphy \'Amerscan\' agent (phial; packet; materia medica)', 'title should be correct');
  t.equal(HTMLData.type, 'objects', 'type should be correct');
  t.ok(HTMLData.fact.length, 'facts should not be empty');
  t.equal(HTMLData.related.objects.length, 1, 'Data should contain one related object');
  t.notOk(HTMLData.description, 'Data should contain no description');
  t.end();
});
