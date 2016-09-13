const Boom = require('boom');
const archiveSchema = require('../schemas/archive.js');
const getArchiveAndChildren = require('../lib/get-archive-and-children');
const getAllFromArchive = require('../lib/get-full-archive');
const archiveTree = require('../lib/archive-tree');
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
                return getArchiveAndChildren(elastic, config, request, function (err, data) {
                  if (err) {
                    if (err.status === 404) {
                      return reply(Boom.notFound());
                    }
                    return reply(Boom.serverUnavailable('unavailable'));
                  }

                  if (cached) {
                    return reply(Object.assign(data.JSONData, {tree: cached.item})).header('content-type', 'application/vnd.api+json');
                  } else if (!err) {
                    cacheDocument(elastic, config, cache, request);
                    return reply(data.JSONData).header('content-type', 'application/vnd.api+json');
                  }
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
      return getArchiveAndChildren(elastic, config, request, function (err, data) {
        if (err) {
          if (err.status === 404) {
            return reply(Boom.notFound());
          }
          return reply(Boom.serverUnavailable('unavailable'));
        }

        if (cached) {
          return reply.view('archive', Object.assign(data.HTMLData, {tree: cached.item}));
        } else if (!err) {
          cacheDocument(elastic, config, cache, request);
          return reply.view('archive', data.HTMLData);
        }
      });
    });
  });
}

function cacheDocument (elastic, config, cache, request) {
  getFullArchive(elastic, TypeMapping.toInternal(request.params.id), function (err, data) {
    if (err) console.log(err);
    cache.set({segment: 'documents', id: TypeMapping.toInternal(request.params.id)}, archiveTree.sortChildren(data), 100000000, (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log(TypeMapping.toInternal(request.params.id) + ' successfully cached');
      }
      cache.stop();
    });
  });
}

function getFullArchive (elastic, id, callback) {
  var fond;
  var data = [];
  elastic.get({index: 'smg', type: 'archive', id: id}, (err, result) => {
    if (err) callback(err);
    if (result._source.level.value === 'fonds') {
      fond = {
        id: id,
        summary_title: result._source.summary_title,
        identifier: result._source.identifier[0].value
      };
    } else {
      fond = {
        id: result._source.fonds[0].admin.uid,
        summary_title: result._source.fonds[0].summary_title
      };
    }
    data.push({id: fond});
    getAllFromArchive(elastic, fond.id, function (err, result) {
      if (err) callback(err);
      callback(null, data.concat(result.map(el => {
        return {
          id: el._source.admin.uid,
          parent: el._source.parent,
          identifier: el._source.identifier[0].value,
          summary_title: el._source.summary_title
        };
      })));
    });
  });
}
