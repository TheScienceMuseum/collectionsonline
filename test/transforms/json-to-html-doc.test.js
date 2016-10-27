const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const sortRelated = require('../../lib/sort-related-items');
const children = sortRelated(require('../fixtures/elastic-responses/database.json').children['aa110000003'].response.hits.hits);
const JSONAPIResponse = buildJSONResponse(require('../fixtures/elastic-responses/example-get-response-document.json'), config, children);
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
  t.equal(HTMLData.title, 'The Babbage Papers', 'title should be correct');
  t.equal(HTMLData.type, 'documents', 'type should be correct');
  t.equal(HTMLData.fact.length, 1, 'facts should not be empty');
  t.equal(HTMLData.related.documents.length, 8, 'Data should contain eight related documents');
  t.ok(HTMLData.description, 'Data should contain a description');
  t.end();
});
