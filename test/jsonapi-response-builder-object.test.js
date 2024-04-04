const test = require('tape');
const config = require('../config');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const buildJSONResponse = require('../lib/jsonapi-response.js');
const JSONAPIResponse = buildJSONResponse(
  require('./fixtures/elastic-responses/example-get-response-object.json'),
  config
);

test(
  file + 'JSON Response for an object should be structured correctly',
  function (t) {
    t.plan(4);
    t.ok(JSONAPIResponse.data, 'Response should contain data field');
    t.ok(
      JSONAPIResponse.data.relationships,
      'Data field should contain relationships field'
    );
    t.ok(JSONAPIResponse.data.links, 'Data field should contain links field');
    t.ok(JSONAPIResponse.included, 'Response should contain included field');
    t.end();
  }
);

test(file + 'Data field should contain correct attributes', function (t) {
  t.plan(2);
  t.equal(
    JSONAPIResponse.data.type,
    'objects',
    'Data field contains correct type'
  );
  t.equal(
    JSONAPIResponse.data.id,
    'co8245103',
    'Data field contains correct id'
  );
  t.end();
});

test(
  file + 'Relationships field should contain correct attributes',
  function (t) {
    t.plan(6);
    t.ok(
      JSONAPIResponse.data.relationships.parent,
      'Relationships field contains parent'
    );
    t.equal(
      JSONAPIResponse.data.relationships.parent.data[0].id,
      'co5191',
      'Parent field has correct id'
    );
    t.ok(
      JSONAPIResponse.data.relationships.term,
      'Relationships field contains terms'
    );
    t.equal(
      JSONAPIResponse.data.relationships.term.data.length,
      3,
      'Terms field contains correct number of items'
    );
    t.ok(
      JSONAPIResponse.data.relationships.maker,
      'Relationships field contains maker'
    );
    t.ok(
      JSONAPIResponse.data.relationships.place,
      'Relationships field contains places'
    );
    t.end();
  }
);

test(file + 'Links field should contain correct link', function (t) {
  t.plan(1);
  t.equal(
    JSONAPIResponse.data.links.self,
    config.rootUrl +
      '/objects/co8245103/packet-of-technetium-mdp-for-bone-scintigraphy-amerscan-agent-phial-packet-materia-medica',
    'Response contains links field'
  );
  t.end();
});

test(file + 'Included field should contain correct attributes', function (t) {
  t.plan(2);
  const terms = JSONAPIResponse.included.filter((el) => el.type === 'term');
  t.equal(
    JSONAPIResponse.included.length,
    6,
    'Included field contains correct number of resources'
  );
  t.equal(terms.length, 3, 'Included field contains correct number of terms');
  t.end();
});
