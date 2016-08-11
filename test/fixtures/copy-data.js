const Client = require('elasticsearch').Client;
const config = require('../../config');
const elastic = new Client(config.elasticsearch);
const getElasticDocument = require('./get-elastic-document');
const fs = require('fs');
const dirData = 'test/fixtures/elastic-responses';
const copyEsDocs = require('./copy-es-docs');
const copyEsSearches = require('./copy-es-searches');
const copyEsrelated = require('./copy-es-related');
const copyEsChildren = require('./copy-es-children');
/**
* Create files for transforms tests
*/

// smgc-agent-108048
getElasticDocument(elastic, 'agent', 'smgc-agent-108048', (error, response) => {
  if (error) {
    console.log('error getting smgc-agent-108048');
  } else {
    fs.writeFileSync(dirData + '/example-get-response-death.json', JSON.stringify(response), 'utf-8');
  }
});

// smga-archive-110000003
getElasticDocument(elastic, 'archive', 'smga-archive-110000003', (error, response) => {
  if (error) {
    console.log('error getting smga-archive-110000003');
  } else {
    fs.writeFileSync(dirData + '/example-get-response-document.json', JSON.stringify(response), 'utf-8');
  }
});

// smgc-object-8245103
getElasticDocument(elastic, 'object', 'smgc-object-8245103', (error, response) => {
  if (error) {
    console.log('error getting smgc-object-8245103');
  } else {
    fs.writeFileSync(dirData + '/example-get-response-object.json', JSON.stringify(response), 'utf-8');
  }
});

// smgc-object-205752
getElasticDocument(elastic, 'object', 'smgc-object-205752', (error, response) => {
  if (error) {
    console.log('error getting smgc-object-205752');
  } else {
    fs.writeFileSync(dirData + '/example-get-response-object2.json', JSON.stringify(response), 'utf-8');
  }
});

// smgc-agent-5207
getElasticDocument(elastic, 'agent', 'smgc-agent-5207', (error, response) => {
  if (error) {
    console.log('error getting smgc-agent-5207');
  } else {
    fs.writeFileSync(dirData + '/example-get-response-organisation.json', JSON.stringify(response), 'utf-8');
  }
});

// smgc-agent-36993
getElasticDocument(elastic, 'agent', 'smgc-agent-36993', (error, response) => {
  if (error) {
    console.log('error getting smgc-agent-36993');
  } else {
    fs.writeFileSync(dirData + '/example-get-response-person.json', JSON.stringify(response), 'utf-8');
  }
});

// smgc-agent-36993
getElasticDocument(elastic, 'agent', 'smgc-agent-86306', (error, response) => {
  if (error) {
    console.log('error getting smgc-agent-86306');
  } else {
    fs.writeFileSync(dirData + '/example-get-response-with-places.json', JSON.stringify(response), 'utf-8');
  }
});

/**
* Create mock elasticsaerch database for get and search tests
*/
const dataToCopy = [
  { type: 'archive', id: 'smga-documents-110000316' },
  { type: 'archive', id: 'smga-documents-wrongid' },
  {type: 'archive', id: 'smga-documents-110069402'},
  {type: 'archive', id: 'smga-documents-110000003'},
  {type: 'archive', id: 'smga-documents-110066453'},
  {type: 'object', id: 'smgc-objects-37959'},
  {type: 'object', id: 'smgc-objects-wrongid'},
  {type: 'object', id: 'smgc-objects-67812'},
  {type: 'object', id: 'smgc-objects-520148'},
  {type: 'agent', id: 'smgc-people-17351'},
  {type: 'agent', id: 'smgc-people-36993'},
  {type: 'agent', id: 'smgc-people-wrongid'},
  {type: 'agent', id: 'smga-people-24329'}
];

const searchToCopy = [
  {q: 'babbage doc', params: {type: 'documents'}},
  {q: 'test', params: {}},
  {q: 'test people', params: {type: 'people'}},
  {q: 'test objects', params: {type: 'objects'}},
  {q: 'test documents', params: {type: 'documents'}},
  {q: 'ada', params: {}},
  {q: 'ada objects', params: {type: 'objects'}},
  {q: '2016-5008/49', params: {type: 'objects'}},
  {q: 'ada people', params: {type: 'people'}},
  {q: 'Lumière', params: {type: 'people'}},
  {q: 'Lumière filmmaker', queryParams: {'filter[occupation]': 'filmmaker'}, params: {type: 'people'}},
  {q: 'sonnabend', params: {}}
];

const related = [
  {id: 'smgc-people-36993'},
  {id: 'smgc-people-17351'},
  {id: 'smgc-people-2735'}
];

const children = [
  {id: 'smga-documents-110000003'},
  {id: 'smga-archive-110000316'},
  {id: 'smga-documents-110000036'},
  {id: 'smga-documents-110066453'},
  {id: 'smga-documents-110000009'}
];

var database = {};
database.archive = {};
database.agent = {};
database.object = {};
database.search = {};
database.related = {};
database.children = {};

// copy get values
copyEsDocs(elastic, dataToCopy, database, () => {
  copyEsSearches(elastic, searchToCopy, database, () => {
    copyEsrelated(elastic, related, database, () => {
      copyEsChildren(elastic, children, database, () => {
        fs.writeFileSync(dirData + '/database.json', JSON.stringify(database), 'utf-8');
      });
    });
  });
});
