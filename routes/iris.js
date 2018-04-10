const Boom = require('boom');
const TypeMapping = require('../lib/type-mapping');
const buildJSONResponse = require('../lib/jsonapi-response');
var AWS = require('aws-sdk');
var beautify = require('json-beautify');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/iris/{type}/{id}/{slug?}',
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

        var inProduction = config && config.NODE_ENV === 'production';
        if (!inProduction) {
          // AWS Rekogition
          var rekognition = new AWS.Rekognition({region: 'eu-west-1'});
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
          rekognition.detectLabels(params, function (err, data) {
            if (err) {
              console.log(err, err.stack);
            }
            data = beautify(data, null, 2, 80);
            return reply(data).header('content-type', 'application/json');
          });
        }
      });
    }
  }
});
