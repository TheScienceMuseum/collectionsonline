/**
* Return a specific document from elasticsearch
*/
module.exports = function (elastic, type, id, next) {
  elastic.get({
    index: 'ciim',
    id
  }, (error, response) => {
    return next(error, response);
  });
};
