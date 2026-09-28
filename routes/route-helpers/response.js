const JSONToHTML = require('../../lib/transforms/json-to-html-data.js');
const addCacheValidators = require('./cache-validators.js');

module.exports = function (h, data, type, responseType) {
  const lastModified = data && data.meta && data.meta.lastModified;

  if (responseType === 'html') {
    const pageData = {
      page: type
    };
    const HTMLData = JSONToHTML(data);
    const view = h.view(type, Object.assign(HTMLData, pageData));
    return addCacheValidators(view, { variant: 'html', payload: data, lastModified });
  }

  if (responseType === 'json') {
    const response = h.response(data).header('content-type', 'application/vnd.api+json');
    return addCacheValidators(response, { variant: 'json', payload: data, lastModified });
  }
};
