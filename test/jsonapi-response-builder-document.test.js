const test = require('tape');
const config = require('../config');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const buildJSONResponse = require('../lib/jsonapi-response.js');
const JSONAPIResponse = buildJSONResponse(require('./fixtures/elastic-responses/example-get-response-document.json'), config);

test(file + 'JSON Response for an object should be structured correctly', function (t) {
  t.plan(4);
  t.ok(JSONAPIResponse.data, 'Response should contain data field');
  t.ok(JSONAPIResponse.data.relationships, 'Data field should contain relationships field');
  t.ok(JSONAPIResponse.data.links, 'Data field should contain links field');
  t.ok(JSONAPIResponse.included, 'Response should contain included field');
  t.end();
});

test(file + 'Data field should contain correct attributes', function (t) {
  t.plan(2);
  t.equal(JSONAPIResponse.data.type, 'documents', 'Data field contains correct type');
  t.equal(JSONAPIResponse.data.id, 'aa110000003', 'Data field contains correct id');
  t.end();
});
