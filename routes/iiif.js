const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
var beautify = require('json-beautify');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/iiif/{type}/{id}/{slug?}',
  config: {
    handler: function (request, reply) {
      elastic.get({index: 'smg', type: TypeMapping.toInternal(request.params.type), id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
        if (err) {
          if (err.status === 404) {
            return reply(Boom.notFound());
          }
          return reply(Boom.serverUnavailable('unavailable'));
        }

        var apiData = beautify(buildJSONResponse(result, config), null, 2, 80);
        return reply.view('iiif', {api: apiData});
      });
    }
  }
});
