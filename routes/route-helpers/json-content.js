/**
* Return true if the request ask for a json content, false otherwise
*/
module.exports = function (request) {
  var jsonContent = false;
  var jsonAcceptHeaders = ['application/vnd.api+json', 'application/json'];
  if (request.headers.accept) {
    jsonAcceptHeaders.forEach(function (acceptHeader) {
      if (request.headers.accept.indexOf(acceptHeader) > -1) {
        jsonContent = true;
      }
    });
  }
  return jsonContent;
};
