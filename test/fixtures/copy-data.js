const Client = require('elasticsearch').Client;
const config = require('../../config');
const elastic = new Client(config.elasticsearch);
const getElasticDocument = require('./get-elastic-document');
const fs = require('fs');
const dirData = 'test/fixtures/elastic-responses';

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
