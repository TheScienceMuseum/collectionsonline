const test = require('tape');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '/fixtures/elastic-responses/bad-data.json')));
let JSONAPIResponse;

test('Should not throw an error', function (t) {
  t.plan(1);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(data, config);
  }, 'Building response does not throw an error');
  t.end();
});

test('Data should contain relationships', function (t) {
  t.plan(2);
  t.doesNotThrow(() => {
    JSONAPIResponse = buildJSONResponse(data, config);
    console.log(JSONAPIResponse);
  }, 'Building response does not throw an error');
  t.ok(JSONAPIResponse.data.relationships, 'contains relationships');
  t.end();
});
