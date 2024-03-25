/**
 * Copy from elasticsearch some values
 */
const getElasticDocument = require('./get-elastic-document');
const TypeMapping = require('../../lib/type-mapping');

module.exports = function (elastic, dataToCopy, database, next) {
  database.archive = database.archive || {};
  database.agent = database.agent || {};
  database.object = database.object || {};
  database.mgroup = database.group || {};

  // Error fixture 400 bad request
  database.archive[TypeMapping.toInternal('aabadRequest')] = {
    error: { status: 400, displayName: 'BadRequest', message: 'Bad Request' },
  };
  database.agent[TypeMapping.toInternal('cpbadRequest')] = {
    error: { status: 400, displayName: 'BadRequest', message: 'Bad Request' },
  };
  database.object[TypeMapping.toInternal('cobadRequest')] = {
    error: { status: 400, displayName: 'BadRequest', message: 'Bad Request' },
  };
  database.mgroup[TypeMapping.toInternal('cobadRequest')] = {
    error: { status: 400, displayName: 'BadRequest', message: 'Bad Request' },
  };
  // Error fixtures no error but also no result
  database.archive[TypeMapping.toInternal('aanoResult')] = {
    error: { status: 404, displayName: 'NotFound', message: 'Not Found' },
    response: null,
  };
  database.agent[TypeMapping.toInternal('cpnoResult')] = {
    error: { status: 404, displayName: 'NotFound', message: 'Not Found' },
    response: null,
  };
  database.object[TypeMapping.toInternal('conoResult')] = {
    error: { status: 404, displayName: 'NotFound', message: 'Not Found' },
    response: null,
  };
  database.mgroup[TypeMapping.toInternal('conoResult')] = {
    error: { status: 404, displayName: 'NotFound', message: 'Not Found' },
    response: null,
  };

  let count = 0;
  console.log('copy database to fixtures');
  dataToCopy.forEach((data) => {
    getElasticDocument(
      elastic,
      data.type,
      TypeMapping.toInternal(data.id),
      (error, response) => {
        if (error) {
          console.log('Error get data for ', data.id);
        }
        database[data.type] = database[data.type] || {};
        database[data.type][TypeMapping.toInternal(data.id)] = {
          error,
          response,
        };
        count += 1;
        if (count === dataToCopy.length) {
          return next();
        }
      }
    );
  });
};
