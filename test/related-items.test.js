const test = require('tape');
const config = require('../config');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const buildHTMLData = require('../lib/transforms/json-to-html-data');
const sortRelated = require('../lib/sort-related-items');
var JSONAPIResponse;
var HTMLData;
var person = require('./fixtures/elastic-responses/example-get-response-person.json');
var relatedItems = sortRelated(require('./fixtures/elastic-responses/database.json').related['cp36993'].response.hits.hits, 'cp36993');

test('Response is built succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(person, config, relatedItems);
  }, 'Building response does not throw an error');
  t.end();
});

test('HTML Response is built succesfully', (t) => {
  t.plan(2);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(person, config, relatedItems);
  }, 'Building JSON response does not throw an error');
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Building HTML response does not throw an error');
  t.end();
});

test('JSON Response should contain related items', (t) => {
  t.plan(3);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(person, config, relatedItems);
  }, 'Building response does not throw an error');
  t.ok(JSONAPIResponse.data.relationships.objects, 'contains related objects');
  t.ok(JSONAPIResponse.included.find(el => el.type === 'objects'), 'contains related object info');
  t.end();
});

test('HTML Response should contain related items', (t) => {
  t.plan(4);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(person, config, relatedItems);
  }, 'Building JSON response does not throw an error');
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Building HTML response does not throw an error');
  t.ok(HTMLData.related.objects, 'contains related objects');
  t.ok(HTMLData.related.objects.find(el => el.role === 'maker'), 'related object has role');
  t.end();
});
