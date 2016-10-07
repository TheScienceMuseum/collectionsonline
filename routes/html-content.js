/**
* Return true if the request ask for html content, false otherwise
*/
module.exports = function (request) {
  var htmlContent = request.headers.accept && request.headers.accept.indexOf('text/html') > -1;
  return Boolean(htmlContent);
};
