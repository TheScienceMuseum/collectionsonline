const Boom = require('boom');
const archiveSchema = require('../schemas/archive.js');
const TypeMapping = require('../lib/type-mapping');
const getCachedDocument = require('../lib/cached-document');
const buildJSONResponse = require('../lib/jsonapi-response');
const JSONToHTML = require('../lib/transforms/json-to-html-data');
const contentType = require('./route-helpers/content-type.js');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/documents/{id}/{slug?}',
  config: {
    validate: {
      query: archiveSchema
    },
    handler: function (request, reply) {
      var responseType = contentType(request);

      if (responseType === 'json') {
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
            return reply(Object.assign(buildJSONResponse(result, config), {tree: data})).header('content-type', 'application/vnd.api+json');
          });
        });
      }

      if (responseType === 'html') {
        return HTMLResponse(request, reply, elastic, config);
      }

      if (responseType === 'notAcceptable') {
        return reply('Not Acceptable').code(416);
      }
    }
  }
});

function HTMLResponse (request, reply, elastic, config) {
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
      var JSONData = buildJSONResponse(result, config);
      var HTMLData = JSONToHTML(JSONData);
      return reply.view('archive', Object.assign(HTMLData, {tree: data}));
    });
  });
}

function elasticError (err) {
  if (err.status === 404) {
    return Boom.notFound();
  } else {
    return Boom.serverUnavailable('unavailable');
  }
}
