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
const search = require('../../lib/search');
const createQueryParams = require('../../lib/query-params/query-params');

Async.parallel([
  /**
  * Create files for transforms tests
  */
  (cb) => {
    Async.each([
      { id: 'cp108048', type: 'agent', filename: 'example-get-response-death' },
      { id: 'aa110000003', type: 'archive', filename: 'example-get-response-document' },
      { id: 'co8245103', type: 'object', filename: 'example-get-response-object' },
      { id: 'co205752', type: 'object', filename: 'example-get-response-object2' },
      { id: 'co8447906', type: 'object', filename: 'example-get-response-object3' },
      { id: 'co503422', type: 'object', filename: 'example-get-response-object4' },
      { id: 'cp5207', type: 'agent', filename: 'example-get-response-organisation' },
      { id: 'cp36993', type: 'agent', filename: 'example-get-response-person' },
      { id: 'cp86306', type: 'agent', filename: 'example-get-response-with-places' }
    ], (data, cb) => {
      getElasticDocument(elastic, data.type, data.id, (err, response) => {
        if (err) {
          console.log('Error Elastic', data.id);
          return cb(err);
        }
        Fs.writeFile(`${dirData}/${data.filename}.json`, JSON.stringify(response, null, 2), 'utf-8', cb);
      });
    }, cb);
  },

/**
* Create mock elasticsaerch database for get and search tests
*/
  (cb) => {
    const dataToCopy = [
      { type: 'archive', id: 'aa110000316' },
      { type: 'archive', id: 'aawrongid' },
      {type: 'archive', id: 'aa110069402'},
      {type: 'archive', id: 'aa110000003'},
      {type: 'archive', id: 'aa110066453'},
      {type: 'object', id: 'co37959'},
      {type: 'object', id: 'cowrongid'},
      {type: 'object', id: 'co67812'},
      {type: 'object', id: 'co520148'},
      {type: 'object', id: 'co8229027'},
      {type: 'object', id: 'co114820'},
      {type: 'agent', id: 'cp17351'},
      {type: 'agent', id: 'cp36993'},
      {type: 'agent', id: 'cpwrongid'},
      {type: 'agent', id: 'ap24329'}
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
      {id: 'cp36993'},
      {id: 'cp17351'},
      {id: 'cp2735'}
    ];

    const children = [
      {id: 'aa110000003'},
      {id: 'aa110000316'},
      {id: 'aa110000036'},
      {id: 'aa110066453'},
      {id: 'aa110000009'}
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
  },

  // Aggregations
  (cb) => {
    search(elastic, createQueryParams('html', {query: {q: 'test'}, params: {}}), (err, response) => {
      if (err) throw err;
      Fs.writeFile(dirData + '/../../helpers/aggregations-all.json', JSON.stringify(response.aggregations.all, null, 2), 'utf-8', cb);
    });
  }
], (err) => {
  if (err) throw err;
});
