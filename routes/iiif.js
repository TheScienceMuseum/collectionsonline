const Boom = require('@hapi/boom');
const buildJSONResponse = require('../lib/jsonapi-response');
const TypeMapping = require('../lib/type-mapping');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const cacheHeaders = require('./route-helpers/cache-control');
const { promisify } = require('util');
const setTimeoutPromise = promisify(setTimeout);

// Pre-load the IIIF manifest template once at startup rather than on every request
const iiifTemplate = Handlebars.compile(
  fs.readFileSync(path.join(__dirname, '/../templates/iiif/iiifmanifest.json'), 'utf8')
);

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/iiif/{type}/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600 * 24),
    handler: async function (request, h) {
      const DEFAULT_TIMEOUT = 3000; // 2 seconds default timeout

      if (!(request.params.type === 'objects' || request.params.type === 'documents')) {
        return Boom.notFound();
      }

      try {
        const internalId = TypeMapping.toInternal(request.params.id);

        // Implement timeout using Promise.race
        const result = await Promise.race([
          elastic.get({
            index: 'ciim',
            id: internalId
          }),
          setTimeoutPromise(DEFAULT_TIMEOUT).then(() => {
            throw new Error(`Elasticsearch request timed out after ${DEFAULT_TIMEOUT}ms`);
          })
        ]);

        if (!result.body || !result.body._source) {
          throw new Error('Invalid Elasticsearch response format');
        }

        const iiifData = buildJSONResponse(result.body, config);
        iiifData.self = config.rootUrl + '/iiif/' + iiifData.data.type + '/' + iiifData.data.id;

        // Initialize media array and only populate if multimedia exists
        iiifData.media = [];
        if (result.body._source.multimedia && Array.isArray(result.body._source.multimedia)) {
          result.body._source.multimedia.forEach(function (media) {
            if (media && media['@processed']) {
              iiifData.media.push(media['@processed']);
            }
          });
        }

        return h.response(iiifTemplate(iiifData)).header('content-type', 'application/json');
      } catch (err) {
        request.log({
          tags: ['iiif', 'error'],
          message: 'IIIF request failed',
          error: err.message,
          params: request.params,
          stack: err.stack
        });

        if (err.message.includes('timed out')) {
          return Boom.serverUnavailable('Backend service timeout');
        }
        if (err.statusCode === 404) {
          return Boom.notFound();
        }
        return Boom.serverUnavailable(`Service unavailable: ${err.message}`);
      }
    }
  }
});
