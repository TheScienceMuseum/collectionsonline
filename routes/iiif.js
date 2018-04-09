const Boom = require('boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/iiif/{type}/{id}/{slug?}',
  config: {
    handler: function (request, reply) {
      if (!(request.params.type === 'objects' || request.params.type === 'documents')) {
        return reply(Boom.notFound());
      }

      elastic.get({index: 'smg', type: TypeMapping.toInternal(request.params.type), id: TypeMapping.toInternal(request.params.id)}, (err, result) => {
        if (err) {
          if (err.status === 404) {
            return reply(Boom.notFound());
          }
          return reply(Boom.serverUnavailable('unavailable'));
        }

        var apiData = buildJSONResponse(result, config);
        var iiifData = apiData;
        iiifData.urlprefix = 'https://collection.sciencemuseum.org.uk';
        iiifData.self = iiifData.urlprefix + '/iiif/' + iiifData.data.type + '/' + iiifData.data.id;

        return reply(
          Handlebars.compile(
            fs.readFileSync(path.join(__dirname, '/../templates/iiif/iiif.json'), 'utf8')
          )(iiifData)
        ).header('content-type', 'application/json');
      });
    }
  }
});
