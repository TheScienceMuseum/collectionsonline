const test = require('tape');
const config = require('../../config');
const responseOrganisation = require('../fixtures/elastic-responses/example-get-response-organisation.json');
// None of the data in elasticsearch have the right value yet so we need to add some fixutre properties to the object
responseOrganisation._source.occupation = ['Astronomy'];
const buildJSONResponse = require('../../lib/jsonapi-response');
const JSONAPIResponse = buildJSONResponse(responseOrganisation, config);
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
var HTMLData;

test(file + 'HTMLData should be transformed succesfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.end();
});

test('Data fields should have correct values', function (t) {
  t.plan(7);
  t.doesNotThrow(() => {
    HTMLData = buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.equal(HTMLData.title, 'Royal Astronomical Society', 'title should be correct');
  t.equal(HTMLData.type, 'people', 'type should be correct');
  t.ok(HTMLData.fact.length, 'facts should not be empty');
  t.equal(HTMLData.related.people.length, 1, 'Data should contain one related person');
  t.ok(HTMLData.description, 'Data should contain description');
  t.equal(HTMLData.details[0].key, 'Website', 'details should contain a website');
  t.end();
});
