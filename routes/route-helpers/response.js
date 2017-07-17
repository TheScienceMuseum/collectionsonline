const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const JSONToHTML = require('../../lib/transforms/json-to-html-data.js');

module.exports = function (reply, data, type, responseType) {
  if (responseType === 'html') {
    const pageData = {
      page: type
    };

    const HTMLData = JSONToHTML(data);

    return reply.view(type, Object.assign(HTMLData, pageData));
  }

  if (responseType === 'rdf') {
    Handlebars.registerHelper('build-rdf', require('../../templates/rdf/build-rdf.js'));
    return reply(
      Handlebars.compile(
        fs.readFileSync(path.join(__dirname, '/../../templates/rdf/rdf-template.rdf'), 'utf8')
      )(data)
    ).header('content-type', 'application/rdf+xml');
  }

  if (responseType === 'json') {
    return reply(data).header('content-type', 'application/vnd.api+json');
  }
};
