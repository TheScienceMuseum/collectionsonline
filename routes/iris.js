const Boom = require('boom');
const TypeMapping = require('../lib/type-mapping');
const buildJSONResponse = require('../lib/jsonapi-response');
const AWS = require('aws-sdk');
const beautify = require('json-beautify');
const cacheHeaders = require('./route-helpers/cache-control');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/iris/{type}/{id}/{slug?}',
  config: {
    cache: cacheHeaders(config, 3600),
    handler: async function (request, h) {
      if (!(request.params.type === 'objects' || request.params.type === 'documents')) {
        return Boom.notFound();
      }

      try {
        const result = await elastic.get({ index: 'ciim', type: TypeMapping.toInternal(request.params.type), id: TypeMapping.toInternal(request.params.id) });

        const apiData = buildJSONResponse(result, config);

        const inProduction = config && config.NODE_ENV === 'production';

        if (!inProduction) {
          // AWS Rekogition
          const rekognition = new AWS.Rekognition({ region: 'eu-west-1' });
          const imageURL = apiData.data.attributes.multimedia[0].processed.medium_thumbnail.location;
          const s3path = 'media/' + imageURL.slice(config.mediaPath.length);

          const params = {
            Image: {
              S3Object: {
                Bucket: 'smgco-images',
                Name: s3path
              }
            }
          };

          const data = await rekognition.detectLabels(params).promise();

          const beautifiedData = beautify(data, null, 2, 80);

          return h.response(beautifiedData).header('content-type', 'application/json');
        }
      } catch (err) {
        if (err.status === 404) {
          return Boom.notFound();
        }
        return Boom.serverUnavailable('unavailable');
      }
    }
  }
});
