const JSONToHTML = require('../../lib/transforms/json-to-html-data.js');

module.exports = function (h, data, type, responseType) {
  if (responseType === 'html') {
    const pageData = {
      page: type
    };
    const HTMLData = JSONToHTML(data);
    return h.view(type, Object.assign(HTMLData, pageData));
  }

  if (responseType === 'json') {
    return h.response(data).header('content-type', 'application/vnd.api+json');
  }
};
