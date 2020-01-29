const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/iiif/{type}/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: async function (request, h) {
      if (!(request.params.type === 'objects' || request.params.type === 'documents')) {
        return Boom.notFound();
      }

      try {
        const result = await elastic.get({ index: 'smg', type: TypeMapping.toInternal(request.params.type), id: TypeMapping.toInternal(request.params.id) });

        var iiifData = buildJSONResponse(result, config);
        iiifData.self = config.rootUrl + '/iiif/' + iiifData.data.type + '/' + iiifData.data.id;

        return h.response(
          Handlebars.compile(
            fs.readFileSync(path.join(__dirname, '/../templates/iiif/iiifmanifest.json'), 'utf8')
          )(iiifData)
        ).header('content-type', 'application/json');
      } catch (err) {
        if (err.status === 404) {
          return Boom.notFound();
        }
        return Boom.serverUnavailable('unavailable');
      }
    }
  }
});
