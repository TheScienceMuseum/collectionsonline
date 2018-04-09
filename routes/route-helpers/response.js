const JSONToHTML = require('../../lib/transforms/json-to-html-data.js');

module.exports = function (reply, data, type, responseType) {
  if (responseType === 'html') {
    const pageData = {
      page: type
    };
    const HTMLData = JSONToHTML(data);
    return reply.view(type, Object.assign(HTMLData, pageData));
  }

  if (responseType === 'json') {
    return reply(data).header('content-type', 'application/vnd.api+json');
  }
};
