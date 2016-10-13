const fs = require('fs');
const Boom = require('boom');
const exampleData = JSON.parse(fs.readFileSync('./src/data/object.json'));
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const JSONToHTML = require('../lib/transforms/json-to-html-data.js');
const contentType = require('./route-helpers/content-type.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/objects/{id}/{slug?}',
  config: {
    handler: function (request, reply) {
      var responseType = contentType(request);
      if (responseType === 'json') {
        elastic.get({index: 'smg', type: 'object', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
          if (err) {
            if (err.status === 404) {
              return reply(Boom.notFound());
            }
            return reply(Boom.serverUnavailable('unavailable'));
          }

          return reply(buildJSONResponse(result, config)).header('content-type', 'application/vnd.api+json');
        });
      }

      if (responseType === 'html') {
        return HTMLResponse(request, reply, elastic, config);
      }

      if (responseType === 'notAcceptable') {
        return reply('Not Acceptable').code(406);
      }
    }
  }
});

function HTMLResponse (request, reply, elastic, config) {
  const data = {
    page: 'object',
    slides: exampleData.slides
  };

  elastic.get({index: 'smg', type: 'object', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
    if (err) {
      if (err.status === 404) {
        return reply(Boom.notFound());
      }
      return reply(Boom.serverUnavailable('unavailable'));
    }

    const JSONData = buildJSONResponse(result, config);
    const HTMLData = JSONToHTML(JSONData);

    return reply.view('object', Object.assign(HTMLData, data));
  });
}
