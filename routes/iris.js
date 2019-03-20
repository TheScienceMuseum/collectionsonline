const Boom = require('boom');
const TypeMapping = require('../lib/type-mapping');
const buildJSONResponse = require('../lib/jsonapi-response');
var AWS = require('aws-sdk');
var beautify = require('json-beautify');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/iris/{type}/{id}/{slug?}',
  config: {
    handler: async function (request, h) {
      if (!(request.params.type === 'objects' || request.params.type === 'documents')) {
        return Boom.notFound();
      }

      try {
        const result = await elastic.get({ index: 'smg', type: TypeMapping.toInternal(request.params.type), id: TypeMapping.toInternal(request.params.id) });

        var apiData = buildJSONResponse(result, config);

        var inProduction = config && config.NODE_ENV === 'production';

        if (!inProduction) {
          // AWS Rekogition
          var rekognition = new AWS.Rekognition({ region: 'eu-west-1' });
          var imageURL = apiData.data.attributes.multimedia[0].processed.medium_thumbnail.location;
          var s3path = 'media/' + imageURL.slice(config.mediaPath.length);

          var params = {
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
