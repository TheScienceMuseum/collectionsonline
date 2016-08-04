const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-object.json'), config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
var HTMLData;

test(file + 'HTMLData should be transformed succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.end();
});

test(file + 'Data fields should have correct values', function (t) {
  t.plan(5);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.equal(HTMLData.title, 'Packet of Technetium (MDP) for bone scintigraphy \'Amerscan\' agent', 'title should be correct');
  t.equal(HTMLData.type, 'objects', 'type should be correct');
  t.ok(HTMLData.fact.length, 'facts should not be empty');
  t.ok(HTMLData.description, 'Data should contain a description');
  t.end();
});
