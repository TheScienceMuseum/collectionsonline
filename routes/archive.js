const Boom = require('boom');
const TypeMapping = require('../lib/type-mapping');
const getCachedDocument = require('../lib/cached-document');
const buildJSONResponse = require('../lib/jsonapi-response');
const contentType = require('./route-helpers/content-type.js');
const response = require('./route-helpers/response');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/documents/{id}/{slug?}',
  handler: function (request, reply) {
    var responseType = contentType(request);

    if (responseType !== 'notAcceptable') {
      elastic.get({index: 'smg', type: 'archive', id: TypeMapping.toInternal(request.params.id)}, function (err, result) {
        var fondsId;

        if (err) {
          return reply(elasticError(err));
        }

        if (result._source.fonds) {
          fondsId = result._source.fonds[0].admin.uid;
        } else {
          fondsId = result._source.admin.uid;
        }

        getCachedDocument(elastic, TypeMapping.toInternal(request.params.id), fondsId, function (err, data) {
          if (err) {
            return reply(elasticError(err));
          }

          const JSONData = Object.assign(buildJSONResponse(result, config), {tree: data});

          return response(reply, JSONData, 'archive', responseType);
        });
      });
    } else {
      return reply('Not Acceptable').code(406);
    }
  }
});

function elasticError (err) {
  if (err.status === 404) {
    return Boom.notFound();
  } else {
    return Boom.serverUnavailable('unavailable');
  }
}
