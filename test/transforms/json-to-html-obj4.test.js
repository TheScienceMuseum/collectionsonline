const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-object4.json'), config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
var HTMLData;

test('All makers should be found', function (t) {
  t.plan(3);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.equal(HTMLData.fact.find((el) => el.key === 'maker').makers[0].value, 'Apple Inc', 'Facts should contain a maker');
  t.equal(HTMLData.fact.find((el) => el.key === 'inventor').makers.length, 3, 'Facts should contain multiple inventors');
  t.end();
});
