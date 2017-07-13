/**
* Return "json" "html" or "notAcceptable"
*/
module.exports = function (request) {
  var jsonAcceptHeaders = ['application/vnd.api+json', 'application/json'];
  var htmlAcceptHeaders = ['text/html', '*/*'];
  var rdfAcceptHeaders = ['application/rdf+xml'];

  if (request.headers.accept) {
    var accept = request.headers.accept;
    var jsonContent = typesInHeaders(accept, jsonAcceptHeaders);
    var htmlContent = typesInHeaders(accept, htmlAcceptHeaders);
    var rdfContent = typesInHeaders(accept, rdfAcceptHeaders);
    // if accept header has both json and html return notAcceptable
    if (jsonContent && htmlContent) {
      return 'notAcceptable';
    }

    if (htmlContent) {
      return 'html';
    }

    if (jsonContent) {
      return 'json';
    }

    if (rdfContent) {
      return 'rdf';
    }
  }

  var twitterBot = (request.headers['user-agent'] || '').indexOf('Twitterbot') > -1;
  if (twitterBot) {
    return 'html';
  }

  // return notAcceptable if no cases match
  return 'notAcceptable';
};

function typesInHeaders (acceptHeaders, contentTypes) {
  var result = false;
  contentTypes.forEach(function (type) {
    if (acceptHeaders.indexOf(type) > -1) {
      result = true;
    }
  });
  return result;
}
