/**
* Return a specific document from elasticsearch
*/
const config = require('../../config');

module.exports = function (elastic, type, id, next) {
  elastic.get({
    index: config.elasticIndex,
    id
  }, (error, response) => {
    return next(error, response);
  });
};
