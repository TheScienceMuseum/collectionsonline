const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const JSONToHTML = require('../lib/transforms/json-to-html-data.js');
const contentType = require('./route-helpers/content-type.js');
const getSimilarObjects = require('../lib/get-similar-objects');
const sortRelated = require('../lib/sort-related-items');

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

          getSimilarObjects(result, elastic, function (err, relatedItems) {
            if (err) {
              relatedItems = null;
            } else {
              relatedItems = sortRelated(relatedItems);
            }

            return reply(buildJSONResponse(result, config, relatedItems)).header('content-type', 'application/vnd.api+json');
          });
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
    page: 'object'
  };

  elastic.get({index: 'smg', type: 'object', id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
    if (err) {
      if (err.status === 404) {
        return reply(Boom.notFound());
      }
      return reply(Boom.serverUnavailable('unavailable'));
    }

    getSimilarObjects(result, elastic, function (err, relatedItems) {
      if (err) {
        relatedItems = null;
      } else {
        relatedItems = sortRelated(relatedItems);
      }

      const JSONData = buildJSONResponse(result, config, relatedItems);
      const HTMLData = JSONToHTML(JSONData, config);

      return reply.view('object', Object.assign(HTMLData, data));
    });
  });
}
