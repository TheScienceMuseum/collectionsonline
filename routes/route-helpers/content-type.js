/**
* Return "json" "html" or "notAcceptable"
*/
module.exports = function (request) {
  const jsonAcceptHeaders = ['application/vnd.api+json', 'application/json'];
  const htmlAcceptHeaders = ['text/html', '*/*'];

  if (request.headers.accept) {
    const accept = request.headers.accept;
    const jsonContent = typesInHeaders(accept, jsonAcceptHeaders);
    const htmlContent = typesInHeaders(accept, htmlAcceptHeaders);
    // if accept header has both json and html return notAcceptable
    if (jsonContent && htmlContent) {
      // ammened as this seem to cause issues with CLiudfortn and Crawlers
      // return 'notAcceptable';
      return 'html';
    }

    if (htmlContent) {
      return 'html';
    }

    if (jsonContent) {
      return 'json';
    }
  }

  const twitterBot = (request.headers['user-agent'] || '').indexOf('Twitterbot') > -1;
  if (twitterBot) {
    return 'html';
  }

  // ammened as this seem to cause issues with CLiudfortn and Crawlers
  // return 'notAcceptable';
  return 'html';
};

function typesInHeaders (acceptHeaders, contentTypes) {
  let result = false;
  contentTypes.forEach(function (type) {
    if (acceptHeaders.indexOf(type) > -1) {
      result = true;
    }
  });
  return result;
}
