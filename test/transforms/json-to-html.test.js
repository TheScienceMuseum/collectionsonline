const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/example-get-response-person.json'), config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
const HTMLData = buildHTMLData(JSONAPIResponse);

test('Data should have correct fields', function (t) {
  t.plan(6);
  t.ok(HTMLData.title, 'Data should contain title');
  t.ok(HTMLData.type, 'Data should contain type');
  t.ok(HTMLData.fact, 'Data field should contain facts');
  t.ok(HTMLData.related, 'Data should contain related');
  t.ok(HTMLData.description, 'Data should contain description');
  t.ok(HTMLData.details, 'Data should contain details');
  t.end();
});
