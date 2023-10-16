const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-object2.json'), config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
let HTMLData;

test('All makers should be found', function (t) {
  t.plan(3);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.equal(HTMLData.fact.filter((el) => el.key === 'maker').length, 1, 'facts should contain a maker');
  t.equal(HTMLData.fact.filter((el) => el.key === 'designer').length, 1, 'facts should contain a designer');
  t.end();
});
