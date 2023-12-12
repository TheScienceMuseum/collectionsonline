const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-document2.json'), config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
let HTMLData;

test('HTMLData should be transformed succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.end();
});

test('Data fields should have correct values', function (t) {
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.equal(HTMLData.title, 'Works photographic negative of cable laying, Ebbw Vale', 'title should be correct');
  // t.ok(HTMLData.details.find(e => e.key === 'Subject'), 'subject should exist');
  t.end();
});
