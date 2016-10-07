const fs = require('fs');
const Boom = require('boom');
const exampleData = JSON.parse(fs.readFileSync('./src/data/object.json'));
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const JSONToHTML = require('../lib/transforms/json-to-html-data.js');
const jsonContent = require('./route-helpers/json-content.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/objects/{id}/{slug?}',
  config: {
    plugins: {
      'hapi-negotiator': false
    },
    handler: function (request, reply) {
      var jsonResponse = jsonContent(request);
      if (jsonResponse) {
        elastic.get({index: 'smg', type: 'object', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
          if (err) {
            if (err.status === 404) {
              return reply(Boom.notFound());
            }
            return reply(Boom.serverUnavailable('unavailable'));
          }

          reply(buildJSONResponse(result, config)).header('content-type', 'application/vnd.api+json');
        });
      } else {
        return HTMLResponse(request, reply, elastic, config);
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

    reply.view('object', Object.assign(HTMLData, data));
  });
}
