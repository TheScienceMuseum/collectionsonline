/**
* Return "json" "html" or "notAcceptable"
*/
module.exports = function (request) {
  const jsonAcceptHeaders = ['application/vnd.api+json', 'application/json'];
  const htmlAcceptHeaders = ['text/html', '*/*'];

  // The client SPA appends `?ajax=true` to every resource fetch. Treat it as
  // an explicit JSON signal so we don't depend on CloudFront forwarding the
  // Accept header to origin — without that, `/group/*`, `/objects/*` etc.
  // cache the HTML response and serve it to SPA JSON fetches, causing
  // `JSON.parse('<...')` to throw "Unrecognized token '<'". The query string
  // also gives CloudFront a distinct cache key from the bare URL.
  if (request.query && request.query.ajax === 'true') {
    return 'json';
  }

  if (request.headers.accept) {
    const accept = request.headers.accept;
    const jsonContent = typesInHeaders(accept, jsonAcceptHeaders);
    const htmlContent = typesInHeaders(accept, htmlAcceptHeaders);
    // if accept header has both json and html return notAcceptable
    if (jsonContent && htmlContent) {
      return 'json';
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

  // ammened as this seem to cause issues with Cloudfront and Crawlers
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
