const Boom = require('boom');
const archiveSchema = require('../schemas/archive.js');
const TypeMapping = require('../lib/type-mapping');
const getCachedDocument = require('../lib/cached-document');
const buildJSONResponse = require('../lib/jsonapi-response');
const JSONToHTML = require('../lib/transforms/json-to-html-data');

module.exports = (elastic, config) => ({
  method: 'GET',
  path: '/documents/{id}/{slug?}',
  handler: (request, reply) => HTMLResponse(request, reply, elastic, config),
  config: {
    validate: {
      query: archiveSchema
    },
    plugins: {
      'hapi-negotiator': {
        mediaTypes: {
          'text/html' (request, reply) {
            return HTMLResponse(request, reply, elastic, config);
          },
          'application/vnd.api+json' (request, reply) {
            elastic.get({index: 'smg', type: 'archive', id: TypeMapping.toInternal(request.params.id)}, function (err, result) {
              var fondsId;
              if (err) reply(err);
              if (result._source.fonds) {
                fondsId = result._source.fonds[0].admin.uid;
              } else {
                fondsId = result._source.admin.uid;
              }
              getCachedDocument(elastic, TypeMapping.toInternal(request.params.id), fondsId, function (err, data) {
                if (err) {
                  if (err.status === 404) {
                    return reply(Boom.notFound());
                  }
                  return reply(Boom.serverUnavailable('unavailable'));
                }
                return reply(Object.assign(buildJSONResponse(result, config), {tree: data})).header('content-type', 'application/vnd.api+json');
              });
            });
          }
        }
      }
    }
  }
});

function HTMLResponse (request, reply, elastic, config) {
  elastic.get({index: 'smg', type: 'archive', id: TypeMapping.toInternal(request.params.id)}, function (err, result) {
    var fondsId;
    if (err) reply(err);
    if (result._source.fonds) {
      fondsId = result._source.fonds[0].admin.uid;
    } else {
      fondsId = result._source.admin.uid;
    }
    getCachedDocument(elastic, TypeMapping.toInternal(request.params.id), fondsId, function (err, data) {
      if (err) {
        if (err.status === 404) {
          return reply(Boom.notFound());
        }
        return reply(Boom.serverUnavailable('unavailable'));
      }
      var JSONData = buildJSONResponse(result, config);
      var HTMLData = JSONToHTML(JSONData);
      return reply.view('archive', Object.assign(HTMLData, {tree: data}));
    });
  });
}
