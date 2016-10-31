const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
var beautify = require('json-beautify');
var contentType = require('./route-helpers/content-type.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/api/{type}/{id}',
  config: {
    handler: function (request, reply) {
      elastic.get({index: 'smg', type: TypeMapping.toInternal(request.params.type), id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
        if (err) {
          if (err.status === 404) {
            return reply(Boom.notFound());
          }
          return reply(Boom.serverUnavailable('unavailable'));
        }

        var responseType = contentType(request);

        var apiData = beautify(buildJSONResponse(result, config), null, 2, 80);
        if (responseType === 'html') {
          return reply.view('api', {api: apiData});
        }

        if (responseType === 'json') {
          return reply(apiData).header('content-type', 'application/vnd.api+json');
        }
      });
    }
  }
});
