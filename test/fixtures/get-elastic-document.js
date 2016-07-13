/**
* Return a specific document from elasticsearch
*/
module.exports = function (elastic, type, id, next) {
  elastic.get({
    index: 'smg',
    type: type,
    id: id
  }, (error, response) => {
    return next(error, response);
  });
};
