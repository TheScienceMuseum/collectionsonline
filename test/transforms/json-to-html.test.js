const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-person.json'), config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
var HTMLData;

test('HTMLData should be transformed succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.end();
});

test('Data should have correct fields', function (t) {
  t.plan(8);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.ok(HTMLData.title, 'Data should contain title');
  t.ok(HTMLData.type, 'Data should contain type');
  t.ok(HTMLData.fact, 'Data field should contain facts');
  t.ok(HTMLData.related, 'Data should contain related');
  t.ok(HTMLData.description, 'Data should contain description');
  t.ok(HTMLData.details, 'Data should contain details');
  t.ok(HTMLData.system, 'Data should contain system');
  t.end();
});

test('Fields should have correct values', function (t) {
  t.plan(4);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.ok(HTMLData.title, 'Charles Babbage', 'name should be normalised');
  t.ok(HTMLData.type, 'people', 'type should be correct');
  t.ok(HTMLData.system.value === 'Mimsy', 'System should equal "Mimsy"');
  t.end();
});
