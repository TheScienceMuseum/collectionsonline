const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-person.json'), config);
const noBirthdayResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-death.json'), config);
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
  t.equal(HTMLData.title, 'Babbage, Charles', 'name should not yet be normalised');
  t.equal(HTMLData.type, 'people', 'type should be correct');
  t.equal(HTMLData.system.value, 'Mimsy', 'System should equal "Mimsy"');
  t.end();
});

test('Missing fields should be dealt with', function (t) {
  t.plan(2);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(noBirthdayResponse);
  }, 'Transform did not throw error');
  t.equal(HTMLData.date, 'Unknown - 1908', 'missing birthdate should change to unknown');
  t.end();
});
