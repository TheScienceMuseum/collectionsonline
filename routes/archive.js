const Boom = require('boom');
const archiveSchema = require('../schemas/archive.js');
const getArchiveAndChildren = require('../lib/get-archive-and-children');
const TypeMapping = require('../lib/type-mapping');
const Catbox = require('catbox');
const CatboxRedis = require('catbox-redis');
var [ elasticacheHost, elasticachePort ] = ['127.0.0.1', '6379'];

if (process.env.ELASTICACHE_EP) {
  [ elasticacheHost, elasticachePort ] = process.env.ELASTICACHE_EP.split(':');
}

const cache = new Catbox.Client(CatboxRedis, {host: elasticacheHost, port: elasticachePort});

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
            cache.start((err) => {
              if (err) console.log(err);
              cache.get({segment: 'documents', id: TypeMapping.toInternal(request.params.id)}, (err, cached) => {
                if (err) console.log(err);
                if (cached) return reply(cached.item.JSONData);
                cacheDocument(elastic, config, cache, request);
                return getArchiveAndChildren(elastic, config, request, function (err, data) {
                  if (err) {
                    if (err.status === 404) {
                      return reply(Boom.notFound());
                    }
                    return reply(Boom.serverUnavailable('unavailable'));
                  }

                  return reply(data.JSONData).header('content-type', 'application/vnd.api+json');
                });
              });
            });
          }
        }
      }
    }
  }
});

function HTMLResponse (request, reply, elastic, config) {
  cache.start((err) => {
    if (err) console.log(err);
    cache.get({segment: 'documents', id: TypeMapping.toInternal(request.params.id)}, (err, cached) => {
      if (err) console.log(err);
      if (cached) return reply.view('archive', cached.item.HTMLData);
      cacheDocument(elastic, config, cache, request);
      return getArchiveAndChildren(elastic, config, request, function (err, data) {
        if (err) {
          if (err.status === 404) {
            return reply(Boom.notFound());
          }
          return reply(Boom.serverUnavailable('unavailable'));
        }

        return reply.view('archive', data.HTMLData);
      });
    });
  });
}

function cacheDocument (elastic, config, cache, request) {
  return getArchiveAndChildren(elastic, config, request, function (err, data) {
    if (err) {
      console.log(err);
    }

    cache.set({segment: 'documents', id: TypeMapping.toInternal(request.params.id)}, data, 100000000, (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log(TypeMapping.toInternal(request.params.id) + ' successfully cached');
      }
      cache.stop();
    });
  });
}
