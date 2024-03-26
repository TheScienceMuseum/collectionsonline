const Boom = require('@hapi/boom');
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
        const result = await elastic.get({ index: 'ciim', id: TypeMapping.toInternal(request.params.id) });

        const iiifData = buildJSONResponse(result.body, config);
        iiifData.self = config.rootUrl + '/iiif/' + iiifData.data.type + '/' + iiifData.data.id;

        // deal with @processed before passing to handlebars
        iiifData.media = [];
        result.body._source.multimedia.forEach(function (media) {
          iiifData.media.push(media['@processed']);
        });

        return h.response(
          Handlebars.compile(
            fs.readFileSync(path.join(__dirname, '/../templates/iiif/iiifmanifest.json'), 'utf8')
          )(iiifData)
        ).header('content-type', 'application/json');
      } catch (err) {
        if (err.statusCode === 404) {
          return Boom.notFound();
        }
        return Boom.serverUnavailable('unavailable');
      }
    }
  }
});
