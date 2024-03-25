const test = require('tape');
const config = require('../config');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const buildJSONResponse = require('../lib/jsonapi-response.js');
const JSONAPIResponse = buildJSONResponse(
  require('./fixtures/elastic-responses/example-get-response-group.json'),
  config
);

test(
  file + 'JSON Response for a group should be structured correctly',
  function (t) {
    t.plan(2);
    t.ok(JSONAPIResponse.data, 'Response should contain data field');
    t.ok(JSONAPIResponse.data.links, 'Data field should contain links field');
    t.end();
  }
);

test(file + 'Data field should contain correct attributes', function (t) {
  t.plan(2);
  t.equal(
    JSONAPIResponse.data.type,
    'group',
    'Data field contains correct type'
  );
  t.equal(JSONAPIResponse.data.id, 'c81734', 'Data field contains correct id');
  t.end();
});

test(file + 'Links field should contain correct link', function (t) {
  t.plan(1);
  t.equal(
    JSONAPIResponse.data.links.self,
    config.rootUrl + '/group/c81734/test-covid19',
    'Response contains links field'
  );
  t.end();
});
