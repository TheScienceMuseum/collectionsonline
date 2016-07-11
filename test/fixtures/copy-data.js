const Client = require('elasticsearch').Client;
const config = require('../../config');
const elastic = new Client(config.elasticsearch);
const getElasticDocument = require('./get-elastic-document');
const fs = require('fs');
const dirData = 'test/fixtures/elastic-responses';
const TypeMapping = require('../../lib/type-mapping');
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
  {type: 'object', id: 'smgc-objects-37959'},
  {type: 'object', id: 'smgc-objects-wrongid'},
  {type: 'agent', id: 'smgc-people-17351'},
  {type: 'agent', id: 'smgc-people-wrongid'},
  {type: 'agent', id: 'smgc-people-17351'}
];

var database = {};
database.archive = {};
database.agent = {};
database.object = {};

// Error fixture 400 bad request
database.archive[TypeMapping.toInternal('smga-documents-badRequest')] = { error: { 'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request' } };
database.agent[TypeMapping.toInternal('smgc-people-badRequest')] = { error: { 'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request' } };
database.object[TypeMapping.toInternal('smgc-object-badRequest')] = { error: { 'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request' } };

// Error fixtures no error but also no result
database.archive[TypeMapping.toInternal('smga-documents-noResult')] = {error: null, response: null};
database.agent[TypeMapping.toInternal('smgc-people-noResult')] = {error: null, response: null};
database.object[TypeMapping.toInternal('smgc-object-noResult')] = {error: null, response: null};

// search error fixture
database.search = {};
database.search.error = {error: {'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request'}, response: null};

var count = 0;
console.log('copy database to fixtures');
dataToCopy.forEach(data => {
  getElasticDocument(elastic, data.type, TypeMapping.toInternal(data.id), (error, response) => {
    if (error) {
      console.log('Error get data for ', data.id);
    }
    database[data.type][TypeMapping.toInternal(data.id)] = {error: error, response: response};
    count += 1;
    if (count === dataToCopy.length) {
      fs.writeFileSync(dirData + '/database.json', JSON.stringify(database), 'utf-8');
    }
  });
});
