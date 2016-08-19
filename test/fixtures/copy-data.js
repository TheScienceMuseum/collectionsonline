const Client = require('elasticsearch').Client;
const Async = require('async');
const config = require('../../config');
const elastic = new Client(config.elasticsearch);
const getElasticDocument = require('./get-elastic-document');
const Fs = require('fs');
const Path = require('path');
const dirData = Path.join(__dirname, 'elastic-responses');
const copyEsDocs = require('./copy-es-docs');
const copyEsSearches = require('./copy-es-searches');
const copyEsrelated = require('./copy-es-related');
const copyEsChildren = require('./copy-es-children');
const copyEsAutocompletes = require('./copy-es-autocompletes');

Async.parallel([
  /**
  * Create files for transforms tests
  */
  (cb) => {
    Async.each([
      { id: 'smgc-agent-108048', type: 'agent', filename: 'example-get-response-death' },
      { id: 'smga-archive-110000003', type: 'archive', filename: 'example-get-response-document' },
      { id: 'smgc-object-8245103', type: 'object', filename: 'example-get-response-object' },
      { id: 'smgc-object-205752', type: 'object', filename: 'example-get-response-object2' },
      { id: 'smgc-agent-5207', type: 'agent', filename: 'example-get-response-organisation' },
      { id: 'smgc-agent-36993', type: 'agent', filename: 'example-get-response-person' },
      { id: 'smgc-agent-86306', type: 'agent', filename: 'example-get-response-with-places' }
    ], (data, cb) => {
      getElasticDocument(elastic, data.type, data.id, (err, response) => {
        if (err) return cb(err);
        Fs.writeFile(`${dirData}/${data.filename}.json`, JSON.stringify(response, null, 2), 'utf-8', cb);
      });
    }, cb);
  },

/**
* Create mock elasticsaerch database for get and search tests
*/
  (cb) => {
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
      {type: 'object', id: 'smgc-objects-8229027'},
      {type: 'object', id: 'smgc-objects-114820'},
      {type: 'agent', id: 'smgc-people-17351'},
      {type: 'agent', id: 'smgc-people-36993'},
      {type: 'agent', id: 'smgc-people-wrongid'},
      {type: 'agent', id: 'smga-people-24329'}
    ];

    const searchToCopy = [
      {q: 'babbage', params: {type: 'documents'}},
      {q: 'test', params: {}},
      {q: 'test people', params: {type: 'people'}},
      {q: 'test objects', params: {type: 'objects'}},
      {q: 'test documents', params: {type: 'documents'}},
      {q: 'ada', params: {}},
      {q: 'rocket', params: {type: 'objects'}},
      {q: 'ada objects', params: {type: 'objects'}},
      {q: '2016-5008/49', params: {type: 'objects'}},
      {q: 'ada people', params: {type: 'people'}},
      {q: 'Lumière', params: {type: 'people'}},
      {q: 'Lumière filmmaker', queryParams: {'filter[occupation]': 'filmmaker'}, params: {type: 'people'}},
      {q: 'hawking painting', params: {}},
      {q: 'all', params: {}},
      {q: 'plumed hat', params: {type: 'objects'}}
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

    const autocompletes = [
      { q: 'babb' }
    ];

    const database = {};

    Async.parallel([
      (cb) => copyEsDocs(elastic, dataToCopy, database, cb),
      (cb) => copyEsSearches(elastic, searchToCopy, database, cb),
      (cb) => copyEsrelated(elastic, related, database, cb),
      (cb) => copyEsChildren(elastic, children, database, cb),
      (cb) => copyEsAutocompletes(elastic, autocompletes, database, cb)
    ], (err) => {
      if (err) throw err;
      Fs.writeFile(dirData + '/database.json', JSON.stringify(database, null, 2), 'utf-8', cb);
    });
  }
], (err) => {
  if (err) throw err;
});
