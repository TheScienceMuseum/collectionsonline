/**
* Copy from elasticsearch some values
*/
const getElasticDocument = require('./get-elastic-document');
const TypeMapping = require('../../lib/type-mapping');

module.exports = function (elastic, dataToCopy, database, next) {
  // Error fixture 400 bad request
  database.archive[TypeMapping.toInternal('smga-documents-badRequest')] = { error: { 'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request' } };
  database.agent[TypeMapping.toInternal('smgc-people-badRequest')] = { error: { 'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request' } };
  database.object[TypeMapping.toInternal('smgc-object-badRequest')] = { error: { 'status': 400, 'displayName': 'BadRequest', 'message': 'Bad Request' } };

  // Error fixtures no error but also no result
  database.archive[TypeMapping.toInternal('smga-documents-noResult')] = {error: { status: 404, displayName: 'NotFound', message: 'Not Found' }, response: null};
  database.agent[TypeMapping.toInternal('smgc-people-noResult')] = {error: { status: 404, displayName: 'NotFound', message: 'Not Found' }, response: null};
  database.object[TypeMapping.toInternal('smgc-object-noResult')] = {error: { status: 404, displayName: 'NotFound', message: 'Not Found' }, response: null};

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
        return next();
      }
    });
  });
};
