const test = require('tape');
const searchResultsToJsonApi = require('../../lib/transforms/search-results-to-jsonapi');
const searchToTemplate = require('../../lib/transforms/search-results-to-template-data');
const queryParams = require('../../lib/query-params');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
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
    total: { doc_count: 3554, total: { value: 3554 } },
    total_per_categories: {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [
        { key: 'object', doc_count: 3304 },
        { key: 'agent', doc_count: 221 },
        { key: 'term', doc_count: 36 },
        { key: 'archive', doc_count: 29 },
        { key: 'place', doc_count: 7 }
      ]
    }
  }
};
const query = queryParams('html', { query: { q: 'test', 'page[number]': 0, 'page[size]': 1 }, params: {} });
const jsonData = searchResultsToJsonApi(query, testResult);

test(file + 'Results should be transformed succesfully', (t) => {
  var templateData;
  t.plan(2);
  t.doesNotThrow(() => {
    templateData = searchToTemplate(query, jsonData);
  }, 'Transform did not throw error');
  t.ok(templateData, 'template data is returned');
  t.end();
});

test(file + 'Person template data is correctly built', (t) => {
  var templateData;
  t.plan(5);
  t.doesNotThrow(() => {
    templateData = searchToTemplate(query, jsonData);
  }, 'Transform did not throw error');

  const personResult = templateData.results.find(el => el.type === 'people');

  t.ok(personResult, 'person result is returned');
  t.equal(personResult.link, '/people/smgc-people-36993', 'person link is correct');
  t.equal(personResult.title, 'Babbage, Charles', 'person title is correct');
  t.equal(personResult.date, '1791 - 1871', 'person\'s date is correct');
  t.end();
});

test(file + 'Document template data is correctly built', (t) => {
  var templateData;
  t.plan(4);
  t.doesNotThrow(() => {
    templateData = searchToTemplate(query, jsonData);
  }, 'Transform did not throw error');

  const documentResult = templateData.results.find(el => el.type === 'documents');

  t.ok(documentResult, 'document result is returned');
  t.equal(documentResult.link, '/documents/smga-documents-110000003', 'document link is correct');
  t.equal(documentResult.title, 'The Babbage Papers', 'document title is correct');
  t.end();
});

test(file + 'Object template data is correctly built', (t) => {
  var templateData;
  t.plan(5);
  t.doesNotThrow(() => {
    templateData = searchToTemplate(query, jsonData);
  }, 'Transform did not throw error');

  const objectResult = templateData.results.find(el => el.type === 'objects');

  t.ok(objectResult, 'object result is returned');
  t.equal(objectResult.link, '/objects/smgc-objects-8245103', 'object link is correct');
  t.equal(objectResult.title, 'Packet of Technetium (MDP) for bone scintigraphy \'Amerscan\' agent', 'object title is correct');
  t.equal(objectResult.isOnDisplay, 'S/G44/CU07B (2pts)', 'object is on display');
  t.end();
});
