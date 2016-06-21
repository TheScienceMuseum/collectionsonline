var test = require('tape');
const buildJSONResponse = require('../lib/jsonapi-response.js');
const exampleGETResponse = require('./fixtures/example-get-response.json');

test('Building the JSON Response', function (t) {
  t.plan(3);
  const JSONAPIResponse = JSON.parse(buildJSONResponse(exampleGETResponse));

  t.ok(JSONAPIResponse.data, 'Response contains data field' + JSONAPIResponse.data);
  t.ok(JSONAPIResponse.relationships, 'Response contains relationships field');
  t.ok(JSONAPIResponse.links, 'Response contains links field');
  t.end();
});
