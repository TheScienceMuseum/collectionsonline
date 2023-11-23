const test = require('tape');
const searchResultsToJsonApi = require('../../lib/transforms/search-results-to-jsonapi');
const searchToTemplate = require('../../lib/transforms/search-results-to-template-data');
const queryParams = require('../../lib/query-params/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const aggregationsAll = require('../helpers/aggregations-all.json');
const aggregationsPeople = require('../helpers/aggregations-all.json');
const aggregationsObjects = require('../helpers/aggregations-all.json');
const aggregationsDocuments = require('../helpers/aggregations-all.json');
const testResult = {
  hits: {
    total: 5,
    max_score: null,
    hits: [
      require('../fixtures/elastic-responses/example-get-response-document.json'),
      require('../fixtures/elastic-responses/example-get-response-person.json'),
      require('../fixtures/elastic-responses/example-get-response-object.json')
    ]
  },
  aggregations: {
    total_categories: {
      doc_count: 17,
      documents: { doc_count: 0, documents_total: [{ value: 29 }] },
      objects: { doc_count: 13, objects_total: [{ value: 3304 }] },
      people: { doc_count: 4, people_total: [{ value: 221 }] },
      all: {
        doc_count: 17,
        all_total: {
          doc_count_error_upper_bound: 0,
          sum_other_doc_count: 0,
          buckets: [
            { key: 'object', doc_count: 13 },
            { key: 'agent', doc_count: 4 }
          ]
        }
      }
    }
  }
};

testResult.aggregations.all = aggregationsAll;
testResult.aggregations.people = aggregationsPeople;
testResult.aggregations.objects = aggregationsObjects;
testResult.aggregations.documents = aggregationsDocuments;

const query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });
const jsonData = searchResultsToJsonApi(query, testResult);
test(file + 'Results should be transformed succesfully', (t) => {
  let templateData;
  t.plan(2);
  t.doesNotThrow(() => {
    templateData = searchToTemplate(query, jsonData);
  }, 'Transform did not throw error');
  t.ok(templateData, 'template data is returned');
  t.end();
});

test(file + 'Person template data is correctly built', (t) => {
  let templateData;
  t.plan(5);
  t.doesNotThrow(() => {
    templateData = searchToTemplate(query, jsonData);
  }, 'Transform did not throw error');

  const personResult = templateData.results.find(el => el.type === 'people');

  t.ok(personResult, 'person result is returned');
  t.equal(personResult.link, '/people/cp36993/charles-babbage', 'person link is correct');
  t.equal(personResult.title, 'Babbage, Charles', 'person title is correct');
  t.equal(personResult.date, '1791 - 1871', 'person\'s date is correct');
  t.end();
});

test(file + 'Document template data is correctly built', (t) => {
  let templateData;
  t.plan(5);
  t.doesNotThrow(() => {
    templateData = searchToTemplate(query, jsonData);
  }, 'Transform did not throw error');

  const documentResult = templateData.results.find(el => el.type === 'documents');

  t.ok(documentResult, 'document result is returned');
  t.equal(documentResult.link, '/documents/aa110000003/the-babbage-papers', 'document link is correct');
  t.equal(documentResult.title, 'The Babbage Papers', 'document title is correct');
  t.equal(documentResult.figcaption, '11 plan press drawers and 8 linear meters of shelving', 'document figcaption is correct');
  t.end();
});

test(file + 'Object template data is correctly built', (t) => {
  let templateData;
  t.plan(4);
  t.doesNotThrow(() => {
    templateData = searchToTemplate(query, jsonData);
  }, 'Transform did not throw error');

  const objectResult = templateData.results.find(el => el.type === 'objects');

  t.ok(objectResult, 'object result is returned');
  t.equal(objectResult.link, '/objects/co8245103/packet-of-technetium-mdp-for-bone-scintigraphy-amerscan-agent-phial-packet-materia-medica', 'object link is correct');
  t.equal(objectResult.title, 'Packet of Technetium (MDP) for bone scintigraphy \'Amerscan\' agent', 'object title is correct');
  t.end();
});
